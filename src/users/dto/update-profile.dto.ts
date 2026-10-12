import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    description: 'ব্যবহারকারীর পুরো নাম (Full name of the user)',
    example: 'হাজী মো. আবুল হোসেন',
  })
  @IsString({ message: 'নাম অবশ্যই টেক্সট হতে হবে।' })
  @IsNotEmpty({ message: 'নাম খালি রাখা যাবে না।' })
  @MinLength(2, { message: 'নাম অন্তত ২ অক্ষরের হতে হবে।' })
  @MaxLength(100, { message: 'নাম সর্বোচ্চ ১০০ অক্ষরের হতে পারে।' })
  name: string;
}
