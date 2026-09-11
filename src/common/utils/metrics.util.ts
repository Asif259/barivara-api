import { UnitStatus, Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { DecimalUtil } from './decimal.util';

export interface UnitCountGroup {
  status: UnitStatus;
  _count: {
    _all: number;
  };
}

export interface UnitMetrics {
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  maintenanceUnits: number;
  occupancyRate: number;
}

export interface CollectionMetrics {
  expected: Decimal;
  collected: Decimal;
  outstanding: Decimal;
  collectionRate: number;
}

export class MetricsUtil {
  /**
   * Calculates unit counts and occupancy rate from grouped unit query results.
   */
  static calculateUnitMetrics(unitCounts: UnitCountGroup[]): UnitMetrics {
    const unitCountByStatus = new Map(
      unitCounts.map((group) => [group.status, group._count._all]),
    );
    const totalUnits = unitCounts.reduce(
      (total, group) => total + group._count._all,
      0,
    );
    const occupiedUnits = unitCountByStatus.get(UnitStatus.OCCUPIED) || 0;
    const vacantUnits = unitCountByStatus.get(UnitStatus.VACANT) || 0;
    const maintenanceUnits = unitCountByStatus.get(UnitStatus.MAINTENANCE) || 0;

    const occupancyRate =
      totalUnits === 0
        ? 0
        : Number(((occupiedUnits / totalUnits) * 100).toFixed(2));

    return {
      totalUnits,
      occupiedUnits,
      vacantUnits,
      maintenanceUnits,
      occupancyRate,
    };
  }

  /**
   * Calculates financial collection metrics (expected, collected, outstanding, collection rate)
   * using Decimal arithmetic.
   */
  static calculateCollectionMetrics(
    totalAmount: number | string | Prisma.Decimal | Decimal | null | undefined,
    paidAmount: number | string | Prisma.Decimal | Decimal | null | undefined,
  ): CollectionMetrics {
    const expected = DecimalUtil.toDecimal(totalAmount);
    const collected = DecimalUtil.toDecimal(paidAmount);
    const diff = expected.minus(collected);
    const outstanding = diff.isNegative() ? new Decimal(0) : diff;

    const collectionRate = expected.isZero()
      ? 0
      : Number(collected.dividedBy(expected).times(100).toFixed(2));

    return {
      expected,
      collected,
      outstanding,
      collectionRate,
    };
  }
}
