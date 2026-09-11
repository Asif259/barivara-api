import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class PaymentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'মাসিক ভাড়া আইডি (UUID)' })
  @IsOptional()
  @IsUUID('4', { message: 'মাসিক ভাড়ার আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  monthlyRentId?: string;

  @ApiPropertyOptional({ description: 'বাড়ি আইডি (UUID)' })
  @IsOptional()
  @IsUUID('4', { message: 'বাড়ির আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  propertyId?: string;

  @ApiPropertyOptional({ description: 'ভাড়াটিয়া আইডি (UUID)' })
  @IsOptional()
  @IsUUID('4', { message: 'ভাড়াটিয়ার আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  tenantId?: string;

  @ApiPropertyOptional({ enum: PaymentMethod, description: 'পেমেন্ট মেথড' })
  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'সঠিক পেমেন্ট মেথড নির্বাচন করুন' })
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ enum: PaymentStatus, description: 'পেমেন্টের অবস্থা (COMPLETED, REVERSED)' })
  @IsOptional()
  @IsEnum(PaymentStatus, { message: 'সঠিক পেমেন্ট স্ট্যাটাস নির্বাচন করুন' })
  status?: PaymentStatus;

  @ApiPropertyOptional({ description: 'তারিখ থেকে' })
  @IsOptional()
  @IsDateString({}, { message: 'সঠিক তারিখ দিন' })
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'তারিখ পর্যন্ত' })
  @IsOptional()
  @IsDateString({}, { message: 'সঠিক তারিখ দিন' })
  dateTo?: string;
}
