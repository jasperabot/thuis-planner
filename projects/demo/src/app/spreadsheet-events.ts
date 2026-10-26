import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { CalendarEvent } from '@ascentsparksoftware/angular-calendar';

export type SpreadsheetRow = Record<string, unknown>;

const allowedAreas = [
  'serre',
  'kitchen',
  'living room',
  'side kitchen',
  'hallway + toilet',
  'bathroom upstairs',
  "leeloo's bedroom",
  "man's bedroom",
  'bedroom carol/jasper',
  'garden',
  'garage',
  'outside house',
  'technical mainternance',
  'walk-in closet',
  'bathroom leeloo',
  'beedroom1',
  'bedroom1',
  'bedroom2',
  'mastersBedroom',
] as const;

const allowedFrequencies = [
  'daily',
  'weekly',
  'biweekly',
  'bi-weekly',
  'monthly',
  'quarterly',
  'half-yearly',
  'annually',
  'yearly',
] as const;

const allowedAssignees = ['leeloo', 'manu', 'carol', 'jasper'] as const;

const defaultArea = 'serre';
const defaultFrequency = 'weekly';
const defaultAssignee = 'carol';
const defaultTimeSlot = '08:00-09:00';

const areaAliases: Record<string, string> = {
  serre: 'serre',
  'living room': 'living room',
  'living-room': 'living room',
  kitchen: 'kitchen',
  'side kitchen': 'side kitchen',
  'hallway + toilet': 'hallway + toilet',
  'hallway and toilet': 'hallway + toilet',
  'bathroom upstairs': 'bathroom upstairs',
  "leeloo's bedroom": "leeloo's bedroom",
  "leeloo's bed room": "leeloo's bedroom",
  "leeloo bedroom": "leeloo's bedroom",
  "man's bedroom": "man's bedroom",
  "manu's bedroom": "man's bedroom",
  'bedroom carol/jasper': 'bedroom carol/jasper',
  'bedroom carol jasper': 'bedroom carol/jasper',
  garden: 'garden',
  garage: 'garage',
  'outside house': 'outside house',
  'technical mainternance': 'technical mainternance',
  'technical maintenance': 'technical mainternance',
  'walk-in closet': 'walk-in closet',
  'walk in closet': 'walk-in closet',
  'bathroom leeloo': 'bathroom leeloo',
  beedroom1: 'beedroom1',
  bedroom1: 'bedroom1',
  bedroom2: 'bedroom2',
  mastersbedroom: 'mastersBedroom',
  'masters bedroom': 'mastersBedroom',
};

const frequencyAliases: Record<string, string> = {
  daily: 'daily',
  weekly: 'weekly',
  'bi-weekly': 'biweekly',
  biweekly: 'biweekly',
  monthly: 'monthly',
  quarterly: 'quarterly',
  'half-yearly': 'half-yearly',
  halfyearly: 'half-yearly',
  annually: 'annually',
  yearly: 'yearly',
};

const assigneeAliases: Record<string, string> = {
  leeloo: 'leeloo',
  'leeloo ': 'leeloo',
  manu: 'manu',
  carol: 'carol',
  jasper: 'jasper',
  'carol/jasper': 'carol',
  'jasper/carol': 'carol',
};

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function canonicalizeValue(value: unknown, aliases: Record<string, string>): string {
  const normalized = normalizeText(value).toLowerCase();
  return aliases[normalized] ?? normalized;
}

function requireText(row: SpreadsheetRow, column: string, rowNumber: number, fallback?: string): string {
  const value = normalizeText(row[column]);
  const result = value || fallback || '';

  if (!result) {
    throw new Error(`Row ${rowNumber}: ${column} is required`);
  }

  return result;
}

function parseAllowedValue<T extends string>(
  value: unknown,
  column: string,
  allowedValues: readonly T[],
  rowNumber: number,
  fallback?: T,
): T {
  const raw = normalizeText(value);

  if (!raw && fallback !== undefined) {
    return fallback;
  }

  if (!raw) {
    throw new Error(`Row ${rowNumber}: ${column} is required`);
  }

  const normalized = canonicalizeValue(raw, {
    ...(column === 'area' ? areaAliases : {}),
    ...(column === 'frequency' ? frequencyAliases : {}),
    ...(column === 'assignee' ? assigneeAliases : {}),
  });

  const exactMatch = allowedValues.find(
    (allowedValue) =>
      allowedValue.toLowerCase() === normalized.toLowerCase(),
  );

  if (exactMatch) {
    return exactMatch;
  }

  const expected = allowedValues.join(', ');
  throw new Error(
    `Row ${rowNumber}: ${column} must be one of ${expected}. Received: ${raw}`,
  );
}

