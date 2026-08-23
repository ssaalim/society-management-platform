import { Injectable, BadRequestException, HttpException, HttpStatus, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DRIZZLE_PROVIDER, DrizzleDB } from '../database/database.module';
import { storageUsage } from '../../../database/schema';
import { eq, sql } from 'drizzle-orm';
import {
  UploadUrlRequestDto,
  UploadUrlResponse,
  MAX_IMAGE_SIZE_BYTES,
  MAX_DOCUMENT_SIZE_BYTES,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_DOCUMENT_TYPES,
} from './storage.types';

@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private publicUrlBase: string;
  private isConfigured: boolean = false;
  private monthlyUploadCap: number;

  constructor(
    private readonly configService: ConfigService,
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
  ) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY');
    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME') || 'society-documents';
    this.publicUrlBase = (this.configService.get<string>('R2_PUBLIC_URL') || '').replace(/\/+$/, '');
    
    // Default safety cap: 50,000 operations/month (well within Cloudflare's 1,000,000 free tier)
    this.monthlyUploadCap = parseInt(
      this.configService.get<string>('R2_MONTHLY_UPLOAD_CAP') || '50000',
      10
    );

    if (accountId && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.isConfigured = true;
      this.logger.log(`Cloudflare R2 Storage initialized (Bucket: ${this.bucketName}, Monthly Safety Cap: ${this.monthlyUploadCap})`);
    } else {
      this.logger.warn('Cloudflare R2 credentials not configured. Running in local fallback mode.');
    }
  }

  /**
   * Retrieves or initializes the current month's storage usage metrics.
   */
  async getMonthlyUsage(): Promise<{ monthKey: string; uploadCount: number; totalBytes: number; maxMonthlyCap: number }> {
    const monthKey = new Date().toISOString().substring(0, 7); // 'YYYY-MM'
    try {
      const records = await this.db.select().from(storageUsage).where(eq(storageUsage.monthKey, monthKey)).limit(1);
      if (records.length > 0) {
        return {
          monthKey,
          uploadCount: records[0].uploadCount,
          totalBytes: Number(records[0].totalBytes),
          maxMonthlyCap: this.monthlyUploadCap,
        };
      }
    } catch (e: any) {
      this.logger.warn(`Failed to read storage_usage: ${e.message}`);
    }

    return {
      monthKey,
      uploadCount: 0,
      totalBytes: 0,
      maxMonthlyCap: this.monthlyUploadCap,
    };
  }

  /**
   * Validates monthly quota and increments usage upon authorized upload.
   */
  private async recordAndValidateMonthlyQuota(fileSize: number = 0): Promise<void> {
    const monthKey = new Date().toISOString().substring(0, 7);

    try {
      const currentUsage = await this.getMonthlyUsage();

      if (currentUsage.uploadCount >= this.monthlyUploadCap) {
        throw new HttpException(
          `Monthly free tier storage quota (${this.monthlyUploadCap} operations) reached. Uploads are temporarily paused to avoid unwanted charges.`,
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      // Upsert monthly counter atomically
      await this.db
        .insert(storageUsage)
        .values({
          monthKey,
          uploadCount: 1,
          totalBytes: String(fileSize),
        })
        .onConflictDoUpdate({
          target: storageUsage.monthKey,
          set: {
            uploadCount: sql`${storageUsage.uploadCount} + 1`,
            totalBytes: sql`${storageUsage.totalBytes} + ${fileSize}`,
            updatedAt: new Date(),
          },
        });
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      this.logger.warn(`Could not update storage_usage counter: ${e.message}`);
    }
  }

  /**
   * Validates file upload scope, size, MIME type, and monthly quota,
   * then generates a pre-signed Cloudflare R2 PUT URL with Edge CDN cache headers.
   */
  async generatePresignedUploadUrl(
    societyId: string,
    dto: UploadUrlRequestDto,
  ): Promise<UploadUrlResponse> {
    if (!dto.fileName || !dto.fileType) {
      throw new BadRequestException('fileName and fileType are required.');
    }

    const contentType = (dto.contentType || 'application/octet-stream').toLowerCase();
    const isImageScope = ['logo', 'avatar', 'bank_passbook'].includes(dto.fileType);
    const maxSize = isImageScope ? MAX_IMAGE_SIZE_BYTES : MAX_DOCUMENT_SIZE_BYTES;
    const maxMb = isImageScope ? 2 : 5;

    // 1. Validate File Size Limit
    if (dto.fileSize && dto.fileSize > maxSize) {
      throw new BadRequestException(
        `File size (${(dto.fileSize / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of ${maxMb} MB for ${dto.fileType}.`
      );
    }

    // 2. Validate MIME Type whitelist
    const allowedTypes = isImageScope ? ALLOWED_IMAGE_TYPES : ALLOWED_DOCUMENT_TYPES;
    if (contentType !== 'application/octet-stream' && !allowedTypes.includes(contentType)) {
      throw new BadRequestException(
        `Disallowed file type "${contentType}". Allowed formats: ${allowedTypes.join(', ')}`
      );
    }

    // 3. Enforce Free Tier Monthly Quota Guardrail
    await this.recordAndValidateMonthlyQuota(dto.fileSize || 0);

    // Clean filename: remove unsafe characters
    const sanitizedFileName = dto.fileName
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '_')
      .replace(/_+/g, '_');

    // Storage Key: societies/{societyId}/{fileType}/{timestamp}_{filename}
    const fileKey = `societies/${societyId}/${dto.fileType}/${Date.now()}_${sanitizedFileName}`;

    // 4. Generate AWS S3 Presigned URL for Cloudflare R2
    if (this.isConfigured && this.s3Client) {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        ContentType: contentType,
        // Cache at Cloudflare Edge CDN for 1 year -> guarantees 0 Class B charges on subsequent views!
        CacheControl: 'public, max-age=31536000, immutable',
      });

      // URL valid for 15 minutes (900s)
      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 900 });
      
      const publicUrl = this.publicUrlBase
        ? `${this.publicUrlBase}/${fileKey}`
        : uploadUrl.split('?')[0];

      return {
        uploadUrl,
        publicUrl,
        fileKey,
        maxSizeBytes: maxSize,
      };
    }

    // 5. Local / Mock Fallback URL when R2 keys are not configured yet
    const localUploadUrl = `/api/v1/storage/direct-upload?fileKey=${encodeURIComponent(fileKey)}`;
    const localPublicUrl = `/uploads/${fileKey}`;

    return {
      uploadUrl: localUploadUrl,
      publicUrl: localPublicUrl,
      fileKey,
      maxSizeBytes: maxSize,
    };
  }

  /**
   * Deletes a file from Cloudflare R2 bucket.
   */
  async deleteFile(fileKey: string): Promise<void> {
    if (!this.isConfigured || !this.s3Client) {
      return;
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });
      await this.s3Client.send(command);
    } catch (err: any) {
      this.logger.error(`Failed to delete object "${fileKey}" from R2: ${err.message}`);
    }
  }

  /**
   * Generates a pre-signed temporary download URL for private documents.
   */
  async getPresignedDownloadUrl(fileKey: string, expiresInSeconds = 3600): Promise<string> {
    if (this.publicUrlBase) {
      return `${this.publicUrlBase}/${fileKey}`;
    }

    if (!this.isConfigured || !this.s3Client) {
      return `/uploads/${fileKey}`;
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }
}
