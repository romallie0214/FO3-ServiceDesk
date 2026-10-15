import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CSMResponse {
  id: number;
  ticket_number: string;
  subject: string;
  category: string;
  requestor_name: string;
  requestor_division: string;
  attending_officer: string;
  officer_rating: number;
  rating_promptness: number;
  rating_reliability: number;
  rating_access: number;
  rating_courtesy: number;
  rating_cost: number;
  rating_integrity: number;
  rating_assurance: number;
  rating_outcome: number;
  cc_awareness: string;
  commendation: string;
  suggestion: string;
  submitted_at: string;
}

const DIMENSIONS = [
  { key: 'rating_promptness',  label: 'Promptness'  },
  { key: 'rating_reliability', label: 'Reliability' },
  { key: 'rating_access',      label: 'Access'      },
  { key: 'rating_courtesy',    label: 'Courtesy'    },
  { key: 'rating_cost',        label: 'Cost'        },
  { key: 'rating_integrity',   label: 'Integrity'   },
  { key: 'rating_assurance',   label: 'Assurance'   },
  { key: 'rating_outcome',     label: 'Outcome'     },
];

function avg(responses: CSMResponse[], key: keyof CSMResponse): string {
  if (responses.length === 0) return '0.00';
  const vals = responses.map(r => Number(r[key])).filter(v => v > 0);
  if (vals.length === 0) return '0.00';
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
}

