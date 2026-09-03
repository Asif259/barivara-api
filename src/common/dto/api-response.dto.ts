import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 145 })
  total: number;

  @ApiProperty({ example: 8 })
  totalPages: number;
}

export class StandardSuccessResponseDto<T> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'অপারেশন সফল হয়েছে' })
  message: string;

  @ApiProperty()
  data: T;

  @ApiPropertyOptional({ type: PaginationMetaDto })
  meta?: PaginationMetaDto;
}

export class StandardErrorResponseDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 'ত্রুটি ঘটেছে' })
  message: string;

  @ApiProperty({ example: 'RESOURCE_NOT_FOUND' })
  errorCode: string;

  @ApiPropertyOptional({ nullable: true })
  details?: any;
}
