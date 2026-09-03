import { DateUtil } from './date.util';

describe('DateUtil', () => {
  it('should clamp due date for 31-day dueDay in February 2026 (non-leap year) to Feb 28', () => {
    const dueDate = DateUtil.calculateDueDate(2026, 2, 31);
    const formatted = DateUtil.formatDhaka(dueDate, 'yyyy-MM-dd');
    expect(formatted).toBe('2026-02-28');
  });

  it('should clamp due date for 31-day dueDay in February 2024 (leap year) to Feb 29', () => {
    const dueDate = DateUtil.calculateDueDate(2024, 2, 31);
    const formatted = DateUtil.formatDhaka(dueDate, 'yyyy-MM-dd');
    expect(formatted).toBe('2024-02-29');
  });

  it('should clamp due date for 31-day dueDay in April 2026 (30-day month) to April 30', () => {
    const dueDate = DateUtil.calculateDueDate(2026, 4, 31);
    const formatted = DateUtil.formatDhaka(dueDate, 'yyyy-MM-dd');
    expect(formatted).toBe('2026-04-30');
  });

  it('should keep due date when valid (e.g. day 15 in March)', () => {
    const dueDate = DateUtil.calculateDueDate(2026, 3, 15);
    const formatted = DateUtil.formatDhaka(dueDate, 'yyyy-MM-dd');
    expect(formatted).toBe('2026-03-15');
  });

  it('should accurately determine if a date is overdue in Asia/Dhaka', () => {
    const pastDueDate = new Date('2026-09-01T23:59:59.999Z');
    const futureCurrentDate = new Date('2026-09-02T10:00:00.000Z');

    expect(DateUtil.isOverdue(pastDueDate, futureCurrentDate)).toBe(true);

    const futureDueDate = new Date('2026-09-10T23:59:59.999Z');
    expect(DateUtil.isOverdue(futureDueDate, futureCurrentDate)).toBe(false);
  });
});
