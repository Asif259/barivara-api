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
    this.logger.log(
      `Requesting upload URL for user=${userId} category=${dto.category} originalName=${dto.originalName} size=${dto.size} entityType=${dto.entityType} entityId=${dto.entityId}`
    );

    try {
      // 1. Validate MIME type
      this.validateMimeType(dto.category, dto.mimeType);

      // 2. Validate file size
      this.validateFileSize(dto.category, dto.size);

      // 3. Validate entity ownership before embedding entityId in the storage path
      if (dto.entityType && dto.entityId) {
        await this.validateEntityOwnership(userId, dto.entityType, dto.entityId);
      }

      // 4. Determine bucket
      const bucket = BUCKET_MAP[dto.category];

      // 5. Generate safe storage path
      const storagePath = this.generateStoragePath(
        dto.category,
        dto.mimeType,
        dto.entityType,
        dto.entityId,
        userId,
      );

      // 6. Create PENDING Media record
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

      // 7. Generate signed upload URL from Supabase
      const uploadData = await this.supabaseStorage.generateSignedUploadUrl(
        bucket,
        storagePath,
      );

      this.logger.log(`Upload URL generated successfully for fileId=${media.id} bucket=${bucket} path=${storagePath}`);

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
    } catch (err) {
      this.logger.error(
        `Failed to request upload URL for user=${userId} category=${dto.category}: ${err.message}`,
        err.stack
      );
      throw err;
    }
  }

  /**
   * Mark an upload as completed after verifying the object exists in storage.
   */
  async completeUpload(userId: string, fileId: string) {
    this.logger.log(`Completing upload for fileId=${fileId} userId=${userId}`);

    try {
      const media = await this.prisma.media.findUnique({
        where: { id: fileId },
      });

      if (!media) {
        this.logger.warn(`File not found for completion: fileId=${fileId}`);
        throw new NotFoundException({
          errorCode: ErrorCode.FILE_NOT_FOUND,
          message: 'ফাইল পাওয়া যায়নি।',
        });
      }

      if (media.uploadedBy !== userId) {
        this.logger.warn(
          `Access denied completing upload: fileId=${fileId} userId=${userId} uploadedBy=${media.uploadedBy}`
        );
        throw new ForbiddenException({
          errorCode: ErrorCode.FILE_ACCESS_DENIED,
          message: 'এই ফাইলে আপনার অ্যাক্সেস নেই।',
        });
      }

      if (media.status !== 'PENDING') {
        this.logger.warn(
          `Invalid status transition for completion: fileId=${fileId} currentStatus=${media.status}`
        );
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
        this.logger.warn(
          `File not found in storage for completion: fileId=${fileId} bucket=${media.bucket} path=${media.storagePath}`
        );
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

      this.logger.log(`Upload completed successfully: fileId=${fileId}`);

      return {
        message: 'ফাইল আপলোড সফলভাবে সম্পন্ন হয়েছে',
        data: this.sanitizeMedia(updated),
      };
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof ForbiddenException || err instanceof BadRequestException) {
        throw err;
      }
      this.logger.error(
        `Failed to complete upload for fileId=${fileId} userId=${userId}: ${err.message}`,
        err.stack
      );
      throw err;
    }
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
          message: 'এই ধরনের ফাইল আপলোড করা সম্ভব নয়।',
        });
      }
      return;
    }

    if (isImageCategory) {
      if (!ALLOWED_IMAGE_MIMES.includes(mimeType)) {
        throw new BadRequestException({
          errorCode: ErrorCode.FILE_INVALID_MIME_TYPE,
          message: 'এই ধরনের ফাইল আপলোড করা সম্ভব নয়। অনুমোদিত: JPEG, PNG, WebP',
        });
      }
    } else if (isDocCategory) {
      if (!ALLOWED_DOCUMENT_MIMES.includes(mimeType)) {
        throw new BadRequestException({
          errorCode: ErrorCode.FILE_INVALID_MIME_TYPE,
          message: 'এই ধরনের ফাইল আপলোড করা সম্ভব নয়। অনুমোদিত: PDF',
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

  /**
   * Validates that the caller owns the entity referenced by entityType + entityId.
   * This prevents IDOR: a user cannot embed another user's entity ID in their upload path.
   * Only known entity types are checked. Unknown types are silently allowed (fallback path).
   */
  private async validateEntityOwnership(
    userId: string,
    entityType: string,
    entityId: string,
  ): Promise<void> {
    let owned = false;

    switch (entityType.toLowerCase()) {
      case 'tenant': {
        // A tenant is valid if they have agreements under the user's properties,
        // or if they have no agreements (unassigned).
        const tenant = await this.prisma.tenant.findFirst({
          where: {
            id: entityId,
            deletedAt: null,
            OR: [
              { agreements: { some: { unit: { property: { ownerId: userId } } } } },
              { agreements: { none: {} } },
            ],
          },
          select: { id: true },
        });
        owned = !!tenant;
        break;
      }
      case 'property': {
        const property = await this.prisma.property.findFirst({
          where: { id: entityId, ownerId: userId, deletedAt: null },
          select: { id: true },
        });
        owned = !!property;
        break;
      }
      case 'unit': {
        const unit = await this.prisma.unit.findFirst({
          where: { id: entityId, property: { ownerId: userId }, deletedAt: null },
          select: { id: true },
        });
        owned = !!unit;
        break;
      }
      case 'agreement': {
        const agreement = await this.prisma.rentalAgreement.findFirst({
          where: { id: entityId, unit: { property: { ownerId: userId } }, deletedAt: null },
          select: { id: true },
        });
        owned = !!agreement;
        break;
      }
      default:
        // Unknown entity types are not validated — path falls back to user-scoped path
        return;
    }

    if (!owned) {
      throw new ForbiddenException({
        errorCode: ErrorCode.AUTH_FORBIDDEN,
        message: 'আপনার এই রিসোর্সে ফাইল আপলোড করার অনুমতি নেই।',
      });
    }
  }
}
