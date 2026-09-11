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
      this.logger.warn(
        'Supabase URL or Service Role Key not configured. File upload features will be unavailable.',
      );
      return;
    }

    this.client = createClient(url, key, {
      auth: { persistSession: false },
    });

    this.logger.log('Supabase client initialized');
    await this.ensureBucketsExist();
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
          );
        } else {
          this.logger.log(
            `Created bucket "${bucket.name}" (public: ${bucket.isPublic})`,
          );
        }
      } else if (data) {
        this.logger.log(`Bucket "${bucket.name}" already exists`);
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

    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUploadUrl(storagePath);

    if (error) {
      this.logger.error(`Failed to create signed upload URL: ${error.message}`);
      throw new InternalServerErrorException({
        errorCode: 'FILE_UPLOAD_FAILED',
        message: `Failed to generate upload URL: ${error.message}`,
      });
    }

    return {
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path,
    };
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

    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error) {
      this.logger.error(
        `Failed to create signed download URL: ${error.message}`,
      );
      throw new InternalServerErrorException({
        errorCode: 'FILE_UPLOAD_FAILED',
        message: `Failed to generate download URL: ${error.message}`,
      });
    }

    return data.signedUrl;
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

    // list with prefix matching the exact path
    const pathParts = storagePath.split('/');
    const fileName = pathParts.pop();
    const folder = pathParts.join('/');

    const { data, error } = await client.storage
      .from(bucket)
      .list(folder, { limit: 100, search: fileName });

    if (error) {
      this.logger.warn(
        `Error checking object existence: ${error.message}`,
      );
      return false;
    }

    return data?.some((f) => f.name === fileName) ?? false;
  }

  /**
   * Remove an object from storage.
   */
  async deleteObject(bucket: string, storagePath: string): Promise<boolean> {
    const client = this.getClient();

    const { error } = await client.storage
      .from(bucket)
      .remove([storagePath]);

    if (error) {
      this.logger.error(`Failed to delete object: ${error.message}`);
      return false;
    }

    return true;
  }
}
