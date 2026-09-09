import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyDto, UpdatePropertyDto } from './dto/create-property.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { ErrorCode } from '../common/constants/error-codes';
import { DateUtil } from '../common/utils/date.util';
import { Decimal } from 'decimal.js';
import { Prisma, UnitStatus } from '@prisma/client';

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreatePropertyDto) {
    const property = await this.prisma.property.create({
      data: {
        ownerId: userId,
        name: dto.name,
        address: dto.address,
        city: dto.city,
        district: dto.district,
        postalCode: dto.postalCode,
        description: dto.description,
        totalFloors: dto.totalFloors ?? 1,
      },
    });

    return {
      message: 'বাড়ি সফলভাবে তৈরি করা হয়েছে',
      data: property,
    };
  }

  async findAll(userId: string, query: PaginationQueryDto) {
    const where: any = {
      ownerId: userId,
      deletedAt: null,
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { address: { contains: query.search, mode: 'insensitive' } },
        { city: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, properties] = await Promise.all([
      this.prisma.property.count({ where }),
      this.prisma.property.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy
          ? { [query.sortBy]: query.sortOrder || 'desc' }
          : { createdAt: 'desc' },
        include: {
          _count: {
            select: { units: { where: { deletedAt: null } } },
          },
        },
      }),
    ]);

    return {
      message: 'বাড়ির তালিকা',
      data: properties,
      meta: {
        page: query.page || 1,
        limit: query.limit || 20,
        total,
        totalPages: Math.ceil(total / (query.limit || 20)),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const property = await this.prisma.property.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        units: {
          where: { deletedAt: null },
          orderBy: { unitNumber: 'asc' },
        },
        _count: {
          select: { units: { where: { deletedAt: null } } },
        },
      },
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

    return {
      message: 'বাড়ির বিস্তারিত তথ্য',
      data: property,
    };
  }

  async update(userId: string, id: string, dto: UpdatePropertyDto) {
    await this.findOne(userId, id);

    const updated = await this.prisma.property.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.district !== undefined && { district: dto.district }),
        ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.totalFloors !== undefined && { totalFloors: dto.totalFloors }),
      },
    });

    return {
      message: 'বাড়ির তথ্য সফলভাবে হালনাগাদ করা হয়েছে',
      data: updated,
    };
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    await this.prisma.property.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return {
      message: 'বাড়ি সফলভাবে মুছে ফেলা হয়েছে',
      data: null,
    };
  }

  async getSummary(userId: string, id: string) {
    await this.findOne(userId, id);

    const nowDhaka = DateUtil.nowInDhaka();
    const { year: currentYear, month: currentMonth } = DateUtil.getDefaultRentPeriod(nowDhaka);
    const unitWhere: Prisma.UnitWhereInput = { propertyId: id, deletedAt: null };
    const rentWhere: Prisma.MonthlyRentWhereInput = {
      agreement: { unit: unitWhere, deletedAt: null },
      year: currentYear,
      month: currentMonth,
    };
    const [unitCounts, activeTenantGroups, rentTotals] = await Promise.all([
      this.prisma.unit.groupBy({ where: unitWhere, by: ['status'], _count: { _all: true } }),
      this.prisma.rentalAgreement.groupBy({
        where: { unit: unitWhere, status: 'ACTIVE', deletedAt: null },
        by: ['tenantId'],
      }),
      this.prisma.monthlyRent.aggregate({
        where: rentWhere,
        _sum: { totalAmount: true, paidAmount: true },
      }),
    ]);
    const unitCountByStatus = new Map(unitCounts.map((group) => [group.status, group._count._all]));
    const totalUnits = unitCounts.reduce((total, group) => total + group._count._all, 0);
    const occupiedUnits = unitCountByStatus.get(UnitStatus.OCCUPIED) || 0;
    const vacantUnits = unitCountByStatus.get(UnitStatus.VACANT) || 0;
    const maintenanceUnits = unitCountByStatus.get(UnitStatus.MAINTENANCE) || 0;
    const activeTenants = activeTenantGroups.length;
    const expected = new Decimal(rentTotals._sum.totalAmount?.toString() || 0);
    const collected = new Decimal(rentTotals._sum.paidAmount?.toString() || 0);

    const outstanding = expected.minus(collected);
    const collectionRate = expected.isZero()
      ? 0
      : collected.dividedBy(expected).times(100).toNumber();

    return {
      message: 'বাড়ির সারাংশ',
      data: {
        propertyId: id,
        totalUnits,
        occupiedUnits,
        vacantUnits,
        maintenanceUnits,
        activeTenants,
        currentMonth: {
          year: currentYear,
          month: currentMonth,
          expected: expected.toNumber(),
          collected: collected.toNumber(),
          outstanding: (outstanding.isNegative() ? new Decimal(0) : outstanding).toNumber(),
          collectionRate: Number(collectionRate.toFixed(2)),
        },
      },
    };
  }
}
