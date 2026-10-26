import { describe, expect, it } from 'vitest';
import { mapRowsToEvents } from './spreadsheet-events';

describe('mapRowsToEvents', () => {
  it('maps the task-based CSV schema to calendar events', () => {
    const events = mapRowsToEvents([
      {
        area: 'serre',
        task: 'Water plants',
        frequency: 'daily',
        timeSlot: '08:00-09:00',
        assignee: 'carol',
      },
    ]);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'water-plants',
      title: 'Water plants',
      isReadonly: true,
      meta: {
        area: 'serre',
        frequency: 'daily',
        timeSlot: '08:00-09:00',
        assignee: 'carol',
      },
    });
    expect(events[0].start).toBeInstanceOf(Date);
  });

  it('accepts the real Google Sheet values and defaults missing schedule details', () => {
    const events = mapRowsToEvents([
      {
        area: 'Serre',
        task: 'Vacuum clean',
        frequency: 'daily',
      },
      {
        area: 'Living room',
        task: 'Tidy up dressoir and cupboard',
        frequency: 'bi-weekly',
      },
      {
        area: 'Kitchen',
        task: 'Clean fridge',
        frequency: 'half-yearly',
        assignee: 'carol',
      },
    ]);

    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      title: 'Vacuum clean',
      isReadonly: true,
      meta: {
        area: 'serre',
        frequency: 'daily',
        assignee: 'carol',
      },
    });
    expect(events[1].meta.frequency).toBe('biweekly');
    expect(events[2].meta.area).toBe('kitchen');
    expect(events[0].recurrenceRule).toContain('FREQ=DAILY');
  });

  it('uses cadence-aware defaults when the time slot is omitted', () => {
    const now = new Date();
    const weeklyStart = new Date(now);
    weeklyStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    weeklyStart.setHours(8, 0, 0, 0);

    const monthlyStart = new Date(now.getFullYear(), now.getMonth(), 15, 8, 0, 0, 0);
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 1, 15, 8, 0, 0, 0);
    const yearlyStart = new Date(now.getFullYear(), 5, 15, 8, 0, 0, 0);

    const events = mapRowsToEvents([
      { area: 'serre', task: 'Weekly task', frequency: 'weekly' },
      { area: 'serre', task: 'Monthly task', frequency: 'monthly' },
      { area: 'serre', task: 'Quarterly task', frequency: 'quarterly' },
      { area: 'serre', task: 'Yearly task', frequency: 'yearly' },
    ]);

    expect(events[0].start).toEqual(weeklyStart);
    expect(events[1].start).toEqual(monthlyStart);
    expect(events[2].start).toEqual(quarterStart);
    expect(events[3].start).toEqual(yearlyStart);
    expect(events.every((event) => event.start.getHours() === 8)).toBe(true);
    expect(events.every((event) => event.meta.timeSlot === '08:00-09:00')).toBe(true);
  });

  it('rejects invalid area, frequency, and assignee values', () => {
    expect(() =>
      mapRowsToEvents([
        {
          area: 'attic',
          task: 'Water plants',
          frequency: 'daily',
          timeSlot: '08:00-09:00',
          assignee: 'carol',
        },
      ]),
    ).toThrowError(/area/);

    expect(() =>
      mapRowsToEvents([
        {
          area: 'serre',
          task: 'Water plants',
          frequency: 'biannual',
          timeSlot: '08:00-09:00',
          assignee: 'carol',
        },
      ]),
    ).toThrowError(/frequency/);

    expect(() =>
      mapRowsToEvents([
        {
          area: 'serre',
          task: 'Water plants',
          frequency: 'daily',
          timeSlot: '08:00-09:00',
          assignee: 'alex',
        },
      ]),
    ).toThrowError(/assignee/);
  });
});
