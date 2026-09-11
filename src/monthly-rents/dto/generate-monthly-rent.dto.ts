import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateMonthlyRentDto {
  @ApiProperty({ example: 2026, description: 'সাল (যেমন: 2026)' })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @ApiProperty({ example: 9, description: 'মাস (১-১২)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiPropertyOptional({ description: 'নির্দিষ্ট কোনো বাড়ির আইডি (ঐচ্ছিক)' })
  @IsOptional()
  @IsString()
  propertyId?: string;
}

export { CreateMonthlyRentDto } from './create-monthly-rent.dto';
export { UpdateMonthlyRentDto } from './update-monthly-rent.dto';
