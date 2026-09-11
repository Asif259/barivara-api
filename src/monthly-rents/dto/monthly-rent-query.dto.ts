import { ApiPropertyOptional } from '@nestjs/swagger';
import { RentStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class MonthlyRentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'বাড়ি আইডি (UUID)' })
  @IsOptional()
  @IsUUID('4', { message: 'বাড়ির আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  propertyId?: string;

  @ApiPropertyOptional({ description: 'ইউনিট আইডি (UUID)' })
  @IsOptional()
  @IsUUID('4', { message: 'ইউনিটের আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  unitId?: string;

  @ApiPropertyOptional({ description: 'ভাড়াটিয়া আইডি (UUID)' })
  @IsOptional()
  @IsUUID('4', { message: 'ভাড়াটিয়ার আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  tenantId?: string;

  @ApiPropertyOptional({ description: 'সাল (২০০০-২১০০)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000, { message: 'সাল ২০০০ থেকে ২১০০ এর মধ্যে হতে হবে' })
  @Max(2100, { message: 'সাল ২০০০ থেকে ২১০০ এর মধ্যে হতে হবে' })
  year?: number;

  @ApiPropertyOptional({ description: 'মাস (১-১২)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'মাস ১ থেকে ১২ এর মধ্যে হতে হবে' })
  @Max(12, { message: 'মাস ১ থেকে ১২ এর মধ্যে হতে হবে' })
  month?: number;

  @ApiPropertyOptional({ enum: RentStatus, description: 'অবস্থা (PENDING, PARTIAL, PAID, OVERDUE, CANCELLED)' })
  @IsOptional()
  @IsEnum(RentStatus, { message: 'সঠিক ভাড়ার অবস্থা নির্বাচন করুন' })
  status?: RentStatus;

  @ApiPropertyOptional({ description: 'নির্দিষ্ট তারিখ থেকে' })
  @IsOptional()
  @IsDateString({}, { message: 'সঠিক তারিখ দিন' })
  dueFrom?: string;

  @ApiPropertyOptional({ description: 'নির্দিষ্ট তারিখ পর্যন্ত' })
  @IsOptional()
  @IsDateString({}, { message: 'সঠিক তারিখ দিন' })
  dueTo?: string;

  @ApiPropertyOptional({ description: 'শুধুমাত্র বকেয়া/মেয়াদোত্তীর্ণ বিল' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  overdueOnly?: boolean;
}
