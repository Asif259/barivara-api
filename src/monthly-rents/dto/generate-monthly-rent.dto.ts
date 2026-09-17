import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateMonthlyRentDto {
  @ApiProperty({ example: 2026, description: 'সাল (যেমন: 2026)' })
  @Type(() => Number)
  @IsInt()
  @Min(2000, { message: 'সাল ২০০০ থেকে ২১০০ এর মধ্যে হতে হবে' })
  @Max(2100, { message: 'সাল ২০০০ থেকে ২১০০ এর মধ্যে হতে হবে' })
  year: number;

  @ApiProperty({ example: 9, description: 'মাস (১-১২)' })
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'মাস ১ থেকে ১২ এর মধ্যে হতে হবে' })
  @Max(12, { message: 'মাস ১ থেকে ১২ এর মধ্যে হতে হবে' })
  month: number;

  @ApiPropertyOptional({ example: 'a7043104-5dce-4969-a8bc-c33ff894bbbb', description: 'নির্দিষ্ট কোনো বাড়ির আইডি (ঐচ্ছিক UUID)' })
  @IsOptional()
  @IsUUID('4', { message: 'বাড়ির আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  propertyId?: string;

  @ApiPropertyOptional({ example: false, default: false, description: 'চলতি মাসে চুক্তি শুরু করা নতুন ভাড়াটিয়াদের চলতি মাসের বিলও তৈরি করবেন কি না' })
  @IsOptional()
  @IsBoolean()
  includeCurrentMonthNewTenants?: boolean = false;
}

