import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { CalendarEvent } from '@ascentsparksoftware/angular-calendar';

export type SpreadsheetRow = Record<string, unknown>;

function parseDate(value: unknown, column: string): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const text = String(value ?? '').trim();

  if (!text) {
    throw new Error(`Missing ${column}`);
  }

  // Require ISO-style dates to avoid ambiguous day/month parsing.
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(text)) {
    throw new Error(`${column} must use ISO date format: ${text}`);
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${column}: ${text}`);
  }

  return date;
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (value == null || String(value).trim() === '') {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();

  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;

  throw new Error(`Invalid allDay value: ${String(value)}`);
}

export function mapRowsToEvents(
  rows: SpreadsheetRow[],
): CalendarEvent[] {
  return rows.map((row, index) => {
    const id = String(row['id'] ?? index + 1).trim();
    const title = String(row['title'] ?? '').trim();
    const start = parseDate(row['start'], 'start');

    const endValue = row['end'];
    const end =
      endValue == null || String(endValue).trim() === ''
        ? undefined
        : parseDate(endValue, 'end');

    if (!id || !title) {
      throw new Error(`Row ${index + 2}: id and title are required`);
    }

    if (end && end < start) {
      throw new Error(`Row ${index + 2}: end precedes start`);
    }

    const status = String(row['status'] ?? '').trim();
    const allDay = optionalBoolean(row['allDay']);

    return {
      id,
      title,
      start,
      ...(end ? { end } : {}),
      ...(allDay !== undefined ? { allDay } : {}),
      ...(status ? { status } : {}),
      isReadonly: true,
      meta: { sourceRow: index + 2 },
    };
  });
}

export function parseCsv(text: string): SpreadsheetRow[] {
  const result = Papa.parse<SpreadsheetRow>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  });

  if (result.errors.length) {
    throw new Error(
      result.errors.map((error) => error.message).join('; '),
    );
  }

  return result.data;
}

export function parseExcel(buffer: ArrayBuffer): SpreadsheetRow[] {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
  });

  const firstSheet = workbook.SheetNames[0];

  if (!firstSheet) {
    throw new Error('Workbook contains no worksheets');
  }

  const worksheet = workbook.Sheets[firstSheet];

  if (!worksheet) {
    throw new Error(`Worksheet "${firstSheet}" not found`);
  }

  return XLSX.utils.sheet_to_json<SpreadsheetRow>(
    worksheet,
    { defval: '' },
  );
}