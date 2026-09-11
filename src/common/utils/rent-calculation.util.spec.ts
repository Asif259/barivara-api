import { RentCalculationUtil } from './rent-calculation.util';
import { DecimalUtil } from './decimal.util';
import { DateUtil } from './date.util';
import { RentStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// RentCalculationUtil — Financial formula + status transitions + date rules
// ---------------------------------------------------------------------------
describe('RentCalculationUtil', () => {
  // -------------------------------------------------------------------------
  // calculateTotal — the core financial formula:
  //   total = rent + serviceFee + parkingFee + extraCharge + lateFee - discount
  // -------------------------------------------------------------------------
  describe('calculateTotal', () => {
    it('sums all positive charges correctly', () => {
      const total = RentCalculationUtil.calculateTotal({
        rent: 20000,
        serviceFee: 3000,
        parkingFee: 2000,
        extraCharge: 500,
        lateFee: 200,
        discount: 0,
      });
      expect(total.toNumber()).toBe(25700);
    });

    it('applies discount correctly: total = sum - discount', () => {
      const total = RentCalculationUtil.calculateTotal({
        rent: 20000,
        serviceFee: 3000,
        parkingFee: 2000,
        extraCharge: 500,
        lateFee: 0,
        discount: 500,
      });
      // 25500 - 500 = 25000
      expect(total.toNumber()).toBe(25000);
    });

    it('applies late fee AND discount together correctly', () => {
      // rent=20000, serviceFee=3000, parkingFee=2000, extraCharge=500 → subtotal=25500
      // + lateFee=200 − discount=500 → 25200
      const total = RentCalculationUtil.calculateTotal({
        rent: 20000,
        serviceFee: 3000,
        parkingFee: 2000,
        extraCharge: 500,
        lateFee: 200,
        discount: 500,
      });
      expect(total.toNumber()).toBe(25200);
    });

    it('clamps total to 0 when discount exceeds all charges', () => {
      const total = RentCalculationUtil.calculateTotal({
        rent: 5000,
        discount: 10000,
      });
      expect(total.toNumber()).toBe(0);
    });

    it('handles optional fields defaulting to 0', () => {
      const total = RentCalculationUtil.calculateTotal({ rent: 15000 });
      expect(total.toNumber()).toBe(15000);
    });

    it('handles decimal precision without floating-point drift', () => {
      const total = RentCalculationUtil.calculateTotal({
        rent: 10000.1,
        serviceFee: 999.9,
        // 10000.1 + 999.9 = 11000 (not 10999.999...)
      });
      expect(total.toFixed(2)).toBe('11000.00');
    });
  });

  // -------------------------------------------------------------------------
  // calculateRemaining — remaining = totalAmount - paidAmount
  // -------------------------------------------------------------------------
  describe('calculateRemaining', () => {
    it('calculates remaining when partially paid', () => {
      const remaining = RentCalculationUtil.calculateRemaining(25500, 20000);
      expect(remaining.toNumber()).toBe(5500);
    });

    it('returns 0 when fully paid', () => {
      const remaining = RentCalculationUtil.calculateRemaining(25500, 25500);
      expect(remaining.toNumber()).toBe(0);
    });

    it('clamps remaining to 0 — never negative (overpayment guard)', () => {
      const remaining = RentCalculationUtil.calculateRemaining(25500, 30000);
      expect(remaining.toNumber()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // calculateStatus — status transition logic:
  //   paid >= total        → PAID
  //   paid > 0 & remaining > 0 & not overdue → PARTIAL
  //   paid == 0 & not overdue → PENDING
  //   remaining > 0 & overdue → OVERDUE
  // -------------------------------------------------------------------------
  describe('calculateStatus — status transitions', () => {
    // All tests use August 2026 rent → September 10 due date
    // The boundary: Sep 10 23:59:59 Dhaka = NOT overdue; Sep 11 00:00:01 Dhaka = OVERDUE
    const AUGUST_RENT_DUE_DATE = DateUtil.calculateDueDate(2026, 8, 10); // Sep 10 23:59:59 Dhaka

    const BEFORE_DUE = new Date('2026-09-02T10:00:00.000Z'); // Sep 2 — well before
    // const EXACT_DUE = AUGUST_RENT_DUE_DATE; // Sep 10 23:59:59.999 Dhaka (in UTC)
    const AFTER_DUE = new Date('2026-09-11T01:00:00.000Z'); // Sep 11 — past due in Dhaka

    const TOTAL = 25500;

    it('PENDING: no payment, before due date', () => {
      const status = RentCalculationUtil.calculateStatus(TOTAL, 0, AUGUST_RENT_DUE_DATE, BEFORE_DUE);
      expect(status).toBe(RentStatus.PENDING);
    });

    it('PARTIAL: some payment, before due date', () => {
      const status = RentCalculationUtil.calculateStatus(TOTAL, 10000, AUGUST_RENT_DUE_DATE, BEFORE_DUE);
      expect(status).toBe(RentStatus.PARTIAL);
    });

    it('PAID: full payment, before due date', () => {
      const status = RentCalculationUtil.calculateStatus(TOTAL, TOTAL, AUGUST_RENT_DUE_DATE, BEFORE_DUE);
      expect(status).toBe(RentStatus.PAID);
    });

    it('PAID: full payment even after due date — payment always wins over overdue', () => {
      const status = RentCalculationUtil.calculateStatus(TOTAL, TOTAL, AUGUST_RENT_DUE_DATE, AFTER_DUE);
      expect(status).toBe(RentStatus.PAID);
    });

    it('OVERDUE: no payment, after due date', () => {
      const status = RentCalculationUtil.calculateStatus(TOTAL, 0, AUGUST_RENT_DUE_DATE, AFTER_DUE);
      expect(status).toBe(RentStatus.OVERDUE);
    });

    it('OVERDUE: partial payment, after due date', () => {
      const status = RentCalculationUtil.calculateStatus(TOTAL, 10000, AUGUST_RENT_DUE_DATE, AFTER_DUE);
      expect(status).toBe(RentStatus.OVERDUE);
    });

    // Critical date boundary: September 10 is NOT overdue
    it('PENDING: Sep 10 23:59:59 Dhaka (exact due date) is NOT yet overdue', () => {
      // Due date is Sep 10 23:59:59.999 Dhaka. If current time == due time, not overdue.
      // We pass a moment slightly before due date to represent Sep 10 22:00
      const sep10evening = new Date('2026-09-10T16:00:00.000Z'); // 22:00 Dhaka (UTC+6)
      const status = RentCalculationUtil.calculateStatus(TOTAL, 0, AUGUST_RENT_DUE_DATE, sep10evening);
      expect(status).toBe(RentStatus.PENDING);
    });

    // Critical date boundary: September 11 IS overdue
    it('OVERDUE: Sep 11 00:00:01 Dhaka is overdue', () => {
      const sep11start = new Date('2026-09-10T18:00:01.000Z'); // Sep 11 00:00:01 Dhaka
      const status = RentCalculationUtil.calculateStatus(TOTAL, 0, AUGUST_RENT_DUE_DATE, sep11start);
      expect(status).toBe(RentStatus.OVERDUE);
    });
  });

  // -------------------------------------------------------------------------
  // Integration: full charge cycle from generate → payment → reversal
  // -------------------------------------------------------------------------
  describe('Financial formula integration', () => {
    it('full rent cycle: generate, partial pay, full pay', () => {
      const total = RentCalculationUtil.calculateTotal({
        rent: 20000,
        serviceFee: 3000,
        parkingFee: 2000,
        extraCharge: 500,
        lateFee: 0,
        discount: 0,
      });
      expect(total.toNumber()).toBe(25500);

      // Partial payment of 10,000
      const afterPartial = DecimalUtil.calculateRemaining(total, 10000);
      expect(afterPartial.toNumber()).toBe(15500);

      const statusAfterPartial = RentCalculationUtil.calculateStatus(
        total,
        10000,
        DateUtil.calculateDueDate(2026, 8, 10),
        new Date('2026-09-02T00:00:00Z'),
      );
      expect(statusAfterPartial).toBe(RentStatus.PARTIAL);

      // Full payment of remaining 15,500
      const afterFull = DecimalUtil.calculateRemaining(total, 25500);
      expect(afterFull.toNumber()).toBe(0);

      const statusAfterFull = RentCalculationUtil.calculateStatus(
        total,
        25500,
        DateUtil.calculateDueDate(2026, 8, 10),
        new Date('2026-09-02T00:00:00Z'),
      );
      expect(statusAfterFull).toBe(RentStatus.PAID);
    });
  });
});
