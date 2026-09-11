import { ApiPropertyOptional } from '@nestjs/swagger';
import { AgreementStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class TenantFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'নির্দিষ্ট বাড়ি আইডি' })
  @IsOptional()
  @IsUUID('4', { message: 'বাড়ির আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  propertyId?: string;

  @ApiPropertyOptional({ description: 'নির্দিষ্ট ইউনিট আইডি' })
  @IsOptional()
  @IsUUID('4', { message: 'ইউনিটের আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  unitId?: string;

  @ApiPropertyOptional({ enum: AgreementStatus, description: 'চুক্তির অবস্থা (যেমন: ACTIVE, ENDED)' })
  @IsOptional()
  @IsEnum(AgreementStatus, { message: 'সঠিক চুক্তির অবস্থা নির্বাচন করুন' })
  status?: AgreementStatus;
}
