import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  ExpenseQueryDto,
} from './dto/create-expense.dto';
import { ErrorCode } from '../common/constants/error-codes';
import { Prisma } from '@prisma/client';
import { DecimalUtil } from '../common/utils/decimal.util';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateExpenseDto) {
    const property = await this.prisma.property.findFirst({
      where: { id: dto.propertyId, deletedAt: null },
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

    const expense = await this.prisma.expense.create({
      data: {
        propertyId: dto.propertyId,
        category: dto.category,
        amount: new Prisma.Decimal(dto.amount),
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : new Date(),
        description: dto.description || null,
        paymentMethod: dto.paymentMethod || 'CASH',
        reference: dto.reference || null,
        receiptFileId: dto.receiptFileId || null,
        createdBy: dto.createdBy || null,
      },
    });

    return {
      message: 'খরচের হিসাব সফলভাবে যুক্ত করা হয়েছে',
      data: expense,
    };
  }

  async findAll(userId: string, query: ExpenseQueryDto) {
    const where: any = {
      property: {
        ownerId: userId,
      },
      deletedAt: null,
    };

    if (query.propertyId) {
      where.propertyId = query.propertyId;
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.paymentMethod) {
      where.paymentMethod = query.paymentMethod;
    }

    if (query.dateFrom || query.dateTo) {
      where.expenseDate = {};
      if (query.dateFrom) {
        where.expenseDate.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.expenseDate.lte = new Date(query.dateTo);
      }
    }

    const [total, expenses, totalSumAggregate] = await Promise.all([
      this.prisma.expense.count({ where }),
      this.prisma.expense.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy
          ? { [query.sortBy]: query.sortOrder || 'desc' }
          : { expenseDate: 'desc' },
        include: {
          property: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.expense.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    const totalAmount = DecimalUtil.toNumber(totalSumAggregate._sum.amount || 0);

    return {
      message: 'খরচের তালিকা',
      data: {
        expenses,
        totalAmount,
      },
      meta: {
        page: query.page || 1,
        limit: query.limit || 20,
        total,
        totalPages: Math.ceil(total / (query.limit || 20)),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, deletedAt: null },
      include: {
        property: true,
      },
    });

    if (!expense) {
      throw new NotFoundException({
        errorCode: ErrorCode.EXPENSE_NOT_FOUND,
        message: 'খরচের হিসাব পাওয়া যায়নি।',
      });
    }

    if (expense.property.ownerId !== userId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.PROPERTY_ACCESS_DENIED,
        message: 'এই সম্পত্তিতে আপনার অ্যাক্সেস নেই।',
      });
    }

    return {
      message: 'খরচের বিস্তারিত তথ্য',
      data: expense,
    };
  }

  async update(userId: string, id: string, dto: UpdateExpenseDto) {
    await this.findOne(userId, id);

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.amount !== undefined && {
          amount: new Prisma.Decimal(dto.amount),
        }),
        ...(dto.expenseDate !== undefined && {
          expenseDate: new Date(dto.expenseDate),
        }),
        ...(dto.description !== undefined && {
          description: dto.description,
        }),
        ...(dto.paymentMethod !== undefined && {
          paymentMethod: dto.paymentMethod,
        }),
        ...(dto.reference !== undefined && { reference: dto.reference }),
        ...(dto.receiptFileId !== undefined && {
          receiptFileId: dto.receiptFileId,
        }),
      },
    });

    return {
      message: 'খরচের তথ্য সফলভাবে হালনাগাদ করা হয়েছে',
      data: updated,
    };
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    await this.prisma.expense.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return {
      message: 'খরচের রেকর্ড সফলভাবে মুছে ফেলা হয়েছে',
      data: null,
    };
  }
}
