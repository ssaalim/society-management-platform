import { BadRequestException, Controller, ForbiddenException, NotFoundException, Put, Query, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { R2StorageService } from './r2-storage.service';
import { verifyLocalUpload } from './local-upload-signature';

export const LOCAL_UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

/**
 * Local development stand-in for an R2 pre-signed PUT URL. Only active when R2 is not configured and the server is
 * not in production. Access is controlled by the HMAC signature in the URL (from /storage/upload-url, which itself
 * requires a verified society session), not by a login header, exactly like a real pre-signed URL.
 */
@ApiExcludeController()
@Controller('storage')
export class LocalUploadController {
  constructor(
    private readonly storage: R2StorageService,
    private readonly config: ConfigService,
  ) {}

  @Put('local-upload')
  async upload(@Query() query: Record<string, string>, @Req() req: any) {
    if (this.config.get<string>('NODE_ENV') === 'production' || !this.storage.usesLocalStorage) {
      throw new NotFoundException();
    }
    const grant = verifyLocalUpload(this.storage.localUploadSecret(), query);
    if (!grant) {
      throw new ForbiddenException('Upload link is invalid or has expired.');
    }
    const sentType = String(req.headers['content-type'] || '').toLowerCase();
    if (grant.contentType !== 'application/octet-stream' && sentType !== grant.contentType) {
      throw new BadRequestException('File type does not match the upload link.');
    }

    const target = path.join(LOCAL_UPLOAD_ROOT, grant.fileKey);
    if (!target.startsWith(LOCAL_UPLOAD_ROOT + path.sep)) {
      throw new ForbiddenException();
    }
    await fs.promises.mkdir(path.dirname(target), { recursive: true });

    // Stream the body to disk through a size limiter; on any failure the partial file is removed.
    let received = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _enc, done) {
        received += chunk.length;
        if (received > grant.maxBytes) {
          done(new BadRequestException('File is larger than the allowed size.'));
          return;
        }
        done(null, chunk);
      },
    });
    try {
      await pipeline(req, limiter, fs.createWriteStream(target));
    } catch (err) {
      await fs.promises.rm(target, { force: true });
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Upload was interrupted.');
    }
    return { success: true, data: { fileKey: grant.fileKey, bytes: received } };
  }
}
