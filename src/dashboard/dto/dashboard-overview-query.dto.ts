import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DashboardOverviewQueryDto {
  @ApiPropertyOptional({ description: 'বাড়ি আইডি (ঐচ্ছিক)' })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({ description: 'সাল (ডিফল্ট বর্তমান সাল)', example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ description: 'মাস ১–১২ (ডিফল্ট বর্তমান মাস)', example: 9 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(12)
  month?: number;
}
