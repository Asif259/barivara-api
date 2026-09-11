import { RentalAgreementsService } from './rental-agreements.service';
import { AgreementStatus } from '@prisma/client';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ErrorCode } from '../common/constants/error-codes';

describe('RentalAgreementsService', () => {
  let service: RentalAgreementsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      unit: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      tenant: {
        findFirst: jest.fn(),
      },
      rentalAgreement: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      monthlyRent: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => {
        return callback(mockPrisma);
      }),
    };

    service = new RentalAgreementsService(mockPrisma);
  });

  const validDto: any = {
    tenantId: 'tenant-123',
    unitId: 'unit-456',
    monthlyRent: 1300,
    serviceFee: 2000,
    parkingFee: 0,
    extraCharge: 0,
    securityDeposit: 15000,
    startDate: '2026-09-01T00:00:00.000Z',
  };

  it('should throw NotFoundException if unit does not exist', async () => {
    mockPrisma.unit.findFirst.mockResolvedValue(null);

    await expect(service.create('owner-1', validDto)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException if user does not own the property', async () => {
    mockPrisma.unit.findFirst.mockResolvedValue({
      id: 'unit-456',
      property: { ownerId: 'other-owner' },
    });

    await expect(service.create('owner-1', validDto)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ConflictException if unit already has an active agreement', async () => {
    mockPrisma.unit.findFirst.mockResolvedValue({
      id: 'unit-456',
      property: { ownerId: 'owner-1' },
    });
    mockPrisma.rentalAgreement.findFirst.mockResolvedValueOnce({
      id: 'existing-agreement-1',
      unitId: 'unit-456',
      status: AgreementStatus.ACTIVE,
    });

    try {
      await service.create('owner-1', validDto);
      fail('Expected ConflictException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse().errorCode).toBe(ErrorCode.AGREEMENT_OVERLAP);
    }
  });

  it('should throw NotFoundException if tenant does not exist', async () => {
    mockPrisma.unit.findFirst.mockResolvedValue({
      id: 'unit-456',
      property: { ownerId: 'owner-1' },
    });
    mockPrisma.rentalAgreement.findFirst.mockResolvedValueOnce(null); // unit check passes
    mockPrisma.tenant.findFirst.mockResolvedValue(null);

    await expect(service.create('owner-1', validDto)).rejects.toThrow(NotFoundException);
  });

  it('should reject with TENANT_ACTIVE_AGREEMENT_EXISTS if tenant already has an active agreement', async () => {
    mockPrisma.unit.findFirst.mockResolvedValue({
      id: 'unit-456',
      property: { ownerId: 'owner-1' },
    });
    mockPrisma.rentalAgreement.findFirst
      .mockResolvedValueOnce(null) // unit active agreement check -> passes
      .mockResolvedValueOnce({
        id: 'existing-active-agreement',
        tenantId: 'tenant-123',
        status: AgreementStatus.ACTIVE,
      }); // tenant active agreement check -> exists!

    mockPrisma.tenant.findFirst.mockResolvedValue({
      id: 'tenant-123',
      name: 'Rahim',
    });

    try {
      await service.create('owner-1', validDto);
      fail('Expected ConflictException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse().errorCode).toBe(ErrorCode.TENANT_ACTIVE_AGREEMENT_EXISTS);
    }
  });

  it('should allow agreement creation when tenant has ENDED or CANCELLED agreement', async () => {
    mockPrisma.unit.findFirst.mockResolvedValue({
      id: 'unit-456',
      property: { ownerId: 'owner-1' },
    });
    // Unit check: null, Tenant active check: null, inside tx: null, null
    mockPrisma.rentalAgreement.findFirst.mockResolvedValue(null);

    mockPrisma.tenant.findFirst.mockResolvedValue({
      id: 'tenant-123',
      name: 'Rahim',
    });

    mockPrisma.rentalAgreement.create.mockImplementation((args: any) => ({
      id: 'new-agreement-1',
      ...args.data,
    }));
    mockPrisma.unit.update.mockResolvedValue({});

    const result = await service.create('owner-1', validDto);
    expect(result.data.id).toBe('new-agreement-1');
    expect(result.data.dueDay).toBe(10); // Defaults to 10!
  });

  it('should honor explicitly provided dueDay', async () => {
    mockPrisma.unit.findFirst.mockResolvedValue({
      id: 'unit-456',
      property: { ownerId: 'owner-1' },
    });
    mockPrisma.rentalAgreement.findFirst.mockResolvedValue(null);
    mockPrisma.tenant.findFirst.mockResolvedValue({
      id: 'tenant-123',
      name: 'Rahim',
    });

    mockPrisma.rentalAgreement.create.mockImplementation((args: any) => ({
      id: 'new-agreement-2',
      ...args.data,
    }));
    mockPrisma.unit.update.mockResolvedValue({});

    const result = await service.create('owner-1', {
      ...validDto,
      dueDay: 15,
    });
    expect(result.data.dueDay).toBe(15);
  });
});
