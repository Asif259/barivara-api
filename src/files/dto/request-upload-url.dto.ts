import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  IsUUID,
  MaxLength,
  Max,
} from 'class-validator';
import { FileCategory } from '@prisma/client';

export class RequestUploadUrlDto {
  @ApiProperty({
    enum: FileCategory,
    description: 'File category determines the target bucket and validation rules',
    example: 'TENANT_FRONT_NID',
  })
  @IsEnum(FileCategory)
  @IsNotEmpty()
  category: FileCategory;

  @ApiProperty({
    description: 'Original file name from the client',
    example: 'nid-front.jpg',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  originalName: string;

  @ApiProperty({
    description: 'MIME type of the file',
    example: 'image/jpeg',
  })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 1048576,
  })
  @IsNumber()
  @IsPositive()
  @Max(5 * 1024 * 1024, { message: 'ফাইলের আকার 5MB সীমা অতিক্রম করতে পারবে না।' })
  size: number;

  @ApiPropertyOptional({
    description: 'Entity type this file belongs to (e.g. "tenant", "property")',
    example: 'tenant',
  })
  @IsString()
  @IsOptional()
  entityType?: string;

  @ApiPropertyOptional({
    description: 'UUID of the entity this file belongs to',
    example: 'a7043104-5dce-4969-a8bc-c33ff894bbbb',
  })
  @IsUUID()
  @IsOptional()
  entityId?: string;
}
