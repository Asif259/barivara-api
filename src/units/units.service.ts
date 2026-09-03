import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BulkCreateUnitsDto, CreateUnitDto, UpdateUnitDto } from './dto/create-unit.dto';
import { UnitFilterDto } from './dto/unit-filter.dto';
import { ErrorCode } from '../common/constants/error-codes';
import { Prisma, UnitStatus } from '@prisma/client';

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, propertyId: string, dto: CreateUnitDto) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
    });

    if (!property) {
      throw new NotFoundException({
        errorCode: ErrorCode.PROPERTY_NOT_FOUND,
        message: 'বাড়ি পাওয়া যায়নি।',
      });
    }

    if (property.ownerId !== userId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.PROPERTY_ACCESS_DENIED,
        message: 'এই সম্পত্তিতে আপনার অ্যাক্সেস নেই।',
      });
    }

    const unit = await this.prisma.unit.create({
      data: {
        propertyId,
        unitNumber: dto.unitNumber,
        floor: dto.floor ?? 0,
        unitType: dto.unitType || 'APARTMENT',
        bedrooms: dto.bedrooms,
        bathrooms: dto.bathrooms,
        monthlyBaseRent: new Prisma.Decimal(dto.monthlyBaseRent ?? 0),
        defaultServiceFee: new Prisma.Decimal(dto.defaultServiceFee ?? 0),
        defaultParkingFee: new Prisma.Decimal(dto.defaultParkingFee ?? 0),
        defaultExtraCharge: new Prisma.Decimal(dto.defaultExtraCharge ?? 0),
        status: dto.status || UnitStatus.VACANT,
      },
    });

    return {
      message: 'ইউনিট সফলভাবে যোগ করা হয়েছে',
      data: unit,
    };
  }

  async bulkCreate(userId: string, propertyId: string, dto: BulkCreateUnitsDto) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
    });

    if (!property) {
      throw new NotFoundException({
        errorCode: ErrorCode.PROPERTY_NOT_FOUND,
        message: 'বাড়ি পাওয়া যায়নি।',
      });
    }

    if (property.ownerId !== userId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.PROPERTY_ACCESS_DENIED,
        message: 'এই সম্পত্তিতে আপনার অ্যাক্সেস নেই।',
      });
    }

    const units = dto.units.map((unit) => ({
      ...unit,
      unitNumber: unit.unitNumber.trim(),
    }));
    const normalizedNumbers = units.map((unit) => unit.unitNumber.toLocaleLowerCase());
    const duplicateNumbers = normalizedNumbers.filter(
      (number, index) => normalizedNumbers.indexOf(number) !== index,
    );

    if (units.some((unit) => !unit.unitNumber) || duplicateNumbers.length > 0) {
      throw new BadRequestException({
        errorCode: ErrorCode.DUPLICATE_RESOURCE,
        message: 'প্রতিটি ইউনিট নম্বর আলাদা এবং আবশ্যক।',
      });
    }

    const createdUnits = await this.prisma.$transaction(async (tx) => {
      const existingUnits = await tx.unit.findMany({
        where: {
          propertyId,
          deletedAt: null,
          OR: units.map((unit) => ({ unitNumber: { equals: unit.unitNumber, mode: 'insensitive' } })),
        },
        select: { unitNumber: true },
      });

      if (existingUnits.length > 0) {
        throw new BadRequestException({
          errorCode: ErrorCode.DUPLICATE_RESOURCE,
          message: `ইউনিট নম্বর ইতিমধ্যে রয়েছে: ${existingUnits.map((unit) => unit.unitNumber).join(', ')}`,
        });
      }

      return Promise.all(
        units.map((unit) =>
          tx.unit.create({
            data: {
              propertyId,
              floor: dto.floor,
              unitNumber: unit.unitNumber,
              unitType: unit.unitType,
              bedrooms: unit.bedrooms,
              bathrooms: unit.bathrooms,
              monthlyBaseRent: new Prisma.Decimal(unit.monthlyBaseRent ?? 0),
              defaultServiceFee: new Prisma.Decimal(unit.defaultServiceFee ?? 0),
              defaultParkingFee: new Prisma.Decimal(unit.defaultParkingFee ?? 0),
              defaultExtraCharge: new Prisma.Decimal(unit.defaultExtraCharge ?? 0),
              status: UnitStatus.VACANT,
            },
          }),
        ),
      );
    });

    return {
      message: 'Units created successfully',
      data: { created: createdUnits.length, units: createdUnits },
    };
  }

  async findByProperty(userId: string, propertyId: string, query: UnitFilterDto) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
    });

    if (!property) {
      throw new NotFoundException({
        errorCode: ErrorCode.PROPERTY_NOT_FOUND,
        message: 'বাড়ি পাওয়া যায়নি।',
      });
    }

    if (property.ownerId !== userId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.PROPERTY_ACCESS_DENIED,
        message: 'এই সম্পত্তিতে আপনার অ্যাক্সেস নেই।',
      });
    }

    const where: any = {
      propertyId,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.unitType) {
      where.unitType = query.unitType;
    }

    if (query.floor !== undefined) {
      where.floor = query.floor;
    }

    if (query.search) {
      where.unitNumber = { contains: query.search, mode: 'insensitive' };
    }

    const [total, units] = await Promise.all([
      this.prisma.unit.count({ where }),
      this.prisma.unit.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy
          ? { [query.sortBy]: query.sortOrder || 'asc' }
          : { unitNumber: 'asc' },
        include: {
          agreements: {
            where: { status: 'ACTIVE', deletedAt: null },
            include: {
              tenant: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                },
              },
            },
            take: 1,
          },
        },
      }),
    ]);

    const formattedUnits = units.map((u) => {
      const activeAgreement = u.agreements[0] || null;
      return {
        ...u,
        currentTenant: activeAgreement ? activeAgreement.tenant : null,
        currentAgreement: activeAgreement,
      };
    });

    return {
      message: 'ইউনিটের তালিকা',
      data: formattedUnits,
      meta: {
        page: query.page || 1,
        limit: query.limit || 20,
        total,
        totalPages: Math.ceil(total / (query.limit || 20)),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const unit = await this.prisma.unit.findFirst({
      where: { id, deletedAt: null },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
        agreements: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                emergencyContactPhone: true,
              },
            },
            monthlyRents: {
              orderBy: [{ year: 'desc' }, { month: 'desc' }],
              take: 3,
            },
          },
          take: 5,
        },
      },
    });

    if (!unit) {
      throw new NotFoundException({
        errorCode: ErrorCode.UNIT_NOT_FOUND,
        message: 'ইউনিট পাওয়া যায়নি।',
      });
    }

    if (unit.property.ownerId !== userId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.PROPERTY_ACCESS_DENIED,
        message: 'এই ইউনিটে আপনার অ্যাক্সেস নেই।',
      });
    }

    const activeAgreement = unit.agreements.find((a) => a.status === 'ACTIVE') || null;

    return {
      message: 'ইউনিটের বিস্তারিত তথ্য',
      data: {
        ...unit,
        currentAgreement: activeAgreement,
        currentTenant: activeAgreement ? activeAgreement.tenant : null,
      },
    };
  }

  async update(userId: string, id: string, dto: UpdateUnitDto) {
    await this.findOne(userId, id);

    const updated = await this.prisma.unit.update({
      where: { id },
      data: {
        ...(dto.unitNumber !== undefined && { unitNumber: dto.unitNumber }),
        ...(dto.floor !== undefined && { floor: dto.floor }),
        ...(dto.unitType !== undefined && { unitType: dto.unitType }),
        ...(dto.bedrooms !== undefined && { bedrooms: dto.bedrooms }),
        ...(dto.bathrooms !== undefined && { bathrooms: dto.bathrooms }),
        ...(dto.monthlyBaseRent !== undefined && {
          monthlyBaseRent: new Prisma.Decimal(dto.monthlyBaseRent),
        }),
        ...(dto.defaultServiceFee !== undefined && {
          defaultServiceFee: new Prisma.Decimal(dto.defaultServiceFee),
        }),
        ...(dto.defaultParkingFee !== undefined && {
          defaultParkingFee: new Prisma.Decimal(dto.defaultParkingFee),
        }),
        ...(dto.defaultExtraCharge !== undefined && {
          defaultExtraCharge: new Prisma.Decimal(dto.defaultExtraCharge),
        }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });

    return {
      message: 'ইউনিটের তথ্য সফলভাবে হালনাগাদ করা হয়েছে',
      data: updated,
    };
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    await this.prisma.unit.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: UnitStatus.INACTIVE,
      },
    });

    return {
      message: 'ইউনিট সফলভাবে মুছে ফেলা হয়েছে',
      data: null,
    };
  }
}
