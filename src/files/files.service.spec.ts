import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseStorageService } from './storage/supabase-storage.service';
import { RequestUploadUrlDto } from './dto';
import { FileCategory } from '@prisma/client';

describe('FilesService', () => {
  let service: FilesService;

  const mockUserId = 'user-uuid-123';
  const mockFileId = 'file-uuid-456';

  const mockPrisma = {
    media: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockSupabaseStorage = {
    isConfigured: jest.fn().mockReturnValue(true),
    generateSignedUploadUrl: jest.fn().mockResolvedValue({
      signedUrl: 'https://supabase.co/storage/upload?token=abc',
      token: 'abc',
      path: 'tenant/id/nid/uuid.jpg',
    }),
    generateSignedDownloadUrl: jest.fn().mockResolvedValue(
      'https://supabase.co/storage/download?token=xyz',
    ),
    getPublicUrl: jest.fn().mockReturnValue(
      'https://supabase.co/storage/v1/object/public/profile-images/path.jpg',
    ),
    objectExists: jest.fn().mockResolvedValue(true),
    deleteObject: jest.fn().mockResolvedValue(true),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, any> = {
        'fileUpload.maxImageSizeBytes': 5 * 1024 * 1024, // 5 MB
        'fileUpload.maxDocumentSizeBytes': 10 * 1024 * 1024, // 10 MB
        'supabase.url': 'https://test.supabase.co',
        'supabase.serviceRoleKey': 'test-key',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SupabaseStorageService, useValue: mockSupabaseStorage },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── requestUploadUrl ──────────────────────────────────────────────────────

  describe('requestUploadUrl', () => {
    const validImageDto: RequestUploadUrlDto = {
      category: 'TENANT_NID' as FileCategory,
      originalName: 'nid-front.jpg',
      mimeType: 'image/jpeg',
      size: 1024 * 1024, // 1 MB
      entityType: 'tenant',
      entityId: 'tenant-uuid-789',
    };

    it('should generate a signed upload URL for a valid image request', async () => {
      mockPrisma.media.create.mockResolvedValue({
        id: mockFileId,
        ...validImageDto,
        bucket: 'tenant-documents',
        storagePath: 'tenant/tenant-uuid-789/nid/uuid.jpg',
        uploadedBy: mockUserId,
        status: 'PENDING',
      });

      const result = await service.requestUploadUrl(mockUserId, validImageDto);

      expect(result.data.fileId).toBe(mockFileId);
      expect(result.data.uploadUrl).toContain('supabase.co');
      expect(result.data.bucket).toBe('tenant-documents');
      expect(mockPrisma.media.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: 'TENANT_NID',
            uploadedBy: mockUserId,
            status: 'PENDING',
            bucket: 'tenant-documents',
          }),
        }),
      );
      expect(mockSupabaseStorage.generateSignedUploadUrl).toHaveBeenCalled();
    });

    it('should reject an invalid MIME type for an image category', async () => {
      const invalidDto = { ...validImageDto, mimeType: 'application/pdf' };

      await expect(
        service.requestUploadUrl(mockUserId, invalidDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject an invalid MIME type for a document category', async () => {
      const docDto: RequestUploadUrlDto = {
        category: 'AGREEMENT_DOCUMENT' as FileCategory,
        originalName: 'agreement.txt',
        mimeType: 'text/plain',
        size: 1024,
      };

      await expect(
        service.requestUploadUrl(mockUserId, docDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a file exceeding the size limit', async () => {
      const oversizedDto = {
        ...validImageDto,
        size: 6 * 1024 * 1024, // 6 MB — exceeds 5 MB limit
      };

      await expect(
        service.requestUploadUrl(mockUserId, oversizedDto),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it('should accept a valid PDF for document categories', async () => {
      const pdfDto: RequestUploadUrlDto = {
        category: 'AGREEMENT_DOCUMENT' as FileCategory,
        originalName: 'lease.pdf',
        mimeType: 'application/pdf',
        size: 2 * 1024 * 1024,
        entityType: 'agreement',
        entityId: 'agreement-uuid-123',
      };

      mockPrisma.media.create.mockResolvedValue({
        id: mockFileId,
        ...pdfDto,
        bucket: 'tenant-documents',
        storagePath: 'agreement/agreement-uuid-123/agreement/uuid.pdf',
        uploadedBy: mockUserId,
        status: 'PENDING',
      });

      const result = await service.requestUploadUrl(mockUserId, pdfDto);
      expect(result.data.fileId).toBe(mockFileId);
    });
  });

  // ─── completeUpload ────────────────────────────────────────────────────────

  describe('completeUpload', () => {
    const pendingMedia = {
      id: mockFileId,
      uploadedBy: mockUserId,
      status: 'PENDING',
      bucket: 'tenant-documents',
      storagePath: 'tenant/id/nid/uuid.jpg',
    };

    it('should complete upload when object exists in storage', async () => {
      mockPrisma.media.findUnique.mockResolvedValue(pendingMedia);
      mockSupabaseStorage.objectExists.mockResolvedValue(true);
      mockPrisma.media.update.mockResolvedValue({
        ...pendingMedia,
        status: 'COMPLETED',
      });

      const result = await service.completeUpload(mockUserId, mockFileId);
      expect(result.data.status).toBe('COMPLETED');
    });

    it('should fail and mark FAILED when object is missing in storage', async () => {
      mockPrisma.media.findUnique.mockResolvedValue(pendingMedia);
      mockSupabaseStorage.objectExists.mockResolvedValue(false);
      mockPrisma.media.update.mockResolvedValue({
        ...pendingMedia,
        status: 'FAILED',
      });

      await expect(
        service.completeUpload(mockUserId, mockFileId),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.media.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'FAILED' },
        }),
      );
    });

    it('should reject cross-user complete attempt', async () => {
      mockPrisma.media.findUnique.mockResolvedValue(pendingMedia);

      await expect(
        service.completeUpload('other-user-id', mockFileId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject if file not found', async () => {
      mockPrisma.media.findUnique.mockResolvedValue(null);

      await expect(
        service.completeUpload(mockUserId, mockFileId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getFile ───────────────────────────────────────────────────────────────

  describe('getFile', () => {
    it('should return file metadata for the owner', async () => {
      mockPrisma.media.findUnique.mockResolvedValue({
        id: mockFileId,
        uploadedBy: mockUserId,
        status: 'COMPLETED',
        bucket: 'tenant-documents',
        storagePath: 'tenant/id/nid/uuid.jpg',
        originalName: 'nid.jpg',
      });

      const result = await service.getFile(mockUserId, mockFileId);
      expect(result.data.id).toBe(mockFileId);
      // storagePath should be stripped from response
      expect(result.data.storagePath).toBeUndefined();
    });

    it('should reject cross-user file access', async () => {
      mockPrisma.media.findUnique.mockResolvedValue({
        id: mockFileId,
        uploadedBy: mockUserId,
        status: 'COMPLETED',
      });

      await expect(
        service.getFile('other-user-id', mockFileId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── getFileUrl ────────────────────────────────────────────────────────────

  describe('getFileUrl', () => {
    it('should return signed download URL for private files', async () => {
      mockPrisma.media.findUnique.mockResolvedValue({
        id: mockFileId,
        uploadedBy: mockUserId,
        status: 'COMPLETED',
        bucket: 'tenant-documents', // private
        storagePath: 'tenant/id/nid/uuid.jpg',
      });

      const result = await service.getFileUrl(mockUserId, mockFileId);
      expect(result.data.url).toContain('supabase.co');
      expect(result.data.isTemporary).toBe(true);
      expect(result.data.expiresAt).toBeDefined();
      expect(mockSupabaseStorage.generateSignedDownloadUrl).toHaveBeenCalled();
    });

    it('should return public URL for public files', async () => {
      mockPrisma.media.findUnique.mockResolvedValue({
        id: mockFileId,
        uploadedBy: mockUserId,
        status: 'COMPLETED',
        bucket: 'profile-images', // public
        storagePath: 'user/id/profile/uuid.jpg',
      });

      const result = await service.getFileUrl(mockUserId, mockFileId);
      expect(result.data.isTemporary).toBe(false);
      expect(result.data.expiresAt).toBeNull();
      expect(mockSupabaseStorage.getPublicUrl).toHaveBeenCalled();
    });
  });

  // ─── deleteFile ────────────────────────────────────────────────────────────

  describe('deleteFile', () => {
    it('should soft-delete and remove from storage', async () => {
      mockPrisma.media.findUnique.mockResolvedValue({
        id: mockFileId,
        uploadedBy: mockUserId,
        status: 'COMPLETED',
        bucket: 'tenant-documents',
        storagePath: 'tenant/id/nid/uuid.jpg',
      });
      mockPrisma.media.update.mockResolvedValue({});

      const result = await service.deleteFile(mockUserId, mockFileId);
      expect(result.data.id).toBe(mockFileId);
      expect(mockPrisma.media.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'DELETED' }),
        }),
      );
    });

    it('should reject cross-user deletion', async () => {
      mockPrisma.media.findUnique.mockResolvedValue({
        id: mockFileId,
        uploadedBy: mockUserId,
      });

      await expect(
        service.deleteFile('other-user-id', mockFileId),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
