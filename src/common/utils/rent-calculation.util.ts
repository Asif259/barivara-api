import { Prisma, RentStatus } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { DateUtil } from './date.util';
import { DecimalUtil } from './decimal.util';

type DecimalValue = number | string | Prisma.Decimal | Decimal;

export class RentCalculationUtil {
  static calculateStatus(
    totalAmount: DecimalValue,
    paidAmount: DecimalValue,
    dueDate: Date,
    currentDate: Date = new Date(),
  ): RentStatus {
    const total = DecimalUtil.toDecimal(totalAmount);
    const paid = DecimalUtil.toDecimal(paidAmount);
    const remaining = total.minus(paid);

    if (remaining.lessThanOrEqualTo(0)) return RentStatus.PAID;
    if (DateUtil.isOverdue(dueDate, currentDate)) return RentStatus.OVERDUE;
    if (paid.greaterThan(0)) return RentStatus.PARTIAL;
    return RentStatus.PENDING;
  }
}
