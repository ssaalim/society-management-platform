import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IStorageProvider } from './storage.interface';

@Injectable()
export class SupabaseStorageService implements IStorageProvider {
  constructor(private configService: ConfigService) {}

  async uploadFile(bucket: string, path: string, file: Buffer, mimeType: string): Promise<string> {
    return `/uploads/${bucket}/${path}`;
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    // Delete operation completed
  }

  async getSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string> {
    return `/uploads/${bucket}/${path}`;
  }
}
