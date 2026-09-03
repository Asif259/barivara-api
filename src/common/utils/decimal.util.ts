import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';

export class DecimalUtil {
  /**
   * Safely converts number, string, or Prisma.Decimal to Decimal instance
   */
  static toDecimal(value: number | string | Prisma.Decimal | Decimal | null | undefined): Decimal {
    if (value === null || value === undefined) {
      return new Decimal(0);
    }
    return new Decimal(value.toString());
  }

  /**
   * Formats decimal to exact 2-decimal string
   */
  static toFixed(value: number | string | Prisma.Decimal | Decimal | null | undefined, dp = 2): string {
    return this.toDecimal(value).toFixed(dp);
  }

  /**
   * Converts decimal to number for API serialization where appropriate
   */
  static toNumber(value: number | string | Prisma.Decimal | Decimal | null | undefined): number {
    return this.toDecimal(value).toNumber();
  }

  /**
   * Calculates monthly rent total amount:
   * totalAmount = rent + serviceFee + parkingFee + extraCharge + lateFee - discount
   */
  static calculateRentTotal(charges: {
    rent: number | string | Prisma.Decimal | Decimal;
    serviceFee?: number | string | Prisma.Decimal | Decimal;
    parkingFee?: number | string | Prisma.Decimal | Decimal;
    extraCharge?: number | string | Prisma.Decimal | Decimal;
    lateFee?: number | string | Prisma.Decimal | Decimal;
    discount?: number | string | Prisma.Decimal | Decimal;
  }): Decimal {
    const rent = this.toDecimal(charges.rent);
    const serviceFee = this.toDecimal(charges.serviceFee);
    const parkingFee = this.toDecimal(charges.parkingFee);
    const extraCharge = this.toDecimal(charges.extraCharge);
    const lateFee = this.toDecimal(charges.lateFee);
    const discount = this.toDecimal(charges.discount);

    const total = rent
      .plus(serviceFee)
      .plus(parkingFee)
      .plus(extraCharge)
      .plus(lateFee)
      .minus(discount);

    return total.isNegative() ? new Decimal(0) : total;
  }

  /**
   * Calculates remaining balance:
   * remaining = totalAmount - paidAmount
   */
  static calculateRemaining(
    totalAmount: number | string | Prisma.Decimal | Decimal,
    paidAmount: number | string | Prisma.Decimal | Decimal,
  ): Decimal {
    const total = this.toDecimal(totalAmount);
    const paid = this.toDecimal(paidAmount);
    const remaining = total.minus(paid);
    return remaining.isNegative() ? new Decimal(0) : remaining;
  }

  /**
   * Helper to format Prisma.Decimal in objects recursively or for API response
   */
  static transformDecimals<T>(obj: T): T {
    if (obj === null || obj === undefined) {
      return obj;
    }
    const anyObj = obj as unknown;
    if (anyObj instanceof Prisma.Decimal || anyObj instanceof Decimal) {
      return (anyObj as Decimal).toNumber() as unknown as T;
    }
    if (Array.isArray(anyObj)) {
      return (anyObj as unknown[]).map((item) =>
        this.transformDecimals(item),
      ) as unknown as T;
    }
    if (typeof anyObj === 'object' && !(anyObj instanceof Date)) {
      const transformed: Record<string, unknown> = {};
      for (const key of Object.keys(anyObj as Record<string, unknown>)) {
        transformed[key] = this.transformDecimals(
          (anyObj as Record<string, unknown>)[key],
        );
      }
      return transformed as T;
    }
    return obj;
  }
}
