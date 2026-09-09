import { DateUtil } from './date.util';

describe('DateUtil', () => {
  it('should calculate due date in September 2026 for August 2026 rent', () => {
    const dueDate = DateUtil.calculateDueDate(2026, 8, 10);
    const formatted = DateUtil.formatDhaka(dueDate, 'yyyy-MM-dd');
    expect(formatted).toBe('2026-09-10');
  });

  it('should calculate due date in October 2026 for September 2026 rent', () => {
    const dueDate = DateUtil.calculateDueDate(2026, 9, 10);
    const formatted = DateUtil.formatDhaka(dueDate, 'yyyy-MM-dd');
    expect(formatted).toBe('2026-10-10');
  });

  it('should calculate due date in January 2027 for December 2026 rent (year rollover)', () => {
    const dueDate = DateUtil.calculateDueDate(2026, 12, 10);
    const formatted = DateUtil.formatDhaka(dueDate, 'yyyy-MM-dd');
    expect(formatted).toBe('2027-01-10');
  });

  it('should calculate due date in February 2027 for January 2027 rent', () => {
    const dueDate = DateUtil.calculateDueDate(2027, 1, 10);
    const formatted = DateUtil.formatDhaka(dueDate, 'yyyy-MM-dd');
    expect(formatted).toBe('2027-02-10');
  });

  it('should clamp due date for 31-day dueDay in January rent (due in Feb non-leap year) to Feb 28', () => {
    const dueDate = DateUtil.calculateDueDate(2026, 1, 31);
    const formatted = DateUtil.formatDhaka(dueDate, 'yyyy-MM-dd');
    expect(formatted).toBe('2026-02-28');
  });

  it('should accurately determine if a date is overdue in Asia/Dhaka', () => {
    const pastDueDate = new Date('2026-09-01T23:59:59.999Z');
    const futureCurrentDate = new Date('2026-09-02T10:00:00.000Z');

    expect(DateUtil.isOverdue(pastDueDate, futureCurrentDate)).toBe(true);

    const futureDueDate = new Date('2026-09-10T23:59:59.999Z');
    expect(DateUtil.isOverdue(futureDueDate, futureCurrentDate)).toBe(false);
  });

  describe('getDefaultRentPeriod', () => {
    it('should return August 2026 when current month is September 2026', () => {
      // Month index in Date constructor: 8 = September
      const sep2026 = new Date(2026, 8, 15, 12, 0, 0);
      const period = DateUtil.getDefaultRentPeriod(sep2026);
      expect(period).toEqual({ year: 2026, month: 8 });
    });

    it('should return September 2026 when current month is October 2026', () => {
      // Month index: 9 = October
      const oct2026 = new Date(2026, 9, 5, 10, 0, 0);
      const period = DateUtil.getDefaultRentPeriod(oct2026);
      expect(period).toEqual({ year: 2026, month: 9 });
    });

    it('should roll back to December 2026 when current month is January 2027', () => {
      // Month index: 0 = January
      const jan2027 = new Date(2027, 0, 1, 10, 0, 0);
      const period = DateUtil.getDefaultRentPeriod(jan2027);
      expect(period).toEqual({ year: 2026, month: 12 });
    });

    it('should return February 2026 when current month is March 2026', () => {
      const mar2026 = new Date(2026, 2, 20);
      const period = DateUtil.getDefaultRentPeriod(mar2026);
      expect(period).toEqual({ year: 2026, month: 2 });
    });
  });
});
