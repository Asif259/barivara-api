import { MonthlyRentsService } from './monthly-rents.service';
import { DateUtil } from '../common/utils/date.util';
import { RentStatus, AuditAction, Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const OWNER_ID = 'owner-uuid-001';

const makeAgreement = (id: string, dueDay = 10) => ({
  id,
  monthlyRent: new Prisma.Decimal(20000),
  serviceFee: new Prisma.Decimal(3000),
  parkingFee: new Prisma.Decimal(2000),
  extraCharge: new Prisma.Decimal(500),
  dueDay,
});

const makeTxPrisma = () => ({
  monthlyRent: {
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
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
  monthlyRent: { findMany: jest.fn(), createMany: jest.fn() },
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
    // agr-1 already has a rent for August 2026
    mockPrisma.monthlyRent.findMany.mockResolvedValue([{ agreementId: 'agr-1' }]);
    mockTx.monthlyRent.createMany.mockResolvedValue({ count: 1 });

    const result = await service.generate(OWNER_ID, { year: 2026, month: 8 });
    expect(result.data.generatedCount).toBe(1);
    expect(result.data.skippedCount).toBe(1);
  });

  it('returns 0 generated when all agreements already have rents', async () => {
    const agreements = [makeAgreement('agr-1')];
    mockPrisma.rentalAgreement.findMany.mockResolvedValue(agreements);
    mockPrisma.monthlyRent.findMany.mockResolvedValue([{ agreementId: 'agr-1' }]);
    // createMany should NOT be called because rentsToCreate is empty
    mockTx.monthlyRent.createMany.mockResolvedValue({ count: 0 });

    const result = await service.generate(OWNER_ID, { year: 2026, month: 8 });
    expect(result.data.generatedCount).toBe(0);
    expect(result.data.skippedCount).toBe(1);
  });

  it('returns 0 when there are no active agreements', async () => {
    mockPrisma.rentalAgreement.findMany.mockResolvedValue([]);
    mockPrisma.monthlyRent.findMany.mockResolvedValue([]);

    const result = await service.generate(OWNER_ID, { year: 2026, month: 8 });
    expect(result.data.generatedCount).toBe(0);
    expect(result.data.totalAgreementsProcessed).toBe(0);
    // createMany should NOT be called for empty arrays
    expect(mockTx.monthlyRent.createMany).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Critical date rule: rent month → due date is NEXT calendar month
  //   August (month=8) rent → September 10 due date
  //   December (month=12) rent → January of next year
  // =========================================================================
  it('August rent (month=8, dueDay=10) → due date is September 10', async () => {
    const agreements = [makeAgreement('agr-1', 10)];
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
    const agreements = [makeAgreement('agr-1', 10)];
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

  // =========================================================================
  // Financial formula: total = rent + serviceFee + parkingFee + extraCharge
  // (lateFee and discount are 0 at generation time)
  // =========================================================================
  it('calculates totalAmount correctly: rent + serviceFee + parkingFee + extraCharge', async () => {
    // Agreement: rent=20000, serviceFee=3000, parkingFee=2000, extraCharge=500 → total=25500
    const agreements = [makeAgreement('agr-1', 10)];
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
    const agreements = [makeAgreement('agr-1', 10)];
    mockPrisma.rentalAgreement.findMany.mockResolvedValue(agreements);
    mockPrisma.monthlyRent.findMany.mockResolvedValue([]);

    let capturedData: any[] = [];
    mockTx.monthlyRent.createMany.mockImplementation(({ data }: any) => {
      capturedData = data;
      return { count: data.length };
    });

    // Generate for current month — due date will be next month, in the future
    await service.generate(OWNER_ID, { year: 2050, month: 8 });
    // September 10 due date is in the future relative to generation in August
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
