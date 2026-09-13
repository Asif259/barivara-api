import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto, UpdateTenantDto, TenantFilterDto } from './dto';
import { ErrorCode } from '../common/constants/error-codes';



@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTenantDto) {
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        phone: dto.phone || '',
        email: dto.email ? dto.email.toLowerCase() : null,
        profilePictureId: dto.profilePictureId || null,
        nidFrontImageId: dto.nidFrontImageId || null,
        nidBackImageId: dto.nidBackImageId || null,
        permanentAddress: dto.permanentAddress || null,
        emergencyContactName: dto.emergencyContactName || null,
        emergencyContactPhone: dto.emergencyContactPhone || null,
        occupation: dto.occupation || null,
        notes: dto.notes || null,
      },
    });

    return {
      message: 'ভাড়াটিয়া সফলভাবে যোগ করা হয়েছে',
      data: tenant,
    };
  }

  async findAll(userId: string, query: TenantFilterDto) {
    // A tenant is visible to a user if they have agreements under properties owned by userId,
    // or if they were newly created and have no agreements yet.
    const where: any = {
      deletedAt: null,
      OR: [
        {
          agreements: {
            some: {
              unit: {
                property: {
                  ownerId: userId,
                },
              },
            },
          },
        },
        // Also allow listing unassigned tenants
        {
          agreements: {
            none: {},
          },
        },
      ],
    };

    if (query.propertyId) {
      where.agreements = {
        some: {
          unit: {
            propertyId: query.propertyId,
            property: { ownerId: userId },
          },
        },
      };
    }

    if (query.unitId) {
      where.agreements = {
        some: {
          unitId: query.unitId,
          unit: { property: { ownerId: userId } },
        },
      };
    }

    if (query.search) {
      where.AND = [
        {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [total, tenants] = await Promise.all([
      this.prisma.tenant.count({ where }),
      this.prisma.tenant.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy
          ? { [query.sortBy]: query.sortOrder || 'desc' }
          : { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          nidFrontImageId: true,
          nidBackImageId: true,
          profilePictureId: true,
          occupation: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
          isActive: true,
          createdAt: true,
          agreements: {
            where: {
              status: 'ACTIVE',
              deletedAt: null,
              unit: { property: { ownerId: userId } },
            },
            include: {
              unit: {
                select: {
                  id: true,
                  unitNumber: true,
                  property: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
            take: 1,
          },
        },
      }),
    ]);

    const formatted = tenants.map((t) => {
      const activeAgreement = t.agreements[0] || null;
      return {
        id: t.id,
        name: t.name,
        phone: t.phone,
        email: t.email,
        nidFrontImageId: t.nidFrontImageId,
        nidBackImageId: t.nidBackImageId,
        profilePictureId: t.profilePictureId,
        occupation: t.occupation,
        emergencyContactName: t.emergencyContactName,
        emergencyContactPhone: t.emergencyContactPhone,
        isActive: t.isActive,
        createdAt: t.createdAt,
        currentProperty: activeAgreement?.unit?.property || null,
        currentUnit: activeAgreement?.unit
          ? { id: activeAgreement.unit.id, unitNumber: activeAgreement.unit.unitNumber }
          : null,
        currentAgreement: activeAgreement,
      };
    });

    return {
      message: 'ভাড়াটিয়ার তালিকা',
      data: formatted,
      meta: {
        page: query.page || 1,
        limit: query.limit || 20,
        total,
        totalPages: Math.ceil(total / (query.limit || 20)),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id, deletedAt: null },
      include: {
        agreements: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: {
            unit: {
              include: {
                property: {
                  select: {
                    id: true,
                    name: true,
                    ownerId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException({
        errorCode: ErrorCode.TENANT_NOT_FOUND,
        message: 'ভাড়াটিয়া পাওয়া যায়নি।',
      });
    }

    // Check that at least one agreement belongs to user, or tenant has no agreements
    const userAgreements = tenant.agreements.filter(
      (a) => a.unit?.property?.ownerId === userId,
    );

    if (tenant.agreements.length > 0 && userAgreements.length === 0) {
      throw new ForbiddenException({
        errorCode: ErrorCode.TENANT_ACCESS_DENIED,
        message: 'এই ভাড়াটিয়ার তথ্যে আপনার অ্যাক্সেস নেই।',
      });
    }

    const activeAgreement = userAgreements.find((a) => a.status === 'ACTIVE') || null;

    // Extract all agreement IDs
    const agreementIds = userAgreements.map((a) => a.id);

    // Calculate total outstanding balance via aggregate
    const outstandingAgg = await this.prisma.monthlyRent.aggregate({
      where: { agreementId: { in: agreementIds } },
      _sum: { remainingAmount: true },
    });
    const totalOutstanding = outstandingAgg._sum.remainingAmount?.toNumber() || 0;

    // Fetch latest 20 monthly rents
    const monthlyRents = await this.prisma.monthlyRent.findMany({
      where: { agreementId: { in: agreementIds } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 20,
    });

    // Fetch latest 50 payments
    const paymentHistory = await this.prisma.payment.findMany({
      where: { monthlyRent: { agreementId: { in: agreementIds } } },
      orderBy: { paymentDate: 'desc' },
      take: 50,
      include: {
        monthlyRent: {
          select: { year: true, month: true },
        },
      },
    });

    return {
      message: 'ভাড়াটিয়ার বিস্তারিত প্রোফাইল',
      data: {
        id: tenant.id,
        name: tenant.name,
        phone: tenant.phone,
        email: tenant.email,
        nidFrontImageId: tenant.nidFrontImageId,
        nidBackImageId: tenant.nidBackImageId,
        permanentAddress: tenant.permanentAddress,
        emergencyContactName: tenant.emergencyContactName,
        emergencyContactPhone: tenant.emergencyContactPhone,
        occupation: tenant.occupation,
        notes: tenant.notes,
        isActive: tenant.isActive,
        createdAt: tenant.createdAt,
        currentAgreement: activeAgreement,
        currentUnit: activeAgreement?.unit || null,
        outstandingAmount: totalOutstanding,
        monthlyRents,
        paymentHistory,
      },
    };
  }

  async update(userId: string, id: string, dto: UpdateTenantDto) {
    await this.findOne(userId, id);

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email ? dto.email.toLowerCase() : null }),
        ...(dto.nidFrontImageId !== undefined && { nidFrontImageId: dto.nidFrontImageId }),
        ...(dto.nidBackImageId !== undefined && { nidBackImageId: dto.nidBackImageId }),
        ...(dto.permanentAddress !== undefined && { permanentAddress: dto.permanentAddress }),
        ...(dto.emergencyContactName !== undefined && { emergencyContactName: dto.emergencyContactName }),
        ...(dto.emergencyContactPhone !== undefined && { emergencyContactPhone: dto.emergencyContactPhone }),
        ...(dto.occupation !== undefined && { occupation: dto.occupation }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    return {
      message: 'ভাড়াটিয়ার তথ্য সফলভাবে হালনাগাদ করা হয়েছে',
      data: updated,
    };
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    await this.prisma.tenant.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return {
      message: 'ভাড়াটিয়া সফলভাবে মুছে ফেলা হয়েছে',
      data: null,
    };
  }
}
