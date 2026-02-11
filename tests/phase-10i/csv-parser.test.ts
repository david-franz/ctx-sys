/**
 * Tests for CSV parser.
 */

import { parseCsv } from '../../src/documents/csv-parser';

describe('CSV Parser', () => {
  it('should parse standard CSV', () => {
    const csv = parseCsv('name,age,city\nAlice,30,NYC\nBob,25,LA');
    expect(csv.headers).toEqual(['name', 'age', 'city']);
    expect(csv.rows).toHaveLength(2);
    expect(csv.rows[0]).toEqual(['Alice', '30', 'NYC']);
    expect(csv.rows[1]).toEqual(['Bob', '25', 'LA']);
    expect(csv.rowCount).toBe(2);
  });

  it('should handle quoted fields with commas', () => {
    const csv = parseCsv('name,address\nAlice,"123 Main St, Apt 4"\nBob,"456 Oak Ave"');
    expect(csv.rows[0]).toEqual(['Alice', '123 Main St, Apt 4']);
  });

  it('should handle escaped quotes', () => {
    const csv = parseCsv('name,quote\nAlice,"She said ""hello"""\nBob,"test"');
    expect(csv.rows[0]).toEqual(['Alice', 'She said "hello"']);
  });

  it('should skip empty rows', () => {
    const csv = parseCsv('a,b\n1,2\n\n3,4\n');
    expect(csv.rows).toHaveLength(2);
  });

  it('should auto-detect tab delimiter', () => {
    const csv = parseCsv('name\tage\nAlice\t30\nBob\t25');
    expect(csv.delimiter).toBe('\t');
    expect(csv.headers).toEqual(['name', 'age']);
    expect(csv.rows[0]).toEqual(['Alice', '30']);
  });

  it('should auto-detect semicolon delimiter', () => {
    const csv = parseCsv('name;age;city\nAlice;30;NYC\nBob;25;LA');
    expect(csv.delimiter).toBe(';');
    expect(csv.headers).toEqual(['name', 'age', 'city']);
  });

  it('should respect explicit delimiter', () => {
    const csv = parseCsv('a|b\n1|2', { delimiter: '|' });
    expect(csv.headers).toEqual(['a', 'b']);
    expect(csv.rows[0]).toEqual(['1', '2']);
  });

  it('should handle maxRows option', () => {
    const lines = ['a,b', ...Array.from({ length: 100 }, (_, i) => `${i},${i}`)];
    const csv = parseCsv(lines.join('\n'), { maxRows: 10 });
    expect(csv.rows).toHaveLength(10);
  });

  it('should handle empty input', () => {
    const csv = parseCsv('');
    expect(csv.headers).toEqual([]);
    expect(csv.rows).toEqual([]);
    expect(csv.rowCount).toBe(0);
  });

  it('should handle header-only CSV', () => {
    const csv = parseCsv('a,b,c');
    expect(csv.headers).toEqual(['a', 'b', 'c']);
    expect(csv.rows).toEqual([]);
  });

  it('should handle Windows line endings', () => {
    const csv = parseCsv('a,b\r\n1,2\r\n3,4');
    expect(csv.rows).toHaveLength(2);
    expect(csv.rows[0]).toEqual(['1', '2']);
  });
});
