import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FileCategory, FileStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ErrorCode } from '../common/constants/error-codes';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        signatureFileId: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        errorCode: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'ব্যবহারকারী পাওয়া যায়নি।',
      });
    }

    return user;
  }

  /**
   * Set or clear the user's signature file.
   * Pass `fileId = null` to remove the current signature.
   */
  async updateSignature(userId: string, fileId: string | null) {
    // 1. If setting a new signature, validate the file
    if (fileId) {
      const media = await this.prisma.media.findUnique({
        where: { id: fileId },
      });

      if (!media || media.deletedAt) {
        throw new NotFoundException({
          errorCode: ErrorCode.FILE_NOT_FOUND,
          message: 'স্বাক্ষরের ফাইল পাওয়া যায়নি।',
        });
      }

      if (media.uploadedBy !== userId) {
        throw new ForbiddenException({
          errorCode: ErrorCode.FILE_ACCESS_DENIED,
          message: 'এই ফাইলে আপনার অ্যাক্সেস নেই।',
        });
      }

      if (media.category !== FileCategory.OWNER_SIGNATURE) {
        throw new BadRequestException({
          errorCode: ErrorCode.VALIDATION_ERROR,
          message: 'এই ফাইলটি স্বাক্ষর ফাইল হিসেবে গ্রহণযোগ্য নয়।',
        });
      }

      if (media.status !== FileStatus.COMPLETED) {
        throw new BadRequestException({
          errorCode: ErrorCode.FILE_UPLOAD_FAILED,
          message: 'স্বাক্ষর ফাইলটির আপলোড এখনো সম্পন্ন হয়নি।',
        });
      }
    }

    // 2. Persist on the user record
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { signatureFileId: fileId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        signatureFileId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  }
}
