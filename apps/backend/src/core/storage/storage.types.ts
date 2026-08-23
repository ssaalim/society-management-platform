export interface UploadUrlRequestDto {
  fileName: string;
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
  contentType: string;
  fileSize?: number; // Size in bytes
}

export interface UploadUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  fileKey: string;
  maxSizeBytes: number;
}

// Strict File Size Limits (in Bytes)
export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;    // 2 MB
export const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_IMPORT_SIZE_BYTES = 2 * 1024 * 1024;   // 2 MB

// Allowed MIME Type whitelists
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const ALLOWED_IMPORT_TYPES = [
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/csv',
];
