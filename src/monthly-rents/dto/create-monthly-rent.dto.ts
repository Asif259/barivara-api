import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMonthlyRentDto {
  @ApiProperty({ example: 'agreement-uuid', description: 'চুক্তি আইডি' })
  @IsString()
  @IsNotEmpty({ message: 'চুক্তি নির্বাচন আবশ্যক' })
  agreementId: string;

  @ApiProperty({ example: 2026, description: 'সাল' })
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

  @ApiProperty({ example: 20000, description: 'মূল ভাড়া' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rent: number;

  @ApiPropertyOptional({ example: 3000, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  serviceFee?: number = 0;

  @ApiPropertyOptional({ example: 2000, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  parkingFee?: number = 0;

  @ApiPropertyOptional({ example: 500, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  extraCharge?: number = 0;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lateFee?: number = 0;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number = 0;
}
