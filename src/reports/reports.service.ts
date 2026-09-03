import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DateUtil } from '../common/utils/date.util';
import { DecimalUtil } from '../common/utils/decimal.util';
import { Decimal } from 'decimal.js';
import { RentStatus } from '@prisma/client';
import { stringify } from 'csv-stringify';
import { ErrorCode } from '../common/constants/error-codes';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMonthlyReport(
    userId: string,
    yearParam?: number,
    monthParam?: number,
    propertyId?: string,
  ) {
    const nowDhaka = DateUtil.nowInDhaka();
    const year = yearParam || nowDhaka.getFullYear();
    const month = monthParam || nowDhaka.getMonth() + 1;

    const propertyWhere: any = {
      ownerId: userId,
      deletedAt: null,
    };
    if (propertyId) {
      propertyWhere.id = propertyId;
    }

    const unitWhere = {
      property: propertyWhere,
      deletedAt: null,
    };

    // Monthly rents
    const monthlyRents = await this.prisma.monthlyRent.findMany({
      where: {
        agreement: {
          unit: unitWhere,
        },
        year,
        month,
      },
      include: {
        agreement: {
          include: {
            tenant: { select: { name: true, phone: true } },
            unit: {
              select: {
                unitNumber: true,
                property: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    // Expenses for this month and property
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const expenseWhere: any = {
      property: propertyWhere,
      deletedAt: null,
      expenseDate: {
        gte: startDate,
        lte: endDate,
      },
    };

    const [expensesAggregate, expensesList] = await Promise.all([
      this.prisma.expense.aggregate({
        where: expenseWhere,
        _sum: { amount: true },
      }),
      this.prisma.expense.findMany({
        where: expenseWhere,
      }),
    ]);

    let expected = new Decimal(0);
    let collected = new Decimal(0);

    let paidCount = 0;
    let partialCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;

    for (const rent of monthlyRents) {
      expected = expected.plus(DecimalUtil.toDecimal(rent.totalAmount));
      collected = collected.plus(DecimalUtil.toDecimal(rent.paidAmount));

      switch (rent.status) {
        case RentStatus.PAID:
          paidCount++;
          break;
        case RentStatus.PARTIAL:
          partialCount++;
          break;
        case RentStatus.PENDING:
          pendingCount++;
          break;
        case RentStatus.OVERDUE:
          overdueCount++;
          break;
      }
    }

    const outstanding = expected.minus(collected);
    const totalExpenses = DecimalUtil.toDecimal(
      expensesAggregate._sum.amount || 0,
    );
    const netCollection = collected.minus(totalExpenses);

    return {
      message: `${month}/${year} মাসিক আর্থিক প্রতিবেদন`,
      data: {
        year,
        month,
        propertyId: propertyId || 'ALL',
        financial: {
          expected: expected.toNumber(),
          collected: collected.toNumber(),
          outstanding: (outstanding.isNegative() ? new Decimal(0) : outstanding).toNumber(),
          expenses: totalExpenses.toNumber(),
          netCollection: netCollection.toNumber(),
        },
        counts: {
          totalRents: monthlyRents.length,
          paidCount,
          partialCount,
          pendingCount,
          overdueCount,
        },
        rentDetails: monthlyRents,
        expenseDetails: expensesList,
      },
    };
  }

  async getTenantStatement(userId: string, tenantId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
      include: {
        agreements: {
          where: {
            unit: {
              property: { ownerId: userId },
            },
            deletedAt: null,
          },
          include: {
            unit: {
              include: { property: true },
            },
            monthlyRents: {
              orderBy: [{ year: 'desc' }, { month: 'desc' }],
              include: {
                payments: {
                  where: { status: 'COMPLETED' },
                  orderBy: { paymentDate: 'desc' },
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

    let totalBilled = new Decimal(0);
    let totalPaid = new Decimal(0);
    const statementRecords: any[] = [];

    for (const agreement of tenant.agreements) {
      for (const rent of agreement.monthlyRents) {
        totalBilled = totalBilled.plus(DecimalUtil.toDecimal(rent.totalAmount));
        totalPaid = totalPaid.plus(DecimalUtil.toDecimal(rent.paidAmount));

        statementRecords.push({
          monthlyRentId: rent.id,
          month: rent.month,
          year: rent.year,
          unitNumber: agreement.unit.unitNumber,
          propertyName: agreement.unit.property.name,
          charges: {
            rent: DecimalUtil.toNumber(rent.rent),
            serviceFee: DecimalUtil.toNumber(rent.serviceFee),
            parkingFee: DecimalUtil.toNumber(rent.parkingFee),
            extraCharge: DecimalUtil.toNumber(rent.extraCharge),
            lateFee: DecimalUtil.toNumber(rent.lateFee),
            discount: DecimalUtil.toNumber(rent.discount),
          },
          totalAmount: DecimalUtil.toNumber(rent.totalAmount),
          paidAmount: DecimalUtil.toNumber(rent.paidAmount),
          remainingAmount: DecimalUtil.toNumber(rent.remainingAmount),
          dueDate: rent.dueDate,
          paidDate: rent.paidDate,
          status: rent.status,
          payments: rent.payments.map((p) => ({
            id: p.id,
            amount: DecimalUtil.toNumber(p.amount),
            method: p.paymentMethod,
            paymentDate: p.paymentDate,
            transactionId: p.transactionId,
          })),
        });
      }
    }

    const totalOutstanding = totalBilled.minus(totalPaid);

    return {
      message: 'ভাড়াটিয়া স্টেটমেন্ট',
      data: {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          phone: tenant.phone,
          email: tenant.email,
        },
        summary: {
          totalBilled: totalBilled.toNumber(),
          totalPaid: totalPaid.toNumber(),
          totalOutstanding: (totalOutstanding.isNegative() ? new Decimal(0) : totalOutstanding).toNumber(),
        },
        records: statementRecords,
      },
    };
  }

  async getPropertyFinancial(userId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, ownerId: userId, deletedAt: null },
    });

    if (!property) {
      throw new NotFoundException({
        errorCode: ErrorCode.PROPERTY_NOT_FOUND,
        message: 'বাড়ি পাওয়া যায়নি।',
      });
    }

    // Aggregate lifetime collected rent
    const rents = await this.prisma.monthlyRent.findMany({
      where: {
        agreement: {
          unit: { propertyId, deletedAt: null },
        },
      },
    });

    let totalExpected = new Decimal(0);
    let totalCollected = new Decimal(0);
    for (const r of rents) {
      totalExpected = totalExpected.plus(DecimalUtil.toDecimal(r.totalAmount));
      totalCollected = totalCollected.plus(DecimalUtil.toDecimal(r.paidAmount));
    }

    const totalOutstanding = totalExpected.minus(totalCollected);

    // Aggregate lifetime expenses
    const expensesSum = await this.prisma.expense.aggregate({
      where: { propertyId, deletedAt: null },
      _sum: { amount: true },
    });

    const totalExpenses = DecimalUtil.toDecimal(expensesSum._sum.amount || 0);
    const netProfit = totalCollected.minus(totalExpenses);

    return {
      message: 'বাড়ির আর্থিক প্রতিবেদন',
      data: {
        property: {
          id: property.id,
          name: property.name,
          address: property.address,
        },
        totalExpected: totalExpected.toNumber(),
        totalCollected: totalCollected.toNumber(),
        totalOutstanding: (totalOutstanding.isNegative() ? new Decimal(0) : totalOutstanding).toNumber(),
        totalExpenses: totalExpenses.toNumber(),
        netProfit: netProfit.toNumber(),
      },
    };
  }

  async exportMonthlyReportCsv(
    userId: string,
    year?: number,
    month?: number,
    propertyId?: string,
  ): Promise<string> {
    const report = await this.getMonthlyReport(userId, year, month, propertyId);
    const rentDetails = report.data.rentDetails;

    const records: any[] = [];
    records.push([
      'মাস/সাল',
      'বাড়ি',
      'ফ্ল্যাট/ইউনিট',
      'ভাড়াটিয়া',
      'ফোন',
      'মোট বিল (৳)',
      'পরিশোধ (৳)',
      'বকেয়া (৳)',
      'শেষ তারিখ',
      'অবস্থা',
    ]);

    for (const r of rentDetails) {
      records.push([
        `${r.month}/${r.year}`,
        r.agreement?.unit?.property?.name || '',
        r.agreement?.unit?.unitNumber || '',
        r.agreement?.tenant?.name || '',
        r.agreement?.tenant?.phone || '',
        DecimalUtil.toFixed(r.totalAmount),
        DecimalUtil.toFixed(r.paidAmount),
        DecimalUtil.toFixed(r.remainingAmount),
        DateUtil.formatDhaka(r.dueDate, 'yyyy-MM-dd'),
        r.status,
      ]);
    }

    return new Promise((resolve, reject) => {
      stringify(records, (err, output) => {
        if (err) return reject(err);
        resolve(output);
      });
    });
  }
}
