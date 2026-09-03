import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class CreatePaymentDto {
  @ApiProperty({ example: 'rent-uuid', description: 'মাসিক ভাড়ার আইডি' })
  @IsString()
  @IsNotEmpty({ message: 'মাসিক ভাড়া নির্বাচন আবশ্যক' })
  monthlyRentId: string;

  @ApiProperty({ example: 20000, description: 'পরিশোধিত টাকার পরিমাণ' })
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'পেমেন্টের পরিমাণ ০ এর বেশি হতে হবে' })
  amount: number;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CASH, description: 'পেমেন্ট মেথড' })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod = PaymentMethod.CASH;

  @ApiPropertyOptional({ example: 'BKASH-TX-987654321', description: 'ট্রানজেকশন আইডি (ঐচ্ছিক)' })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({ example: '2026-09-05T10:00:00.000Z', description: 'পেমেন্টের তারিখ' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({ example: 'সেপ্টেম্বর মাসের আংশিক ভাড়া', description: 'নোট বা মন্তব্য' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 'ম্যানেজার', description: 'পেমেন্ট গ্রহণকারীর নাম' })
  @IsOptional()
  @IsString()
  receivedBy?: string;
}

export class PaymentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'মাসিক ভাড়া আইডি' })
  @IsOptional()
  @IsString()
  monthlyRentId?: string;

  @ApiPropertyOptional({ description: 'বাড়ি আইডি' })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({ description: 'ভাড়াটিয়া আইডি' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ enum: PaymentMethod, description: 'পেমেন্ট মেথড' })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ enum: PaymentStatus, description: 'পেমেন্টের অবস্থা (COMPLETED, REVERSED)' })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ description: 'তারিখ থেকে' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'তারিখ পর্যন্ত' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
