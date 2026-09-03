import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
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
import { FilesService } from './files.service';
import { RequestUploadUrlDto } from './dto';

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload-url')
  @ApiOperation({
    summary: 'ফাইল আপলোডের জন্য signed URL তৈরি করুন',
    description:
      'Returns a signed Supabase upload URL. The client uploads directly to Supabase Storage using this URL.',
  })
  @ApiResponse({ status: 201, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 400, type: StandardErrorResponseDto })
  @ApiResponse({ status: 413, type: StandardErrorResponseDto })
  async requestUploadUrl(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RequestUploadUrlDto,
  ) {
    return this.filesService.requestUploadUrl(user.id, dto);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'আপলোড সম্পন্ন হিসেবে চিহ্নিত করুন',
    description:
      'After uploading directly to Supabase, call this endpoint to verify and mark the file as COMPLETED.',
  })
  @ApiParam({ name: 'id', description: 'File ID (UUID)' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 404, type: StandardErrorResponseDto })
  async completeUpload(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.filesService.completeUpload(user.id, id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'ফাইলের তথ্য দেখুন',
    description: 'Returns file metadata. Does not return the storage path for security reasons.',
  })
  @ApiParam({ name: 'id', description: 'File ID (UUID)' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 404, type: StandardErrorResponseDto })
  async getFile(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.filesService.getFile(user.id, id);
  }

  @Get(':id/url')
  @ApiOperation({
    summary: 'ফাইলের ডাউনলোড URL নিন',
    description:
      'Returns a public URL for public buckets or a time-limited signed download URL for private/sensitive files.',
  })
  @ApiParam({ name: 'id', description: 'File ID (UUID)' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 404, type: StandardErrorResponseDto })
  async getFileUrl(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.filesService.getFileUrl(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'ফাইল মুছে ফেলুন',
    description: 'Soft-deletes the file record and removes the object from Supabase Storage.',
  })
  @ApiParam({ name: 'id', description: 'File ID (UUID)' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 404, type: StandardErrorResponseDto })
  async deleteFile(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.filesService.deleteFile(user.id, id);
  }
}
