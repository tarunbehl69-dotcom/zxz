import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PptxGenJS from 'pptxgenjs';
import * as XLSX from 'xlsx';
import type { ReportRecord } from '../types';

export function exportReportToPdf(report: ReportRecord) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 48;

  // Header band
  doc.setFillColor(23, 54, 80); // #173650
  doc.rect(0, 0, pageWidth, 64, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text('PaperPulse AI — Marketing Intelligence', 40, 30);
  doc.setFontSize(10);
  doc.text(`${report.category} · Generated ${new Date(report.createdAt).toLocaleDateString()}`, 40, 48);

  y = 92;
  doc.setTextColor(23, 54, 80);
  doc.setFontSize(16);
  const titleLines = doc.splitTextToSize(report.title, pageWidth - 80);
  doc.text(titleLines, 40, y);
  y += titleLines.length * 20 + 10;

  const addSection = (heading: string, body: string | string[]) => {
    if (y > 740) {
      doc.addPage();
      y = 48;
    }
    doc.setFontSize(11);
    doc.setTextColor(36, 155, 145); // #249B91
    doc.text(heading, 40, y);
    y += 16;
    doc.setFontSize(10);
    doc.setTextColor(26, 37, 48);
    if (Array.isArray(body)) {
      for (const item of body) {
        const lines = doc.splitTextToSize(`• ${item}`, pageWidth - 88);
        if (y + lines.length * 14 > 780) {
          doc.addPage();
          y = 48;
        }
        doc.text(lines, 46, y);
        y += lines.length * 14 + 4;
      }
    } else {
      const lines = doc.splitTextToSize(body || 'N/A', pageWidth - 80);
      for (const line of lines) {
        if (y > 780) {
          doc.addPage();
          y = 48;
        }
        doc.text(line, 40, y);
        y += 14;
      }
    }
    y += 10;
  };

  addSection('1. Executive Summary', report.executiveSummary);
  addSection('2. Objective', report.objective);
  addSection('3. Methodology', report.methodology);
  addSection('4. Data Sources', report.dataSources);
  addSection('5. Analysis', report.analysis);

  if (report.chartData && report.chartData.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Metric / Segment', 'Value', 'Unit']],
      body: report.chartData.map((d) => [d.label, String(d.value), d.unit || '-']),
      headStyles: { fillColor: [23, 54, 80] },
      margin: { left: 40, right: 40 },
    });
    const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
    y = (lastTable?.finalY ?? y) + 20;
  }

  addSection('6. Key Findings', report.keyFindings);
  addSection('7. Strategic Recommendations', report.recommendations);
  addSection('8. Explicit Assumptions', report.assumptions);
  addSection('9. Limitations', report.limitations);

  doc.save(`${report.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.pdf`);
}

