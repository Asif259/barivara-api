import { ApiPropertyOptional } from '@nestjs/swagger';
import { UnitStatus, UnitType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

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
