import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  PayloadTooLargeException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseStorageService } from './storage/supabase-storage.service';
import { RequestUploadUrlDto } from './dto';
import {
  BUCKET_MAP,
  SENSITIVE_BUCKETS,
  ALLOWED_IMAGE_MIMES,
  ALLOWED_DOCUMENT_MIMES,
  IMAGE_CATEGORIES,
  DOCUMENT_CATEGORIES,
  CATEGORY_PATH_SEGMENT,
  CATEGORY_MAX_SIZE_MB,
} from './enums';
import { ErrorCode } from '../common/constants/error-codes';
import { FileCategory } from '@prisma/client';
import { randomUUID } from 'crypto';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly supabaseStorage: SupabaseStorageService,
  ) {}

  /**
   * Request a signed upload URL.
   * Validates MIME, size, generates safe path, creates PENDING record.
   */
  async requestUploadUrl(userId: string, dto: RequestUploadUrlDto) {
    // 1. Validate MIME type
    this.validateMimeType(dto.category, dto.mimeType);

    // 2. Validate file size
    this.validateFileSize(dto.category, dto.size);

    // 3. Determine bucket
    const bucket = BUCKET_MAP[dto.category];

    // 4. Generate safe storage path
    const storagePath = this.generateStoragePath(
      dto.category,
      dto.mimeType,
      dto.entityType,
      dto.entityId,
      userId,
    );

    // 5. Create PENDING Media record
    const media = await this.prisma.media.create({
      data: {
        originalName: dto.originalName,
        storagePath,
        bucket,
        mimeType: dto.mimeType,
        size: dto.size,
        category: dto.category,
        entityType: dto.entityType || null,
        entityId: dto.entityId || null,
        uploadedBy: userId,
        status: 'PENDING',
      },
    });

    // 6. Generate signed upload URL from Supabase
    const uploadData = await this.supabaseStorage.generateSignedUploadUrl(
      bucket,
      storagePath,
    );

    return {
      message: 'আপলোড URL তৈরি হয়েছে',
      data: {
        fileId: media.id,
        uploadUrl: uploadData.signedUrl,
        token: uploadData.token,
        storagePath,
        bucket,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
      },
    };
  }

  /**
   * Mark an upload as completed after verifying the object exists in storage.
   */
  async completeUpload(userId: string, fileId: string) {
    const media = await this.prisma.media.findUnique({
      where: { id: fileId },
    });

    if (!media) {
      throw new NotFoundException({
        errorCode: ErrorCode.FILE_NOT_FOUND,
        message: 'ফাইল পাওয়া যায়নি।',
      });
    }

    if (media.uploadedBy !== userId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.FILE_ACCESS_DENIED,
        message: 'এই ফাইলে আপনার অ্যাক্সেস নেই।',
      });
    }

    if (media.status !== 'PENDING') {
      throw new BadRequestException({
        errorCode: ErrorCode.INVALID_STATUS_TRANSITION,
        message: `ফাইলের বর্তমান অবস্থা "${media.status}"; শুধুমাত্র PENDING ফাইল complete করা যায়।`,
      });
    }

    // Verify the object actually exists in Supabase Storage
    const exists = await this.supabaseStorage.objectExists(
      media.bucket,
      media.storagePath,
    );

    if (!exists) {
      // Mark as FAILED
      await this.prisma.media.update({
        where: { id: fileId },
        data: { status: 'FAILED' },
      });

      throw new NotFoundException({
        errorCode: ErrorCode.FILE_NOT_IN_STORAGE,
        message: 'ফাইলটি স্টোরেজে পাওয়া যায়নি। আপলোড সম্পন্ন হয়নি।',
      });
    }

    const updated = await this.prisma.media.update({
      where: { id: fileId },
      data: { status: 'COMPLETED' },
    });

    return {
      message: 'ফাইল আপলোড সফলভাবে সম্পন্ন হয়েছে',
      data: this.sanitizeMedia(updated),
    };
  }

  /**
   * Get file metadata by ID.
   */
  async getFile(userId: string, fileId: string) {
    const media = await this.prisma.media.findUnique({
      where: { id: fileId },
    });

    if (!media || media.deletedAt) {
      throw new NotFoundException({
        errorCode: ErrorCode.FILE_NOT_FOUND,
        message: 'ফাইল পাওয়া যায়নি।',
      });
    }

    if (media.uploadedBy !== userId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.FILE_ACCESS_DENIED,
        message: 'এই ফাইলে আপনার অ্যাক্সেস নেই।',
      });
    }

    return {
      message: 'ফাইলের তথ্য',
      data: this.sanitizeMedia(media),
    };
  }

  /**
   * Get a download URL for the file.
   * Public buckets → permanent public URL.
   * Private buckets → time-limited signed download URL (1 hour).
   */
  async getFileUrl(userId: string, fileId: string) {
    const media = await this.prisma.media.findUnique({
      where: { id: fileId },
    });

    if (!media || media.deletedAt) {
      throw new NotFoundException({
        errorCode: ErrorCode.FILE_NOT_FOUND,
        message: 'ফাইল পাওয়া যায়নি।',
      });
    }

    if (media.uploadedBy !== userId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.FILE_ACCESS_DENIED,
        message: 'এই ফাইলে আপনার অ্যাক্সেস নেই।',
      });
    }

    if (media.status !== 'COMPLETED') {
      throw new BadRequestException({
        errorCode: ErrorCode.FILE_UPLOAD_FAILED,
        message: 'ফাইল আপলোড এখনো সম্পন্ন হয়নি।',
      });
    }

    const isSensitive = SENSITIVE_BUCKETS.includes(media.bucket);

    let url: string;
    if (isSensitive) {
      url = await this.supabaseStorage.generateSignedDownloadUrl(
        media.bucket,
        media.storagePath,
        3600, // 1 hour
      );
    } else {
      url = this.supabaseStorage.getPublicUrl(media.bucket, media.storagePath);
    }

    return {
      message: 'ডাউনলোড URL তৈরি হয়েছে',
      data: {
        url,
        isTemporary: isSensitive,
        expiresAt: isSensitive
          ? new Date(Date.now() + 3600 * 1000).toISOString()
          : null,
      },
    };
  }

  /**
   * Soft-delete a file and optionally remove from storage.
   */
  async deleteFile(userId: string, fileId: string) {
    const media = await this.prisma.media.findUnique({
      where: { id: fileId },
    });

    if (!media || media.deletedAt) {
      throw new NotFoundException({
        errorCode: ErrorCode.FILE_NOT_FOUND,
        message: 'ফাইল পাওয়া যায়নি।',
      });
    }

    if (media.uploadedBy !== userId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.FILE_ACCESS_DENIED,
        message: 'এই ফাইলে আপনার অ্যাক্সেস নেই।',
      });
    }

    // Soft delete in database
    await this.prisma.media.update({
      where: { id: fileId },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
      },
    });

    // Best-effort delete from storage (non-blocking)
    this.supabaseStorage
      .deleteObject(media.bucket, media.storagePath)
      .catch((err) => {
        this.logger.warn(
          `Failed to delete object from storage: ${err.message}`,
        );
      });

    return {
      message: 'ফাইল সফলভাবে মুছে ফেলা হয়েছে',
      data: { id: fileId },
    };
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  /**
   * Validate the MIME type against the allowed types for the category.
   */
  private validateMimeType(category: FileCategory, mimeType: string): void {
    const isImageCategory = IMAGE_CATEGORIES.includes(category);
    const isDocCategory = DOCUMENT_CATEGORIES.includes(category);

    // OTHER category accepts both
    if (category === 'OTHER') {
      const allAllowed = [...ALLOWED_IMAGE_MIMES, ...ALLOWED_DOCUMENT_MIMES];
      if (!allAllowed.includes(mimeType)) {
        throw new BadRequestException({
          errorCode: ErrorCode.FILE_INVALID_MIME_TYPE,
          message: `"${mimeType}" ফাইল টাইপ অনুমোদিত নয়। অনুমোদিত: ${allAllowed.join(', ')}`,
        });
      }
      return;
    }

    if (isImageCategory) {
      if (!ALLOWED_IMAGE_MIMES.includes(mimeType)) {
        throw new BadRequestException({
          errorCode: ErrorCode.FILE_INVALID_MIME_TYPE,
          message: `"${mimeType}" ফাইল টাইপ অনুমোদিত নয়। অনুমোদিত: ${ALLOWED_IMAGE_MIMES.join(', ')}`,
        });
      }
    } else if (isDocCategory) {
      if (!ALLOWED_DOCUMENT_MIMES.includes(mimeType)) {
        throw new BadRequestException({
          errorCode: ErrorCode.FILE_INVALID_MIME_TYPE,
          message: `"${mimeType}" ফাইল টাইপ অনুমোদিত নয়। অনুমোদিত: ${ALLOWED_DOCUMENT_MIMES.join(', ')}`,
        });
      }
    }
  }

  /**
   * Validate the file size against per-category and configurable limits.
   * Per-category overrides (CATEGORY_MAX_SIZE_MB) take precedence.
   */
  private validateFileSize(category: FileCategory, size: number): void {
    const isImageCategory = IMAGE_CATEGORIES.includes(category);

    // Per-category cap (e.g. OWNER_SIGNATURE → 2 MB)
    const categoryCapMb = CATEGORY_MAX_SIZE_MB[category];
    if (categoryCapMb !== undefined) {
      const capBytes = categoryCapMb * 1024 * 1024;
      if (size > capBytes) {
        throw new PayloadTooLargeException({
          errorCode: ErrorCode.FILE_SIZE_EXCEEDED,
          message: `ফাইলের আকার ${categoryCapMb}MB সীমা অতিক্রম করেছে।`,
        });
      }
      return;
    }

    const maxSize = isImageCategory
      ? this.configService.get<number>('fileUpload.maxImageSizeBytes')
      : this.configService.get<number>('fileUpload.maxDocumentSizeBytes');

    if (size > maxSize) {
      const maxMb = Math.round(maxSize / (1024 * 1024));
      throw new PayloadTooLargeException({
        errorCode: ErrorCode.FILE_SIZE_EXCEEDED,
        message: `ফাইলের আকার ${maxMb}MB সীমা অতিক্রম করেছে।`,
      });
    }
  }

  /**
   * Generate a safe, deterministic storage path.
   * Pattern: {entityType}/{entityId}/{subcategory}/{uuid}.{ext}
   * Falls back to: uploads/{userId}/{subcategory}/{uuid}.{ext}
   */
  private generateStoragePath(
    category: FileCategory,
    mimeType: string,
    entityType?: string,
    entityId?: string,
    userId?: string,
  ): string {
    const uuid = randomUUID();
    const ext = this.getExtensionFromMime(mimeType);
    const subcategory = CATEGORY_PATH_SEGMENT[category];

    if (entityType && entityId) {
      return `${entityType}/${entityId}/${subcategory}/${uuid}.${ext}`;
    }

    return `uploads/${userId}/${subcategory}/${uuid}.${ext}`;
  }

  /**
   * Maps a MIME type to a file extension.
   */
  private getExtensionFromMime(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
    };
    return map[mimeType] || 'bin';
  }

  /**
   * Strips internal fields for API responses.
   */
  private sanitizeMedia(media: any) {
    const { storagePath, deletedAt, ...rest } = media;
    return rest;
  }
}
