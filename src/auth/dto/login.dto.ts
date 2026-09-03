import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiPropertyOptional({ example: 'user@example.com', description: 'ইমেইল অথবা ফোন নম্বর' })
  @IsOptional()
  @IsString()
  identifier?: string;

  @ApiPropertyOptional({ example: 'user@example.com', description: 'ইমেইল ঠিকানা' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: '01712345678', description: 'ফোন নম্বর' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'StrongPassword123', description: 'পাসওয়ার্ড' })
  @IsString()
  @IsNotEmpty({ message: 'পাসওয়ার্ড আবশ্যক' })
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'রিফ্রেশ টোকেন' })
  @IsString()
  @IsNotEmpty({ message: 'রিফ্রেশ টোকেন আবশ্যক' })
  refreshToken: string;
}
