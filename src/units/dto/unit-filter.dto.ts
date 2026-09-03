import { ApiPropertyOptional } from '@nestjs/swagger';
import { UnitStatus, UnitType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class UnitFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: UnitStatus, description: 'ইউনিটের অবস্থা (যেমন: VACANT, OCCUPIED)' })
  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;

  @ApiPropertyOptional({ enum: UnitType, description: 'ইউনিটের ধরন (যেমন: APARTMENT, FLAT, SHOP)' })
  @IsOptional()
  @IsEnum(UnitType)
  unitType?: UnitType;

  @ApiPropertyOptional({ example: 4, description: 'নির্দিষ্ট তলা' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  floor?: number;
}
