export async function buildExcelReport(rows: Record<string, string | number>[], widths: number[]) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Ticket Report');
  if (rows.length) {
    sheet.columns = Object.keys(rows[0]).map((header, index) => ({ header, key: header, width: widths[index] || 18 }));
    sheet.addRows(rows);
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D3B6E' } };
  }
  return workbook;
}

export async function downloadExcelReport(rows: Record<string, string | number>[], widths: number[], filename: string) {
  const workbook = await buildExcelReport(rows, widths);
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename.replace(/[\\/:*?"<>|]/g, '_');
  document.body.appendChild(link);
  try { link.click(); } finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
