import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { ErrorCode } from '../common/constants/error-codes';
import { PaymentStatus, RentStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';

// =========================================================================
// Test fixtures
// =========================================================================
const OWNER_ID = 'owner-uuid-001';
const OTHER_OWNER_ID = 'owner-uuid-002';
const MONTHLY_RENT_ID = 'rent-uuid-001';
const PAYMENT_ID = 'payment-uuid-001';

const makeMockRent = (overrides: Partial<any> = {}) => ({
  id: MONTHLY_RENT_ID,
  totalAmount: new Prisma.Decimal(25500),
  paidAmount: new Prisma.Decimal(0),
  remainingAmount: new Prisma.Decimal(25500),
  status: RentStatus.PENDING,
  dueDate: new Date('2050-09-10T17:59:59.999Z'), // Sep 10 23:59:59 Dhaka
  ...overrides,
  agreement: {
    unit: {
      property: { ownerId: OWNER_ID },
    },
    ...(overrides.agreement || {}),
  },
});

const makeMockPayment = (overrides: Partial<any> = {}) => ({
  id: PAYMENT_ID,
  monthlyRentId: MONTHLY_RENT_ID,
  amount: new Prisma.Decimal(10000),
  status: PaymentStatus.COMPLETED,
  paymentDate: new Date('2026-09-05T10:00:00.000Z'),
  ...overrides,
  monthlyRent: {
    totalAmount: new Prisma.Decimal(25500),
    paidAmount: new Prisma.Decimal(10000),
    remainingAmount: new Prisma.Decimal(15500),
    status: RentStatus.PARTIAL,
    dueDate: new Date('2050-09-10T17:59:59.999Z'),
    agreement: {
      unit: {
        property: { ownerId: OWNER_ID },
      },
    },
    ...(overrides.monthlyRent || {}),
  },
});

// =========================================================================
// Prisma mock factory
// =========================================================================
const makePrisma = () => ({
  monthlyRent: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  payment: {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
    aggregate: jest.fn(),
  },
  user: {
    findUnique: jest.fn().mockResolvedValue({ id: OWNER_ID, name: 'মালিক', signatureFileId: null }),
  },
  auditLog: {
    create: jest.fn().mockResolvedValue({}),
  },
  $transaction: jest.fn(async (callback: any) => callback(mockPrismaInner)),
});

// Inner prisma passed inside $transaction callback
const mockPrismaInner: any = {
  monthlyRent: { findUnique: jest.fn(), update: jest.fn() },
  payment: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn(), aggregate: jest.fn() },
  auditLog: { create: jest.fn().mockResolvedValue({}) },
};

