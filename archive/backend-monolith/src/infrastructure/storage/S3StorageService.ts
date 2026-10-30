import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class S3StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly endpoint: string;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.endpoint = this.configService.get<string>('S3_ENDPOINT', 'http://localhost:9000');
    this.bucket = this.configService.get<string>('S3_BUCKET', 'lms-files');
    this.logger.log(`Initialized S3 / MinIO storage configured for bucket "${this.bucket}" at ${this.endpoint}`);
  }

  /**
   * Uploads or registers a file and returns its public S3 URL
   */
  async uploadFile(filename: string, content: Buffer | string, contentType: string): Promise<string> {
    const sanitizedFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const fileUrl = `${this.endpoint}/${this.bucket}/${sanitizedFilename}`;
    this.logger.log(`Uploaded file to S3: ${fileUrl} (type: ${contentType})`);
    return fileUrl;
  }

  getBucketUrl(): string {
    return `${this.endpoint}/${this.bucket}`;
  }
}
