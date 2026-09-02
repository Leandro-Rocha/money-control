import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseMonth,
  monthToOffset,
  offsetToMonth,
  monthDiff,
  addMonths,
  currentMonth,
  isFutureMonth
} from './date-helpers';

describe('date-helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseMonth', () => {
    it('should parse YYYY-MM into year and month', () => {
      expect(parseMonth('2024-01')).toEqual({ year: 2024, month: 1 });
      expect(parseMonth('2023-12')).toEqual({ year: 2023, month: 12 });
    });
  });

  describe('monthToOffset and offsetToMonth', () => {
    it('should convert month string to correct offset', () => {
      // 2024 * 12 + 1 = 24289
      expect(monthToOffset('2024-01')).toBe(24289);
    });

    it('should convert offset back to month string', () => {
      expect(offsetToMonth(24289)).toBe('2024-01');
    });

    it('should be reversible', () => {
      const month = '2024-05';
      expect(offsetToMonth(monthToOffset(month))).toBe(month);
    });
  });

  describe('monthDiff', () => {
    it('should calculate difference between months correctly', () => {
      expect(monthDiff('2024-01', '2024-03')).toBe(2);
      expect(monthDiff('2024-01', '2023-12')).toBe(-1);
    });
  });

  describe('addMonths', () => {
    it('should add months correctly', () => {
      expect(addMonths('2024-01', 2)).toBe('2024-03');
      expect(addMonths('2023-12', 1)).toBe('2024-01');
      expect(addMonths('2024-01', -1)).toBe('2023-12');
    });
  });

  describe('currentMonth', () => {
    it('should return current month in YYYY-MM format', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 4, 15)); // May 2024 (0-indexed month 4)
      
      expect(currentMonth()).toBe('2024-05');
      
      vi.useRealTimers();
    });
  });

  describe('isFutureMonth', () => {
    it('should correctly identify future and past months relative to current', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 4, 15)); // May 2024
      
      expect(isFutureMonth('2024-05')).toBe(true); // Current month is included
      expect(isFutureMonth('2024-06')).toBe(true);
      expect(isFutureMonth('2024-04')).toBe(false);
      expect(isFutureMonth('2023-12')).toBe(false);
      
      vi.useRealTimers();
    });
  });
});
