import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';

export class UpdateSignatureDto {
  @ApiProperty({
    description:
      'ID of the completed OWNER_SIGNATURE file (obtained via the file upload flow).',
    example: 'a7043104-5dce-4969-a8bc-c33ff894bbbb',
  })
  @IsUUID()
  @IsNotEmpty()
  fileId: string;
}
