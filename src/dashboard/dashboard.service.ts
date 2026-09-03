import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DateUtil } from '../common/utils/date.util';
import { Decimal } from 'decimal.js';
import { Prisma, RentStatus, UnitStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(
    userId: string,
    propertyId?: string,
    yearParam?: number,
    monthParam?: number,
  ) {
    const nowDhaka = DateUtil.nowInDhaka();
    const year = yearParam || nowDhaka.getFullYear();
    const month = monthParam || nowDhaka.getMonth() + 1;

    // Refresh overdue statuses lazily
    await this.prisma.monthlyRent.updateMany({
      where: {
        agreement: {
          unit: {
            property: {
              ownerId: userId,
            },
          },
        },
        status: RentStatus.PENDING,
        dueDate: { lt: new Date() },
        remainingAmount: { gt: 0 },
      },
      data: {
        status: RentStatus.OVERDUE,
      },
    });

    const propertyWhere: Prisma.PropertyWhereInput = {
      ownerId: userId,
      deletedAt: null,
    };
    if (propertyId) {
      propertyWhere.id = propertyId;
    }

    const unitWhere: Prisma.UnitWhereInput = {
      property: propertyWhere,
      deletedAt: null,
    };

    const rentWhere: Prisma.MonthlyRentWhereInput = {
      agreement: { unit: unitWhere },
      year,
      month,
    };

    const [propertiesCount, unitCounts, activeTenantGroups, rentTotals, rentStatusGroups] = await Promise.all([
      this.prisma.property.count({ where: propertyWhere }),
      this.prisma.unit.groupBy({
        where: unitWhere,
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.rentalAgreement.groupBy({
        where: { unit: unitWhere, status: 'ACTIVE', deletedAt: null },
        by: ['tenantId'],
      }),
      this.prisma.monthlyRent.aggregate({
        where: rentWhere,
        _sum: { totalAmount: true, paidAmount: true },
      }),
      this.prisma.monthlyRent.groupBy({
        where: rentWhere,
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const unitCountByStatus = new Map(unitCounts.map((group) => [group.status, group._count._all]));
    const totalUnits = unitCounts.reduce((total, group) => total + group._count._all, 0);
    const occupiedUnits = unitCountByStatus.get(UnitStatus.OCCUPIED) || 0;
    const vacantUnits = unitCountByStatus.get(UnitStatus.VACANT) || 0;
    const maintenanceUnits = unitCountByStatus.get(UnitStatus.MAINTENANCE) || 0;

    const occupancyRate = totalUnits === 0
      ? 0
      : Number(((occupiedUnits / totalUnits) * 100).toFixed(2));

    const totalTenants = activeTenantGroups.length;
    const expected = new Decimal(rentTotals._sum.totalAmount?.toString() || 0);
    const collected = new Decimal(rentTotals._sum.paidAmount?.toString() || 0);
    const rentCountByStatus = new Map(
      rentStatusGroups.map((group) => [group.status, group._count._all]),
    );
    const paidCount = rentCountByStatus.get(RentStatus.PAID) || 0;
    const partialCount = rentCountByStatus.get(RentStatus.PARTIAL) || 0;
    const pendingCount = rentCountByStatus.get(RentStatus.PENDING) || 0;
    const overdueCount = rentCountByStatus.get(RentStatus.OVERDUE) || 0;

    const outstanding = expected.minus(collected);
    const collectionRate = expected.isZero()
      ? 0
      : Number(collected.dividedBy(expected).times(100).toFixed(2));

    return {
      message: 'ড্যাশবোর্ড সারাংশ',
      data: {
        totalProperties: propertiesCount,
        totalUnits,
        occupiedUnits,
        vacantUnits,
        maintenanceUnits,
        totalTenants,
        occupancyRate,
        currentMonth: {
          year,
          month,
          expected: expected.toNumber(),
          collected: collected.toNumber(),
          outstanding: (outstanding.isNegative() ? new Decimal(0) : outstanding).toNumber(),
          collectionRate,
          paidCount,
          partialCount,
          pendingCount,
          overdueCount,
        },
      },
    };
  }
}
