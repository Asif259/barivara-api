import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';

describe('BariVara Core Milestone Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let ownerToken: string;
  let userBToken: string;
  let propertyId: string;
  let unitId: string;
  let tenantId: string;
  let monthlyRentId: string;
  let secondPaymentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Clean up test data if prisma is connected
    try {
      if (ownerToken) {
        await prisma.user.deleteMany({
          where: { email: { in: ['e2e.owner@barivara.com', 'user.b@barivara.com'] } },
        });
      }
    } catch {
      // Ignore cleanup error if db not available
    }
    await app.close();
  });

  it('1. GET /api/v1/health should return ok', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBeDefined();
  });

  it('2. POST /api/v1/auth/register should register Owner A', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Asif Test Owner',
        email: 'e2e.owner@barivara.com',
        phone: '01700112233',
        password: 'Password123!',
      });

    if (res.status === 201) {
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      ownerToken = res.body.data.accessToken;
    } else if (res.status === 409) {
      // If user exists, login
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          identifier: 'e2e.owner@barivara.com',
          password: 'Password123!',
        })
        .expect(200);
      ownerToken = loginRes.body.data.accessToken;
    }
    expect(ownerToken).toBeDefined();
  });

  it('3. POST /api/v1/properties should create a new property for Owner A', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'E2E Green View Tower',
        address: 'House 10, Road 5, Dhanmondi, Dhaka',
        city: 'Dhaka',
        district: 'Dhaka',
        totalFloors: 5,
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    propertyId = res.body.data.id;
  });

  it('4. POST /api/v1/properties/:propertyId/units should create a unit', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/units`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        unitNumber: '4A',
        floor: 4,
        unitType: 'APARTMENT',
        bedrooms: 3,
        bathrooms: 2,
        monthlyBaseRent: 20000,
        defaultServiceFee: 3000,
        defaultParkingFee: 2000,
        defaultExtraCharge: 500,
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.status).toBe('VACANT');
    unitId = res.body.data.id;
  });

  it('5. POST /api/v1/tenants should create a tenant', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Kamal Hossain',
        phone: '01899112233',
        email: 'kamal.test@example.com',
        nid: '1234567890123',
        occupation: 'Software Engineer',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    tenantId = res.body.data.id;
  });

  it('6. POST /api/v1/rental-agreements should create agreement and set unit to OCCUPIED', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/rental-agreements')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        tenantId,
        unitId,
        monthlyRent: 20000,
        serviceFee: 3000,
        parkingFee: 2000,
        extraCharge: 500,
        dueDay: 5,
        securityDeposit: 40000,
        startDate: '2026-09-01T00:00:00.000Z',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.status).toBe('ACTIVE');

    // Verify unit status is now OCCUPIED
    const unitRes = await request(app.getHttpServer())
      .get(`/api/v1/units/${unitId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(unitRes.body.data.status).toBe('OCCUPIED');
  });

  it('7. POST /api/v1/monthly-rents/generate should generate September 2026 rent (৳25,500 total)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/monthly-rents/generate')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        year: 2026,
        month: 9,
        propertyId,
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.generatedCount).toBeGreaterThanOrEqual(1);

    // Retrieve generated monthly rent
    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/monthly-rents?propertyId=${propertyId}&year=2026&month=9`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
    const rent = listRes.body.data[0];
    monthlyRentId = rent.id;

    expect(rent.totalAmount).toBe(25500);
    expect(rent.paidAmount).toBe(0);
    expect(rent.remainingAmount).toBe(25500);
    expect(rent.status).toBe('PENDING');
  });

  it('8. POST /api/v1/payments - Record ৳20,000 partial payment -> total=25,500, paid=20,000, remaining=5,500, status=PARTIAL', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        monthlyRentId,
        amount: 20000,
        paymentMethod: 'CASH',
        note: 'September partial rent',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    const monthlyRent = res.body.data.monthlyRent;
    expect(monthlyRent.totalAmount).toBe(25500);
    expect(monthlyRent.paidAmount).toBe(20000);
    expect(monthlyRent.remainingAmount).toBe(5500);
    expect(monthlyRent.status).toBe('PARTIAL');
  });

  it('9. POST /api/v1/payments - Record remaining ৳5,500 -> total=25,500, paid=25,500, remaining=0, status=PAID', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        monthlyRentId,
        amount: 5500,
        paymentMethod: 'BKASH',
        transactionId: 'BKASH-E2E-001',
        note: 'September final payment',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    secondPaymentId = res.body.data.payment.id;
    const monthlyRent = res.body.data.monthlyRent;
    expect(monthlyRent.totalAmount).toBe(25500);
    expect(monthlyRent.paidAmount).toBe(25500);
    expect(monthlyRent.remainingAmount).toBe(0);
    expect(monthlyRent.status).toBe('PAID');
    expect(monthlyRent.paidDate).toBeDefined();
  });

  it('10. GET /api/v1/dashboard/overview should reflect collected ৳25,500 and 1 PAID unit', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/dashboard/overview?propertyId=${propertyId}&year=2026&month=9`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.currentMonth.expected).toBe(25500);
    expect(data.currentMonth.collected).toBe(25500);
    expect(data.currentMonth.outstanding).toBe(0);
    expect(data.currentMonth.paidCount).toBe(1);
  });

  it('11. POST /api/v1/payments/:id/reverse should reverse second payment and restore PARTIAL status', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/payments/${secondPaymentId}/reverse`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    const monthlyRent = res.body.data.monthlyRent;
    expect(monthlyRent.totalAmount).toBe(25500);
    expect(monthlyRent.paidAmount).toBe(20000);
    expect(monthlyRent.remainingAmount).toBe(5500);
    expect(monthlyRent.status).toBe('PARTIAL');
  });

  it('12. Authorization Isolation: User B cannot access User A property or record payment for User A rent', async () => {
    // Register User B
    const userBRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'User B',
        email: 'user.b@barivara.com',
        phone: '01600112233',
        password: 'Password123!',
      });

    if (userBRes.status === 201) {
      userBToken = userBRes.body.data.accessToken;
    } else {
      const loginB = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ identifier: 'user.b@barivara.com', password: 'Password123!' });
      userBToken = loginB.body.data.accessToken;
    }

    // User B attempts to access User A's property -> Forbidden / Denied
    await request(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .expect(403);

    // User B attempts to record payment on User A's rent -> Forbidden / Denied
    await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        monthlyRentId,
        amount: 1000,
        paymentMethod: 'CASH',
      })
      .expect(403);
  });
});
