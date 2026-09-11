import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ValidationPipe, ArgumentMetadata } from '@nestjs/common';
import { CreatePaymentDto } from '../../payments/dto/create-payment.dto';
import { CreateRentalAgreementDto } from '../../rental-agreements/dto/create-rental-agreement.dto';
import { GenerateMonthlyRentDto } from '../../monthly-rents/dto/generate-monthly-rent.dto';
import { CreateMonthlyRentDto } from '../../monthly-rents/dto/create-monthly-rent.dto';
import { CreateExpenseDto } from '../../expenses/dto/create-expense.dto';
import { CreateTenantDto } from '../../tenants/dto/create-tenant.dto';
import { TenantFilterDto } from '../../tenants/dto/tenant-filter.dto';
import { PaginationQueryDto } from './pagination.dto';
import { CreatePropertyDto } from '../../properties/dto/create-property.dto';

describe('DTO and Input Validation Suite', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  });

  describe('Financial and Payment Validation', () => {
    it('should reject payment amount <= 0', async () => {
      const dto = plainToInstance(CreatePaymentDto, {
        monthlyRentId: 'a7043104-5dce-4969-a8bc-c33ff894bbbb',
        amount: 0,
        paymentMethod: 'CASH',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });

    it('should reject negative payment amount', async () => {
      const dto = plainToInstance(CreatePaymentDto, {
        monthlyRentId: 'a7043104-5dce-4969-a8bc-c33ff894bbbb',
        amount: -500,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });

    it('should accept positive payment amount', async () => {
      const dto = plainToInstance(CreatePaymentDto, {
        monthlyRentId: 'a7043104-5dce-4969-a8bc-c33ff894bbbb',
        amount: 15000,
        paymentMethod: 'BKASH',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject negative expense amount', async () => {
      const dto = plainToInstance(CreateExpenseDto, {
        propertyId: 'a7043104-5dce-4969-a8bc-c33ff894bbbb',
        category: 'ELECTRICITY',
        amount: -100,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'amount')).toBe(true);
    });

    it('should reject negative rental agreement amounts', async () => {
      const dto = plainToInstance(CreateRentalAgreementDto, {
        tenantId: 'a7043104-5dce-4969-a8bc-c33ff894bbbb',
        unitId: 'b7043104-5dce-4969-a8bc-c33ff894bbbb',
        monthlyRent: -1000,
        serviceFee: -50,
        parkingFee: -20,
        securityDeposit: -500,
        dueDay: 5,
        startDate: '2026-09-01T00:00:00.000Z',
      });
      const errors = await validate(dto);
      const errorProps = errors.map((e) => e.property);
      expect(errorProps).toContain('monthlyRent');
      expect(errorProps).toContain('serviceFee');
      expect(errorProps).toContain('parkingFee');
      expect(errorProps).toContain('securityDeposit');
    });

    it('should reject negative monthly rent amounts', async () => {
      const dto = plainToInstance(CreateMonthlyRentDto, {
        agreementId: 'a7043104-5dce-4969-a8bc-c33ff894bbbb',
        year: 2026,
        month: 9,
        rent: -5000,
        serviceFee: -100,
        discount: -20,
      });
      const errors = await validate(dto);
      const errorProps = errors.map((e) => e.property);
      expect(errorProps).toContain('rent');
      expect(errorProps).toContain('serviceFee');
      expect(errorProps).toContain('discount');
    });
  });

  describe('Calendar and Due Day Validation', () => {
    it('should reject month < 1 or > 12', async () => {
      const dtoLow = plainToInstance(GenerateMonthlyRentDto, {
        year: 2026,
        month: 0,
      });
      const errorsLow = await validate(dtoLow);
      expect(errorsLow.some((e) => e.property === 'month')).toBe(true);

      const dtoHigh = plainToInstance(GenerateMonthlyRentDto, {
        year: 2026,
        month: 13,
      });
      const errorsHigh = await validate(dtoHigh);
      expect(errorsHigh.some((e) => e.property === 'month')).toBe(true);
    });

    it('should reject year < 2000 or > 2100', async () => {
      const dtoOld = plainToInstance(GenerateMonthlyRentDto, {
        year: 1999,
        month: 5,
      });
      const errorsOld = await validate(dtoOld);
      expect(errorsOld.some((e) => e.property === 'year')).toBe(true);

      const dtoFuture = plainToInstance(GenerateMonthlyRentDto, {
        year: 2105,
        month: 5,
      });
      const errorsFuture = await validate(dtoFuture);
      expect(errorsFuture.some((e) => e.property === 'year')).toBe(true);
    });

    it('should reject dueDay < 1 or > 31', async () => {
      const dtoZero = plainToInstance(CreateRentalAgreementDto, {
        tenantId: 'a7043104-5dce-4969-a8bc-c33ff894bbbb',
        unitId: 'b7043104-5dce-4969-a8bc-c33ff894bbbb',
        monthlyRent: 20000,
        dueDay: 0,
        startDate: '2026-09-01T00:00:00.000Z',
      });
      const errorsZero = await validate(dtoZero);
      expect(errorsZero.some((e) => e.property === 'dueDay')).toBe(true);

      const dto32 = plainToInstance(CreateRentalAgreementDto, {
        tenantId: 'a7043104-5dce-4969-a8bc-c33ff894bbbb',
        unitId: 'b7043104-5dce-4969-a8bc-c33ff894bbbb',
        monthlyRent: 20000,
        dueDay: 32,
        startDate: '2026-09-01T00:00:00.000Z',
      });
      const errors32 = await validate(dto32);
      expect(errors32.some((e) => e.property === 'dueDay')).toBe(true);
    });
  });

  describe('ID and UUID Validation', () => {
    it('should reject malformed IDs in CreatePaymentDto', async () => {
      const dto = plainToInstance(CreatePaymentDto, {
        monthlyRentId: 'not-a-valid-uuid',
        amount: 5000,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'monthlyRentId')).toBe(true);
    });

    it('should reject malformed IDs in CreateRentalAgreementDto', async () => {
      const dto = plainToInstance(CreateRentalAgreementDto, {
        tenantId: 'invalid-tenant-id',
        unitId: 'invalid-unit-id',
        agreementDocumentId: 'invalid-doc-id',
        monthlyRent: 20000,
        dueDay: 5,
        startDate: '2026-09-01T00:00:00.000Z',
      });
      const errors = await validate(dto);
      const errorProps = errors.map((e) => e.property);
      expect(errorProps).toContain('tenantId');
      expect(errorProps).toContain('unitId');
      expect(errorProps).toContain('agreementDocumentId');
    });

    it('should reject malformed nidImageId in CreateTenantDto', async () => {
      const dto = plainToInstance(CreateTenantDto, {
        name: 'Kamal',
        nidImageId: 'not-uuid-1234',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'nidImageId')).toBe(true);
    });
  });

  describe('Enum Validation', () => {
    it('should reject invalid payment method', async () => {
      const dto = plainToInstance(CreatePaymentDto, {
        monthlyRentId: 'a7043104-5dce-4969-a8bc-c33ff894bbbb',
        amount: 5000,
        paymentMethod: 'BITCOIN' as any,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'paymentMethod')).toBe(true);
    });

    it('should reject invalid agreement status filter', async () => {
      const dto = plainToInstance(TenantFilterDto, {
        status: 'UNKNOWN_STATUS' as any,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'status')).toBe(true);
    });

    it('should reject invalid sortOrder in pagination', async () => {
      const dto = plainToInstance(PaginationQueryDto, {
        sortOrder: 'side' as any,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
    });
  });

  describe('Strict Validation Pipe (Reject Unknown Fields)', () => {
    it('should reject unknown fields when forbidNonWhitelisted is active', async () => {
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: CreatePropertyDto,
      };

      await expect(
        validationPipe.transform(
          {
            name: 'Green Villa',
            address: 'Dhanmondi, Dhaka',
            maliciousField: 'exploit',
          },
          metadata,
        ),
      ).rejects.toThrow();
    });

    it('should accept valid whitelisted fields in CreatePropertyDto', async () => {
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: CreatePropertyDto,
      };

      const result = await validationPipe.transform(
        {
          name: 'Green Villa',
          address: 'Dhanmondi, Dhaka',
          totalFloors: 5,
        },
        metadata,
      );

      expect(result).toBeDefined();
      expect(result.name).toBe('Green Villa');
      expect(result.totalFloors).toBe(5);
    });
  });
});
