import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email or phone number registered with BariVara',
  })
  @IsString()
  @IsNotEmpty({ message: 'ইমেইল অথবা মোবাইল নম্বর প্রদান করুন' })
  identifier!: string;
}
