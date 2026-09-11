import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateReminderDto,
  UpdateReminderDto,
  ReminderQueryDto,
} from './dto';
import { ErrorCode } from '../common/constants/error-codes';
import { ReminderStatus } from '@prisma/client';

@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateReminderDto) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: dto.tenantId, deletedAt: null },
    });

    if (!tenant) {
      throw new NotFoundException({
        errorCode: ErrorCode.TENANT_NOT_FOUND,
        message: 'ভাড়াটিয়া পাওয়া যায়নি।',
      });
    }

    if (dto.monthlyRentId) {
      const rent = await this.prisma.monthlyRent.findUnique({
        where: { id: dto.monthlyRentId },
        include: {
          agreement: {
            include: {
              unit: {
                include: { property: true },
              },
            },
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

      // Check deduplication for same pending reminder
      const existing = await this.prisma.reminder.findFirst({
        where: {
          monthlyRentId: dto.monthlyRentId,
          type: dto.type,
          status: ReminderStatus.PENDING,
          scheduledAt: new Date(dto.scheduledAt),
        },
      });

      if (existing) {
        throw new ConflictException({
          errorCode: ErrorCode.DUPLICATE_RESOURCE,
          message: 'এই সময়ের জন্য ইতিমধ্যে একটি রিমাইন্ডার নির্ধারিত আছে।',
        });
      }
    }

    const reminder = await this.prisma.reminder.create({
      data: {
        tenantId: dto.tenantId,
        monthlyRentId: dto.monthlyRentId || null,
        type: dto.type || 'UPCOMING_DUE',
        channel: dto.channel || 'IN_APP',
        scheduledAt: new Date(dto.scheduledAt),
        message: dto.message,
        status: ReminderStatus.PENDING,
      },
    });

    return {
      message: 'রিমাইন্ডার সফলভাবে তৈরি করা হয়েছে',
      data: reminder,
    };
  }

  async findAll(userId: string, query: ReminderQueryDto) {
    const where: any = {
      tenant: {
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
          {
            agreements: { none: {} },
          },
        ],
      },
    };

    if (query.tenantId) {
      where.tenantId = query.tenantId;
    }

    if (query.monthlyRentId) {
      where.monthlyRentId = query.monthlyRentId;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.channel) {
      where.channel = query.channel;
    }

    const [total, reminders] = await Promise.all([
      this.prisma.reminder.count({ where }),
      this.prisma.reminder.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: query.sortBy
          ? { [query.sortBy]: query.sortOrder || 'desc' }
          : { scheduledAt: 'desc' },
        include: {
          tenant: {
            select: { id: true, name: true, phone: true },
          },
          monthlyRent: {
            select: {
              id: true,
              month: true,
              year: true,
              totalAmount: true,
              remainingAmount: true,
              dueDate: true,
              status: true,
            },
          },
        },
      }),
    ]);

    return {
      message: 'রিমাইন্ডারের তালিকা',
      data: reminders,
      meta: {
        page: query.page || 1,
        limit: query.limit || 20,
        total,
        totalPages: Math.ceil(total / (query.limit || 20)),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const reminder = await this.prisma.reminder.findUnique({
      where: { id },
      include: {
        tenant: true,
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

    if (!reminder) {
      throw new NotFoundException({
        errorCode: ErrorCode.REMINDER_NOT_FOUND,
        message: 'রিমাইন্ডার পাওয়া যায়নি।',
      });
    }

    return {
      message: 'রিমাইন্ডারের বিস্তারিত',
      data: reminder,
    };
  }

  async update(userId: string, id: string, dto: UpdateReminderDto) {
    await this.findOne(userId, id);

    const updated = await this.prisma.reminder.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.scheduledAt !== undefined && {
          scheduledAt: new Date(dto.scheduledAt),
        }),
        ...(dto.message !== undefined && { message: dto.message }),
      },
    });

    return {
      message: 'রিমাইন্ডার হালনাগাদ করা হয়েছে',
      data: updated,
    };
  }

  async send(userId: string, id: string) {
    await this.findOne(userId, id);

    const updated = await this.prisma.reminder.update({
      where: { id },
      data: {
        status: ReminderStatus.SENT,
        sentAt: new Date(),
      },
    });

    return {
      message: 'রিমাইন্ডার সফলভাবে পাঠানো হয়েছে',
      data: updated,
    };
  }
}
