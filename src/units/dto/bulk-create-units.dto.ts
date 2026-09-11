import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UnitType } from '@prisma/client';
import {
  IsEnum,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BulkUnitItemDto {
  @ApiProperty({ example: '4A', description: 'ইউনিট/ফ্ল্যাট নম্বর' })
  @IsString()
  @IsNotEmpty({ message: 'ইউনিট নম্বর আবশ্যক' })
  unitNumber: string;

  @ApiProperty({ enum: UnitType, example: UnitType.FLAT })
  @IsEnum(UnitType)
  unitType: UnitType;

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

  @ApiPropertyOptional({ example: 20000, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyBaseRent?: number = 0;

  @ApiPropertyOptional({ example: 3000, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultServiceFee?: number = 0;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultParkingFee?: number = 0;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultExtraCharge?: number = 0;
}

export class BulkCreateUnitsDto {
  @ApiProperty({ example: 4, description: 'সকল ইউনিটের তলা নম্বর' })
  @Type(() => Number)
  @IsInt({ message: 'তলা নম্বর পূর্ণসংখ্যা হতে হবে' })
  @Min(0, { message: 'তলা নম্বর ০ বা তার বেশি হতে হবে' })
  floor: number;

  @ApiProperty({ type: [BulkUnitItemDto], description: 'একসাথে যোগ করার ইউনিটসমূহ' })
  @IsArray()
  @ArrayMinSize(1, { message: 'অন্তত একটি ইউনিট আবশ্যক' })
  @ArrayMaxSize(100, { message: 'একবারে সর্বোচ্চ ১০০টি ইউনিট যোগ করা যাবে' })
  @ValidateNested({ each: true })
  @Type(() => BulkUnitItemDto)
  units: BulkUnitItemDto[];
}
