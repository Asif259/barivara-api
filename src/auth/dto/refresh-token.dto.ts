import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'রিফ্রেশ টোকেন' })
  @IsString()
  @IsNotEmpty({ message: 'রিফ্রেশ টোকেন আবশ্যক' })
  refreshToken: string;
}
