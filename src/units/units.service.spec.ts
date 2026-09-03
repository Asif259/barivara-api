import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UnitType } from '@prisma/client';
import { validate } from 'class-validator';
import { BulkCreateUnitsDto, BulkUnitItemDto } from './dto/create-unit.dto';
import { UnitsService } from './units.service';

const property = { id: 'property-1', ownerId: 'owner-1', deletedAt: null };
const item = { unitNumber: '4A', unitType: UnitType.FLAT, bedrooms: 3, bathrooms: 2, monthlyBaseRent: 20000, defaultServiceFee: 3000, defaultParkingFee: 0, defaultExtraCharge: 0 };

describe('UnitsService.bulkCreate', () => {
  const prisma = {
    property: { findFirst: jest.fn() },
    unit: { findMany: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  };
  let service: UnitsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UnitsService(prisma as never);
    prisma.property.findFirst.mockResolvedValue(property);
    prisma.unit.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation((callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma));
  });

  it('creates every valid unit in one transaction', async () => {
    prisma.unit.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: data.unitNumber, ...data }));
    const result = await service.bulkCreate('owner-1', 'property-1', { floor: 4, units: [item, { ...item, unitNumber: '4B' }] });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.unit.create).toHaveBeenCalledTimes(2);
    expect(result.data.created).toBe(2);
  });

  it('rejects duplicate unit numbers in the request before a transaction starts', async () => {
    await expect(service.bulkCreate('owner-1', 'property-1', { floor: 4, units: [item, { ...item, unitNumber: '4a' }] })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a number that already belongs to the property', async () => {
    prisma.unit.findMany.mockResolvedValue([{ unitNumber: '4A' }]);
    await expect(service.bulkCreate('owner-1', 'property-1', { floor: 4, units: [item] })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.unit.create).not.toHaveBeenCalled();
  });

  it('rejects access by a non-owner', async () => {
    await expect(service.bulkCreate('another-user', 'property-1', { floor: 4, units: [item] })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.unit.findMany).not.toHaveBeenCalled();
  });

  it('propagates an insert failure so Prisma rolls back the transaction', async () => {
    prisma.unit.create.mockResolvedValueOnce({ id: '4A' }).mockRejectedValueOnce(new Error('insert failed'));
    await expect(service.bulkCreate('owner-1', 'property-1', { floor: 4, units: [item, { ...item, unitNumber: '4B' }] })).rejects.toThrow('insert failed');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('BulkCreateUnitsDto', () => {
  it('rejects negative financial values', async () => {
    const dto = Object.assign(new BulkCreateUnitsDto(), { floor: 4, units: [Object.assign(new BulkUnitItemDto(), { ...item, monthlyBaseRent: -1 })] });
    const errors = await validate(dto);
    expect(errors).not.toHaveLength(0);
  });
});