describe('PaymentsService', () => {
  let service: PaymentsService;
  let mockPrisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset inner transaction mock
    mockPrismaInner.monthlyRent.findUnique.mockReset();
    mockPrismaInner.monthlyRent.update.mockReset();
    mockPrismaInner.payment.create.mockReset();
    mockPrismaInner.payment.update.mockReset();
    mockPrismaInner.payment.findFirst.mockReset();
    mockPrismaInner.payment.aggregate.mockReset();
    mockPrismaInner.auditLog.create.mockResolvedValue({});

    mockPrisma = makePrisma();
    service = new PaymentsService(mockPrisma as any);
  });

  // =========================================================================
  // create — payment creation
  // =========================================================================
  describe('create', () => {
    const PARTIAL_DTO = {
      monthlyRentId: MONTHLY_RENT_ID,
      amount: 10000,
      paymentMethod: 'CASH' as const,
    };

    const FULL_DTO = {
      monthlyRentId: MONTHLY_RENT_ID,
      amount: 25500,
      paymentMethod: 'CASH' as const,
    };

    it('PARTIAL payment: remaining > 0 → status becomes PARTIAL', async () => {
      const rent = makeMockRent();
      mockPrisma.monthlyRent.findUnique.mockResolvedValue(rent);
      mockPrismaInner.monthlyRent.findUnique.mockResolvedValue(rent);

      const createdPayment = { id: PAYMENT_ID, amount: new Prisma.Decimal(10000), status: PaymentStatus.COMPLETED };
      mockPrismaInner.payment.create.mockResolvedValue(createdPayment);
      mockPrismaInner.monthlyRent.update.mockResolvedValue({
        ...rent, paidAmount: new Prisma.Decimal(10000),
        remainingAmount: new Prisma.Decimal(15500), status: RentStatus.PARTIAL,
      });

      const result = await service.create(OWNER_ID, PARTIAL_DTO);
      expect(result.data).toBeDefined();

      // The updated rent status must be PARTIAL
      const updateCall = mockPrismaInner.monthlyRent.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(RentStatus.PARTIAL);
      expect(updateCall.data.paidDate).toBeNull();
    });

    it('FULL payment: remaining = 0 → status becomes PAID, paidDate is set', async () => {
      const rent = makeMockRent();
      mockPrisma.monthlyRent.findUnique.mockResolvedValue(rent);
      mockPrismaInner.monthlyRent.findUnique.mockResolvedValue(rent);

      mockPrismaInner.payment.create.mockResolvedValue({ id: PAYMENT_ID, amount: new Prisma.Decimal(25500) });
      mockPrismaInner.monthlyRent.update.mockResolvedValue({
        ...rent, paidAmount: new Prisma.Decimal(25500),
        remainingAmount: new Prisma.Decimal(0), status: RentStatus.PAID,
      });

      await service.create(OWNER_ID, FULL_DTO);

      const updateCall = mockPrismaInner.monthlyRent.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(RentStatus.PAID);
      expect(updateCall.data.paidDate).toBeDefined();
      expect(updateCall.data.paidDate).not.toBeNull();
    });

    it('rejects payment when monthly rent is not found → 404', async () => {
      mockPrisma.monthlyRent.findUnique.mockResolvedValue(null);

      await expect(service.create(OWNER_ID, PARTIAL_DTO)).rejects.toThrow(NotFoundException);
    });

    it('IDOR guard: throws ForbiddenException when rent belongs to another owner', async () => {
      const rent = makeMockRent({ agreement: { unit: { property: { ownerId: OTHER_OWNER_ID } } } });
      mockPrisma.monthlyRent.findUnique.mockResolvedValue(rent);

      await expect(service.create(OWNER_ID, PARTIAL_DTO)).rejects.toThrow(ForbiddenException);
    });

    it('rejects payment exceeding remaining balance → 400', async () => {
      // Rent with 5000 remaining
      const rent = makeMockRent({
        remainingAmount: new Prisma.Decimal(5000),
        paidAmount: new Prisma.Decimal(20500),
      });
      mockPrisma.monthlyRent.findUnique.mockResolvedValue(rent);

      await expect(
        service.create(OWNER_ID, { ...PARTIAL_DTO, amount: 10000 }),
      ).rejects.toMatchObject({
        response: { errorCode: ErrorCode.PAYMENT_EXCEEDS_REMAINING },
      });
    });

    it('rejects zero-amount payment → 400', async () => {
      const rent = makeMockRent();
      mockPrisma.monthlyRent.findUnique.mockResolvedValue(rent);

      await expect(
        service.create(OWNER_ID, { ...PARTIAL_DTO, amount: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects payment for a CANCELLED rent → 400', async () => {
      const rent = makeMockRent({ status: RentStatus.CANCELLED });
      mockPrisma.monthlyRent.findUnique.mockResolvedValue(rent);

      await expect(service.create(OWNER_ID, PARTIAL_DTO)).rejects.toMatchObject({
        response: { errorCode: ErrorCode.INVALID_STATUS_TRANSITION },
      });
    });

    it('captures owner signature snapshot at payment creation time', async () => {
      const rent = makeMockRent();
      mockPrisma.monthlyRent.findUnique.mockResolvedValue(rent);
      mockPrismaInner.monthlyRent.findUnique.mockResolvedValue(rent);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: OWNER_ID, name: 'মালিক', signatureFileId: 'sig-file-uuid-123',
      });

      mockPrismaInner.payment.create.mockResolvedValue({ id: PAYMENT_ID });
      mockPrismaInner.monthlyRent.update.mockResolvedValue({ ...rent, status: RentStatus.PARTIAL });

      await service.create(OWNER_ID, PARTIAL_DTO);

      const paymentCreate = mockPrismaInner.payment.create.mock.calls[0][0];
      expect(paymentCreate.data.ownerSignatureSnapshotId).toBe('sig-file-uuid-123');
    });
  });

  // =========================================================================
  // reverse — payment reversal
  // =========================================================================
  describe('reverse', () => {
    it('marks payment as REVERSED and recalculates rent status', async () => {
      const payment = makeMockPayment();
      mockPrisma.payment = { ...mockPrisma.payment, findUnique: jest.fn().mockResolvedValue(payment) } as any;

      // After reversal, 0 payments remain → PENDING
      mockPrismaInner.payment.update.mockResolvedValue({ ...payment, status: PaymentStatus.REVERSED });
      mockPrismaInner.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });
      mockPrismaInner.monthlyRent.update.mockResolvedValue({
        id: MONTHLY_RENT_ID, paidAmount: new Prisma.Decimal(0),
        remainingAmount: new Prisma.Decimal(25500), status: RentStatus.PENDING,
      });

      const result = await service.reverse(OWNER_ID, PAYMENT_ID);
      expect(result.data.payment.status).toBe(PaymentStatus.REVERSED);
    });

    it('recalculates to PAID when other completed payments still cover the total', async () => {
      // A rent with 2 payments of 12750 each. Reversing one leaves 12750.
      // But here we simulate the DB aggregate returning 25500 (the other payment covers it all).
      const payment = makeMockPayment({ amount: new Prisma.Decimal(12750) });
      mockPrisma.payment = { ...mockPrisma.payment, findUnique: jest.fn().mockResolvedValue(payment) } as any;

      mockPrismaInner.payment.update.mockResolvedValue({ ...payment, status: PaymentStatus.REVERSED });
      mockPrismaInner.payment.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(25500) }, // the other payment covers the full rent
      });
      mockPrismaInner.payment.findFirst.mockResolvedValue({ paymentDate: new Date() });
      mockPrismaInner.monthlyRent.update.mockResolvedValue({
        id: MONTHLY_RENT_ID, status: RentStatus.PAID,
      });

      await service.reverse(OWNER_ID, PAYMENT_ID);
      const updateCall = mockPrismaInner.monthlyRent.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(RentStatus.PAID);
    });

    it('throws ForbiddenException when payment belongs to another owner', async () => {
      const payment = makeMockPayment({
        monthlyRent: {
          totalAmount: new Prisma.Decimal(25500), paidAmount: new Prisma.Decimal(10000),
          remainingAmount: new Prisma.Decimal(15500), status: RentStatus.PARTIAL,
          dueDate: new Date(),
          agreement: { unit: { property: { ownerId: OTHER_OWNER_ID } } },
        },
      });
      mockPrisma.payment = { ...mockPrisma.payment, findUnique: jest.fn().mockResolvedValue(payment) } as any;

      await expect(service.reverse(OWNER_ID, PAYMENT_ID)).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when payment is already reversed', async () => {
      const payment = makeMockPayment({ status: PaymentStatus.REVERSED });
      mockPrisma.payment = { ...mockPrisma.payment, findUnique: jest.fn().mockResolvedValue(payment) } as any;

      await expect(service.reverse(OWNER_ID, PAYMENT_ID)).rejects.toMatchObject({
        response: { errorCode: ErrorCode.PAYMENT_ALREADY_REVERSED },
      });
    });

    it('throws NotFoundException when payment does not exist', async () => {
      mockPrisma.payment = { ...mockPrisma.payment, findUnique: jest.fn().mockResolvedValue(null) } as any;

      await expect(service.reverse(OWNER_ID, 'nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
