import { MonthlyRentsService } from './monthly-rents.service';
import { RentStatus } from '@prisma/client';

describe('MonthlyRentsService Status Calculations', () => {
  let service: MonthlyRentsService;

  beforeEach(() => {
    service = new MonthlyRentsService({} as any);
  });

  it('should return PENDING when paidAmount is 0 and dueDate is in future', () => {
    const total = 25500;
    const paid = 0;
    const futureDueDate = new Date('2026-09-10T23:59:59.999Z');
    const currentDate = new Date('2026-09-02T10:00:00.000Z');

    const status = service.calculateStatus(total, paid, futureDueDate, currentDate);
    expect(status).toBe(RentStatus.PENDING);
  });

  it('should return PARTIAL when paidAmount > 0 and remainingAmount > 0', () => {
    const total = 25500;
    const paid = 20000;
    const futureDueDate = new Date('2026-09-10T23:59:59.999Z');
    const currentDate = new Date('2026-09-02T10:00:00.000Z');

    const status = service.calculateStatus(total, paid, futureDueDate, currentDate);
    expect(status).toBe(RentStatus.PARTIAL);
  });

  it('should return PAID when paidAmount equals totalAmount', () => {
    const total = 25500;
    const paid = 25500;
    const dueDate = new Date('2026-09-10T23:59:59.999Z');
    const currentDate = new Date('2026-09-02T10:00:00.000Z');

    const status = service.calculateStatus(total, paid, dueDate, currentDate);
    expect(status).toBe(RentStatus.PAID);
  });

  it('should return OVERDUE when remaining > 0 and dueDate has passed', () => {
    const total = 25500;
    const paid = 0;
    const pastDueDate = new Date('2026-09-01T23:59:59.999Z');
    const currentDate = new Date('2026-09-05T10:00:00.000Z');

    const status = service.calculateStatus(total, paid, pastDueDate, currentDate);
    expect(status).toBe(RentStatus.OVERDUE);
  });

  it('should return PAID even if paid after overdue date', () => {
    const total = 25500;
    const paid = 25500;
    const pastDueDate = new Date('2026-09-01T23:59:59.999Z');
    const currentDate = new Date('2026-09-05T10:00:00.000Z');

    const status = service.calculateStatus(total, paid, pastDueDate, currentDate);
    expect(status).toBe(RentStatus.PAID);
  });
});
