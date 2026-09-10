import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaTx } from '../prisma/prisma.service';
import { CreatePaymentDto, PaymentQueryDto } from './dto/create-payment.dto';
import { ErrorCode } from '../common/constants/error-codes';
import { Prisma, PaymentStatus, RentStatus, AuditAction } from '@prisma/client';
import { DecimalUtil } from '../common/utils/decimal.util';
import { Decimal } from 'decimal.js';
import { RentCalculationUtil } from '../common/utils/rent-calculation.util';

import { DateUtil, TIMEZONE_DHAKA } from '../common/utils/date.util';
import { toZonedTime } from 'date-fns-tz';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreatePaymentDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const monthlyRent = await this.prisma.monthlyRent.findUnique({
      where: { id: dto.monthlyRentId },
      include: {
        agreement: {
          include: {
            unit: {
              include: {
                property: true,
              },
            },
            tenant: true,
          },
        },
      },
    });

    if (!monthlyRent) {
      throw new NotFoundException({
        errorCode: ErrorCode.MONTHLY_RENT_NOT_FOUND,
        message: 'মাসিক ভাড়ার হিসাব পাওয়া যায়নি।',
      });
    }

    if (monthlyRent.agreement.unit.property.ownerId !== userId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.PROPERTY_ACCESS_DENIED,
        message: 'এই সম্পত্তিতে আপনার অ্যাক্সেস নেই।',
      });
    }

    if (monthlyRent.status === RentStatus.CANCELLED) {
      throw new BadRequestException({
        errorCode: ErrorCode.INVALID_STATUS_TRANSITION,
        message: 'বাতিলকৃত ভাড়ার জন্য পেমেন্ট নেওয়া সম্ভব নয়।',
      });
    }

    const paymentAmount = new Decimal(dto.amount);
    if (paymentAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException({
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: 'পেমেন্টের পরিমাণ ০ এর বেশি হতে হবে।',
      });
    }

    const remainingAmount = DecimalUtil.toDecimal(monthlyRent.remainingAmount);
    if (paymentAmount.greaterThan(remainingAmount)) {
      throw new BadRequestException({
        errorCode: ErrorCode.PAYMENT_EXCEEDS_REMAINING,
        message: `পেমেন্টের পরিমাণ বকেয়া পরিমাণের চেয়ে বেশি হতে পারে না (সর্বোচ্চ: ৳${remainingAmount.toFixed(2)})।`,
      });
    }

    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
    if (isNaN(paymentDate.getTime())) {
      throw new BadRequestException({
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: 'অবৈধ পেমেন্টের তারিখ।',
      });
    }

    const dhakaNow = DateUtil.nowInDhaka();
    const dhakaPaymentDate = toZonedTime(paymentDate, TIMEZONE_DHAKA);

    if (dhakaPaymentDate > dhakaNow) {
      const isSameDay =
        dhakaPaymentDate.getFullYear() === dhakaNow.getFullYear() &&
        dhakaPaymentDate.getMonth() === dhakaNow.getMonth() &&
        dhakaPaymentDate.getDate() === dhakaNow.getDate();

      if (!isSameDay) {
        throw new BadRequestException({
          errorCode: ErrorCode.VALIDATION_ERROR,
          message: 'পেমেন্টের তারিখ ভবিষ্যতের তারিখ হতে পারে না।',
        });
      }
    }

    // Snapshot the owner's current signature fileId for historical receipt consistency.
    // We capture the value at payment-creation time so later signature changes do not
    // affect already-issued receipts.
    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, signatureFileId: true },
    });

    // Execute atomic transaction for payment creation and rent balance update
    const result = await this.prisma.$transaction(async (tx: PrismaTx) => {
      // 1. Create Payment (with signature snapshot)
      const payment = await tx.payment.create({
        data: {
          monthlyRentId: dto.monthlyRentId,
          amount: new Prisma.Decimal(paymentAmount.toString()),
          paymentMethod: dto.paymentMethod || 'CASH',
          transactionId: dto.transactionId || null,
          paymentDate,
          receivedBy: dto.receivedBy || null,
          note: dto.note || null,
          status: PaymentStatus.COMPLETED,
          ownerSignatureSnapshotId: owner?.signatureFileId || null,
        },
      });

      // 2. Calculate new totals
      const newPaidAmount = DecimalUtil.toDecimal(monthlyRent.paidAmount).plus(
        paymentAmount,
      );
      const newRemaining = DecimalUtil.calculateRemaining(
        monthlyRent.totalAmount,
        newPaidAmount,
      );
      const newStatus = RentCalculationUtil.calculateStatus(
        monthlyRent.totalAmount,
        newPaidAmount,
        monthlyRent.dueDate,
        paymentDate,
      );

      // 3. Update MonthlyRent
      const updatedRent = await tx.monthlyRent.update({
        where: { id: dto.monthlyRentId },
        data: {
          paidAmount: new Prisma.Decimal(newPaidAmount.toString()),
          remainingAmount: new Prisma.Decimal(newRemaining.toString()),
          status: newStatus,
          paidDate: newStatus === RentStatus.PAID ? paymentDate : null,
        },
      });

      // 4. Record Audit Log
      await tx.auditLog.create({
        data: {
          userId,
          action: AuditAction.PAYMENT_CREATED,
          entityType: 'Payment',
          entityId: payment.id,
          ipAddress,
          userAgent,
          metadata: {
            monthlyRentId: dto.monthlyRentId,
            amount: paymentAmount.toNumber(),
            paymentMethod: dto.paymentMethod,
            newRentStatus: newStatus,
          },
        },
      });

      return {
        payment,
        monthlyRent: updatedRent,
      };
    });

    return {
      message: 'পেমেন্ট সফলভাবে সম্পন্ন হয়েছে',
      data: {
        ...result,
        owner: owner
          ? { id: owner.id, name: owner.name }
          : { id: userId, name: null },
      },
    };
  }

  async reverse(
    userId: string,
    id: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        monthlyRent: {
          include: {
            agreement: {
              include: {
                unit: {
                  include: {
                    property: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException({
        errorCode: ErrorCode.PAYMENT_NOT_FOUND,
        message: 'পেমেন্ট রেকর্ড পাওয়া যায়নি।',
      });
    }

    if (payment.monthlyRent.agreement.unit.property.ownerId !== userId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.PROPERTY_ACCESS_DENIED,
        message: 'এই সম্পত্তিতে আপনার অ্যাক্সেস নেই।',
      });
    }

    if (payment.status === PaymentStatus.REVERSED) {
      throw new BadRequestException({
        errorCode: ErrorCode.PAYMENT_ALREADY_REVERSED,
        message: 'এই পেমেন্টটি ইতিমধ্যে বাতিল (রিভার্স) করা হয়েছে।',
      });
    }

    // Atomic transaction for payment reversal and balance recalculation
    const result = await this.prisma.$transaction(async (tx: PrismaTx) => {
      // 1. Mark payment reversed
      const reversedPayment = await tx.payment.update({
        where: { id },
        data: { status: PaymentStatus.REVERSED },
      });

      // 2. Sum remaining active COMPLETED payments for this rent
      const completedPayments = await tx.payment.findMany({
        where: {
          monthlyRentId: payment.monthlyRentId,
          status: PaymentStatus.COMPLETED,
        },
        orderBy: { paymentDate: 'desc' },
      });

      let recalculatedPaid = new Decimal(0);
      for (const p of completedPayments) {
        recalculatedPaid = recalculatedPaid.plus(DecimalUtil.toDecimal(p.amount));
      }

      const totalAmount = DecimalUtil.toDecimal(payment.monthlyRent.totalAmount);
      const newRemaining = DecimalUtil.calculateRemaining(
        totalAmount,
        recalculatedPaid,
      );
      const newStatus = RentCalculationUtil.calculateStatus(
        totalAmount,
        recalculatedPaid,
        payment.monthlyRent.dueDate,
      );

      const latestPayment = completedPayments[0] || null;

      // 3. Update MonthlyRent
      const updatedRent = await tx.monthlyRent.update({
        where: { id: payment.monthlyRentId },
        data: {
          paidAmount: new Prisma.Decimal(recalculatedPaid.toString()),
          remainingAmount: new Prisma.Decimal(newRemaining.toString()),
          status: newStatus,
          paidDate:
            newStatus === RentStatus.PAID && latestPayment
              ? latestPayment.paymentDate
              : null,
        },
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          userId,
          action: AuditAction.PAYMENT_REVERSED,
          entityType: 'Payment',
          entityId: id,
          ipAddress,
          userAgent,
          metadata: {
            monthlyRentId: payment.monthlyRentId,
            reversedAmount: DecimalUtil.toNumber(payment.amount),
            newRentStatus: newStatus,
          },
        },
      });

      return {
        payment: reversedPayment,
        monthlyRent: updatedRent,
      };
    });

    return {
      message: 'পেমেন্ট সফলভাবে রিভার্স করা হয়েছে',
      data: result,
    };
  }

  async findAll(userId: string, query: PaymentQueryDto) {
    const where: any = {
      monthlyRent: {
        agreement: {
          unit: {
            property: {
              ownerId: userId,
            },
          },
        },
      },
    };

    if (query.monthlyRentId) {
      where.monthlyRentId = query.monthlyRentId;
    }

    if (query.propertyId) {
      where.monthlyRent.agreement.unit.propertyId = query.propertyId;
    }

    if (query.tenantId) {
      where.monthlyRent.agreement.tenantId = query.tenantId;
    }

    if (query.paymentMethod) {
      where.paymentMethod = query.paymentMethod;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.dateFrom || query.dateTo) {
      where.paymentDate = {};
      if (query.dateFrom) {
        where.paymentDate.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.paymentDate.lte = new Date(query.dateTo);
      }
    }

    const [total, payments] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy
          ? { [query.sortBy]: query.sortOrder || 'desc' }
          : { paymentDate: 'desc' },
        include: {
          monthlyRent: {
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
          },
        },
      }),
    ]);

    return {
      message: 'পেমেন্টের তালিকা',
      data: payments,
      meta: {
        page: query.page || 1,
        limit: query.limit || 20,
        total,
        totalPages: Math.ceil(total / (query.limit || 20)),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        monthlyRent: {
          include: {
            agreement: {
              include: {
                tenant: true,
                unit: {
                  include: {
                    property: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException({
        errorCode: ErrorCode.PAYMENT_NOT_FOUND,
        message: 'পেমেন্ট পাওয়া যায়নি।',
      });
    }

    if (payment.monthlyRent.agreement.unit.property.ownerId !== userId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.PROPERTY_ACCESS_DENIED,
        message: 'এই সম্পত্তিতে আপনার অ্যাক্সেস নেই।',
      });
    }

    const ownerId = payment.monthlyRent.agreement.unit.property.ownerId;
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true, name: true, signatureFileId: true },
    });
    const ownerSignatureSnapshot = await this.loadSignatureSnapshot(
      payment.ownerSignatureSnapshotId,
    );

    return {
      message: 'পেমেন্টের বিস্তারিত তথ্য',
      data: {
        ...payment,
        owner: owner
          ? {
              id: owner.id,
              name: owner.name,
              signatureFileId: owner.signatureFileId,
            }
          : { id: ownerId, name: null, signatureFileId: null },
        ownerSignatureSnapshot,
      },
    };
  }

  /**
   * Load the Media record (sanitized) for a payment's owner-signature snapshot.
   * Returns null if the snapshot is missing or the file has been deleted.
   */
  private async loadSignatureSnapshot(snapshotId: string | null) {
    if (!snapshotId) return null;
    const media = await this.prisma.media.findUnique({
      where: { id: snapshotId },
    });
    if (!media || media.deletedAt || media.status !== 'COMPLETED') return null;
    // Strip internal fields the API never exposes
    const { storagePath, deletedAt, ...rest } = media;
    return rest;
  }
}
