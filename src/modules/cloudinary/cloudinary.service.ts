import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private configService: AppConfigService) {
    cloudinary.config({
      cloud_name: this.configService.cloudinaryConfig.cloudName,
      api_key: this.configService.cloudinaryConfig.apiKey,
      api_secret: this.configService.cloudinaryConfig.apiSecret,
    });
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'profiles',
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          transformation: [{ width: 500, height: 500, crop: 'limit' }],
        },
        (error, result) => {
          if (error) {
            this.logger.error('Cloudinary upload error:', error);
            reject(error);
            return;
          }
          if (!result) {
            reject(new Error('Cloudinary upload failed'));
            return;
          }
          resolve(result.secure_url);
        },
      );
      uploadStream.end(file.buffer);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    if (!publicId.startsWith('profiles/')) {
      this.logger.warn(
        `Rejected deletion of publicId outside allowed prefix: ${publicId}`,
      );
      return;
    }
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      this.logger.error('Cloudinary delete error:', error);
    }
  }

  getPublicIdFromUrl(url: string): string | null {
    try {
      const parts = url.split('/');
      const uploadIndex = parts.findIndex((p) => p === 'upload');
      if (uploadIndex === -1) return null;
      const afterUpload = parts.slice(uploadIndex + 2).join('/');
      const publicId = afterUpload.replace(/\.[^/.]+$/, '');
      return publicId;
    } catch {
      return null;
    }
  }
}
