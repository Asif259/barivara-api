import { MonthlyRentsService } from './monthly-rents.service';
import { DateUtil } from '../common/utils/date.util';
import { RentStatus, AuditAction, Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const OWNER_ID = 'owner-uuid-001';

const makeAgreement = (
  id: string,
  dueDay = 10,
  startDate = new Date('2026-08-01'),
  endDate: Date | null = null,
) => ({
  id,
  monthlyRent: new Prisma.Decimal(20000),
  serviceFee: new Prisma.Decimal(3000),
  parkingFee: new Prisma.Decimal(2000),
  extraCharge: new Prisma.Decimal(500),
  dueDay,
  startDate,
  endDate,
});

const makeTxPrisma = () => ({
  monthlyRent: {
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    update: jest.fn(),
  },
  auditLog: {
    create: jest.fn().mockResolvedValue({}),
  },
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
let mockTx = makeTxPrisma();

const mockPrisma = {
  rentalAgreement: { findMany: jest.fn() },
  monthlyRent: { findMany: jest.fn(), createMany: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(async (callback: any) => callback(mockTx)),
};

describe('MonthlyRentsService — generate', () => {
  let service: MonthlyRentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTx = makeTxPrisma();
    service = new MonthlyRentsService(mockPrisma as any);
  });

  // =========================================================================
  // Core generation logic
  // =========================================================================
  it('generates rents for all active agreements', async () => {
    const agreements = [makeAgreement('agr-1'), makeAgreement('agr-2')];
    mockPrisma.rentalAgreement.findMany.mockResolvedValue(agreements);
    mockPrisma.monthlyRent.findMany.mockResolvedValue([]); // none exist yet
    mockTx.monthlyRent.createMany.mockResolvedValue({ count: 2 });

    const result = await service.generate(OWNER_ID, { year: 2026, month: 8 });
    expect(result.data.generatedCount).toBe(2);
    expect(result.data.skippedCount).toBe(0);
  });

  it('skips agreements that already have rent for the given month (idempotent)', async () => {
    const agreements = [makeAgreement('agr-1'), makeAgreement('agr-2')];
    mockPrisma.rentalAgreement.findMany.mockResolvedValue(agreements);
    mockPrisma.monthlyRent.findMany.mockResolvedValue([{ agreementId: 'agr-1', year: 2026, month: 8 }]);
    mockTx.monthlyRent.createMany.mockResolvedValue({ count: 1 });

    const result = await service.generate(OWNER_ID, { year: 2026, month: 8 });
    expect(result.data.generatedCount).toBe(1);
    expect(result.data.skippedCount).toBe(0);
  });

  it('returns 0 generated when all agreements already have rents', async () => {
    const agreements = [makeAgreement('agr-1')];
    mockPrisma.rentalAgreement.findMany.mockResolvedValue(agreements);
    mockPrisma.monthlyRent.findMany.mockResolvedValue([{ agreementId: 'agr-1', year: 2026, month: 8 }]);
    mockTx.monthlyRent.createMany.mockResolvedValue({ count: 0 });

    const result = await service.generate(OWNER_ID, { year: 2026, month: 8 });
    expect(result.data.generatedCount).toBe(0);
    expect(result.data.skippedCount).toBe(0);
  });

  it('returns 0 when there are no active agreements', async () => {
    mockPrisma.rentalAgreement.findMany.mockResolvedValue([]);
    mockPrisma.monthlyRent.findMany.mockResolvedValue([]);

    const result = await service.generate(OWNER_ID, { year: 2026, month: 8 });
    expect(result.data.generatedCount).toBe(0);
    expect(result.data.totalAgreementsProcessed).toBe(0);
    expect(mockTx.monthlyRent.createMany).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Multi-Month Backfill & Missing Month Scenarios
  // =========================================================================
  it('September invoice already exists and is unpaid; October invoice is missing; generation through October creates only October', async () => {
    // Agreement started in September 2026
    const agreement = makeAgreement('agr-1', 10, new Date('2026-09-01'));
    mockPrisma.rentalAgreement.findMany.mockResolvedValue([agreement]);
    // September invoice exists (unpaid status PENDING)
    mockPrisma.monthlyRent.findMany.mockResolvedValue([
      { agreementId: 'agr-1', year: 2026, month: 9, status: RentStatus.PENDING },
    ]);

    let capturedRents: any[] = [];
    mockTx.monthlyRent.createMany.mockImplementation(({ data }: any) => {
      capturedRents = data;
      return { count: data.length };
    });

    const result = await service.generate(OWNER_ID, { year: 2026, month: 10 });
    expect(result.data.generatedCount).toBe(1);
    expect(capturedRents).toHaveLength(1);
    expect(capturedRents[0].month).toBe(10);
    expect(capturedRents[0].year).toBe(2026);
  });

  it('Both September and October invoices are missing; generation through October creates both', async () => {
    // Agreement started in September 2026
    const agreement = makeAgreement('agr-1', 10, new Date('2026-09-01'));
    mockPrisma.rentalAgreement.findMany.mockResolvedValue([agreement]);
    mockPrisma.monthlyRent.findMany.mockResolvedValue([]); // neither exists

    let capturedRents: any[] = [];
    mockTx.monthlyRent.createMany.mockImplementation(({ data }: any) => {
      capturedRents = data;
      return { count: data.length };
    });

    const result = await service.generate(OWNER_ID, { year: 2026, month: 10 });
    expect(result.data.generatedCount).toBe(2);
    expect(capturedRents).toHaveLength(2);
    expect(capturedRents.map((r) => r.month)).toEqual([9, 10]);
  });

  it('Re-running generation does not create duplicates (idempotent)', async () => {
    const agreement = makeAgreement('agr-1', 10, new Date('2026-09-01'));
    mockPrisma.rentalAgreement.findMany.mockResolvedValue([agreement]);
    // Both 9 and 10 already exist
    mockPrisma.monthlyRent.findMany.mockResolvedValue([
      { agreementId: 'agr-1', year: 2026, month: 9 },
      { agreementId: 'agr-1', year: 2026, month: 10 },
    ]);

    const result = await service.generate(OWNER_ID, { year: 2026, month: 10 });
    expect(result.data.generatedCount).toBe(0);
    expect(mockTx.monthlyRent.createMany).not.toHaveBeenCalled();
  });

  it('A paid or cancelled existing invoice is not duplicated', async () => {
    const agreement = makeAgreement('agr-1', 10, new Date('2026-09-01'));
    mockPrisma.rentalAgreement.findMany.mockResolvedValue([agreement]);
    // September invoice is PAID, October is CANCELLED
    mockPrisma.monthlyRent.findMany.mockResolvedValue([
      { agreementId: 'agr-1', year: 2026, month: 9, status: RentStatus.PAID },
      { agreementId: 'agr-1', year: 2026, month: 10, status: RentStatus.CANCELLED },
    ]);

    const result = await service.generate(OWNER_ID, { year: 2026, month: 10 });
    expect(result.data.generatedCount).toBe(0);
    expect(mockTx.monthlyRent.createMany).not.toHaveBeenCalled();
  });

  it('An agreement is not billed outside its eligible period (respects startDate and endDate)', async () => {
    // Agreement active only for September 2026 (ended on Sep 30)
    const agreement = makeAgreement(
      'agr-ended',
      10,
      new Date('2026-09-01'),
      new Date('2026-09-30'),
    );
    mockPrisma.rentalAgreement.findMany.mockResolvedValue([agreement]);
    mockPrisma.monthlyRent.findMany.mockResolvedValue([]);

    let capturedRents: any[] = [];
    mockTx.monthlyRent.createMany.mockImplementation(({ data }: any) => {
      capturedRents = data;
      return { count: data.length };
    });

    // Generate through October
    await service.generate(OWNER_ID, { year: 2026, month: 10 });

    // October must NOT be generated because agreement ended before October 1
    expect(capturedRents).toHaveLength(1);
    expect(capturedRents[0].month).toBe(9);
    expect(capturedRents[0].year).toBe(2026);
  });

  // =========================================================================
  // Critical date rules: rent month → due date calculations
  // =========================================================================
  it('August rent (month=8, dueDay=10) → due date is September 10', async () => {
    const agreements = [makeAgreement('agr-1', 10, new Date('2026-08-01'))];
    mockPrisma.rentalAgreement.findMany.mockResolvedValue(agreements);
    mockPrisma.monthlyRent.findMany.mockResolvedValue([]);

    let capturedData: any[] = [];
    mockTx.monthlyRent.createMany.mockImplementation(({ data }: any) => {
      capturedData = data;
      return { count: data.length };
    });

    await service.generate(OWNER_ID, { year: 2026, month: 8 });

    const dueDate: Date = capturedData[0].dueDate;
    const formatted = DateUtil.formatDhaka(dueDate, 'yyyy-MM-dd');
    expect(formatted).toBe('2026-09-10');
  });

  it('December rent (month=12, dueDay=10) → due date is January 10 of next year', async () => {
    const agreements = [makeAgreement('agr-1', 10, new Date('2026-12-01'))];
    mockPrisma.rentalAgreement.findMany.mockResolvedValue(agreements);
    mockPrisma.monthlyRent.findMany.mockResolvedValue([]);

    let capturedData: any[] = [];
    mockTx.monthlyRent.createMany.mockImplementation(({ data }: any) => {
      capturedData = data;
      return { count: data.length };
    });

    await service.generate(OWNER_ID, { year: 2026, month: 12 });

    const dueDate: Date = capturedData[0].dueDate;
    const formatted = DateUtil.formatDhaka(dueDate, 'yyyy-MM-dd');
    expect(formatted).toBe('2027-01-10');
  });

  it('handles month-end clamping: January rent with dueDay=31 → due date is February 28 in non-leap year', () => {
    const dueDate = DateUtil.calculateDueDate(2026, 1, 31);
    const formatted = DateUtil.formatDhaka(dueDate, 'yyyy-MM-dd');
    expect(formatted).toBe('2026-02-28');
  });

  it('handles leap year month-end clamping: January 2024 rent with dueDay=31 → due date is February 29', () => {
    const dueDate = DateUtil.calculateDueDate(2024, 1, 31);
    const formatted = DateUtil.formatDhaka(dueDate, 'yyyy-MM-dd');
    expect(formatted).toBe('2024-02-29');
  });

  // =========================================================================
  // Financial formula: total = rent + serviceFee + parkingFee + extraCharge
  // =========================================================================
  it('calculates totalAmount correctly: rent + serviceFee + parkingFee + extraCharge', async () => {
    const agreements = [makeAgreement('agr-1', 10, new Date('2026-08-01'))];
    mockPrisma.rentalAgreement.findMany.mockResolvedValue(agreements);
    mockPrisma.monthlyRent.findMany.mockResolvedValue([]);

    let capturedData: any[] = [];
    mockTx.monthlyRent.createMany.mockImplementation(({ data }: any) => {
      capturedData = data;
      return { count: data.length };
    });

    await service.generate(OWNER_ID, { year: 2026, month: 8 });

    expect(capturedData[0].totalAmount.toString()).toBe('25500');
    expect(capturedData[0].paidAmount.toString()).toBe('0');
    expect(capturedData[0].remainingAmount.toString()).toBe('25500');
    expect(capturedData[0].lateFee.toString()).toBe('0');
    expect(capturedData[0].discount.toString()).toBe('0');
  });

  it('sets initial status to PENDING when dueDate is in the future', async () => {
    const agreements = [makeAgreement('agr-1', 10, new Date('2050-08-01'))];
    mockPrisma.rentalAgreement.findMany.mockResolvedValue(agreements);
    mockPrisma.monthlyRent.findMany.mockResolvedValue([]);

    let capturedData: any[] = [];
    mockTx.monthlyRent.createMany.mockImplementation(({ data }: any) => {
      capturedData = data;
      return { count: data.length };
    });

    await service.generate(OWNER_ID, { year: 2050, month: 8 });
    expect(capturedData[0].status).toBe(RentStatus.PENDING);
  });

  it('logs an audit event for each generate call', async () => {
    mockPrisma.rentalAgreement.findMany.mockResolvedValue([makeAgreement('agr-1')]);
    mockPrisma.monthlyRent.findMany.mockResolvedValue([]);
    mockTx.monthlyRent.createMany.mockResolvedValue({ count: 1 });

    await service.generate(OWNER_ID, { year: 2026, month: 8 });

    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: OWNER_ID,
          action: AuditAction.RENT_GENERATED,
        }),
      }),
    );
  });
});
