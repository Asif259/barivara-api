import {
  Controller,
  Patch,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../common/decorators/current-user.decorator';
import {
  StandardSuccessResponseDto,
  StandardErrorResponseDto,
} from '../common/dto/api-response.dto';
import { UsersService } from './users.service';
import { UpdateSignatureDto } from './dto/update-signature.dto';
import { ErrorCode } from '../common/constants/error-codes';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('profile/signature')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'মালিকের স্বাক্ষর সেট/আপডেট করুন',
    description:
      "Sets the current owner's signature by linking a previously uploaded OWNER_SIGNATURE file (must be COMPLETED). Pass an empty fileId to clear the signature.",
  })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 400, type: StandardErrorResponseDto })
  @ApiResponse({ status: 403, type: StandardErrorResponseDto })
  @ApiResponse({ status: 404, type: StandardErrorResponseDto })
  async updateSignature(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateSignatureDto,
  ) {
    this.assertOwnerRole(user);

    const updated = await this.usersService.updateSignature(user.id, dto.fileId);

    return {
      message: 'স্বাক্ষর সফলভাবে আপডেট করা হয়েছে',
      data: updated,
    };
  }

  @Delete('profile/signature')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'মালিকের স্বাক্ষর মুছে ফেলুন',
    description: "Removes the owner's current signature reference.",
  })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 403, type: StandardErrorResponseDto })
  async removeSignature(@CurrentUser() user: CurrentUserPayload) {
    this.assertOwnerRole(user);

    const updated = await this.usersService.updateSignature(user.id, null);

    return {
      message: 'স্বাক্ষর সফলভাবে মুছে ফেলা হয়েছে',
      data: updated,
    };
  }

  /**
   * Per spec: only authenticated OWNER users may manage their signature.
   */
  private assertOwnerRole(user: CurrentUserPayload) {
    if (user?.role !== 'OWNER') {
      throw new ForbiddenException({
        errorCode: ErrorCode.AUTH_FORBIDDEN,
        message: 'শুধুমাত্র মালিক (OWNER) স্বাক্ষর সেট করতে পারবেন।',
      });
    }
  }
}
