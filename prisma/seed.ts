import {
  PrismaClient,
  Role,
  UnitType,
  UnitStatus,
  AgreementStatus,
  RentStatus,
  PaymentMethod,
  PaymentStatus,
  ExpenseCategory,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting BariVara database seeding...');

  // 1. Create Owner User
  const passwordHash = await argon2.hash('Password123');
  const owner = await prisma.user.upsert({
    where: { email: 'owner@barivara.com' },
    update: {},
    create: {
      name: 'আসিফ চৌধুরী',
      email: 'owner@barivara.com',
      phone: '01711223344',
      passwordHash,
      role: Role.OWNER,
    },
  });
  console.log(`👤 Created/Verified Owner: ${owner.name} (${owner.id})`);

  // 2. Create Property
  let property = await prisma.property.findFirst({
    where: { ownerId: owner.id, name: 'গ্রিন ভিউ অ্যাপার্টমেন্টস' },
  });

  if (!property) {
    property = await prisma.property.create({
      data: {
        ownerId: owner.id,
        name: 'গ্রিন ভিউ অ্যাপার্টমেন্টস',
        address: 'বাড়ি # ২৫, রোড # ৭, ধানমন্ডি, ঢাকা',
        city: 'ঢাকা',
        district: 'ঢাকা',
        postalCode: '১২০৫',
        description: '৬ তলা বিশিষ্ট আধুনিক আবাসিক ভবন',
        totalFloors: 6,
      },
    });
    console.log(`🏢 Created Property: ${property.name}`);
  }

  // 3. Create 6 Units (1A, 1B, 2A, 2B, 3A, 3B)
  const unitConfigs = [
    { number: '1A', floor: 1, rent: 20000, service: 3000, parking: 2000, extra: 500 },
    { number: '1B', floor: 1, rent: 22000, service: 3000, parking: 2000, extra: 500 },
    { number: '2A', floor: 2, rent: 24000, service: 3500, parking: 2000, extra: 500 },
    { number: '2B', floor: 2, rent: 25000, service: 3500, parking: 2000, extra: 500 },
    { number: '3A', floor: 3, rent: 26000, service: 4000, parking: 2000, extra: 500 },
    { number: '3B', floor: 3, rent: 26000, service: 4000, parking: 2000, extra: 500 },
  ];

  const units: any[] = [];
  for (const uc of unitConfigs) {
    let unit = await prisma.unit.findFirst({
      where: { propertyId: property.id, unitNumber: uc.number },
    });

    if (!unit) {
      unit = await prisma.unit.create({
        data: {
          propertyId: property.id,
          unitNumber: uc.number,
          floor: uc.floor,
          unitType: UnitType.APARTMENT,
          bedrooms: 3,
          bathrooms: 2,
          monthlyBaseRent: uc.rent,
          defaultServiceFee: uc.service,
          defaultParkingFee: uc.parking,
          defaultExtraCharge: uc.extra,
          status: UnitStatus.VACANT,
        },
      });
    }
    units.push(unit);
  }
  console.log(`🚪 Created/Verified ${units.length} Units`);

  // 4. Create 4 Tenants
  const tenantConfigs = [
    { name: 'কামাল হোসেন', phone: '01811223301', email: 'kamal@example.com', occ: 'ব্যবসায়ী' },
    { name: 'তানভীর আহমেদ', phone: '01811223302', email: 'tanvir@example.com', occ: 'সফটওয়্যার ইঞ্জিনিয়ার' },
    { name: 'মাহমুদুল হাসান', phone: '01811223303', email: 'mahmud@example.com', occ: 'ব্যাংকার' },
    { name: 'ফারহানা ইসলাম', phone: '01811223304', email: 'farhana@example.com', occ: 'ডাক্তার' },
  ];

  const tenants: any[] = [];
  for (const tc of tenantConfigs) {
    let tenant = await prisma.tenant.findFirst({
      where: { phone: tc.phone },
    });
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          name: tc.name,
          phone: tc.phone,
          email: tc.email,
          occupation: tc.occ,
          permanentAddress: 'ঢাকা, বাংলাদেশ',
          emergencyContactName: 'জরুরি অভিভাবক',
          emergencyContactPhone: '01900000000',
        },
      });
    }
    tenants.push(tenant);
  }
  console.log(`👥 Created/Verified ${tenants.length} Tenants`);

  // 5. Create 4 Active Agreements (for first 4 units)
  const agreements: any[] = [];
  for (let i = 0; i < 4; i++) {
    const tenant = tenants[i];
    const unit = units[i];
    const uc = unitConfigs[i];

    let agreement = await prisma.rentalAgreement.findFirst({
      where: { unitId: unit.id, status: AgreementStatus.ACTIVE },
    });

    if (!agreement) {
      agreement = await prisma.rentalAgreement.create({
        data: {
          tenantId: tenant.id,
          unitId: unit.id,
          monthlyRent: uc.rent,
          serviceFee: uc.service,
          parkingFee: uc.parking,
          extraCharge: uc.extra,
          dueDay: 5,
          securityDeposit: uc.rent * 2,
          startDate: new Date('2026-01-01'),
          status: AgreementStatus.ACTIVE,
        },
      });

      await prisma.unit.update({
        where: { id: unit.id },
        data: { status: UnitStatus.OCCUPIED },
      });
    }
    agreements.push(agreement);
  }
  console.log(`📝 Created/Verified ${agreements.length} Rental Agreements`);

  // 6. Create Monthly Rents for September 2026
  const monthlyRents: any[] = [];
  for (let i = 0; i < 4; i++) {
    const agreement = agreements[i];
    const uc = unitConfigs[i];
    const totalAmount = uc.rent + uc.service + uc.parking + uc.extra;

    let rent = await prisma.monthlyRent.findUnique({
      where: {
        agreementId_year_month: {
          agreementId: agreement.id,
          year: 2026,
          month: 9,
        },
      },
    });

    if (!rent) {
      rent = await prisma.monthlyRent.create({
        data: {
          agreementId: agreement.id,
          year: 2026,
          month: 9,
          rent: uc.rent,
          serviceFee: uc.service,
          parkingFee: uc.parking,
          extraCharge: uc.extra,
          lateFee: 0,
          discount: 0,
          totalAmount,
          paidAmount: 0,
          remainingAmount: totalAmount,
          dueDate: new Date('2026-09-05T23:59:59.999Z'),
          status: RentStatus.PENDING,
        },
      });
    }
    monthlyRents.push(rent);
  }
  console.log(`💰 Created/Verified ${monthlyRents.length} Monthly Rents for Sept 2026`);

  // 7. Create 3 Payments (Full payment for unit 1, partial for unit 2, full for unit 3)
  // Rent 1: Full Payment
  const rent1 = monthlyRents[0];
  const rent1Total = Number(rent1.totalAmount);
  await prisma.payment.create({
    data: {
      monthlyRentId: rent1.id,
      amount: rent1Total,
      paymentMethod: PaymentMethod.BKASH,
      transactionId: 'BKASH-SEED-001',
      paymentDate: new Date('2026-09-02T10:00:00Z'),
      note: 'সেপ্টেম্বরের পূর্ণ ভাড়া',
      status: PaymentStatus.COMPLETED,
    },
  });
  await prisma.monthlyRent.update({
    where: { id: rent1.id },
    data: {
      paidAmount: rent1Total,
      remainingAmount: 0,
      status: RentStatus.PAID,
      paidDate: new Date('2026-09-02T10:00:00Z'),
    },
  });

  // Rent 2: Partial Payment (৳20,000 paid out of total)
  const rent2 = monthlyRents[1];
  const partialPaid = 20000;
  const rent2Total = Number(rent2.totalAmount);
  await prisma.payment.create({
    data: {
      monthlyRentId: rent2.id,
      amount: partialPaid,
      paymentMethod: PaymentMethod.CASH,
      paymentDate: new Date('2026-09-02T11:00:00Z'),
      note: 'আংশিক পরিশোধ',
      status: PaymentStatus.COMPLETED,
    },
  });
  await prisma.monthlyRent.update({
    where: { id: rent2.id },
    data: {
      paidAmount: partialPaid,
      remainingAmount: rent2Total - partialPaid,
      status: RentStatus.PARTIAL,
    },
  });

  // Rent 3: Full Payment via Bank
  const rent3 = monthlyRents[2];
  const rent3Total = Number(rent3.totalAmount);
  await prisma.payment.create({
    data: {
      monthlyRentId: rent3.id,
      amount: rent3Total,
      paymentMethod: PaymentMethod.BANK,
      transactionId: 'IBBL-SEED-88221',
      paymentDate: new Date('2026-09-02T12:00:00Z'),
      note: 'ব্যাংক ট্রান্সফার',
      status: PaymentStatus.COMPLETED,
    },
  });
  await prisma.monthlyRent.update({
    where: { id: rent3.id },
    data: {
      paidAmount: rent3Total,
      remainingAmount: 0,
      status: RentStatus.PAID,
      paidDate: new Date('2026-09-02T12:00:00Z'),
    },
  });
  console.log(`💳 Created 3 Payments with updated balances`);

  // 8. Create 2 Expenses
  await prisma.expense.createMany({
    data: [
      {
        propertyId: property.id,
        category: ExpenseCategory.ELECTRICITY,
        amount: 4500,
        expenseDate: new Date('2026-09-01T08:00:00Z'),
        description: 'কমন এরিয়া বিদ্যুৎ বিল',
        paymentMethod: PaymentMethod.CASH,
        reference: 'DESCO-AUG-2026',
      },
      {
        propertyId: property.id,
        category: ExpenseCategory.CLEANING,
        amount: 2500,
        expenseDate: new Date('2026-09-01T09:00:00Z'),
        description: 'ভবন পরিচ্ছন্নতা কর্মী বেতন',
        paymentMethod: PaymentMethod.CASH,
      },
    ],
  });
  console.log(`🧾 Created 2 Property Expenses`);

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
