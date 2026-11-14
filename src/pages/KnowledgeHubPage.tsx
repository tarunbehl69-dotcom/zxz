import React, { useEffect, useState } from 'react';
import { FileText, Search, Trash2, Upload } from 'lucide-react';
import { useToast } from '../components/Shell';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import type { DocumentRecord } from '../types';

interface SearchResultChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  fileName: string;
  pageNumber: number;
  sectionTitle: string;
  content: string;
  similarity: number;
}

export function KnowledgeHubPage() {
  const { hasPermission } = useAuth();
  const { addToast } = useToast();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Upload metadata
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Market Research');
  const [productCategory, setProductCategory] = useState('All Categories');
  const [region, setRegion] = useState('All India');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Semantic Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultChunk[] | null>(null);

  // Document filter
  const [filterCategory, setFilterCategory] = useState('All');

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ documents: DocumentRecord[] }>('/api/documents');
      setDocuments(res.documents);
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to load documents', message: err instanceof Error ? err.message : '' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      addToast({ type: 'error', title: 'File Required', message: 'Select a PDF, DOCX, XLSX, CSV, or TXT file.' });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', title || selectedFile.name.replace(/\.[^.]+$/, ''));
      formData.append('category', category);
      formData.append('productCategory', productCategory);
      formData.append('region', region);

      const res = await apiRequest<{ document: DocumentRecord }>('/api/documents/upload', {
        method: 'POST',
        body: formData,
        isFormData: true,
      });

      addToast({
        type: 'success',
        title: 'Document Indexed',
        message: `${res.document.fileName} processed into ${res.document.chunkCount} semantic chunks.`,
      });
      setTitle('');
      setSelectedFile(null);
      await loadDocuments();
    } catch (err) {
      addToast({ type: 'error', title: 'Upload Failed', message: err instanceof Error ? err.message : '' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: DocumentRecord) => {
    try {
      await apiRequest(`/api/documents/${doc.id}`, { method: 'DELETE' });
      addToast({ type: 'info', title: 'Document Removed', message: doc.fileName });
      await loadDocuments();
    } catch (err) {
      addToast({ type: 'error', title: 'Delete Failed', message: err instanceof Error ? err.message : '' });
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    try {
      const res = await apiRequest<{ results: SearchResultChunk[] }>('/api/knowledge/search', {
        method: 'POST',
        body: { query: searchQuery, limit: 6 },
      });
      setSearchResults(res.results);
    } catch (err) {
      addToast({ type: 'error', title: 'Search Failed', message: err instanceof Error ? err.message : '' });
    } finally {
      setSearching(false);
    }
  };

  const visibleDocs = documents.filter((d) => filterCategory === 'All' || d.category === filterCategory);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#173650]">Knowledge Hub & RAG Document Intelligence</h1>
        <p className="text-sm text-slate-600">
          Ingest PDF, DOCX, XLSX, CSV, and TXT market documents into pgvector with page-level and section-level citation tracking.
        </p>
      </div>

      {/* Upload Pipeline Form */}
      {hasPermission('knowledge:write') && (
        <form onSubmit={handleUpload} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h2 className="text-base font-semibold text-[#173650]">Upload & Index Document</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document Title (optional)"
              className="px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-md bg-white">
              <option>Market Research</option>
              <option>Competitor Filing</option>
              <option>Customer Survey</option>
              <option>Internal Brief</option>
              <option>Regulatory</option>
            </select>
            <select value={productCategory} onChange={(e) => setProductCategory(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-md bg-white">
              <option>All Categories</option>
              <option>Writing & Printing Paper</option>
              <option>Office & Copier Paper</option>
              <option>Coated Paper</option>
              <option>Packaging Boards</option>
              <option>Specialty Paper</option>
            </select>
            <select value={region} onChange={(e) => setRegion(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-md bg-white">
              <option>All India</option>
              <option>West</option>
              <option>North</option>
              <option>South</option>
              <option>East</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="flex items-center gap-2 px-3.5 py-2 rounded-md border border-dashed border-slate-300 bg-[#F8FAFC] text-xs text-slate-700 cursor-pointer hover:border-[#249B91]">
              <Upload className="w-4 h-4 text-[#173650]" />
              <span>{selectedFile ? `${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)` : 'Choose PDF, DOCX, XLSX, CSV, or TXT file (max 15 MB)'}</span>
              <input
                type="file"
                accept=".pdf,.docx,.xlsx,.csv,.txt"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>

            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="px-5 py-2 rounded-md bg-[#249B91] hover:bg-[#1E857C] disabled:opacity-50 text-white text-xs font-medium cursor-pointer whitespace-nowrap"
            >
              {uploading ? 'Extracting & Embedding...' : 'Upload & Index'}
            </button>
          </div>
        </form>
      )}

      {/* Semantic Vector Search Tester */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Semantic RAG search across indexed documents (e.g., PFAS-free barrier board demand in pharma)..."
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-md"
          />
          <button
            type="submit"
            disabled={searching}
            className="px-4 py-2 rounded-md bg-[#173650] hover:bg-[#1E4566] text-white text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{searching ? 'Searching...' : 'Search Knowledge'}</span>
          </button>
        </form>

        {searchResults && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Top {searchResults.length} retrieved semantic excerpts</span>
              <button type="button" onClick={() => setSearchResults(null)} className="text-[#4A89B8] hover:underline cursor-pointer">
                Clear Results
              </button>
            </div>
            {searchResults.length === 0 ? (
              <p className="text-xs text-slate-500">No matching excerpts found. Upload relevant documents first.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {searchResults.map((chunk) => (
                  <div key={chunk.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#173650]">
                        {chunk.documentTitle} ({chunk.fileName}) · {chunk.sectionTitle} · Page {chunk.pageNumber}
                      </span>
                      <span className="font-mono text-[#249B91]">Similarity: {(chunk.similarity * 100).toFixed(1)}%</span>
                    </div>
                    <p className="text-xs text-slate-700 mt-1.5 leading-relaxed">{chunk.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Document Library Table */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-[#173650]">Document Library ({visibleDocs.length})</h2>
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-md">
            {['All', 'Market Research', 'Competitor Filing', 'Customer Survey', 'Internal Brief'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                className={`px-2.5 py-1 text-xs font-medium rounded cursor-pointer ${
                  filterCategory === cat ? 'bg-white text-[#173650] shadow-xs' : 'text-slate-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="h-32 animate-pulse bg-slate-50 rounded" />
        ) : visibleDocs.length === 0 ? (
          <div className="py-10 text-center">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-[#173650]">No documents indexed yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Upload a PDF market report, Excel survey sheet, or DOCX competitor brief above to enable RAG citations.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-medium">Document</th>
                  <th className="py-2 pr-3 font-medium">Category · Scope</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium text-right">Pages / Chunks</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/70">
                    <td className="py-3 pr-3 align-top">
                      <div className="font-semibold text-[#173650]">{doc.title}</div>
                      <div className="text-[11px] text-slate-500">
                        {doc.fileName} · {doc.fileType.toUpperCase()} · {Math.round(doc.fileSize / 1024)} KB
                      </div>
                      {doc.rawSummary && <p className="text-[11px] text-slate-600 mt-1 max-w-xl">{doc.rawSummary}</p>}
                    </td>
                    <td className="py-3 pr-3 align-top text-slate-700 whitespace-nowrap">
                      <div>{doc.category}</div>
                      <div className="text-[11px] text-slate-500">{doc.productCategory} · {doc.region}</div>
                    </td>
                    <td className="py-3 pr-3 align-top whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          doc.status === 'indexed'
                            ? 'text-[#249B91]'
                            : doc.status === 'failed'
                              ? 'text-red-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="py-3 pr-3 align-top text-right font-mono tabular-nums text-slate-700">
                      {doc.pageCount}p / {doc.chunkCount}c
                    </td>
                    <td className="py-3 align-top text-right">
                      {hasPermission('knowledge:delete') && (
                        <button
                          type="button"
                          onClick={() => handleDelete(doc)}
                          title="Delete document"
                          className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
