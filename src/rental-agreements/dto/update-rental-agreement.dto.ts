import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateRentalAgreementDto {
  @ApiPropertyOptional({ example: 22000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'ভাড়া ০ বা তার বেশি হতে হবে' })
  monthlyRent?: number;

  @ApiPropertyOptional({ example: 3500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'সার্ভিস ফি ০ বা তার বেশি হতে হবে' })
  serviceFee?: number;

  @ApiPropertyOptional({ example: 2000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'পার্কিং ফি ০ বা তার বেশি হতে হবে' })
  parkingFee?: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'অতিরিক্ত চার্জ ০ বা তার বেশি হতে হবে' })
  extraCharge?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'শেষ দিন ১ থেকে ৩১ এর মধ্যে হতে হবে' })
  @Max(31, { message: 'শেষ দিন ১ থেকে ৩১ এর মধ্যে হতে হবে' })
  dueDay?: number;

  @ApiPropertyOptional({ example: 40000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'সিকিউরিটি ডিপোজিট ০ বা তার বেশি হতে হবে' })
  securityDeposit?: number;

  @ApiPropertyOptional({ example: '2027-08-31T00:00:00.000Z' })
  @IsOptional()
  @IsDateString({}, { message: 'সঠিক সমাপ্তির তারিখ দিন' })
  endDate?: string;

  @ApiPropertyOptional({ example: 'শর্তাবলী পরিমার্জন করা হয়েছে' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'a7043104-5dce-4969-a8bc-c33ff894bbbb' })
  @IsOptional()
  @IsUUID('4', { message: 'চুক্তির দলিলের ফাইল আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  agreementDocumentId?: string;
}
