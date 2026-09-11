import { getDaysInMonth } from 'date-fns';
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';

export const TIMEZONE_DHAKA = 'Asia/Dhaka';

export class DateUtil {
  /**
   * Returns the current date in Asia/Dhaka timezone
   */
  static nowInDhaka(): Date {
    return toZonedTime(new Date(), TIMEZONE_DHAKA);
  }

  /**
   * Clamps due day to the maximum valid days in the given month/year and returns a Date in UTC.
   * Month is 1-indexed (1 = January, 12 = December).
   * Example: year=2026, month=2, dueDay=31 -> Feb 28, 2026 (or Feb 29 on leap year)
   */
  static calculateDueDate(rentYear: number, rentMonth: number, dueDay: number): Date {
    const dueYear = rentMonth === 12 ? rentYear + 1 : rentYear;
    const dueMonth = rentMonth === 12 ? 1 : rentMonth + 1;

    const monthDate = new Date(dueYear, dueMonth - 1, 1);
    const maxDays = getDaysInMonth(monthDate);
    const clampedDay = Math.min(Math.max(1, dueDay), maxDays);

    // Represent as the due date at 23:59:59.999 Asia/Dhaka
    const formattedDateString = `${dueYear}-${String(dueMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}T23:59:59.999`;
    return fromZonedTime(formattedDateString, TIMEZONE_DHAKA);
  }

  /**
   * Determines if a due date is overdue compared to current date in Asia/Dhaka
   */
  static isOverdue(dueDate: Date, currentDate: Date = new Date()): boolean {
    const zonedDue = toZonedTime(dueDate, TIMEZONE_DHAKA);
    const zonedCurrent = toZonedTime(currentDate, TIMEZONE_DHAKA);
    return zonedCurrent > zonedDue;
  }

  /**
   * Formats a date in Asia/Dhaka timezone
   */
  static formatDhaka(date: Date, pattern = 'yyyy-MM-dd HH:mm:ss'): string {
    return format(toZonedTime(date, TIMEZONE_DHAKA), pattern, {
      timeZone: TIMEZONE_DHAKA,
    });
  }

  /**
   * Returns the default monthly rent period { year, month } (1-indexed month)
   * which is the calendar month immediately preceding the given date in Asia/Dhaka.
   * If current month is September 2026, returns August 2026 { year: 2026, month: 8 }.
   * If current month is January 2027, rolls back to December 2026 { year: 2026, month: 12 }.
   */
  static getDefaultRentPeriod(referenceDate?: Date): { year: number; month: number } {
    const zoned = toZonedTime(referenceDate || new Date(), TIMEZONE_DHAKA);
    const calYear = zoned.getFullYear();
    const calMonth = zoned.getMonth() + 1; // 1-12

    if (calMonth === 1) {
      return { year: calYear - 1, month: 12 };
    }
    return { year: calYear, month: calMonth - 1 };
  }

  /**
   * Returns start and end Date boundary for a given calendar year and 1-indexed month.
   */
  static getMonthDateRange(year: number, month: number): { startDate: Date; endDate: Date } {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    return { startDate, endDate };
  }

  /**
   * Returns start of today (00:00:00.000)
   */
  static startOfToday(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }
}

