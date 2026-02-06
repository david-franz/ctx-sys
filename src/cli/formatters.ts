/**
 * F10.7: CLI output formatters.
 */

/**
 * Truncate a string to a maximum length.
 */
export function truncate(text: string | undefined, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format a date for display.
 */
export function formatDate(date: unknown): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date instanceof Date ? date : new Date();
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Column definition for table formatting.
 */
export interface ColumnDef {
  header: string;
  key: string;
  width?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  format?: (value: unknown, row: any) => string;
}

/**
 * Format data as a simple table.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatTable(data: any[], columns: ColumnDef[]): string {
  const lines: string[] = [];

  // Calculate column widths
  const widths = columns.map(col => {
    const maxDataWidth = data.reduce((max, row) => {
      const value = getNestedValue(row, col.key);
      const formatted = col.format ? col.format(value, row) : String(value ?? '');
      return Math.max(max, formatted.length);
    }, 0);
    return col.width || Math.max(col.header.length, Math.min(maxDataWidth, 50));
  });

  // Header
  const header = columns.map((col, i) => col.header.padEnd(widths[i])).join('  ');
  lines.push(header);
  lines.push('-'.repeat(header.length));

  // Rows
  for (const row of data) {
    const cells = columns.map((col, i) => {
      const value = getNestedValue(row, col.key);
      const formatted = col.format ? col.format(value, row) : String(value ?? '-');
      return truncate(formatted, widths[i]).padEnd(widths[i]);
    });
    lines.push(cells.join('  '));
  }

  return lines.join('\n');
}

/**
 * Get a nested value from an object using dot notation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNestedValue(obj: any, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Format a number with locale-specific thousands separators.
 */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}

/**
 * Format bytes as human-readable size.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Print a colored status indicator.
 */
export function statusColor(ok: boolean): string {
  return ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
}

/**
 * Print text in a specific color.
 */
export function color(text: string, colorCode: string): string {
  return `\x1b[${colorCode}m${text}\x1b[0m`;
}

export const colors = {
  bold: (t: string) => color(t, '1'),
  dim: (t: string) => color(t, '90'),
  cyan: (t: string) => color(t, '36'),
  green: (t: string) => color(t, '32'),
  yellow: (t: string) => color(t, '33'),
  red: (t: string) => color(t, '31')
};
