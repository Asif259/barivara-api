import { RemindersService } from './reminders.service';
import { ErrorCode } from '../common/constants/error-codes';
import { ReminderStatus } from '@prisma/client';

const OWNER_ID = 'owner-uuid-001';
const OTHER_OWNER_ID = 'owner-uuid-002';
const REMINDER_ID = 'reminder-uuid-001';
const TENANT_ID = 'tenant-uuid-001';

describe('RemindersService - Security Tests', () => {
  let service: RemindersService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        findFirst: jest.fn(),
      },
      monthlyRent: {
        findUnique: jest.fn(),
      },
      reminder: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new RemindersService(mockPrisma as any);
  });

  describe('findOne - IDOR Guard', () => {
    it('throws ForbiddenException when reminder belongs to another owner', async () => {
      mockPrisma.reminder.findUnique.mockResolvedValue({
        id: REMINDER_ID,
        tenantId: TENANT_ID,
        tenant: {
          id: TENANT_ID,
          createdById: OTHER_OWNER_ID,
          agreements: [], // Zero agreements owned by OWNER_ID
        },
        monthlyRent: null,
      });

      await expect(service.findOne(OWNER_ID, REMINDER_ID)).rejects.toMatchObject({
        response: { errorCode: ErrorCode.AUTH_FORBIDDEN },
      });
    });

    it('allows access when reminder monthly rent belongs to caller', async () => {
      mockPrisma.reminder.findUnique.mockResolvedValue({
        id: REMINDER_ID,
        tenantId: TENANT_ID,
        tenant: { id: TENANT_ID, agreements: [] },
        monthlyRent: {
          agreement: {
            unit: {
              property: { ownerId: OWNER_ID },
            },
          },
        },
      });

      const res = await service.findOne(OWNER_ID, REMINDER_ID);
      expect(res.data.id).toBe(REMINDER_ID);
    });

    it('allows access when reminder tenant agreement belongs to caller', async () => {
      mockPrisma.reminder.findUnique.mockResolvedValue({
        id: REMINDER_ID,
        tenantId: TENANT_ID,
        tenant: {
          id: TENANT_ID,
          agreements: [{ id: 'agr-1' }], // agreement owned by OWNER_ID
        },
        monthlyRent: null,
      });

      const res = await service.findOne(OWNER_ID, REMINDER_ID);
      expect(res.data.id).toBe(REMINDER_ID);
    });

    it('throws NotFoundException when reminder does not exist', async () => {
      mockPrisma.reminder.findUnique.mockResolvedValue(null);

      await expect(service.findOne(OWNER_ID, 'non-existent')).rejects.toMatchObject({
        response: { errorCode: ErrorCode.REMINDER_NOT_FOUND },
      });
    });
  });

  describe('create - Tenant Access Guard', () => {
    it('throws ForbiddenException when creating reminder for foreign tenant without monthlyRent', async () => {
      // Tenant exists in system
      mockPrisma.tenant.findFirst.mockResolvedValueOnce({ id: TENANT_ID });
      // Caller has no relation/agreements with tenant
      mockPrisma.tenant.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.create(OWNER_ID, {
          tenantId: TENANT_ID,
          message: 'Pay rent',
          scheduledAt: new Date().toISOString(),
        } as any),
      ).rejects.toMatchObject({
        response: { errorCode: ErrorCode.TENANT_ACCESS_DENIED },
      });
    });
  });
});
