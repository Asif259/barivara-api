import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRentalAgreementDto {
  @ApiProperty({ example: 'a7043104-5dce-4969-a8bc-c33ff894bbbb', description: 'ভাড়াটিয়ার আইডি (UUID)' })
  @IsUUID('4', { message: 'ভাড়াটিয়ার আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  @IsNotEmpty({ message: 'ভাড়াটিয়া নির্বাচন আবশ্যক' })
  tenantId: string;

  @ApiProperty({ example: 'a7043104-5dce-4969-a8bc-c33ff894bbbb', description: 'ইউনিটের আইডি (UUID)' })
  @IsUUID('4', { message: 'ইউনিটের আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
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
  @Min(0, { message: 'সার্ভিস ফি ০ বা তার বেশি হতে হবে' })
  serviceFee?: number = 0;

  @ApiPropertyOptional({ example: 2000, default: 0, description: 'পার্কিং ফি' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'পার্কিং ফি ০ বা তার বেশি হতে হবে' })
  parkingFee?: number = 0;

  @ApiPropertyOptional({ example: 500, default: 0, description: 'অন্যান্য নিয়মিত চার্জ' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'অতিরিক্ত চার্জ ০ বা তার বেশি হতে হবে' })
  extraCharge?: number = 0;

  @ApiPropertyOptional({ example: 10, default: 10, description: 'প্রতি মাসের ভাড়ার শেষ তারিখ (১-৩১)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'শেষ দিন ১ থেকে ৩১ এর মধ্যে হতে হবে' })
  @Max(31, { message: 'শেষ দিন ১ থেকে ৩১ এর মধ্যে হতে হবে' })
  dueDay?: number = 10;

  @ApiPropertyOptional({ example: 40000, default: 0, description: 'অগ্রিম / সিকিউরিটি ডিপোজিট' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'সিকিউরিটি ডিপোজিট ০ বা তার বেশি হতে হবে' })
  securityDeposit?: number = 0;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z', description: 'চুক্তির শুরুর তারিখ' })
  @IsDateString({}, { message: 'সঠিক শুরুর তারিখ দিন' })
  startDate: string;

  @ApiPropertyOptional({ example: '2027-08-31T00:00:00.000Z', description: 'চুক্তির সমাপ্তির তারিখ' })
  @IsOptional()
  @IsDateString({}, { message: 'সঠিক সমাপ্তির তারিখ দিন' })
  endDate?: string;

  @ApiPropertyOptional({ example: '১ বছরের মেয়াদী চুক্তি', description: 'চুক্তির শর্তাবলী বা নোট' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'a7043104-5dce-4969-a8bc-c33ff894bbbb', description: 'চুক্তির দলিলের ফাইল আইডি (UUID)' })
  @IsOptional()
  @IsUUID('4', { message: 'চুক্তির দলিলের ফাইল আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  agreementDocumentId?: string;

  @ApiPropertyOptional({ example: true, default: false, description: 'তাত্ক্ষণিকভাবে চলতি মাসের বিল তৈরি করবেন কি না' })
  @IsOptional()
  @IsBoolean()
  generateCurrentMonthRent?: boolean = false;
}
