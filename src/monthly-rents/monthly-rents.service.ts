import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateMonthlyRentDto,
  GenerateMonthlyRentDto,
  UpdateMonthlyRentDto,
} from './dto/generate-monthly-rent.dto';
import { MonthlyRentQueryDto } from './dto/monthly-rent-query.dto';
import { ErrorCode } from '../common/constants/error-codes';
import { Prisma, RentStatus, AgreementStatus, AuditAction } from '@prisma/client';
import { DecimalUtil } from '../common/utils/decimal.util';
import { DateUtil } from '../common/utils/date.util';
import { Decimal } from 'decimal.js';
import { RentCalculationUtil } from '../common/utils/rent-calculation.util';

@Injectable()
export class MonthlyRentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Status calculation helper adhering strictly to spec rule #18
   */
  calculateStatus(
    totalAmount: number | string | Prisma.Decimal | Decimal,
    paidAmount: number | string | Prisma.Decimal | Decimal,
    dueDate: Date,
    currentDate: Date = new Date(),
  ): RentStatus {
    return RentCalculationUtil.calculateStatus(
      totalAmount,
      paidAmount,
      dueDate,
      currentDate,
    );
  }

  async generate(userId: string, dto: GenerateMonthlyRentDto) {
    const agreementWhere: Prisma.RentalAgreementWhereInput = {
      status: AgreementStatus.ACTIVE,
      deletedAt: null,
      unit: {
        property: {
          ownerId: userId,
          deletedAt: null,
        },
        deletedAt: null,
      },
    };

    if (dto.propertyId) {
      agreementWhere.unit = {
        is: {
          deletedAt: null,
          property: {
            is: {
              id: dto.propertyId,
              ownerId: userId,
              deletedAt: null,
            },
          },
        },
      };
    }

    const activeAgreements = await this.prisma.rentalAgreement.findMany({
      where: agreementWhere,
      select: {
        id: true,
        monthlyRent: true,
        serviceFee: true,
        parkingFee: true,
        extraCharge: true,
        dueDay: true,
      },
    });

    const agreementIds = activeAgreements.map((agreement) => agreement.id);
    const existingRents = agreementIds.length === 0
      ? []
      : await this.prisma.monthlyRent.findMany({
          where: {
            agreementId: { in: agreementIds },
            year: dto.year,
            month: dto.month,
          },
          select: { agreementId: true },
        });
    const existingAgreementIds = new Set(existingRents.map((rent) => rent.agreementId));

    const rentsToCreate: Prisma.MonthlyRentCreateManyInput[] = activeAgreements
      .filter((agreement) => !existingAgreementIds.has(agreement.id))
      .map((agreement) => {
        const rent = DecimalUtil.toDecimal(agreement.monthlyRent);
        const serviceFee = DecimalUtil.toDecimal(agreement.serviceFee);
        const parkingFee = DecimalUtil.toDecimal(agreement.parkingFee);
        const extraCharge = DecimalUtil.toDecimal(agreement.extraCharge);
        const totalAmount = DecimalUtil.calculateRentTotal({
          rent,
          serviceFee,
          parkingFee,
          extraCharge,
        });
        const dueDate = DateUtil.calculateDueDate(dto.year, dto.month, agreement.dueDay || 5);

        return {
          agreementId: agreement.id,
          year: dto.year,
          month: dto.month,
          rent: new Prisma.Decimal(rent.toString()),
          serviceFee: new Prisma.Decimal(serviceFee.toString()),
          parkingFee: new Prisma.Decimal(parkingFee.toString()),
          extraCharge: new Prisma.Decimal(extraCharge.toString()),
          lateFee: new Prisma.Decimal(0),
          discount: new Prisma.Decimal(0),
          totalAmount: new Prisma.Decimal(totalAmount.toString()),
          paidAmount: new Prisma.Decimal(0),
          remainingAmount: new Prisma.Decimal(totalAmount.toString()),
          dueDate,
          status: this.calculateStatus(totalAmount, 0, dueDate),
        };
      });

    const result = await this.prisma.$transaction(async (tx) => {
      const created = rentsToCreate.length === 0
        ? { count: 0 }
        : await tx.monthlyRent.createMany({
            data: rentsToCreate,
            // The unique agreement/year/month key also protects concurrent generation requests.
            skipDuplicates: true,
          });
      const generatedCount = created.count;
      const skippedCount = activeAgreements.length - generatedCount;

      await tx.auditLog.create({
        data: {
          userId,
          action: AuditAction.RENT_GENERATED,
          entityType: 'MonthlyRent',
          metadata: {
            year: dto.year,
            month: dto.month,
            propertyId: dto.propertyId || 'ALL',
            generatedCount,
            skippedCount,
          },
        },
      });

      return { generatedCount, skippedCount };
    });

    return {
      message: `${dto.month}/${dto.year} মাসের ভাড়ার হিসাব সফলভাবে তৈরি হয়েছে`,
      data: {
        year: dto.year,
        month: dto.month,
        generatedCount: result.generatedCount,
        skippedCount: result.skippedCount,
        totalAgreementsProcessed: activeAgreements.length,
      },
    };
  }

  async create(userId: string, dto: CreateMonthlyRentDto) {
    const agreement = await this.prisma.rentalAgreement.findFirst({
      where: { id: dto.agreementId, deletedAt: null },
      include: {
        unit: {
          include: {
            property: {
              select: { ownerId: true },
            },
          },
        },
      },
    });

    if (!agreement) {
      throw new NotFoundException({
        errorCode: ErrorCode.AGREEMENT_NOT_FOUND,
        message: 'ভাড়া চুক্তি পাওয়া যায়নি।',
      });
    }

    if (agreement.unit.property.ownerId !== userId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.PROPERTY_ACCESS_DENIED,
        message: 'এই সম্পত্তিতে আপনার অ্যাক্সেস নেই।',
      });
    }

    const existing = await this.prisma.monthlyRent.findUnique({
      where: {
        agreementId_year_month: {
          agreementId: dto.agreementId,
          year: dto.year,
          month: dto.month,
        },
      },
    });

    if (existing) {
      throw new ConflictException({
        errorCode: ErrorCode.RENT_ALREADY_GENERATED,
        message: 'এই মাসের ভাড়ার হিসাব ইতিমধ্যে তৈরি করা হয়েছে।',
      });
    }

    const totalAmount = DecimalUtil.calculateRentTotal({
      rent: dto.rent,
      serviceFee: dto.serviceFee ?? 0,
      parkingFee: dto.parkingFee ?? 0,
      extraCharge: dto.extraCharge ?? 0,
      lateFee: dto.lateFee ?? 0,
      discount: dto.discount ?? 0,
    });

    const dueDate = DateUtil.calculateDueDate(
      dto.year,
      dto.month,
      agreement.dueDay || 5,
    );

    const status = this.calculateStatus(totalAmount, 0, dueDate);

    const rent = await this.prisma.monthlyRent.create({
      data: {
        agreementId: dto.agreementId,
        year: dto.year,
        month: dto.month,
        rent: new Prisma.Decimal(dto.rent),
        serviceFee: new Prisma.Decimal(dto.serviceFee ?? 0),
        parkingFee: new Prisma.Decimal(dto.parkingFee ?? 0),
        extraCharge: new Prisma.Decimal(dto.extraCharge ?? 0),
        lateFee: new Prisma.Decimal(dto.lateFee ?? 0),
        discount: new Prisma.Decimal(dto.discount ?? 0),
        totalAmount: new Prisma.Decimal(totalAmount.toString()),
        paidAmount: new Prisma.Decimal(0),
        remainingAmount: new Prisma.Decimal(totalAmount.toString()),
        dueDate,
        status,
      },
    });

    return {
      message: 'মাসিক ভাড়ার হিসাব সফলভাবে তৈরি হয়েছে',
      data: rent,
    };
  }

  async findAll(userId: string, query: MonthlyRentQueryDto) {
    // Lazy status check for overdue records
    await this.refreshOverdueStatuses(userId);

    const where: any = {
      agreement: {
        unit: {
          property: {
            ownerId: userId,
          },
        },
      },
    };

    if (query.propertyId) {
      where.agreement.unit.propertyId = query.propertyId;
    }

    if (query.unitId) {
      where.agreement.unitId = query.unitId;
    }

    if (query.tenantId) {
      where.agreement.tenantId = query.tenantId;
    }

    if (query.year) {
      where.year = query.year;
    }

    if (query.month) {
      where.month = query.month;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.dueFrom || query.dueTo) {
      where.dueDate = {};
      if (query.dueFrom) {
        where.dueDate.gte = new Date(query.dueFrom);
      }
      if (query.dueTo) {
        where.dueDate.lte = new Date(query.dueTo);
      }
    }

    if (query.overdueOnly) {
      where.status = RentStatus.OVERDUE;
    }

    const [total, rents] = await Promise.all([
      this.prisma.monthlyRent.count({ where }),
      this.prisma.monthlyRent.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy
          ? { [query.sortBy]: query.sortOrder || 'desc' }
          : [{ year: 'desc' }, { month: 'desc' }],
        include: {
          agreement: {
            include: {
              tenant: { select: { id: true, name: true, phone: true } },
              unit: {
                select: {
                  id: true,
                  unitNumber: true,
                  property: { select: { id: true, name: true } },
                },
              },
            },
          },
          _count: { select: { payments: true } },
        },
      }),
    ]);

    return {
      message: 'মাসিক ভাড়ার তালিকা',
      data: rents,
      meta: {
        page: query.page || 1,
        limit: query.limit || 20,
        total,
        totalPages: Math.ceil(total / (query.limit || 20)),
      },
    };
  }

  async findOutstanding(userId: string, query: MonthlyRentQueryDto) {
    await this.refreshOverdueStatuses(userId);

    const where: any = {
      agreement: {
        unit: {
          property: {
            ownerId: userId,
          },
        },
      },
      remainingAmount: { gt: 0 },
      status: { not: RentStatus.CANCELLED },
    };

    if (query.propertyId) {
      where.agreement.unit.propertyId = query.propertyId;
    }

    if (query.tenantId) {
      where.agreement.tenantId = query.tenantId;
    }

    if (query.year) {
      where.year = query.year;
    }

    if (query.month) {
      where.month = query.month;
    }

    if (query.overdueOnly) {
      where.status = RentStatus.OVERDUE;
    } else if (query.status) {
      where.status = query.status;
    }

    const [total, rents] = await Promise.all([
      this.prisma.monthlyRent.count({ where }),
      this.prisma.monthlyRent.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: [
          // OVERDUE first, then earliest due date, then highest remaining
          { dueDate: 'asc' },
          { remainingAmount: 'desc' },
        ],
        include: {
          agreement: {
            include: {
              tenant: { select: { id: true, name: true, phone: true } },
              unit: {
                select: {
                  id: true,
                  unitNumber: true,
                  property: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      message: 'বকেয়া ভাড়ার তালিকা',
      data: rents,
      meta: {
        page: query.page || 1,
        limit: query.limit || 20,
        total,
        totalPages: Math.ceil(total / (query.limit || 20)),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const rent = await this.prisma.monthlyRent.findUnique({
      where: { id },
      include: {
        agreement: {
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
              },
            },
            unit: {
              include: {
                property: {
                  select: {
                    id: true,
                    name: true,
                    address: true,
                    city: true,
                    district: true,
                    ownerId: true,
                  },
                },
              },
            },
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!rent) {
      throw new NotFoundException({
        errorCode: ErrorCode.MONTHLY_RENT_NOT_FOUND,
        message: 'মাসিক ভাড়ার হিসাব পাওয়া যায়নি।',
      });
    }

    if (rent.agreement.unit.property.ownerId !== userId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.PROPERTY_ACCESS_DENIED,
        message: 'এই সম্পত্তিতে আপনার অ্যাক্সেস নেই।',
      });
    }

    // Lazy status check
    const currentCalculatedStatus = this.calculateStatus(
      rent.totalAmount,
      rent.paidAmount,
      rent.dueDate,
    );

    if (rent.status !== currentCalculatedStatus && rent.status !== RentStatus.CANCELLED) {
      const updated = await this.prisma.monthlyRent.update({
        where: { id },
        data: { status: currentCalculatedStatus },
        include: {
          agreement: {
            include: {
              tenant: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  email: true,
                },
              },
              unit: {
                include: {
                  property: {
                    select: {
                      id: true,
                      name: true,
                      address: true,
                      city: true,
                      district: true,
                      ownerId: true,
                    },
                  },
                },
              },
            },
          },
          payments: {
            orderBy: { paymentDate: 'desc' },
          },
        },
      });
      return {
        message: 'মাসিক ভাড়ার বিস্তারিত',
        data: updated,
      };
    }

    return {
      message: 'মাসিক ভাড়ার বিস্তারিত',
      data: rent,
    };
  }

  async update(userId: string, id: string, dto: UpdateMonthlyRentDto) {
    const current = await this.findOne(userId, id);
    const data = current.data;

    const rent = dto.rent !== undefined ? dto.rent : data.rent;
    const serviceFee =
      dto.serviceFee !== undefined ? dto.serviceFee : data.serviceFee;
    const parkingFee =
      dto.parkingFee !== undefined ? dto.parkingFee : data.parkingFee;
    const extraCharge =
      dto.extraCharge !== undefined ? dto.extraCharge : data.extraCharge;
    const lateFee = dto.lateFee !== undefined ? dto.lateFee : data.lateFee;
    const discount = dto.discount !== undefined ? dto.discount : data.discount;

    const newTotalAmount = DecimalUtil.calculateRentTotal({
      rent,
      serviceFee,
      parkingFee,
      extraCharge,
      lateFee,
      discount,
    });

    const newRemaining = DecimalUtil.calculateRemaining(
      newTotalAmount,
      data.paidAmount,
    );

    const newStatus = this.calculateStatus(
      newTotalAmount,
      data.paidAmount,
      data.dueDate,
    );

    const updated = await this.prisma.monthlyRent.update({
      where: { id },
      data: {
        ...(dto.rent !== undefined && { rent: new Prisma.Decimal(dto.rent) }),
        ...(dto.serviceFee !== undefined && {
          serviceFee: new Prisma.Decimal(dto.serviceFee),
        }),
        ...(dto.parkingFee !== undefined && {
          parkingFee: new Prisma.Decimal(dto.parkingFee),
        }),
        ...(dto.extraCharge !== undefined && {
          extraCharge: new Prisma.Decimal(dto.extraCharge),
        }),
        ...(dto.lateFee !== undefined && {
          lateFee: new Prisma.Decimal(dto.lateFee),
        }),
        ...(dto.discount !== undefined && {
          discount: new Prisma.Decimal(dto.discount),
        }),
        totalAmount: new Prisma.Decimal(newTotalAmount.toString()),
        remainingAmount: new Prisma.Decimal(newRemaining.toString()),
        status: newStatus,
      },
    });

    return {
      message: 'মাসিক ভাড়ার তথ্য সফলভাবে হালনাগাদ করা হয়েছে',
      data: updated,
    };
  }

  async recalculateStatus(userId: string, id: string) {
    const current = await this.findOne(userId, id);
    const calculated = this.calculateStatus(
      current.data.totalAmount,
      current.data.paidAmount,
      current.data.dueDate,
    );

    const updated = await this.prisma.monthlyRent.update({
      where: { id },
      data: { status: calculated },
    });

    return {
      message: 'অবস্থা সফলভাবে পুনঃগণনা করা হয়েছে',
      data: updated,
    };
  }

  /**
   * Lazy refresh: Updates PENDING records that have passed due date to OVERDUE
   */
  private async refreshOverdueStatuses(userId: string) {
    const now = new Date();
    await this.prisma.monthlyRent.updateMany({
      where: {
        agreement: {
          unit: {
            property: {
              ownerId: userId,
            },
          },
        },
        status: { in: [RentStatus.PENDING, RentStatus.PARTIAL] },
        dueDate: { lt: now },
        remainingAmount: { gt: 0 },
      },
      data: {
        status: RentStatus.OVERDUE,
      },
    });
  }
}
