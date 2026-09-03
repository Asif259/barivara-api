import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class TenantFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'নির্দিষ্ট বাড়ি আইডি' })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({ description: 'নির্দিষ্ট ইউনিট আইডি' })
  @IsOptional()
  @IsString()
  unitId?: string;

  @ApiPropertyOptional({ description: 'চুক্তির অবস্থা (যেমন: ACTIVE, ENDED)' })
  @IsOptional()
  @IsString()
  status?: string;
}
