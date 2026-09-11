import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class MonthlyReportQueryDto {
  @ApiPropertyOptional({ description: 'সাল (ডিফল্ট বর্তমান সাল)', example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000, { message: 'সাল ২০০০ থেকে ২১০০ এর মধ্যে হতে হবে' })
  @Max(2100, { message: 'সাল ২০০০ থেকে ২১০০ এর মধ্যে হতে হবে' })
  year?: number;

  @ApiPropertyOptional({ description: 'মাস ১–১২ (ডিফল্ট বর্তমান মাস)', example: 9 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'মাস ১ থেকে ১২ এর মধ্যে হতে হবে' })
  @Max(12, { message: 'মাস ১ থেকে ১২ এর মধ্যে হতে হবে' })
  month?: number;

  @ApiPropertyOptional({ description: 'বাড়ি আইডি (ঐচ্ছিক UUID)', example: 'a7043104-5dce-4969-a8bc-c33ff894bbbb' })
  @IsOptional()
  @IsUUID('4', { message: 'বাড়ির আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  propertyId?: string;
}
