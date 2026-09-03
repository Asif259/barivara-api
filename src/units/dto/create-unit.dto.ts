import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UnitStatus, UnitType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUnitDto {
  @ApiProperty({ example: '4A', description: 'ইউনিট/ফ্ল্যাট নম্বর' })
  @IsString()
  @IsNotEmpty({ message: 'ইউনিট নম্বর আবশ্যক' })
  unitNumber: string;

  @ApiPropertyOptional({ example: 4, default: 0, description: 'তলা নম্বর' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'তলা নম্বর পূর্ণসংখ্যা হতে হবে' })
  @Min(0, { message: 'তলা নম্বর ০ বা তার বেশি হতে হবে' })
  floor?: number = 0;

  @ApiPropertyOptional({ enum: UnitType, default: UnitType.APARTMENT, description: 'ইউনিটের ধরন' })
  @IsOptional()
  @IsEnum(UnitType)
  unitType?: UnitType = UnitType.APARTMENT;

  @ApiPropertyOptional({ example: 3, description: 'বেডরুম সংখ্যা' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bedrooms?: number;

  @ApiPropertyOptional({ example: 2, description: 'বাথরুম সংখ্যা' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bathrooms?: number;

  @ApiPropertyOptional({ example: 20000, default: 0, description: 'মূল মাসিক ভাড়া (টাকা)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'ভাড়া ০ বা তার বেশি হতে হবে' })
  monthlyBaseRent?: number = 0;

  @ApiPropertyOptional({ example: 3000, default: 0, description: 'ডিফল্ট সার্ভিস চার্জ' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultServiceFee?: number = 0;

  @ApiPropertyOptional({ example: 2000, default: 0, description: 'ডিফল্ট পার্কিং চার্জ' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultParkingFee?: number = 0;

  @ApiPropertyOptional({ example: 500, default: 0, description: 'ডিফল্ট অন্যান্য চার্জ' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultExtraCharge?: number = 0;

  @ApiPropertyOptional({ enum: UnitStatus, default: UnitStatus.VACANT, description: 'ইউনিটের বর্তমান অবস্থা' })
  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus = UnitStatus.VACANT;
}

export class UpdateUnitDto {
  @ApiPropertyOptional({ example: '4A' })
  @IsOptional()
  @IsString()
  unitNumber?: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  floor?: number;

  @ApiPropertyOptional({ enum: UnitType })
  @IsOptional()
  @IsEnum(UnitType)
  unitType?: UnitType;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bedrooms?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bathrooms?: number;

  @ApiPropertyOptional({ example: 22000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyBaseRent?: number;

  @ApiPropertyOptional({ example: 3500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultServiceFee?: number;

  @ApiPropertyOptional({ example: 2500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultParkingFee?: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultExtraCharge?: number;

  @ApiPropertyOptional({ enum: UnitStatus })
  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;
}
