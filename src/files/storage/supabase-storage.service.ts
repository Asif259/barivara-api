import {
  Injectable,
  Logger,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ALL_BUCKETS } from '../enums';

@Injectable()
export class SupabaseStorageService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private client: SupabaseClient | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const url = this.configService.get<string>('supabase.url');
    const key = this.configService.get<string>('supabase.serviceRoleKey');

    if (!url || !key) {
      this.logger.error(
        'Supabase URL or Service Role Key not configured. File upload features will be unavailable. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment variables.',
      );
      return;
    }

    this.client = createClient(url, key, {
      auth: { persistSession: false },
    });

    this.logger.log('Supabase client initialized');
    try {
      await this.ensureBucketsExist();
    } catch (error) {
      this.logger.error(`Failed to ensure buckets exist: ${error.message}`, error.stack);
    }
  }

  /**
   * Returns true if the Supabase client is configured and ready.
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Get the underlying Supabase client. Throws if not configured.
   */
  private getClient(): SupabaseClient {
    if (!this.client) {
      const url = this.configService.get<string>('supabase.url');
      const key = this.configService.get<string>('supabase.serviceRoleKey');
      
      this.logger.error(
        `Supabase client not initialized. Config check - URL: ${url ? 'SET' : 'MISSING'}, ServiceRoleKey: ${key ? 'SET' : 'MISSING'}`
      );
      
      throw new InternalServerErrorException({
        errorCode: 'SUPABASE_NOT_CONFIGURED',
        message:
          'Supabase স্টোরেজ কনফিগার করা হয়নি। অনুগ্রহ করে .env ফাইলে SUPABASE_URL এবং SUPABASE_SERVICE_ROLE_KEY দিন। (Supabase Storage is not configured. Please provide SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env)',
      });
    }
    return this.client;
  }

  /**
   * Ensures all required buckets exist. Creates them if not present.
   */
  private async ensureBucketsExist(): Promise<void> {
    const client = this.getClient();

    for (const bucket of ALL_BUCKETS) {
      try {
        const { data, error } = await client.storage.getBucket(bucket.name);

        if (error && error.message?.includes('not found')) {
          const { error: createError } = await client.storage.createBucket(
            bucket.name,
            {
              public: bucket.isPublic,
              fileSizeLimit: 10 * 1024 * 1024, // 10 MB max at bucket level
            },
          );

          if (createError) {
            this.logger.error(
              `Failed to create bucket "${bucket.name}": ${createError.message}`,
              createError.stack
            );
          } else {
            this.logger.log(
              `Created bucket "${bucket.name}" (public: ${bucket.isPublic})`,
            );
          }
        } else if (data) {
          this.logger.log(`Bucket "${bucket.name}" already exists`);
        } else {
          this.logger.warn(
            `Unexpected response checking bucket "${bucket.name}": ${error?.message || 'no data'}`
          );
        }
      } catch (err) {
        this.logger.error(
          `Error ensuring bucket "${bucket.name}" exists: ${err.message}`,
          err.stack
        );
      }
    }
  }

  /**
   * Generate a signed upload URL for direct client-to-Supabase upload.
   * @returns The signed URL and token
   */
  async generateSignedUploadUrl(
    bucket: string,
    storagePath: string,
    _expiresInSeconds: number = 600, // 10 minutes
  ): Promise<{ signedUrl: string; token: string; path: string }> {
    const client = this.getClient();

    try {
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUploadUrl(storagePath);

      if (error) {
        this.logger.error(
          `Failed to create signed upload URL for bucket="${bucket}" path="${storagePath}": ${error.message}`,
          error.stack
        );
        throw new InternalServerErrorException({
          errorCode: 'FILE_UPLOAD_FAILED',
          message: 'ফাইল আপলোড URL তৈরি সম্ভব হয়নি।',
          details: { bucket, storagePath, supabaseError: error.message },
        });
      }

      return {
        signedUrl: data.signedUrl,
        token: data.token,
        path: data.path,
      };
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      this.logger.error(
        `Unexpected error creating signed upload URL for bucket="${bucket}" path="${storagePath}": ${err.message}`,
        err.stack
      );
      throw new InternalServerErrorException({
        errorCode: 'FILE_UPLOAD_FAILED',
        message: 'ফাইল আপলোড URL তৈরি সম্ভব হয়নি।',
        details: { bucket, storagePath, error: err.message },
      });
    }
  }

  /**
   * Generate a signed download URL for private files.
   */
  async generateSignedDownloadUrl(
    bucket: string,
    storagePath: string,
    expiresInSeconds: number = 3600, // 1 hour
  ): Promise<string> {
    const client = this.getClient();

    try {
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrl(storagePath, expiresInSeconds);

      if (error) {
        this.logger.error(
          `Failed to create signed download URL for bucket="${bucket}" path="${storagePath}": ${error.message}`,
          error.stack
        );
        throw new InternalServerErrorException({
          errorCode: 'INTERNAL_ERROR',
          message: 'ফাইল ডাউনলোড URL তৈরি সম্ভব হয়নি।',
          details: { bucket, storagePath, supabaseError: error.message },
        });
      }

      return data.signedUrl;
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      this.logger.error(
        `Unexpected error creating signed download URL for bucket="${bucket}" path="${storagePath}": ${err.message}`,
        err.stack
      );
      throw new InternalServerErrorException({
        errorCode: 'INTERNAL_ERROR',
        message: 'ফাইল ডাউনলোড URL তৈরি সম্ভব হয়নি।',
        details: { bucket, storagePath, error: err.message },
      });
    }
  }

  /**
   * Get the permanent public URL for files in public buckets.
   */
  getPublicUrl(bucket: string, storagePath: string): string {
    const client = this.getClient();

    const { data } = client.storage.from(bucket).getPublicUrl(storagePath);
    return data.publicUrl;
  }

  /**
   * Check if an object exists in storage (verifies upload completion).
   */
  async objectExists(bucket: string, storagePath: string): Promise<boolean> {
    const client = this.getClient();

    try {
      // list with prefix matching the exact path
      const pathParts = storagePath.split('/');
      const fileName = pathParts.pop();
      const folder = pathParts.join('/');

      const { data, error } = await client.storage
        .from(bucket)
        .list(folder, { limit: 100, search: fileName });

      if (error) {
        this.logger.warn(
          `Error checking object existence for bucket="${bucket}" path="${storagePath}": ${error.message}`,
        );
        return false;
      }

      return data?.some((f) => f.name === fileName) ?? false;
    } catch (err) {
      this.logger.error(
        `Unexpected error checking object existence for bucket="${bucket}" path="${storagePath}": ${err.message}`,
        err.stack
      );
      return false;
    }
  }

  /**
   * Remove an object from storage.
   */
  async deleteObject(bucket: string, storagePath: string): Promise<boolean> {
    const client = this.getClient();

    try {
      const { error } = await client.storage
        .from(bucket)
        .remove([storagePath]);

      if (error) {
        this.logger.error(
          `Failed to delete object from bucket="${bucket}" path="${storagePath}": ${error.message}`,
          error.stack
        );
        return false;
      }

      return true;
    } catch (err) {
      this.logger.error(
        `Unexpected error deleting object from bucket="${bucket}" path="${storagePath}": ${err.message}`,
        err.stack
      );
      return false;
    }
  }
}
