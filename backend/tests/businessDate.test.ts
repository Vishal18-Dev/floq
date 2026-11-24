import { it, expect } from 'vitest';
import { businessDate, businessDayRange, businessHour } from '@floq/utils';

it('H7: the business day rolls over at midnight IST, not UTC', () => {
  // 00:30 IST on 25 Nov is still 24 Nov in UTC.
  expect(businessDate(new Date('2026-11-24T19:00:00.000Z'))).toBe('2026-11-25');
  expect(businessDate(new Date('2026-11-24T18:29:59.999Z'))).toBe('2026-11-24');
  expect(businessDayRange('2026-11-25')).toEqual({ start: '2026-11-24T18:30:00.000Z', end: '2026-11-25T18:29:59.999Z' });
  expect(businessHour('2026-11-24T19:00:00.000Z')).toBe(0);
  expect(businessHour('2026-11-25T08:30:00.000Z')).toBe(14);
});