export function exportReportToExcel(report: ReportRecord) {
  const wb = XLSX.utils.book_new();

  const summaryRows = [
    ['Field', 'Content'],
    ['Title', report.title],
    ['Category', report.category],
    ['Generated At', new Date(report.createdAt).toLocaleString()],
    ['Executive Summary', report.executiveSummary],
    ['Objective', report.objective],
    ['Methodology', report.methodology],
    ['Analysis', report.analysis],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Report Summary');

  const findingsRows = [
    ['Section', 'Item'],
    ...report.dataSources.map((s) => ['Data Source', s]),
    ...report.keyFindings.map((f) => ['Key Finding', f]),
    ...report.recommendations.map((r) => ['Recommendation', r]),
    ...report.assumptions.map((a) => ['Assumption', a]),
    ...report.limitations.map((l) => ['Limitation', l]),
  ];
  const wsDetails = XLSX.utils.aoa_to_sheet(findingsRows);
  XLSX.utils.book_append_sheet(wb, wsDetails, 'Findings & Governance');

  if (report.chartData && report.chartData.length > 0) {
    const wsMetrics = XLSX.utils.json_to_sheet(report.chartData);
    XLSX.utils.book_append_sheet(wb, wsMetrics, 'Quantitative Metrics');
  }

  XLSX.writeFile(wb, `${report.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.xlsx`);
}

export async function exportReportToPptx(report: ReportRecord) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';

  // Slide 1: Cover
  const slide1 = pptx.addSlide();
  slide1.background = { color: '173650' };
  slide1.addText('PaperPulse AI · Paper & Packaging Intelligence', {
    x: 0.7,
    y: 0.8,
    w: 11.5,
    h: 0.5,
    fontSize: 14,
    color: '249B91',
    bold: true,
  });
  slide1.addText(report.title, {
    x: 0.7,
    y: 1.6,
    w: 11.5,
    h: 1.5,
    fontSize: 30,
    color: 'FFFFFF',
    bold: true,
  });
  slide1.addText(`${report.category}  |  ${new Date(report.createdAt).toLocaleDateString()}`, {
    x: 0.7,
    y: 3.5,
    w: 11.5,
    h: 0.5,
    fontSize: 14,
    color: 'CBD5E1',
  });

  // Slide 2: Executive Summary & Objective
  const slide2 = pptx.addSlide();
  slide2.addText('Executive Summary & Methodology', {
    x: 0.6,
    y: 0.4,
    w: 12,
    h: 0.6,
    fontSize: 22,
    color: '173650',
    bold: true,
  });
  slide2.addText(
    `Executive Summary:\n${report.executiveSummary}\n\nObjective:\n${report.objective}\n\nMethodology:\n${report.methodology}`,
    { x: 0.6, y: 1.2, w: 12, h: 5.5, fontSize: 13, color: '1A2530', valign: 'top' }
  );

  // Slide 3: Analysis & Quantitative Metrics
  const slide3 = pptx.addSlide();
  slide3.addText('Analysis & Quantitative Evidence', {
    x: 0.6,
    y: 0.4,
    w: 12,
    h: 0.6,
    fontSize: 22,
    color: '173650',
    bold: true,
  });
  slide3.addText(report.analysis, {
    x: 0.6,
    y: 1.1,
    w: 6.5,
    h: 5.6,
    fontSize: 12,
    color: '1A2530',
    valign: 'top',
  });
  if (report.chartData && report.chartData.length > 0) {
    const rows = [
      [{ text: 'Metric' }, { text: 'Value' }, { text: 'Unit' }],
      ...report.chartData.map((d) => [
        { text: d.label },
        { text: String(d.value) },
        { text: d.unit || '-' },
      ]),
    ];
    slide3.addTable(rows, {
      x: 7.4,
      y: 1.1,
      w: 5.3,
      fontSize: 11,
      border: { pt: 1, color: 'CBD5E1' },
    });
  }

  // Slide 4: Key Findings & Recommendations
  const slide4 = pptx.addSlide();
  slide4.addText('Key Findings & Strategic Recommendations', {
    x: 0.6,
    y: 0.4,
    w: 12,
    h: 0.6,
    fontSize: 22,
    color: '173650',
    bold: true,
  });
  slide4.addText(
    `Key Findings:\n${report.keyFindings.map((f) => `• ${f}`).join('\n')}\n\nRecommendations:\n${report.recommendations.map((r) => `• ${r}`).join('\n')}`,
    { x: 0.6, y: 1.2, w: 12, h: 5.6, fontSize: 12, color: '1A2530', valign: 'top' }
  );

  // Slide 5: Data Sources, Assumptions & Limitations
  const slide5 = pptx.addSlide();
  slide5.addText('Data Governance: Sources, Assumptions & Limitations', {
    x: 0.6,
    y: 0.4,
    w: 12,
    h: 0.6,
    fontSize: 22,
    color: '173650',
    bold: true,
  });
  slide5.addText(
    `Data Sources:\n${report.dataSources.map((d) => `• ${d}`).join('\n')}\n\nAssumptions:\n${report.assumptions.map((a) => `• ${a}`).join('\n')}\n\nLimitations:\n${report.limitations.map((l) => `• ${l}`).join('\n')}`,
    { x: 0.6, y: 1.2, w: 12, h: 5.6, fontSize: 12, color: '1A2530', valign: 'top' }
  );

  await pptx.writeFile({
    fileName: `${report.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.pptx`,
  });
}
