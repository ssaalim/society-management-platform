import { apiClient } from '../api/client';

export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;    // 2 MB
export const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface UploadOptions {
  file: File;
  fileType: 
    | 'logo' 
    | 'registration_certificate' 
    | 'pan' 
    | 'gst' 
    | 'bye_laws' 
    | 'bank_passbook' 
    | 'lease_agreement' 
    | 'tenant_noc' 
    | 'police_verification' 
    | 'circular' 
    | 'notice' 
    | 'document' 
    | 'avatar';
  societyId?: string;
  onProgress?: (percent: number) => void;
}

export interface UploadResult {
  publicUrl: string;
  fileKey: string;
  fileName: string;
}

/**
 * Validates file size and uploads directly to Cloudflare R2 via pre-signed URL.
 */
export async function uploadFileToR2(options: UploadOptions): Promise<UploadResult> {
  const { file, fileType, societyId } = options;

  if (!file) {
    throw new Error('No file selected for upload.');
  }

  const isImageScope = ['logo', 'avatar', 'bank_passbook'].includes(fileType);
  const maxSize = isImageScope ? MAX_IMAGE_SIZE_BYTES : MAX_DOCUMENT_SIZE_BYTES;
  const maxMb = isImageScope ? 2 : 5;

  // 1. Client-side Size Validation
  if (file.size > maxSize) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    throw new Error(`File size (${sizeMb} MB) exceeds maximum allowed limit of ${maxMb} MB.`);
  }

  // 2. Request Presigned R2 Upload URL from Backend
  const res = await apiClient.post('/storage/upload-url', {
    fileName: file.name,
    fileType,
    contentType: file.type || 'application/octet-stream',
    fileSize: file.size,
    societyId,
  });

  if (!res.data?.success || !res.data?.data?.uploadUrl) {
    throw new Error(res.data?.message || 'Failed to acquire secure upload URL.');
  }

  const { uploadUrl, publicUrl, fileKey } = res.data.data;

  // 3. Upload directly to Cloudflare R2 via HTTP PUT
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Cloud storage upload failed with status ${uploadResponse.status} ${uploadResponse.statusText}`);
  }

  return {
    publicUrl,
    fileKey,
    fileName: file.name,
  };
}
