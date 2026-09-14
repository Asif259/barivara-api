import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaTx } from '../prisma/prisma.service';
import {
  CreateRentalAgreementDto,
  UpdateRentalAgreementDto,
  RentalAgreementQueryDto,
} from './dto';
import { ErrorCode } from '../common/constants/error-codes';
import { Prisma, UnitStatus, AgreementStatus, RentStatus } from '@prisma/client';
import { DateUtil } from '../common/utils/date.util';
import { DecimalUtil } from '../common/utils/decimal.util';

@Injectable()
export class RentalAgreementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateRentalAgreementDto) {
    const unit = await this.prisma.unit.findFirst({
      where: { id: dto.unitId, deletedAt: null },
      include: {
        property: true,
      },
    });

    if (!unit) {
      throw new NotFoundException({
        errorCode: ErrorCode.UNIT_NOT_FOUND,
        message: 'ভাড়া ইউনিট পাওয়া যায়নি।',
      });
    }

    if (unit.property.ownerId !== userId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.PROPERTY_ACCESS_DENIED,
        message: 'এই সম্পত্তিতে আপনার অ্যাক্সেস নেই।',
      });
    }

    // Pre-flight conflict checks (fast rejection before entering transaction)
    await this.assertNoActiveAgreementOnUnit(dto.unitId);

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: dto.tenantId, deletedAt: null },
    });

    if (!tenant) {
      throw new NotFoundException({
        errorCode: ErrorCode.TENANT_NOT_FOUND,
        message: 'ভাড়াটিয়া পাওয়া যায়নি।',
      });
    }

    await this.assertNoActiveAgreementForTenant(dto.tenantId);

    const dueDay = dto.dueDay ?? 10;

    // Transaction for Agreement creation + Unit OCCUPIED status transition
    const agreement = await this.prisma.$transaction(async (tx: PrismaTx) => {
      // Re-verify inside transaction to prevent concurrent race condition
      await this.assertNoActiveAgreementForTenantTx(tx, dto.tenantId);
      await this.assertNoActiveAgreementOnUnitTx(tx, dto.unitId);

      const createdAgreement = await tx.rentalAgreement.create({
        data: {
          tenantId: dto.tenantId,
          unitId: dto.unitId,
          monthlyRent: new Prisma.Decimal(dto.monthlyRent),
          serviceFee: new Prisma.Decimal(dto.serviceFee ?? 0),
          parkingFee: new Prisma.Decimal(dto.parkingFee ?? 0),
          extraCharge: new Prisma.Decimal(dto.extraCharge ?? 0),
          dueDay,
          securityDeposit: new Prisma.Decimal(dto.securityDeposit ?? 0),
          startDate: new Date(dto.startDate),
          status: AgreementStatus.ACTIVE,
          notes: dto.notes || null,
          agreementDocumentId: dto.agreementDocumentId || null,
        },
        include: {
          tenant: {
            select: { id: true, name: true, phone: true, email: true },
          },
          unit: {
            select: { id: true, unitNumber: true, propertyId: true },
          },
        },
      });

      await tx.unit.update({
        where: { id: dto.unitId },
        data: { status: UnitStatus.OCCUPIED },
      });

      if (dto.generateCurrentMonthRent) {
        await this.createInitialMonthlyRent(tx, createdAgreement.id, dto, dueDay);
      }

      return createdAgreement;
    });

    return {
      message: 'ভাড়া চুক্তি সফলভাবে সম্পন্ন হয়েছে',
      data: agreement,
    };
  }

  async findAll(userId: string, query: RentalAgreementQueryDto) {
    const where: Prisma.RentalAgreementWhereInput = {
      unit: {
        property: {
          ownerId: userId,
        },
      },
      deletedAt: null,
    };

    if (query.propertyId) {
      (where.unit as Prisma.UnitWhereInput).propertyId = query.propertyId;
    }

    if (query.unitId) {
      where.unitId = query.unitId;
    }

    if (query.tenantId) {
      where.tenantId = query.tenantId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [total, agreements] = await Promise.all([
      this.prisma.rentalAgreement.count({ where }),
      this.prisma.rentalAgreement.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy
          ? { [query.sortBy]: query.sortOrder || 'desc' }
          : { createdAt: 'desc' },
        include: {
          tenant: {
            select: { id: true, name: true, phone: true, profilePictureId: true },
          },
          unit: {
            select: {
              id: true,
              unitNumber: true,
              property: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    return {
      message: 'চুক্তির তালিকা',
      data: agreements,
      meta: {
        page: query.page || 1,
        limit: query.limit || 20,
        total,
        totalPages: Math.ceil(total / (query.limit || 20)),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const agreement = await this.prisma.rentalAgreement.findFirst({
      where: { id, deletedAt: null },
      include: {
        tenant: true,
        unit: {
          include: {
            property: true,
          },
        },
        monthlyRents: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          include: {
            payments: {
              orderBy: { paymentDate: 'desc' },
            },
          },
        },
      },
    });

    if (!agreement) {
      throw new NotFoundException({
        errorCode: ErrorCode.AGREEMENT_NOT_FOUND,
        message: 'ভাড়া চুক্তি পাওয়া যায়নি।',
      });
    }

    if (agreement.unit.property.ownerId !== userId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.PROPERTY_ACCESS_DENIED,
        message: 'এই সম্পত্তিতে আপনার অ্যাক্সেস নেই।',
      });
    }

    return {
      message: 'চুক্তির বিস্তারিত বিবরণ',
      data: agreement,
    };
  }

  async update(userId: string, id: string, dto: UpdateRentalAgreementDto) {
    await this.findOne(userId, id);

    const updated = await this.prisma.rentalAgreement.update({
      where: { id },
      data: {
        ...(dto.monthlyRent !== undefined && {
          monthlyRent: new Prisma.Decimal(dto.monthlyRent),
        }),
        ...(dto.serviceFee !== undefined && {
          serviceFee: new Prisma.Decimal(dto.serviceFee),
        }),
        ...(dto.parkingFee !== undefined && {
          parkingFee: new Prisma.Decimal(dto.parkingFee),
        }),
        ...(dto.extraCharge !== undefined && {
          extraCharge: new Prisma.Decimal(dto.extraCharge),
        }),
        ...(dto.dueDay !== undefined && { dueDay: dto.dueDay }),
        ...(dto.securityDeposit !== undefined && {
          securityDeposit: new Prisma.Decimal(dto.securityDeposit),
        }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.agreementDocumentId !== undefined && {
          agreementDocumentId: dto.agreementDocumentId,
        }),
      },
    });

    return {
      message: 'চুক্তির তথ্য সফলভাবে হালনাগাদ করা হয়েছে',
      data: updated,
    };
  }

  async end(userId: string, id: string, endDate?: string) {
    const agreement = await this.findOne(userId, id);

    await this.prisma.$transaction(async (tx: PrismaTx) => {
      await tx.rentalAgreement.update({
        where: { id },
        data: {
          status: AgreementStatus.ENDED,
          endDate: endDate ? new Date(endDate) : new Date(),
        },
      });

      // Vacate the unit only if there are no other ACTIVE agreements on it
      const otherActive = await tx.rentalAgreement.findFirst({
        where: {
          unitId: agreement.data.unitId,
          id: { not: id },
          status: AgreementStatus.ACTIVE,
          deletedAt: null,
        },
      });

      if (!otherActive) {
        await tx.unit.update({
          where: { id: agreement.data.unitId },
          data: { status: UnitStatus.VACANT },
        });
      }
    });

    return {
      message: 'ভাড়া চুক্তি সফলভাবে সমাপ্ত করা হয়েছে',
      data: null,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Throws ConflictException if the unit already has an active agreement.
   */
  private async assertNoActiveAgreementOnUnit(unitId: string): Promise<void> {
    const existing = await this.prisma.rentalAgreement.findFirst({
      where: { unitId, status: AgreementStatus.ACTIVE, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException({
        errorCode: ErrorCode.AGREEMENT_OVERLAP,
        message: 'এই ইউনিটে ইতিমধ্যে একটি সক্রিয় চুক্তি রয়েছে।',
      });
    }
  }

  /**
   * Throws ConflictException if the tenant already has an active agreement.
   */
  private async assertNoActiveAgreementForTenant(tenantId: string): Promise<void> {
    const existing = await this.prisma.rentalAgreement.findFirst({
      where: { tenantId, status: AgreementStatus.ACTIVE, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException({
        errorCode: ErrorCode.TENANT_ACTIVE_AGREEMENT_EXISTS,
        message: 'এই ভাড়াটিয়ার ইতোমধ্যে একটি সক্রিয় ভাড়ার চুক্তি রয়েছে।',
      });
    }
  }

  /**
   * In-transaction version: re-verifies no active agreement on unit (race-condition guard).
   */
  private async assertNoActiveAgreementOnUnitTx(tx: PrismaTx, unitId: string): Promise<void> {
    const existing = await tx.rentalAgreement.findFirst({
      where: { unitId, status: AgreementStatus.ACTIVE, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException({
        errorCode: ErrorCode.AGREEMENT_OVERLAP,
        message: 'এই ইউনিটে ইতিমধ্যে একটি সক্রিয় চুক্তি রয়েছে।',
      });
    }
  }

  /**
   * In-transaction version: re-verifies no active agreement for tenant (race-condition guard).
   */
  private async assertNoActiveAgreementForTenantTx(tx: PrismaTx, tenantId: string): Promise<void> {
    const existing = await tx.rentalAgreement.findFirst({
      where: { tenantId, status: AgreementStatus.ACTIVE, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException({
        errorCode: ErrorCode.TENANT_ACTIVE_AGREEMENT_EXISTS,
        message: 'এই ভাড়াটিয়ার ইতোমধ্যে একটি সক্রিয় ভাড়ার চুক্তি রয়েছে।',
      });
    }
  }

  /**
   * Creates the initial monthly rent record for the agreement's start month.
   */
  private async createInitialMonthlyRent(
    tx: PrismaTx,
    agreementId: string,
    dto: CreateRentalAgreementDto,
    dueDay: number,
  ): Promise<void> {
    const start = new Date(dto.startDate);
    const year = start.getFullYear();
    const month = start.getMonth() + 1;

    const totalAmount = DecimalUtil.calculateRentTotal({
      rent: dto.monthlyRent,
      serviceFee: dto.serviceFee,
      parkingFee: dto.parkingFee,
      extraCharge: dto.extraCharge,
      lateFee: 0,
      discount: 0,
    });

    const dueDate = DateUtil.calculateDueDate(year, month, dueDay);

    await tx.monthlyRent.create({
      data: {
        agreementId,
        year,
        month,
        rent: new Prisma.Decimal(dto.monthlyRent),
        serviceFee: new Prisma.Decimal(dto.serviceFee ?? 0),
        parkingFee: new Prisma.Decimal(dto.parkingFee ?? 0),
        extraCharge: new Prisma.Decimal(dto.extraCharge ?? 0),
        lateFee: new Prisma.Decimal(0),
        discount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(totalAmount.toString()),
        paidAmount: new Prisma.Decimal(0),
        remainingAmount: new Prisma.Decimal(totalAmount.toString()),
        dueDate,
        status: RentStatus.PENDING,
      },
    });
  }
}
