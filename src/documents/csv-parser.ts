/**
 * CSV parser with quoted-field support.
 * Handles standard CSV, TSV, and auto-detects delimiter.
 */

export interface CsvDocument {
  headers: string[];
  rows: string[][];
  rowCount: number;
  delimiter: string;
}

export function parseCsv(content: string, options?: {
  delimiter?: string;
  maxRows?: number;
}): CsvDocument {
  const delimiter = options?.delimiter ?? detectDelimiter(content);
  const maxRows = options?.maxRows ?? 10000;
  const lines = content.split(/\r?\n/);

  if (lines.length === 0 || lines[0].trim().length === 0) {
    return { headers: [], rows: [], rowCount: 0, delimiter };
  }

  const headers = parseRow(lines[0], delimiter);
  const rows: string[][] = [];

  for (let i = 1; i < lines.length && rows.length < maxRows; i++) {
    const line = lines[i].trim();
    if (line.length === 0) continue;
    rows.push(parseRow(line, delimiter));
  }

  return { headers, rows, rowCount: rows.length, delimiter };
}

/**
 * Auto-detect delimiter by checking which one produces consistent column counts.
 */
function detectDelimiter(content: string): string {
  const candidates = [',', '\t', ';', '|'];
  const lines = content.split(/\r?\n/).slice(0, 5).filter(l => l.trim().length > 0);
  if (lines.length < 2) return ',';

  let bestDelimiter = ',';
  let bestScore = -1;

  for (const delim of candidates) {
    const counts = lines.map(l => parseRow(l, delim).length);
    // Score: consistent column count across lines, with more columns preferred
    const allSame = counts.every(c => c === counts[0]);
    const score = allSame ? counts[0] : 0;
    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delim;
    }
  }

  return bestDelimiter;
}

/**
 * Parse a single CSV row, handling quoted fields with escaped quotes.
 */
function parseRow(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}
