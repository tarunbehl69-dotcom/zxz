import { Router } from 'express';
import { desc, eq, sql } from 'drizzle-orm';
import multer from 'multer';
import { db } from '../db/index.ts';
import { documentChunks, documents } from '../db/schema.ts';
import { createNotification, logAudit } from '../db/users.ts';
import {
  chunkSections,
  extractDocumentSections,
  validateUploadedFile,
} from '../lib/document-parser.ts';
import {
  ai,
  assertGeminiConfigured,
  generateEmbedding,
  SYSTEM_SECURITY_GUARDRAIL,
  Type,
} from '../lib/gemini.ts';
import { type AuthRequest, requireAuth, requirePermission } from '../middleware/auth.ts';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

export interface RetrievedChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  fileName: string;
  pageNumber: number;
  sectionTitle: string;
  content: string;
  similarity: number;
}

export async function retrieveRelevantChunks(
  queryText: string,
  limit = 6,
  filters?: { productCategory?: string; region?: string; industry?: string }
): Promise<RetrievedChunk[]> {
  try {
    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await generateEmbedding(queryText);
    } catch (err) {
      console.warn('Embedding query fallback to keyword search:', err);
    }

    if (queryEmbedding) {
      const vectorLiteral = `[${queryEmbedding.join(',')}]`;
      const result = await db.execute(sql`
        SELECT
          dc.id,
          dc.document_id AS "documentId",
          d.title AS "documentTitle",
          d.file_name AS "fileName",
          dc.page_number AS "pageNumber",
          dc.section_title AS "sectionTitle",
          dc.content,
          ROUND((1 - (dc.embedding <=> ${vectorLiteral}::vector))::numeric, 4)::float AS similarity
        FROM document_chunks dc
        INNER JOIN documents d ON d.id = dc.document_id
        WHERE d.status = 'indexed'
          AND dc.embedding IS NOT NULL
        ORDER BY dc.embedding <=> ${vectorLiteral}::vector ASC
        LIMIT ${limit * 2}
      `);

      let rows = (result.rows || []) as unknown as RetrievedChunk[];
      if (filters?.productCategory && filters.productCategory !== 'All Categories') {
        const filtered = rows.filter((r) =>
          r.content.toLowerCase().includes(filters.productCategory!.toLowerCase().split(' ')[0])
        );
        if (filtered.length > 0) rows = filtered;
      }
      if (rows.length > 0) return rows.slice(0, limit);
    }

    // Keyword fallback if no embeddings exist yet
    const keywords = queryText
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 4);

    if (keywords.length === 0) return [];
    const likePattern = `%${keywords[0]}%`;
    const fallback = await db.execute(sql`
      SELECT
        dc.id,
        dc.document_id AS "documentId",
        d.title AS "documentTitle",
        d.file_name AS "fileName",
        dc.page_number AS "pageNumber",
        dc.section_title AS "sectionTitle",
        dc.content,
        0.55::float AS similarity
      FROM document_chunks dc
      INNER JOIN documents d ON d.id = dc.document_id
      WHERE d.status = 'indexed'
        AND dc.content ILIKE ${likePattern}
      LIMIT ${limit}
    `);
    return (fallback.rows || []) as unknown as RetrievedChunk[];
  } catch (err) {
    console.error('Vector retrieval error:', err);
    return [];
  }
}