function getDefaultDateForFrequency(frequency: string): Date {
  const base = new Date();
  base.setMilliseconds(0);

  switch (frequency.toLowerCase()) {
    case 'weekly':
    case 'biweekly':
      base.setDate(base.getDate() - ((base.getDay() + 6) % 7));
      break;
    case 'monthly':
      base.setDate(15);
      break;
    case 'quarterly':
      base.setMonth(Math.floor(base.getMonth() / 3) * 3 + 1, 15);
      break;
    case 'half-yearly':
      base.setMonth(base.getMonth() < 6 ? 3 : 9, 15);
      break;
    case 'annually':
    case 'yearly':
      base.setMonth(5, 15);
      break;
    default:
      break;
  }

  base.setHours(8, 0, 0, 0);
  return base;
}

function parseTimeSlotToDate(timeSlot: string, frequency = defaultFrequency): Date {
  const base = getDefaultDateForFrequency(frequency);
  base.setSeconds(0, 0);

  const slotText = (normalizeText(timeSlot).split(/[–-]/)[0] ?? '').trim();
  const match = slotText.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);

  if (!match) {
    base.setHours(8, 0, 0, 0);
    return base;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? '0');
  const meridiem = match[3]?.toLowerCase();

  if (meridiem === 'pm' && hours < 12) {
    hours += 12;
  }
  if (meridiem === 'am' && hours === 12) {
    hours = 0;
  }

  base.setHours(hours, minutes, 0, 0);
  return base;
}

function parseTimeSlotToEndDate(timeSlot: string, frequency = defaultFrequency): Date {
  const slotText = normalizeText(timeSlot);
  const range = slotText.split(/[–-]/);

  if (range.length < 2) {
    const start = parseTimeSlotToDate(slotText, frequency);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return end;
  }

  const endText = range[1]?.trim() ?? '';
  const base = parseTimeSlotToDate(slotText, frequency);
  const endMatch = endText.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);

  if (!endMatch) {
    return new Date(base.getTime() + 60 * 60 * 1000);
  }

  let endHours = Number(endMatch[1]);
  const endMinutes = Number(endMatch[2] ?? '0');
  const endMeridiem = endMatch[3]?.toLowerCase();

  if (endMeridiem === 'pm' && endHours < 12) {
    endHours += 12;
  }
  if (endMeridiem === 'am' && endHours === 12) {
    endHours = 0;
  }

  const end = new Date(base);
  end.setHours(endHours, endMinutes, 0, 0);
  return end;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'task';
}

function frequencyToRrule(frequency: string): string | undefined {
  switch (frequency) {
    case 'daily':
      return 'FREQ=DAILY';
    case 'weekly':
      return 'FREQ=WEEKLY';
    case 'biweekly':
      return 'FREQ=WEEKLY;INTERVAL=2';
    case 'monthly':
      return 'FREQ=MONTHLY';
    case 'quarterly':
      return 'FREQ=MONTHLY;INTERVAL=3';
    case 'half-yearly':
      return 'FREQ=MONTHLY;INTERVAL=6';
    case 'annually':
    case 'yearly':
      return 'FREQ=YEARLY';
    default:
      return undefined;
  }
}

export function mapRowsToEvents(
  rows: SpreadsheetRow[],
): CalendarEvent[] {
  const usedIds = new Set<string>();

  return rows.map((row, index) => {
    const rowNumber = index + 2;
    const area = parseAllowedValue(
      row['area'],
      'area',
      allowedAreas,
      rowNumber,
      defaultArea,
    );
    const task = requireText(row, 'task', rowNumber);
    const frequency = parseAllowedValue(
      row['frequency'],
      'frequency',
      allowedFrequencies,
      rowNumber,
      defaultFrequency,
    );
    const timeSlot = requireText(row, 'timeSlot', rowNumber, defaultTimeSlot);
    const assignee = parseAllowedValue(
      row['assignee'],
      'assignee',
      allowedAssignees,
      rowNumber,
      defaultAssignee,
    );

    const start = parseTimeSlotToDate(timeSlot, frequency);
    const end = parseTimeSlotToEndDate(timeSlot, frequency);

    const baseId = slugify(task);
    const id = usedIds.has(baseId) ? `${baseId}-${rowNumber}` : baseId;
    usedIds.add(id);
    const recurrenceRule = frequencyToRrule(frequency);

    return {
      id,
      title: task,
      start,
      end,
      isReadonly: true,
      ...(recurrenceRule ? { recurrenceRule } : {}),
      meta: {
        area,
        task,
        frequency,
        timeSlot,
        assignee,
        sourceRow: rowNumber,
      },
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