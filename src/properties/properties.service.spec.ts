import { ForbiddenException } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { ErrorCode } from '../common/constants/error-codes';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const OWNER_ID = 'owner-uuid-001';
const OTHER_OWNER_ID = 'owner-uuid-002';
const PROPERTY_ID = 'prop-uuid-001';

const mockProperty = (overrides: Partial<any> = {}) => ({
  id: PROPERTY_ID,
  name: 'গ্রিন ভিউ ভিলা',
  address: 'বাড়ি ১২, রোড ৪, ধানমন্ডি',
  city: 'ঢাকা',
  district: 'ঢাকা',
  ownerId: OWNER_ID,
  isActive: true,
  deletedAt: null,
  createdAt: new Date(),
  units: [],
  _count: { units: 0 },
  ...overrides,
});

const mockPrisma = {
  property: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  unit: { groupBy: jest.fn() },
  rentalAgreement: { groupBy: jest.fn() },
  monthlyRent: { aggregate: jest.fn() },
};

describe('PropertiesService', () => {
  let service: PropertiesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PropertiesService(mockPrisma as any);
  });

  // =========================================================================
  // create
  // =========================================================================
  describe('create', () => {
    it('creates a property scoped to the requesting user', async () => {
      const dto = { name: 'গ্রিন ভিউ', address: 'ধানমন্ডি' };
      mockPrisma.property.create.mockResolvedValue(mockProperty());

      const result = await service.create(OWNER_ID, dto as any);
      expect(result.data.id).toBe(PROPERTY_ID);

      const createCall = mockPrisma.property.create.mock.calls[0][0];
      // ownerId must be forced from the server, not client-provided
      expect(createCall.data.ownerId).toBe(OWNER_ID);
    });
  });

  // =========================================================================
  // findOne
  // =========================================================================
  describe('findOne', () => {
    it('returns property details for the owner', async () => {
      mockPrisma.property.findFirst.mockResolvedValue(mockProperty());

      const result = await service.findOne(OWNER_ID, PROPERTY_ID);
      expect(result.data.id).toBe(PROPERTY_ID);
    });

    it('throws NotFoundException when property does not exist', async () => {
      mockPrisma.property.findFirst.mockResolvedValue(null);

      await expect(service.findOne(OWNER_ID, 'ghost-id')).rejects.toMatchObject({
        response: { errorCode: ErrorCode.PROPERTY_NOT_FOUND },
      });
    });

    it('IDOR guard: throws ForbiddenException when property belongs to another owner', async () => {
      mockPrisma.property.findFirst.mockResolvedValue(mockProperty({ ownerId: OTHER_OWNER_ID }));

      await expect(service.findOne(OWNER_ID, PROPERTY_ID)).rejects.toMatchObject({
        response: { errorCode: ErrorCode.PROPERTY_ACCESS_DENIED },
      });
    });
  });

  // =========================================================================
  // update
  // =========================================================================
  describe('update', () => {
    it('updates allowed fields and returns updated property', async () => {
      mockPrisma.property.findFirst.mockResolvedValue(mockProperty());
      const updated = mockProperty({ name: 'নতুন নাম' });
      mockPrisma.property.update.mockResolvedValue(updated);

      const result = await service.update(OWNER_ID, PROPERTY_ID, { name: 'নতুন নাম' } as any);
      expect(result.data.name).toBe('নতুন নাম');
    });

    it('IDOR guard: cannot update property belonging to another owner', async () => {
      mockPrisma.property.findFirst.mockResolvedValue(mockProperty({ ownerId: OTHER_OWNER_ID }));

      await expect(
        service.update(OWNER_ID, PROPERTY_ID, { name: 'হ্যাক' } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // remove (soft-delete)
  // =========================================================================
  describe('remove', () => {
    it('soft-deletes the property (sets deletedAt, isActive=false)', async () => {
      mockPrisma.property.findFirst.mockResolvedValue(mockProperty());
      mockPrisma.property.update.mockResolvedValue({});

      await service.remove(OWNER_ID, PROPERTY_ID);

      expect(mockPrisma.property.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PROPERTY_ID },
          data: expect.objectContaining({ isActive: false }),
        }),
      );
      const updateCall = mockPrisma.property.update.mock.calls[0][0];
      expect(updateCall.data.deletedAt).toBeInstanceOf(Date);
    });

    it('IDOR guard: cannot delete property belonging to another owner', async () => {
      mockPrisma.property.findFirst.mockResolvedValue(mockProperty({ ownerId: OTHER_OWNER_ID }));

      await expect(service.remove(OWNER_ID, PROPERTY_ID)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.property.update).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // findAll — pagination
  // =========================================================================
  describe('findAll', () => {
    it('returns paginated results with meta', async () => {
      mockPrisma.property.count.mockResolvedValue(5);
      mockPrisma.property.findMany.mockResolvedValue([mockProperty()]);

      const result = await service.findAll(OWNER_ID, { page: 1, limit: 20, skip: 0, take: 20 } as any);
      expect(result.meta.total).toBe(5);
      expect(result.data).toHaveLength(1);
    });

    it('always scopes query to requesting user (ownerId filter)', async () => {
      mockPrisma.property.count.mockResolvedValue(0);
      mockPrisma.property.findMany.mockResolvedValue([]);

      await service.findAll(OWNER_ID, { page: 1, limit: 20, skip: 0, take: 20 } as any);

      const countCall = mockPrisma.property.count.mock.calls[0][0];
      expect(countCall.where.ownerId).toBe(OWNER_ID);
    });
  });
});