async function processAndIndexDocument(docId: string, buffer: Buffer, ext: string, fileName: string) {
  const { sections, pageCount } = await extractDocumentSections(buffer, ext, fileName);
  const chunks = chunkSections(sections);

  if (chunks.length === 0) {
    throw new Error('No readable text content could be extracted from the uploaded file.');
  }

  // Generate embeddings for chunks (cap batch gracefully for large docs)
  const chunkRows: Array<typeof documentChunks.$inferInsert> = [];
  for (const chunk of chunks) {
    let embedding: number[] | null = null;
    try {
      if (process.env.GEMINI_API_KEY) {
        embedding = await generateEmbedding(chunk.content);
      }
    } catch (err) {
      console.warn(`Embedding failed for chunk ${chunk.chunkIndex}:`, err);
    }
    chunkRows.push({
      documentId: docId,
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber,
      sectionTitle: chunk.sectionTitle,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      embedding,
    });
  }

  await db.delete(documentChunks).where(eq(documentChunks.documentId, docId));
  await db.insert(documentChunks).values(chunkRows);

  // Extract structured executive summary & key facts via Gemini
  let rawSummary = `Extracted ${chunks.length} indexed chunks across ${pageCount} page(s)/section(s).`;
  let extractedFacts: string[] = [];

  if (process.env.GEMINI_API_KEY) {
    try {
      assertGeminiConfigured();
      const sampleText = chunks
        .slice(0, 8)
        .map((c) => `[Page/Section ${c.pageNumber} - ${c.sectionTitle}]\n${c.content}`)
        .join('\n\n');

      const resp = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Analyze the following extracted document excerpts from "${fileName}". Provide a concise 2-3 sentence factual summary and 4-6 bulleted key facts strictly present in the text.\n\nEXCERPTS:\n${sampleText}`,
        config: {
          systemInstruction: SYSTEM_SECURITY_GUARDRAIL,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              facts: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['summary', 'facts'],
          },
        },
      });
      const parsed = JSON.parse((resp.text || '{}').trim());
      if (parsed.summary) rawSummary = parsed.summary;
      if (Array.isArray(parsed.facts)) extractedFacts = parsed.facts;
    } catch (err) {
      console.warn('Document summary generation skipped:', err);
    }
  }

  const [updated] = await db
    .update(documents)
    .set({
      status: 'indexed',
      pageCount,
      chunkCount: chunkRows.length,
      rawSummary,
      extractedFacts,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, docId))
    .returning();

  return updated;
}

export const knowledgeRouter = Router();

knowledgeRouter.get('/documents', requireAuth, requirePermission('knowledge:read'), async (_req, res) => {
  try {
    const docs = await db.select().from(documents).orderBy(desc(documents.createdAt));
    res.json({ documents: docs });
  } catch (error) {
    console.error('Failed to list documents:', error);
    res.status(500).json({ error: 'Failed to retrieve documents.' });
  }
});

knowledgeRouter.get('/documents/:id/chunks', requireAuth, requirePermission('knowledge:read'), async (req, res) => {
  try {
    const docId = String(req.params.id);
    const chunks = await db
      .select({
        id: documentChunks.id,
        chunkIndex: documentChunks.chunkIndex,
        pageNumber: documentChunks.pageNumber,
        sectionTitle: documentChunks.sectionTitle,
        content: documentChunks.content,
        tokenCount: documentChunks.tokenCount,
      })
      .from(documentChunks)
      .where(eq(documentChunks.documentId, docId))
      .orderBy(documentChunks.chunkIndex);
    res.json({ chunks });
  } catch (error) {
    console.error('Failed to list chunks:', error);
    res.status(500).json({ error: 'Failed to retrieve document chunks.' });
  }
});

knowledgeRouter.post(
  '/documents/upload',
  requireAuth,
  requirePermission('knowledge:write'),
  upload.single('file'),
  async (req: AuthRequest, res) => {
    let createdDocId: string | null = null;
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'Please select a file to upload (PDF, DOCX, XLSX, CSV, or TXT).' });
        return;
      }

      const ext = validateUploadedFile(file.originalname, file.size);
      const title = (req.body.title as string)?.trim() || file.originalname.replace(/\.[^.]+$/, '');
      const category = (req.body.category as string)?.trim() || 'Market Research';
      const productCategory = (req.body.productCategory as string)?.trim() || 'All Categories';
      const region = (req.body.region as string)?.trim() || 'All India';
      const industry = (req.body.industry as string)?.trim() || 'All Industries';

      const [doc] = await db
        .insert(documents)
        .values({
          title,
          fileName: file.originalname,
          fileType: ext,
          fileSize: file.size,
          category,
          productCategory,
          region,
          industry,
          status: 'processing',
          uploadedBy: req.user?.id ?? null,
        })
        .returning();

      createdDocId = doc.id;

      const indexed = await processAndIndexDocument(doc.id, file.buffer, ext, file.originalname);

      await logAudit({
        userId: req.user?.id,
        userEmail: req.user?.email || 'unknown',
        action: 'DOCUMENT_UPLOADED',
        entityType: 'document',
        entityId: doc.id,
        details: { fileName: file.originalname, fileType: ext, chunkCount: indexed.chunkCount },
      });

      await createNotification({
        userId: req.user?.id,
        title: 'Document Indexed in Knowledge Hub',
        message: `"${indexed.title}" (${indexed.chunkCount} chunks across ${indexed.pageCount} pages) is ready for RAG search.`,
        type: 'success',
        module: 'Knowledge Hub',
      });

      res.status(201).json({ document: indexed });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Document processing failed.';
      if (createdDocId) {
        await db
          .update(documents)
          .set({ status: 'failed', errorMessage: message, updatedAt: new Date() })
          .where(eq(documents.id, createdDocId));
      }
      console.error('Upload error:', error);
      res.status(400).json({ error: message });
    }
  }
);

knowledgeRouter.delete('/documents/:id', requireAuth, requirePermission('knowledge:delete'), async (req: AuthRequest, res) => {
  try {
    const docId = String(req.params.id);
    const [deleted] = await db.delete(documents).where(eq(documents.id, docId)).returning();
    if (!deleted) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }
    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email || 'unknown',
      action: 'DOCUMENT_DELETED',
      entityType: 'document',
      entityId: deleted.id,
      details: { fileName: deleted.fileName },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document.' });
  }
});

knowledgeRouter.post('/knowledge/search', requireAuth, requirePermission('knowledge:read'), async (req, res) => {
  try {
    const { query, limit = 6 } = req.body as { query?: string; limit?: number };
    if (!query || query.trim().length < 2) {
      res.status(400).json({ error: 'Search query must be at least 2 characters.' });
      return;
    }
    const results = await retrieveRelevantChunks(query.trim(), Math.min(Number(limit) || 6, 15));
    res.json({ results });
  } catch (error) {
    console.error('Semantic search error:', error);
    res.status(500).json({ error: 'Failed to perform semantic search.' });
  }
});
