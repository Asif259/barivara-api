import { ReportsService } from './reports.service';
import { ErrorCode } from '../common/constants/error-codes';
import { Prisma } from '@prisma/client';

const OWNER_ID = 'owner-uuid-001';
const OTHER_OWNER_ID = 'owner-uuid-002';
const TENANT_ID = 'tenant-uuid-001';

describe('ReportsService - Security Tests', () => {
  let service: ReportsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        findFirst: jest.fn(),
      },
      property: {
        findFirst: jest.fn(),
      },
      monthlyRent: {
        findMany: jest.fn(),
        aggregate: jest.fn(),
      },
      expense: {
        findMany: jest.fn(),
        aggregate: jest.fn(),
      },
    };
    service = new ReportsService(mockPrisma as any);
  });

  describe('getTenantStatement', () => {
    it('throws ForbiddenException when tenant has no agreements under caller property (IDOR guard)', async () => {
      // Tenant exists in system, but has zero agreements with OWNER_ID
      mockPrisma.tenant.findFirst.mockResolvedValue({
        id: TENANT_ID,
        name: 'Target Tenant',
        phone: '01700000000',
        email: 'target@example.com',
        agreements: [], // filtered out because ownerId !== OWNER_ID
      });

      await expect(service.getTenantStatement(OWNER_ID, TENANT_ID)).rejects.toMatchObject({
        response: { errorCode: ErrorCode.TENANT_ACCESS_DENIED },
      });
    });

    it('returns statement when tenant has agreements under caller property', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue({
        id: TENANT_ID,
        name: 'Target Tenant',
        phone: '01700000000',
        email: 'target@example.com',
        agreements: [
          {
            id: 'agr-1',
            unit: {
              unitNumber: '101',
              property: { name: 'Lake View' },
            },
            monthlyRents: [],
          },
        ],
      });

      const result = await service.getTenantStatement(OWNER_ID, TENANT_ID);
      expect(result.data.tenant.id).toBe(TENANT_ID);
      expect(result.data.tenant.name).toBe('Target Tenant');
    });

    it('throws NotFoundException when tenant does not exist at all', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);

      await expect(service.getTenantStatement(OWNER_ID, 'non-existent')).rejects.toMatchObject({
        response: { errorCode: ErrorCode.TENANT_NOT_FOUND },
      });
    });
  });
});
