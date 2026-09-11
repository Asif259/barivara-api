import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyDto, UpdatePropertyDto } from './dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { ErrorCode } from '../common/constants/error-codes';
import { DateUtil } from '../common/utils/date.util';
import { Prisma } from '@prisma/client';
import { MetricsUtil, UnitCountGroup } from '../common/utils/metrics.util';

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
    const where = this.buildFindAllWhere(userId, query.search);

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

    const unitMetrics = MetricsUtil.calculateUnitMetrics(unitCounts as UnitCountGroup[]);
    const collectionMetrics = MetricsUtil.calculateCollectionMetrics(
      rentTotals._sum.totalAmount,
      rentTotals._sum.paidAmount,
    );

    return {
      message: 'বাড়ির সারাংশ',
      data: {
        propertyId: id,
        totalUnits: unitMetrics.totalUnits,
        occupiedUnits: unitMetrics.occupiedUnits,
        vacantUnits: unitMetrics.vacantUnits,
        maintenanceUnits: unitMetrics.maintenanceUnits,
        activeTenants: activeTenantGroups.length,
        currentMonth: {
          year: currentYear,
          month: currentMonth,
          expected: collectionMetrics.expected.toNumber(),
          collected: collectionMetrics.collected.toNumber(),
          outstanding: collectionMetrics.outstanding.toNumber(),
          collectionRate: collectionMetrics.collectionRate,
        },
      },
    };
  }

  /**
   * Builds search and ownership filter for properties listing.
   */
  private buildFindAllWhere(userId: string, search?: string): Prisma.PropertyWhereInput {
    const where: Prisma.PropertyWhereInput = {
      ownerId: userId,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
