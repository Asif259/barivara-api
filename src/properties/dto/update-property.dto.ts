import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePropertyDto {
  @ApiPropertyOptional({ example: 'গ্রিন ভিউ ভিলা' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'বাড়ি # ১২, রোড # ৪, ধানমন্ডি, ঢাকা' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'ঢাকা' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'ঢাকা' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ example: '১২০৫' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: '৬ তলা বিশিষ্ট আবাসিক ভবন' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsInt()
  @Min(1)
  totalFloors?: number;
}
