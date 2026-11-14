import { parse as parseCsv } from 'csv-parse/sync';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import * as XLSX from 'xlsx';

export interface ExtractedSection {
  pageNumber: number;
  sectionTitle: string;
  text: string;
}

export interface DocumentChunkPayload {
  chunkIndex: number;
  pageNumber: number;
  sectionTitle: string;
  content: string;
  tokenCount: number;
}

export const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'xlsx', 'csv', 'txt']);
export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export function validateUploadedFile(fileName: string, fileSize: number): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported file type '.${ext}'. Supported formats: PDF, DOCX, XLSX, CSV, TXT.`);
  }
  if (fileSize <= 0 || fileSize > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size must be between 1 byte and 15 MB.`);
  }
  return ext;
}

export function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractDocumentSections(
  buffer: Buffer,
  ext: string,
  fileName: string
): Promise<{ sections: ExtractedSection[]; pageCount: number }> {
  if (ext === 'pdf') {
    const parser = new PDFParse({ data: buffer });
    try {
      const textResult = await parser.getText();
      const pages = textResult.pages || [];
      const sections: ExtractedSection[] = pages
        .map((p) => ({
          pageNumber: p.num,
          sectionTitle: `Page ${p.num}`,
          text: cleanText(p.text || ''),
        }))
        .filter((s) => s.text.length > 0);

      if (sections.length === 0 && textResult.text) {
        sections.push({
          pageNumber: 1,
          sectionTitle: 'Document Body',
          text: cleanText(textResult.text),
        });
      }
      return { sections, pageCount: Math.max(textResult.total || sections.length, 1) };
    } finally {
      await parser.destroy();
    }
  }

  if (ext === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    const cleaned = cleanText(result.value || '');
    const paragraphs = cleaned.split(/\n\n+/).filter((p) => p.trim().length > 0);
    // Group into logical sections of ~1500 chars
    const sections: ExtractedSection[] = [];
    let current = '';
    let secIdx = 1;
    for (const para of paragraphs) {
      if ((current + '\n\n' + para).length > 1800 && current.length > 0) {
        sections.push({ pageNumber: secIdx, sectionTitle: `Section ${secIdx}`, text: current.trim() });
        secIdx++;
        current = para;
      } else {
        current = current ? `${current}\n\n${para}` : para;
      }
    }
    if (current.trim()) {
      sections.push({ pageNumber: secIdx, sectionTitle: `Section ${secIdx}`, text: current.trim() });
    }
    return { sections, pageCount: Math.max(sections.length, 1) };
  }

  if (ext === 'xlsx') {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sections: ExtractedSection[] = [];
    workbook.SheetNames.forEach((sheetName, idx) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      if (rows.length === 0) return;
      const lines = rows.map((row, rIdx) =>
        `Row ${rIdx + 1}: ` +
        Object.entries(row)
          .filter(([, v]) => String(v).trim() !== '')
          .map(([k, v]) => `${k}=${String(v).trim()}`)
          .join(' | ')
      );
      sections.push({
        pageNumber: idx + 1,
        sectionTitle: `Sheet: ${sheetName}`,
        text: cleanText(lines.join('\n')),
      });
    });
    return { sections, pageCount: Math.max(sections.length, 1) };
  }

  if (ext === 'csv') {
    const records = parseCsv(buffer.toString('utf-8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];
    const lines = records.map(
      (row, idx) =>
        `Row ${idx + 1}: ` +
        Object.entries(row)
          .filter(([, v]) => String(v).trim() !== '')
          .map(([k, v]) => `${k}=${String(v).trim()}`)
          .join(' | ')
    );
    return {
      sections: [
        {
          pageNumber: 1,
          sectionTitle: `CSV Table (${fileName})`,
          text: cleanText(lines.join('\n')),
        },
      ],
      pageCount: 1,
    };
  }

  // txt
  const text = cleanText(buffer.toString('utf-8'));
  return {
    sections: [
      {
        pageNumber: 1,
        sectionTitle: 'Plain Text Document',
        text,
      },
    ],
    pageCount: 1,
  };
}

export function chunkSections(
  sections: ExtractedSection[],
  maxChars = 1100,
  overlapChars = 150
): DocumentChunkPayload[] {
  const chunks: DocumentChunkPayload[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const text = section.text;
    if (!text) continue;

    if (text.length <= maxChars) {
      chunks.push({
        chunkIndex: chunkIndex++,
        pageNumber: section.pageNumber,
        sectionTitle: section.sectionTitle,
        content: text,
        tokenCount: Math.ceil(text.split(/\s+/).length * 1.3),
      });
      continue;
    }

    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + maxChars, text.length);
      const slice = text.slice(start, end).trim();
      if (slice.length > 0) {
        chunks.push({
          chunkIndex: chunkIndex++,
          pageNumber: section.pageNumber,
          sectionTitle: section.sectionTitle,
          content: slice,
          tokenCount: Math.ceil(slice.split(/\s+/).length * 1.3),
        });
      }
      if (end >= text.length) break;
      start = Math.max(0, end - overlapChars);
    }
  }

  return chunks;
}
