import { RentCalculationUtil } from '../common/utils/rent-calculation.util';
import { Prisma, RentStatus } from '@prisma/client';

describe('RentCalculationUtil.calculateStatus', () => {
  it('should return PENDING when paidAmount is 0 and dueDate is in future', () => {
    const total = 25500;
    const paid = 0;
    const futureDueDate = new Date('2026-09-10T23:59:59.999Z');
    const currentDate = new Date('2026-09-02T10:00:00.000Z');

    const status = RentCalculationUtil.calculateStatus(total, paid, futureDueDate, currentDate);
    expect(status).toBe(RentStatus.PENDING);
  });

  it('should return PARTIAL when paidAmount > 0 and remainingAmount > 0', () => {
    const total = 25500;
    const paid = 20000;
    const futureDueDate = new Date('2026-09-10T23:59:59.999Z');
    const currentDate = new Date('2026-09-02T10:00:00.000Z');

    const status = RentCalculationUtil.calculateStatus(total, paid, futureDueDate, currentDate);
    expect(status).toBe(RentStatus.PARTIAL);
  });

  it('should return PAID when paidAmount equals totalAmount', () => {
    const total = 25500;
    const paid = 25500;
    const dueDate = new Date('2026-09-10T23:59:59.999Z');
    const currentDate = new Date('2026-09-02T10:00:00.000Z');

    const status = RentCalculationUtil.calculateStatus(total, paid, dueDate, currentDate);
    expect(status).toBe(RentStatus.PAID);
  });

  it('should return OVERDUE when remaining > 0 and dueDate has passed', () => {
    const total = 25500;
    const paid = 0;
    const pastDueDate = new Date('2026-09-01T23:59:59.999Z');
    const currentDate = new Date('2026-09-05T10:00:00.000Z');

    const status = RentCalculationUtil.calculateStatus(total, paid, pastDueDate, currentDate);
    expect(status).toBe(RentStatus.OVERDUE);
  });

  it('should return PAID even if paid after overdue date', () => {
    const total = 25500;
    const paid = 25500;
    const pastDueDate = new Date('2026-09-01T23:59:59.999Z');
    const currentDate = new Date('2026-09-05T10:00:00.000Z');

    const status = RentCalculationUtil.calculateStatus(total, paid, pastDueDate, currentDate);
    expect(status).toBe(RentStatus.PAID);
  });

  it('should return OVERDUE when partially paid after due date', () => {
    const total = 25500;
    const paid = 10000;
    const pastDueDate = new Date('2026-09-10T23:59:59.999Z');
    const currentDate = new Date('2026-09-11T10:00:00.000Z');

    const status = RentCalculationUtil.calculateStatus(total, paid, pastDueDate, currentDate);
    expect(status).toBe(RentStatus.OVERDUE);
  });
});

