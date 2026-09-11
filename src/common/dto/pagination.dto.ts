import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, description: 'পৃষ্ঠা নম্বর' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100, description: 'প্রতি পৃষ্ঠার আইটেম সংখ্যা' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'অনুসন্ধান কি-ওয়ার্ড' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'সর্ট করার কলাম' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc', description: 'সর্টের দিক' })
  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'সর্টের দিক asc অথবা desc হতে হবে' })
  sortOrder?: 'asc' | 'desc' = 'desc';

  get skip(): number {
    return ((this.page || 1) - 1) * (this.limit || 20);
  }

  get take(): number {
    return this.limit || 20;
  }
}
