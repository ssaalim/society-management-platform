import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { IStorageProvider } from './storage.interface';

@Injectable()
export class SupabaseStorageService implements IStorageProvider {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL') || '';
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    } else {
      console.warn('Supabase credentials missing. Storage disabled.');
    }
  }

  async uploadFile(bucket: string, path: string, file: Buffer, mimeType: string): Promise<string> {
    if (!this.supabase) throw new InternalServerErrorException('Storage not configured');
    
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .upload(path, file, { contentType: mimeType, upsert: true });

    if (error) throw new InternalServerErrorException(`Upload failed: ${error.message}`);
    return data.path;
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    if (!this.supabase) throw new InternalServerErrorException('Storage not configured');
    
    const { error } = await this.supabase.storage.from(bucket).remove([path]);
    if (error) throw new InternalServerErrorException(`Delete failed: ${error.message}`);
  }

  async getSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string> {
    if (!this.supabase) throw new InternalServerErrorException('Storage not configured');
    
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) throw new InternalServerErrorException(`URL generation failed: ${error.message}`);
    return data.signedUrl;
  }
}
