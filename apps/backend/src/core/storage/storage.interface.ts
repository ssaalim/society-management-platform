export interface IStorageProvider {
  uploadFile(bucket: string, path: string, file: Buffer, mimeType: string): Promise<string>;
  deleteFile(bucket: string, path: string): Promise<void>;
  getSignedUrl(bucket: string, path: string, expiresIn?: number): Promise<string>;
}
