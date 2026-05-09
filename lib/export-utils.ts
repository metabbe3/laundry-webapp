import * as XLSX from "xlsx";

export function exportToCsv(data: Record<string, unknown>[], filename: string, headers?: Record<string, string>) {
  if (data.length === 0) return;
  const keys = Object.keys(data[0]);
  const headerRow = keys.map((k) => headers?.[k] ?? k).join(",");
  const rows = data.map((row) =>
    keys.map((k) => {
      const val = row[k];
      const str = String(val ?? "");
      return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(",")
  );
  const csv = [headerRow, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename);
}

export function exportToXls(data: Record<string, unknown>[], filename: string, sheetName = "Report", headers?: Record<string, string>) {
  if (data.length === 0) return;
  const keys = Object.keys(data[0]);
  const headerRow: Record<string, string> = {};
  keys.forEach((k) => { headerRow[k] = headers?.[k] ?? k; });
  const displayData = [headerRow, ...data];
  const ws = XLSX.utils.json_to_sheet(displayData, { skipHeader: true });
  ws["!cols"] = keys.map((k) => ({ wch: Math.max((headers?.[k] ?? k).length, 12) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

export function exportToPdf(type: string, from: string, to: string) {
  window.open(`/api/reports/export?type=${type}&from=${from}&to=${to}`, "_blank");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