describe('MonthlyRentsService - Notice / Payment Request Workflow', () => {
  const OWNER_ID = 'owner-uuid-001';
  const OTHER_OWNER_ID = 'owner-uuid-999';
  const RENT_ID = 'rent-uuid-001';

  let service: any;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      rentalAgreement: {
        findMany: jest.fn(),
      },
      monthlyRent: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn().mockImplementation(({ data, where }: any) => Promise.resolve({ ...makeMockInvoice(), ...data, id: where.id })),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      payment: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const { MonthlyRentsService } = require('./monthly-rents.service');
    service = new MonthlyRentsService(mockPrisma);
  });

  const makeMockInvoice = (overrides: Partial<any> = {}) => ({
    id: RENT_ID,
    year: 2026,
    month: 10,
    rent: new Prisma.Decimal(20000),
    serviceFee: new Prisma.Decimal(3000),
    parkingFee: new Prisma.Decimal(2000),
    extraCharge: new Prisma.Decimal(500),
    lateFee: new Prisma.Decimal(0),
    discount: new Prisma.Decimal(0),
    totalAmount: new Prisma.Decimal(25500),
    paidAmount: new Prisma.Decimal(0),
    remainingAmount: new Prisma.Decimal(25500),
    status: RentStatus.PENDING,
    dueDate: new Date('2050-10-10T17:59:59.999Z'),
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    agreement: {
      tenant: {
        id: 'tenant-uuid-1',
        name: 'তানভীর আহমেদ',
        phone: '01711000000',
        email: 'tanvir@example.com',
      },
      unit: {
        id: 'unit-uuid-1',
        unitNumber: 'A-1',
        property: {
          id: 'prop-uuid-1',
          name: 'গ্রিন ভিলা',
          address: 'মিরপুর ২, ঢাকা',
          city: 'ঢাকা',
          district: 'ঢাকা',
          ownerId: OWNER_ID,
          owner: {
            id: OWNER_ID,
            name: 'আসিফ চৌধুরী',
            phone: '01811000000',
            email: 'asif@example.com',
            signatureFileId: 'sig-file-123',
          },
        },
      },
    },
    payments: [],
    ...overrides,
  });

  describe('Notice generation & data retrieval without payment creation', () => {
    it('should retrieve notice data without calling payment.create or altering rent status', async () => {
      const mockInvoice = makeMockInvoice();
      mockPrisma.monthlyRent.findUnique.mockResolvedValue(mockInvoice);

      const result = await service.findOne(OWNER_ID, RENT_ID);

      expect(mockPrisma.monthlyRent.findUnique).toHaveBeenCalledTimes(1);
      // Absolute guarantee: notice retrieval NEVER creates a payment
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
      // Absolute guarantee: notice retrieval NEVER updates status or amounts
      expect(mockPrisma.monthlyRent.update).not.toHaveBeenCalled();

      expect(result.data.id).toBe(RENT_ID);
      expect(Number(result.data.totalAmount)).toBe(25500);
      expect(Number(result.data.paidAmount)).toBe(0);
      expect(Number(result.data.remainingAmount)).toBe(25500);
      expect(result.data.status).toBe(RentStatus.PENDING);
      expect(result.data.agreement.unit.property.owner.name).toBe('আসিফ চৌধুরী');
      expect(result.data.agreement.unit.property.owner.signatureFileId).toBe('sig-file-123');
    });

    it('should produce identical snapshots upon repeated notice queries without duplicating records', async () => {
      const mockInvoice = makeMockInvoice();
      mockPrisma.monthlyRent.findUnique.mockResolvedValue(mockInvoice);

      const query1 = await service.findOne(OWNER_ID, RENT_ID);
      const query2 = await service.findOne(OWNER_ID, RENT_ID);

      expect(query1.data).toEqual(query2.data);
      expect(mockPrisma.monthlyRent.create).not.toHaveBeenCalled();
      expect(mockPrisma.monthlyRent.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
    });
  });

  describe('Partially paid, paid, and previous-month outstanding notice accuracy', () => {
    it('should reflect partial payment details without modifying remaining balance', async () => {
      const mockPartialInvoice = makeMockInvoice({
        paidAmount: new Prisma.Decimal(10000),
        remainingAmount: new Prisma.Decimal(15500),
        status: RentStatus.PARTIAL,
        payments: [
          {
            id: 'pay-1',
            amount: new Prisma.Decimal(10000),
            paymentDate: new Date('2026-10-05T10:00:00.000Z'),
          },
        ],
      });
      mockPrisma.monthlyRent.findUnique.mockResolvedValue(mockPartialInvoice);

      const result = await service.findOne(OWNER_ID, RENT_ID);

      expect(Number(result.data.totalAmount)).toBe(25500);
      expect(Number(result.data.paidAmount)).toBe(10000);
      expect(Number(result.data.remainingAmount)).toBe(15500);
      expect(result.data.status).toBe(RentStatus.PARTIAL);
      // No extra payments created
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
    });

    it('should accurately handle fully paid invoice notice without creating payment', async () => {
      const mockPaidInvoice = makeMockInvoice({
        paidAmount: new Prisma.Decimal(25500),
        remainingAmount: new Prisma.Decimal(0),
        status: RentStatus.PAID,
      });
      mockPrisma.monthlyRent.findUnique.mockResolvedValue(mockPaidInvoice);

      const result = await service.findOne(OWNER_ID, RENT_ID);

      expect(Number(result.data.totalAmount)).toBe(25500);
      expect(Number(result.data.paidAmount)).toBe(25500);
      expect(Number(result.data.remainingAmount)).toBe(0);
      expect(result.data.status).toBe(RentStatus.PAID);
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
    });

    it('should support previous-month outstanding invoice notice with original amounts and overdue status', async () => {
      const mockPastInvoice = makeMockInvoice({
        year: 2026,
        month: 8,
        status: RentStatus.OVERDUE,
        dueDate: new Date('2026-08-10T17:59:59.999Z'),
      });
      mockPrisma.monthlyRent.findUnique.mockResolvedValue(mockPastInvoice);

      const result = await service.findOne(OWNER_ID, RENT_ID);

      expect(result.data.year).toBe(2026);
      expect(result.data.month).toBe(8);
      expect(result.data.status).toBe(RentStatus.OVERDUE);
      expect(result.data.dueDate).toEqual(new Date('2026-08-10T17:59:59.999Z'));
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
    });
  });

  describe('Amount consistency and separation from payment receipts', () => {
    it('should verify charge snapshot breakdown matches totalAmount and paid + remaining balance', async () => {
      const mockInvoice = makeMockInvoice({
        rent: new Prisma.Decimal(18000),
        serviceFee: new Prisma.Decimal(2500),
        parkingFee: new Prisma.Decimal(1500),
        extraCharge: new Prisma.Decimal(1000),
        lateFee: new Prisma.Decimal(500),
        discount: new Prisma.Decimal(1000),
        totalAmount: new Prisma.Decimal(22500), // 18000 + 2500 + 1500 + 1000 + 500 - 1000
        paidAmount: new Prisma.Decimal(5000),
        remainingAmount: new Prisma.Decimal(17500),
      });
      mockPrisma.monthlyRent.findUnique.mockResolvedValue(mockInvoice);

      const result = await service.findOne(OWNER_ID, RENT_ID);
      const data = result.data;

      const calculatedTotal =
        Number(data.rent) +
        Number(data.serviceFee) +
        Number(data.parkingFee) +
        Number(data.extraCharge) +
        Number(data.lateFee) -
        Number(data.discount);

      expect(calculatedTotal).toBe(Number(data.totalAmount));
      expect(Number(data.paidAmount) + Number(data.remainingAmount)).toBe(Number(data.totalAmount));
    });

    it('should reject unauthorized landlord trying to fetch notice data', async () => {
      const mockInvoice = makeMockInvoice();
      mockPrisma.monthlyRent.findUnique.mockResolvedValue(mockInvoice);

      await expect(service.findOne(OTHER_OWNER_ID, RENT_ID)).rejects.toThrow();
    });
  });
});
