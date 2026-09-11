import { DashboardService } from './dashboard.service';
import { RentStatus, UnitStatus, Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const OWNER_ID = 'owner-uuid-001';
const PROPERTY_ID = 'prop-uuid-001';

const mockPrisma = {
  monthlyRent: {
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  property: { count: jest.fn() },
  unit: { groupBy: jest.fn() },
  rentalAgreement: { groupBy: jest.fn() },
};

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DashboardService(mockPrisma as any);
  });

  // =========================================================================
  // getOverview — unit metrics
  // =========================================================================
  describe('getOverview — unit metrics', () => {
    it('calculates totalUnits, occupiedUnits, vacantUnits, maintenanceUnits', async () => {
      mockPrisma.property.count.mockResolvedValue(3);
      mockPrisma.unit.groupBy.mockResolvedValue([
        { status: UnitStatus.OCCUPIED, _count: { _all: 8 } },
        { status: UnitStatus.VACANT, _count: { _all: 4 } },
        { status: UnitStatus.MAINTENANCE, _count: { _all: 2 } },
      ]);
      mockPrisma.rentalAgreement.groupBy.mockResolvedValue([
        { tenantId: 't1' }, { tenantId: 't2' }, { tenantId: 't3' },
      ]);
      mockPrisma.monthlyRent.aggregate.mockResolvedValue({
        _sum: { totalAmount: new Prisma.Decimal(100000), paidAmount: new Prisma.Decimal(80000) },
      });
      mockPrisma.monthlyRent.groupBy.mockResolvedValue([
        { status: RentStatus.PAID, _count: { _all: 5 } },
        { status: RentStatus.PARTIAL, _count: { _all: 2 } },
        { status: RentStatus.PENDING, _count: { _all: 1 } },
      ]);

      const result = await service.getOverview(OWNER_ID);

      expect(result.data.totalUnits).toBe(14);
      expect(result.data.occupiedUnits).toBe(8);
      expect(result.data.vacantUnits).toBe(4);
      expect(result.data.maintenanceUnits).toBe(2);
    });

    it('calculates occupancyRate correctly (occupied / total * 100)', async () => {
      mockPrisma.property.count.mockResolvedValue(1);
      mockPrisma.unit.groupBy.mockResolvedValue([
        { status: UnitStatus.OCCUPIED, _count: { _all: 7 } },
        { status: UnitStatus.VACANT, _count: { _all: 3 } },
      ]);
      mockPrisma.rentalAgreement.groupBy.mockResolvedValue([]);
      mockPrisma.monthlyRent.aggregate.mockResolvedValue({ _sum: { totalAmount: null, paidAmount: null } });
      mockPrisma.monthlyRent.groupBy.mockResolvedValue([]);

      const result = await service.getOverview(OWNER_ID);
      expect(result.data.occupancyRate).toBe(70); // 7/10 * 100
    });

    it('returns 0 occupancyRate when there are no units', async () => {
      mockPrisma.property.count.mockResolvedValue(0);
      mockPrisma.unit.groupBy.mockResolvedValue([]);
      mockPrisma.rentalAgreement.groupBy.mockResolvedValue([]);
      mockPrisma.monthlyRent.aggregate.mockResolvedValue({ _sum: { totalAmount: null, paidAmount: null } });
      mockPrisma.monthlyRent.groupBy.mockResolvedValue([]);

      const result = await service.getOverview(OWNER_ID);
      expect(result.data.occupancyRate).toBe(0);
      expect(result.data.totalUnits).toBe(0);
    });
  });

  // =========================================================================
  // getOverview — collection metrics
  // =========================================================================
  describe('getOverview — collection metrics', () => {
    it('calculates expected, collected, outstanding, collectionRate', async () => {
      mockPrisma.property.count.mockResolvedValue(1);
      mockPrisma.unit.groupBy.mockResolvedValue([]);
      mockPrisma.rentalAgreement.groupBy.mockResolvedValue([]);
      mockPrisma.monthlyRent.aggregate.mockResolvedValue({
        _sum: {
          totalAmount: new Prisma.Decimal(100000),
          paidAmount: new Prisma.Decimal(80000),
        },
      });
      mockPrisma.monthlyRent.groupBy.mockResolvedValue([
        { status: RentStatus.PAID, _count: { _all: 4 } },
        { status: RentStatus.PARTIAL, _count: { _all: 2 } },
      ]);

      const result = await service.getOverview(OWNER_ID);
      const cm = result.data.currentMonth;
      expect(cm.expected).toBe(100000);
      expect(cm.collected).toBe(80000);
      expect(cm.outstanding).toBe(20000);
      expect(cm.collectionRate).toBe(80);
    });

    it('returns 0 collectionRate when expected is 0 (no rents)', async () => {
      mockPrisma.property.count.mockResolvedValue(1);
      mockPrisma.unit.groupBy.mockResolvedValue([]);
      mockPrisma.rentalAgreement.groupBy.mockResolvedValue([]);
      mockPrisma.monthlyRent.aggregate.mockResolvedValue({ _sum: { totalAmount: null, paidAmount: null } });
      mockPrisma.monthlyRent.groupBy.mockResolvedValue([]);

      const result = await service.getOverview(OWNER_ID);
      expect(result.data.currentMonth.collectionRate).toBe(0);
    });
  });

  // =========================================================================
  // getOverview — rent status counts
  // =========================================================================
  describe('getOverview — rent status counts', () => {
    it('correctly extracts paidCount, partialCount, pendingCount, overdueCount', async () => {
      mockPrisma.property.count.mockResolvedValue(1);
      mockPrisma.unit.groupBy.mockResolvedValue([]);
      mockPrisma.rentalAgreement.groupBy.mockResolvedValue([]);
      mockPrisma.monthlyRent.aggregate.mockResolvedValue({ _sum: { totalAmount: null, paidAmount: null } });
      mockPrisma.monthlyRent.groupBy.mockResolvedValue([
        { status: RentStatus.PAID, _count: { _all: 5 } },
        { status: RentStatus.PARTIAL, _count: { _all: 2 } },
        { status: RentStatus.PENDING, _count: { _all: 3 } },
        { status: RentStatus.OVERDUE, _count: { _all: 1 } },
      ]);

      const result = await service.getOverview(OWNER_ID);
      expect(result.data.currentMonth.paidCount).toBe(5);
      expect(result.data.currentMonth.partialCount).toBe(2);
      expect(result.data.currentMonth.pendingCount).toBe(3);
      expect(result.data.currentMonth.overdueCount).toBe(1);
    });

    it('defaults missing status counts to 0', async () => {
      mockPrisma.property.count.mockResolvedValue(1);
      mockPrisma.unit.groupBy.mockResolvedValue([]);
      mockPrisma.rentalAgreement.groupBy.mockResolvedValue([]);
      mockPrisma.monthlyRent.aggregate.mockResolvedValue({ _sum: { totalAmount: null, paidAmount: null } });
      // Only PAID status exists in DB — others should default to 0
      mockPrisma.monthlyRent.groupBy.mockResolvedValue([
        { status: RentStatus.PAID, _count: { _all: 3 } },
      ]);

      const result = await service.getOverview(OWNER_ID);
      expect(result.data.currentMonth.partialCount).toBe(0);
      expect(result.data.currentMonth.pendingCount).toBe(0);
      expect(result.data.currentMonth.overdueCount).toBe(0);
    });
  });

  // =========================================================================
  // refreshOverdueStatuses — called on every getOverview
  // =========================================================================
  describe('refreshOverdueStatuses', () => {
    it('calls updateMany with correct filter (PENDING|PARTIAL, past dueDate, remaining > 0)', async () => {
      mockPrisma.property.count.mockResolvedValue(0);
      mockPrisma.unit.groupBy.mockResolvedValue([]);
      mockPrisma.rentalAgreement.groupBy.mockResolvedValue([]);
      mockPrisma.monthlyRent.aggregate.mockResolvedValue({ _sum: { totalAmount: null, paidAmount: null } });
      mockPrisma.monthlyRent.groupBy.mockResolvedValue([]);

      await service.getOverview(OWNER_ID);

      const updateCall = mockPrisma.monthlyRent.updateMany.mock.calls[0][0];
      expect(updateCall.where.status).toEqual({ in: [RentStatus.PENDING, RentStatus.PARTIAL] });
      expect(updateCall.where.dueDate).toEqual({ lt: expect.any(Date) });
      expect(updateCall.where.remainingAmount).toEqual({ gt: 0 });
      expect(updateCall.data.status).toBe(RentStatus.OVERDUE);
    });

    it('always scopes overdue refresh to requesting user\'s properties (no cross-user bleed)', async () => {
      mockPrisma.property.count.mockResolvedValue(0);
      mockPrisma.unit.groupBy.mockResolvedValue([]);
      mockPrisma.rentalAgreement.groupBy.mockResolvedValue([]);
      mockPrisma.monthlyRent.aggregate.mockResolvedValue({ _sum: { totalAmount: null, paidAmount: null } });
      mockPrisma.monthlyRent.groupBy.mockResolvedValue([]);

      await service.getOverview(OWNER_ID);

      const updateCall = mockPrisma.monthlyRent.updateMany.mock.calls[0][0];
      // Must contain ownerId scoping, not update ALL rents globally
      expect(JSON.stringify(updateCall.where)).toContain(OWNER_ID);
    });
  });

  // =========================================================================
  // propertyId filtering — scoped overview
  // =========================================================================
  describe('propertyId filtering', () => {
    it('passes propertyId filter through to all DB queries', async () => {
      mockPrisma.property.count.mockResolvedValue(1);
      mockPrisma.unit.groupBy.mockResolvedValue([]);
      mockPrisma.rentalAgreement.groupBy.mockResolvedValue([]);
      mockPrisma.monthlyRent.aggregate.mockResolvedValue({ _sum: { totalAmount: null, paidAmount: null } });
      mockPrisma.monthlyRent.groupBy.mockResolvedValue([]);

      await service.getOverview(OWNER_ID, PROPERTY_ID);

      const countCall = mockPrisma.property.count.mock.calls[0][0];
      expect(countCall.where.id).toBe(PROPERTY_ID);
    });
  });
});
