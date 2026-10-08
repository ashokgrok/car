/**
 * Client-Side CSV Export Utility
 * Converts arrays of structured objects into formatted CSV files and triggers browser download.
 */

export function exportToCsv<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns?: { key: keyof T | string; label: string; formatter?: (val: any, row: T) => string }[]
) {
  if (!data || data.length === 0) {
    alert('No data available to export.');
    return;
  }

  let headers: string[];
  let rows: string[][];

  if (columns && columns.length > 0) {
    headers = columns.map(c => `"${c.label.replace(/"/g, '""')}"`);
    rows = data.map(row => {
      return columns.map(col => {
        let val: any;
        if (typeof col.key === 'string' && col.key.includes('.')) {
          // Nested path like caseItem.case_number
          val = col.key.split('.').reduce((obj, k) => (obj ? obj[k] : undefined), row);
        } else {
          val = row[col.key as keyof T];
        }

        if (col.formatter) {
          val = col.formatter(val, row);
        }

        const strVal = val === null || val === undefined ? '' : String(val);
        return `"${strVal.replace(/"/g, '""')}"`;
      });
    });
  } else {
    // Infer headers from keys
    const keys = Object.keys(data[0]);
    headers = keys.map(k => `"${k.replace(/"/g, '""')}"`);
    rows = data.map(row => {
      return keys.map(k => {
        const val = row[k];
        const strVal = val === null || val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val);
        return `"${strVal.replace(/"/g, '""')}"`;
      });
    });
  }

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const finalFilename = filename.endsWith('.csv')
    ? filename.replace('.csv', `_${timestamp}.csv`)
    : `${filename}_${timestamp}.csv`;

  link.setAttribute('href', url);
  link.setAttribute('download', finalFilename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
