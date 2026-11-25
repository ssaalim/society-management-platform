import { apiClient } from '../api/client';
import { prepareFileForUpload, type PreparedFile } from './compress';

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
    | 'avatar'
    | 'chat_photo';
  societyId?: string;
  onProgress?: (percent: number) => void;
}

export interface UploadResult {
  publicUrl: string;
  fileKey: string;
  fileName: string;
  /** Size details when the file was compressed before upload. */
  prepared?: PreparedFile;
}

/** PUTs a file to a pre-signed URL and fails loudly if storage rejects it. */
export async function putToSignedUrl(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload failed (${response.status}). Please try again.`);
  }
}

/**
 * Validates file size and uploads directly to Cloudflare R2 via pre-signed URL.
 */
export async function uploadFileToR2(options: UploadOptions): Promise<UploadResult> {
  const { fileType, societyId } = options;

  if (!options.file) {
    throw new Error('No file selected for upload.');
  }

  const isImageScope = ['logo', 'avatar', 'bank_passbook', 'chat_photo'].includes(fileType);
  // Compress images and size-check PDFs before asking for an upload URL.
  const prepared = await prepareFileForUpload(options.file, {
    maxBytes: isImageScope ? MAX_IMAGE_SIZE_BYTES : MAX_DOCUMENT_SIZE_BYTES,
  });
  const file = prepared.file;

  // Request a pre-signed upload URL (the server files it under the signed-in society)
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
  await putToSignedUrl(uploadUrl, file);

  return {
    publicUrl,
    fileKey,
    fileName: file.name,
    prepared,
  };
}
