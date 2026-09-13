
import { TenantsService } from './tenants.service';
import { ErrorCode } from '../common/constants/error-codes';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const OWNER_ID = 'owner-uuid-001';
const OTHER_OWNER_ID = 'owner-uuid-002';
const TENANT_ID = 'tenant-uuid-001';

const makeAgreement = (ownerId = OWNER_ID, status = 'ACTIVE') => ({
  id: `agr-${ownerId}`,
  status,
  deletedAt: null,
  unit: {
    id: 'unit-1',
    unitNumber: 'A-101',
    property: { id: 'prop-1', name: 'গ্রিন ভিউ', ownerId },
  },
  monthlyRents: [
    {
      id: 'rent-1',
      remainingAmount: new Prisma.Decimal(15500),
      payments: [
        { id: 'pay-1', paymentDate: new Date('2026-09-05') },
      ],
    },
    {
      id: 'rent-2',
      remainingAmount: new Prisma.Decimal(0),
      payments: [],
    },
  ],
});

const mockTenant = (overrides: Partial<any> = {}) => ({
  id: TENANT_ID,
  name: 'কামাল হোসেন',
  phone: '01812345678',
  email: null,
  profilePictureId: null,
  nidFrontImageId: null,
  nidBackImageId: null,
  permanentAddress: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  occupation: null,
  notes: null,
  isActive: true,
  createdAt: new Date(),
  agreements: [makeAgreement()],
  ...overrides,
});

const mockPrisma = {
  tenant: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  monthlyRent: {
    aggregate: jest.fn().mockResolvedValue({ _sum: { remainingAmount: new Prisma.Decimal(15500) } }),
    findMany: jest.fn().mockResolvedValue([]),
  },
  payment: {
    findMany: jest.fn().mockResolvedValue([]),
  },
};

describe('TenantsService', () => {
  let service: TenantsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TenantsService(mockPrisma as any);
  });

  // =========================================================================
  // create
  // =========================================================================
  describe('create', () => {
    it('creates a tenant and returns it', async () => {
      const dto = { name: 'কামাল হোসেন', phone: '01812345678' };
      const created = { id: TENANT_ID, ...dto, email: null };
      mockPrisma.tenant.create.mockResolvedValue(created);

      const result = await service.create(OWNER_ID, dto as any);
      expect(result.data.id).toBe(TENANT_ID);
      expect(mockPrisma.tenant.create).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // findOne
  // =========================================================================
  describe('findOne', () => {
    it('returns tenant with outstanding balance aggregated across agreements', async () => {
      const tenant = mockTenant();
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);

      const result = await service.findOne(OWNER_ID, TENANT_ID);
      // Remaining: 15500 + 0 = 15500
      expect(result.data.outstandingAmount).toBe(15500);
    });

    it('returns 0 outstanding when all rents are fully paid', async () => {
      const tenant = mockTenant({
        agreements: [{
          ...makeAgreement(),
          monthlyRents: [
            { id: 'r1', remainingAmount: new Prisma.Decimal(0), payments: [] },
          ],
        }],
      });
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.monthlyRent.aggregate.mockResolvedValueOnce({ _sum: { remainingAmount: new Prisma.Decimal(0) } });

      const result = await service.findOne(OWNER_ID, TENANT_ID);
      expect(result.data.outstandingAmount).toBe(0);
    });

    it('throws NotFoundException when tenant does not exist', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);

      await expect(service.findOne(OWNER_ID, 'ghost-id')).rejects.toMatchObject({
        response: { errorCode: ErrorCode.TENANT_NOT_FOUND },
      });
    });

    it('IDOR guard: throws ForbiddenException when tenant belongs to another owner', async () => {
      // Tenant has agreements, but all under OTHER_OWNER_ID's properties
      const tenant = mockTenant({
        agreements: [makeAgreement(OTHER_OWNER_ID)],
      });
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);

      await expect(service.findOne(OWNER_ID, TENANT_ID)).rejects.toMatchObject({
        response: { errorCode: ErrorCode.TENANT_ACCESS_DENIED },
      });
    });

    it('allows access when tenant has no agreements (newly created)', async () => {
      // A tenant with zero agreements is accessible by any authenticated user
      const tenant = mockTenant({ agreements: [] });
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.monthlyRent.aggregate.mockResolvedValueOnce({ _sum: { remainingAmount: new Prisma.Decimal(0) } });

      const result = await service.findOne(OWNER_ID, TENANT_ID);
      expect(result.data.id).toBe(TENANT_ID);
      expect(result.data.outstandingAmount).toBe(0);
    });

    it('includes payment history sorted by date descending', async () => {
      const older = new Date('2026-08-01');
      const newer = new Date('2026-09-05');
      const tenant = mockTenant({
        agreements: [{
          ...makeAgreement(),
          monthlyRents: [{
            id: 'r1', remainingAmount: new Prisma.Decimal(0),
            payments: [
              { id: 'p1', paymentDate: older },
              { id: 'p2', paymentDate: newer },
            ],
          }],
        }],
      });
      mockPrisma.tenant.findFirst.mockResolvedValue(tenant);
      mockPrisma.payment.findMany.mockResolvedValueOnce([
        { id: 'p2', paymentDate: newer },
        { id: 'p1', paymentDate: older },
      ]);

      const result = await service.findOne(OWNER_ID, TENANT_ID);
      const history: any[] = result.data.paymentHistory;
      expect(new Date(history[0].paymentDate).getTime()).toBeGreaterThan(
        new Date(history[1].paymentDate).getTime(),
      );
    });
  });

  // =========================================================================
  // remove (soft-delete)
  // =========================================================================
  describe('remove', () => {
    it('soft-deletes the tenant (sets deletedAt)', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(mockTenant());
      mockPrisma.tenant.update.mockResolvedValue({});

      await service.remove(OWNER_ID, TENANT_ID);

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TENANT_ID },
          data: expect.objectContaining({ isActive: false }),
        }),
      );
      // deletedAt must be a Date, not null
      const updateCall = mockPrisma.tenant.update.mock.calls[0][0];
      expect(updateCall.data.deletedAt).toBeInstanceOf(Date);
    });
  });
});