export function exportCSMPDF(responses: CSMResponse[]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-PH');

  // ─── COLOR PALETTE ───
  const NAVY  : [number, number, number] = [13,  59,  110];
  const GREEN : [number, number, number] = [27,  107, 58 ];
  const AMBER : [number, number, number] = [204, 119, 0  ];
  const RED   : [number, number, number] = [139, 26,  26 ];
  const LGRAY : [number, number, number] = [240, 243, 247];
  const DGRAY : [number, number, number] = [74,  74,  74 ];
  const WHITE : [number, number, number] = [255, 255, 255];

  // ══════════════════════════════════════════
  //  PAGE 1 — COVER / SUMMARY
  // ══════════════════════════════════════════

  // Header banner
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 36, 'F');

  // DSWD circle seal
  doc.setFillColor(...WHITE);
  doc.circle(18, 18, 10, 'F');
  doc.setFillColor(...NAVY);
  doc.circle(18, 18, 8, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.text('DSWD', 18, 16.5, { align: 'center' });
  doc.text('PHL',  18, 19.5, { align: 'center' });

  // Header text
  doc.setTextColor(...WHITE);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Department of Social Welfare and Development', 32, 13);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('ICTMS — IT Help Desk & Ticketing System', 32, 19);
  doc.setFontSize(8);
  doc.text('Client Satisfaction Measurement Report  |  DSWD-QMS-GF-005 REV 04', 32, 25);
  doc.text(`Generated: ${dateStr} at ${timeStr}`, 32, 31);

  // Title section
  doc.setFillColor(...LGRAY);
  doc.rect(0, 36, pageW, 20, 'F');
  doc.setTextColor(...NAVY);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('CSM SUMMARY REPORT', pageW / 2, 48, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DGRAY);
  doc.text(
    `Total Responses: ${responses.length}  |  Report Period: All Time`,
    pageW / 2, 54, { align: 'center' }
  );

  // ── SUMMARY STAT BOXES ──
  const avgOfficer  = Number(avg(responses, 'officer_rating'));
  const avgService  = DIMENSIONS.reduce(
    (sum, d) => sum + Number(avg(responses, d.key as keyof CSMResponse)), 0
  ) / DIMENSIONS.length;
  const highSat  = responses.filter(r => r.officer_rating >= 4).length;
  const satRate  = responses.length > 0
    ? Math.round((highSat / responses.length) * 100)
    : 0;

  const boxes = [
    { label: 'Total Responses',    value: String(responses.length),     color: NAVY  },
    { label: 'Avg Officer Rating', value: `${avgOfficer.toFixed(2)} / 5`, color: AMBER },
    { label: 'Avg Service Quality',value: `${avgService.toFixed(2)} / 5`, color: GREEN },
    { label: 'Satisfaction Rate',  value: `${satRate}%`,
      color: satRate >= 75 ? GREEN : AMBER },
  ];

  const boxW = (pageW - 20) / 4;
  boxes.forEach((box, i) => {
    const x = 10 + i * boxW;
    doc.setFillColor(...WHITE);
    doc.roundedRect(x, 62, boxW - 4, 28, 2, 2, 'F');
    doc.setDrawColor(...box.color);
    doc.setLineWidth(0.8);
    doc.line(x, 62, x + boxW - 4, 62);
    doc.setTextColor(...DGRAY);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(box.label.toUpperCase(), x + (boxW - 4) / 2, 70, { align: 'center' });
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...box.color);
    doc.text(box.value, x + (boxW - 4) / 2, 80, { align: 'center' });
  });

  // ── 8 DIMENSIONS — draw real bars ──
  doc.setTextColor(...NAVY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('8 SERVICE QUALITY DIMENSIONS — AVERAGE SCORES', 10, 100);

  const dimStartY  = 105;
  const dimBarMaxW = 110;
  const dimRowH    = 10;

  DIMENSIONS.forEach((d, i) => {
    const score    = Number(avg(responses, d.key as keyof CSMResponse));
    const y        = dimStartY + i * dimRowH;
    const barW     = (score / 5) * dimBarMaxW;
    const barColor: [number, number, number] =
      score >= 4 ? GREEN : score >= 3 ? AMBER : RED;
    const label    = score >= 4 ? 'Satisfied'
      : score >= 3 ? 'Neither'
      : 'Unsatisfied';

    // Dimension label
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DGRAY);
    doc.text(d.label, 10, y + 5);

    // Score number
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...barColor);
    doc.text(`${score.toFixed(2)} / 5`, 58, y + 5);

    // Background track
    doc.setFillColor(220, 225, 232);
    doc.roundedRect(88, y + 1, dimBarMaxW, 5, 1, 1, 'F');

    // Filled bar
    doc.setFillColor(...barColor);
    if (barW > 0) doc.roundedRect(88, y + 1, barW, 5, 1, 1, 'F');

    // Assessment label
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DGRAY);
    doc.setFontSize(7);
    doc.text(label, 202, y + 5);
  });

  // ── OFFICER RATING DISTRIBUTION ──
  const lastY = dimStartY + DIMENSIONS.length * dimRowH + 8;

  doc.setTextColor(...NAVY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('OFFICER RATING DISTRIBUTION', 10, lastY);

  const distLabels: string[] = [
    '1 — Very Unsatisfied',
    '2 — Unsatisfied',
    '3 — Neither',
    '4 — Satisfied',
    '5 — Very Satisfied',
  ];
  const distColors: [number, number, number][] = [RED, AMBER, DGRAY, GREEN, NAVY];
  const distCounts = [1, 2, 3, 4, 5].map(r =>
    responses.filter(res => res.officer_rating === r).length
  );
  const maxCount = Math.max(...distCounts, 1);
  const barMaxW  = pageW - 110;

  distLabels.forEach((label, i) => {
    const y    = lastY + 6 + i * 9;
    const barW = (distCounts[i] / maxCount) * barMaxW;

    doc.setFontSize(7);
    doc.setTextColor(...DGRAY);
    doc.setFont('helvetica', 'normal');
    doc.text(label, 10, y + 3);

    // Track
    doc.setFillColor(220, 225, 232);
    doc.roundedRect(70, y, barMaxW, 5, 1, 1, 'F');

    // Bar
    doc.setFillColor(...distColors[i]);
    if (barW > 0) doc.roundedRect(70, y, barW, 5, 1, 1, 'F');

    // Count label
    doc.setTextColor(...DGRAY);
    doc.text(
      `${distCounts[i]} response${distCounts[i] !== 1 ? 's' : ''}`,
      74 + barMaxW, y + 4
    );
  });

  // ══════════════════════════════════════════
  //  PAGE 2 — FULL RESPONSE TABLE
  // ══════════════════════════════════════════
  doc.addPage();

  // Page 2 header banner
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 20, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('INDIVIDUAL CSM RESPONSES', pageW / 2, 10, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${responses.length} total record(s)  |  ${dateStr}`,
    pageW / 2, 16, { align: 'center' }
  );

  // Main response table
  const tableRows = responses.map(r => {
    const dimAvg = (
      DIMENSIONS.reduce(
        (sum, d) => sum + Number(r[d.key as keyof CSMResponse] ?? 0), 0
      ) / DIMENSIONS.length
    ).toFixed(2);

    return [
      r.ticket_number,
      r.subject?.length > 35
        ? r.subject.substring(0, 35) + '...'
        : (r.subject ?? ''),
      r.requestor_division || '—',
      r.attending_officer  || '—',
      `${r.officer_rating}/5`,
      `${dimAvg}/5`,
      new Date(r.submitted_at).toLocaleDateString('en-PH'),
    ];
  });

  autoTable(doc, {
    startY: 24,
    head: [['Ticket #', 'Subject', 'Division', 'Officer', 'Officer Rtg', 'Svc Avg', 'Date']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: NAVY,
      textColor: WHITE,
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 25, fontStyle: 'bold'  },
      1: { cellWidth: 65                     },
      2: { cellWidth: 45                     },
      3: { cellWidth: 45                     },
      4: { cellWidth: 22, halign: 'center'   },
      5: { cellWidth: 22, halign: 'center'   },
      6: { cellWidth: 28, halign: 'center'   },
    },
    alternateRowStyles: { fillColor: LGRAY   },
    margin: { left: 10, right: 10            },
    didParseCell: (data) => {
      if (data.column.index === 0 && data.section === 'body') {
        data.cell.styles.textColor = NAVY;
      }
      if (data.column.index === 4 && data.section === 'body') {
        const val = parseInt(String(data.cell.text).replace('/5', ''));
        data.cell.styles.textColor =
          val >= 4 ? GREEN : val <= 2 ? RED : DGRAY;
      }
      if (data.column.index === 5 && data.section === 'body') {
        const val = parseFloat(String(data.cell.text).replace('/5', ''));
        data.cell.styles.textColor =
          val >= 4 ? GREEN : val <= 2 ? RED : DGRAY;
      }
    },
  });

  // ══════════════════════════════════════════
  //  PAGE 3 — COMMENDATIONS & SUGGESTIONS
  // ══════════════════════════════════════════
  const withFeedback = responses.filter(r => r.commendation || r.suggestion);

  if (withFeedback.length > 0) {
    doc.addPage();

    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, 20, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('COMMENDATIONS & SUGGESTIONS', pageW / 2, 10, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${withFeedback.length} response(s) with feedback`,
      pageW / 2, 16, { align: 'center' }
    );

    let currentY = 28;
    const halfW  = (pageW - 24) / 2;

    withFeedback.forEach(r => {
      if (currentY > 175) {
        doc.addPage();
        currentY = 15;
      }

      // Entry row header
      doc.setFillColor(...LGRAY);
      doc.roundedRect(10, currentY, pageW - 20, 8, 1, 1, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NAVY);
      doc.text(
        `${r.ticket_number}  —  ${r.subject ?? ''}  |  Officer: ${r.attending_officer || 'N/A'}`,
        14, currentY + 5
      );
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DGRAY);
      doc.text(
        new Date(r.submitted_at).toLocaleDateString('en-PH'),
        pageW - 14, currentY + 5, { align: 'right' }
      );
      currentY += 11;

      const rowStartY = currentY;

      // Commendation box (left)
      if (r.commendation) {
        doc.setFillColor(232, 245, 238);
        doc.roundedRect(10, rowStartY, halfW, 18, 1, 1, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...GREEN);
        doc.text('COMMENDATION', 14, rowStartY + 5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...DGRAY);
        const lines = doc.splitTextToSize(r.commendation, halfW - 8);
        doc.text(lines.slice(0, 2), 14, rowStartY + 10);
      }

      // Suggestion box (right)
      if (r.suggestion) {
        doc.setFillColor(254, 243, 220);
        doc.roundedRect(14 + halfW, rowStartY, halfW, 18, 1, 1, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...AMBER);
        doc.text('SUGGESTION', 18 + halfW, rowStartY + 5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...DGRAY);
        const lines = doc.splitTextToSize(r.suggestion, halfW - 8);
        doc.text(lines.slice(0, 2), 18 + halfW, rowStartY + 10);
      }

      currentY = rowStartY + 22;
    });
  }

  // ── FOOTER on every page ──
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFillColor(...LGRAY);
    doc.rect(0, pageH - 10, pageW, 10, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...DGRAY);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'DSWD ICTMS — Client Satisfaction Measurement Report  |  DSWD-QMS-GF-005 REV 04  |  CONFIDENTIAL',
      pageW / 2, pageH - 4, { align: 'center' }
    );
    doc.text(
      `Page ${p} of ${totalPages}`,
      pageW - 10, pageH - 4, { align: 'right' }
    );
  }

  // ── SAVE FILE ──
  const filename = `DSWD_ICTMS_CSM_Report_${now.toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}