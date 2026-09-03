import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRentalAgreementDto {
  @ApiProperty({ example: 'tenant-uuid', description: 'ভাড়াটিয়ার আইডি' })
  @IsString()
  @IsNotEmpty({ message: 'ভাড়াটিয়া নির্বাচন আবশ্যক' })
  tenantId: string;

  @ApiProperty({ example: 'unit-uuid', description: 'ইউনিটের আইডি' })
  @IsString()
  @IsNotEmpty({ message: 'ইউনিট নির্বাচন আবশ্যক' })
  unitId: string;

  @ApiProperty({ example: 20000, description: 'মাসিক নির্ধারিত মূল ভাড়া (টাকা)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'ভাড়া ০ বা তার বেশি হতে হবে' })
  monthlyRent: number;

  @ApiPropertyOptional({ example: 3000, default: 0, description: 'সার্ভিস চার্জ' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  serviceFee?: number = 0;

  @ApiPropertyOptional({ example: 2000, default: 0, description: 'পার্কিং ফি' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  parkingFee?: number = 0;

  @ApiPropertyOptional({ example: 500, default: 0, description: 'অন্যান্য নিয়মিত চার্জ' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  extraCharge?: number = 0;

  @ApiPropertyOptional({ example: 5, default: 5, description: 'প্রতি মাসের ভাড়ার শেষ তারিখ (১-৩১)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'শেষ দিন ১ থেকে ৩১ এর মধ্যে হতে হবে' })
  @Max(31, { message: 'শেষ দিন ১ থেকে ৩১ এর মধ্যে হতে হবে' })
  dueDay?: number = 5;

  @ApiPropertyOptional({ example: 40000, default: 0, description: 'অগ্রিম / সিকিউরিটি ডিপোজিট' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  securityDeposit?: number = 0;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z', description: 'চুক্তির শুরুর তারিখ' })
  @IsDateString({}, { message: 'সঠিক শুরুর তারিখ দিন' })
  startDate: string;

  @ApiPropertyOptional({ example: '2027-08-31T00:00:00.000Z', description: 'চুক্তির সমাপ্তির তারিখ' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: '১ বছরের মেয়াদী চুক্তি', description: 'চুক্তির শর্তাবলী বা নোট' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'file-uuid', description: 'চুক্তির দলিলের ফাইল আইডি' })
  @IsOptional()
  @IsString()
  agreementDocumentId?: string;

  @ApiPropertyOptional({ example: true, default: false, description: 'তাত্ক্ষণিকভাবে চলতি মাসের বিল তৈরি করবেন কি না' })
  @IsOptional()
  generateCurrentMonthRent?: boolean = false;
}

export class UpdateRentalAgreementDto {
  @ApiPropertyOptional({ example: 22000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyRent?: number;

  @ApiPropertyOptional({ example: 3500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  serviceFee?: number;

  @ApiPropertyOptional({ example: 2000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  parkingFee?: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  extraCharge?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number;

  @ApiPropertyOptional({ example: 40000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  securityDeposit?: number;

  @ApiPropertyOptional({ example: '2027-08-31T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'শর্তাবলী পরিমার্জন করা হয়েছে' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'file-uuid' })
  @IsOptional()
  @IsString()
  agreementDocumentId?: string;
}
