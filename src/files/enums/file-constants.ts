import { FileCategory } from '@prisma/client';

/**
 * Maps each FileCategory to its Supabase Storage bucket name.
 */
export const BUCKET_MAP: Record<FileCategory, string> = {
  PROFILE_IMAGE: 'profile-images',
  PROPERTY_IMAGE: 'property-images',
  TENANT_PROFILE_PICTURE: 'tenant-documents',
  TENANT_FRONT_NID: 'tenant-documents',
  TENANT_BACK_NID: 'tenant-documents',
  TENANT_DOCUMENT: 'tenant-documents',
  AGREEMENT_DOCUMENT: 'tenant-documents',
  PAYMENT_RECEIPT: 'payment-receipts',
  OWNER_SIGNATURE: 'owner-signatures',
  OTHER: 'tenant-documents',
};

/**
 * Buckets that are private and require signed URLs for download.
 */
export const SENSITIVE_BUCKETS = [
  'tenant-documents',
  'payment-receipts',
  'owner-signatures',
];

/**
 * All Supabase Storage buckets used by BariVara.
 */
export const ALL_BUCKETS = [
  { name: 'profile-images', isPublic: true },
  { name: 'property-images', isPublic: true },
  { name: 'tenant-documents', isPublic: false },
  { name: 'payment-receipts', isPublic: false },
  { name: 'owner-signatures', isPublic: false },
];

/**
 * Allowed MIME types for image uploads.
 */
export const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

/**
 * Allowed MIME types for document uploads.
 */
export const ALLOWED_DOCUMENT_MIMES = [
  'application/pdf',
];

/**
 * Categories that accept image MIME types.
 */
export const IMAGE_CATEGORIES: FileCategory[] = [
  'PROFILE_IMAGE',
  'PROPERTY_IMAGE',
  'TENANT_PROFILE_PICTURE',
  'TENANT_FRONT_NID',
  'TENANT_BACK_NID',
  'PAYMENT_RECEIPT',
  'OWNER_SIGNATURE',
];

/**
 * Per-category max size in MB. Falls back to the config defaults
 * for any category not listed here.
 */
export const CATEGORY_MAX_SIZE_MB: Partial<Record<FileCategory, number>> = {
  OWNER_SIGNATURE: 2,
};

/**
 * Categories that accept document (PDF) MIME types.
 */
export const DOCUMENT_CATEGORIES: FileCategory[] = [
  'TENANT_DOCUMENT',
  'AGREEMENT_DOCUMENT',
];

/**
 * Subcategory path segment derived from the file category.
 */
export const CATEGORY_PATH_SEGMENT: Record<FileCategory, string> = {
  PROFILE_IMAGE: 'profile',
  PROPERTY_IMAGE: 'cover',
  TENANT_PROFILE_PICTURE: 'tenant-profile',
  TENANT_FRONT_NID: 'nid-front',
  TENANT_BACK_NID: 'nid-back',
  TENANT_DOCUMENT: 'document',
  AGREEMENT_DOCUMENT: 'agreement',
  PAYMENT_RECEIPT: 'receipt',
  OWNER_SIGNATURE: 'signature',
  OTHER: 'other',
};
