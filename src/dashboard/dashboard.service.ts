import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DateUtil } from '../common/utils/date.util';
import { Prisma, RentStatus } from '@prisma/client';
import { MetricsUtil, UnitCountGroup } from '../common/utils/metrics.util';

export interface RentStatusCountGroup {
  status: RentStatus;
  _count: {
    _all: number;
  };
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(
    userId: string,
    propertyId?: string,
    yearParam?: number,
    monthParam?: number,
  ) {
    const { year, month } = this.resolvePeriod(yearParam, monthParam);

    await this.refreshOverdueStatuses(userId);

    const { propertyWhere, unitWhere, rentWhere } = this.buildOverviewFilters(
      userId,
      propertyId,
      year,
      month,
    );

    const [
      propertiesCount,
      unitCounts,
      activeTenantGroups,
      rentTotals,
      rentStatusGroups,
    ] = await this.fetchOverviewData(propertyWhere, unitWhere, rentWhere);

    const unitMetrics = MetricsUtil.calculateUnitMetrics(unitCounts as UnitCountGroup[]);
    const collectionMetrics = MetricsUtil.calculateCollectionMetrics(
      rentTotals._sum.totalAmount,
      rentTotals._sum.paidAmount,
    );
    const rentStatusCounts = this.extractRentStatusCounts(rentStatusGroups as RentStatusCountGroup[]);

    return {
      message: 'ড্যাশবোর্ড সারাংশ',
      data: {
        totalProperties: propertiesCount,
        totalUnits: unitMetrics.totalUnits,
        occupiedUnits: unitMetrics.occupiedUnits,
        vacantUnits: unitMetrics.vacantUnits,
        maintenanceUnits: unitMetrics.maintenanceUnits,
        totalTenants: activeTenantGroups.length,
        occupancyRate: unitMetrics.occupancyRate,
        currentMonth: {
          year,
          month,
          expected: collectionMetrics.expected.toNumber(),
          collected: collectionMetrics.collected.toNumber(),
          outstanding: collectionMetrics.outstanding.toNumber(),
          collectionRate: collectionMetrics.collectionRate,
          paidCount: rentStatusCounts.paidCount,
          partialCount: rentStatusCounts.partialCount,
          pendingCount: rentStatusCounts.pendingCount,
          overdueCount: rentStatusCounts.overdueCount,
        },
      },
    };
  }

  /**
   * Resolves target year and month, defaulting to current Dhaka rent period if omitted.
   */
  private resolvePeriod(yearParam?: number, monthParam?: number): { year: number; month: number } {
    const nowDhaka = DateUtil.nowInDhaka();
    const defaultPeriod = DateUtil.getDefaultRentPeriod(nowDhaka);
    return {
      year: yearParam || defaultPeriod.year,
      month: monthParam || defaultPeriod.month,
    };
  }

  /**
   * Refreshes overdue rent statuses for both PENDING and PARTIAL rents past due date.
   */
  private async refreshOverdueStatuses(userId: string): Promise<void> {
    await this.prisma.monthlyRent.updateMany({
      where: {
        agreement: {
          unit: {
            property: {
              ownerId: userId,
            },
          },
        },
        status: { in: [RentStatus.PENDING, RentStatus.PARTIAL] },
        dueDate: { lt: new Date() },
        remainingAmount: { gt: 0 },
      },
      data: {
        status: RentStatus.OVERDUE,
      },
    });
  }

  /**
   * Builds scoped Prisma where filters for dashboard aggregation queries.
   */
  private buildOverviewFilters(
    userId: string,
    propertyId: string | undefined,
    year: number,
    month: number,
  ) {
    const propertyWhere: Prisma.PropertyWhereInput = {
      ownerId: userId,
      deletedAt: null,
      ...(propertyId && { id: propertyId }),
    };

    const unitWhere: Prisma.UnitWhereInput = {
      property: propertyWhere,
      deletedAt: null,
    };

    const rentWhere: Prisma.MonthlyRentWhereInput = {
      agreement: { unit: unitWhere },
      year,
      month,
    };

    return { propertyWhere, unitWhere, rentWhere };
  }

  /**
   * Executes parallel database aggregations for dashboard overview.
   */
  private async fetchOverviewData(
    propertyWhere: Prisma.PropertyWhereInput,
    unitWhere: Prisma.UnitWhereInput,
    rentWhere: Prisma.MonthlyRentWhereInput,
  ) {
    return Promise.all([
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
  }

  /**
   * Extracts counts for each rent status from grouped query results.
   */
  private extractRentStatusCounts(rentStatusGroups: RentStatusCountGroup[]) {
    const rentCountByStatus = new Map(
      rentStatusGroups.map((group) => [group.status, group._count._all]),
    );
    return {
      paidCount: rentCountByStatus.get(RentStatus.PAID) || 0,
      partialCount: rentCountByStatus.get(RentStatus.PARTIAL) || 0,
      pendingCount: rentCountByStatus.get(RentStatus.PENDING) || 0,
      overdueCount: rentCountByStatus.get(RentStatus.OVERDUE) || 0,
    };
  }
}
