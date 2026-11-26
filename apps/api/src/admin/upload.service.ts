import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { AppConfigService } from '../common/app-config.service';

const signatures: Record<string, Buffer> = {
  'image/jpeg': Buffer.from([0xff, 0xd8, 0xff]),
  'image/png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/webp': Buffer.from([0x52, 0x49, 0x46, 0x46]),
};
const extensions: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

@Injectable()
export class UploadService {
  constructor(private readonly config: AppConfigService) {}

  async save(file: Express.Multer.File | undefined): Promise<{ imageUrl: string }> {
    if (!file || !file.buffer?.length) throw new BadRequestException('Изображение обязательно');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('Максимальный размер изображения — 5 МБ');
    const signature = signatures[file.mimetype];
    if (!signature || !file.buffer.subarray(0, signature.length).equals(signature)) {
      throw new BadRequestException('Разрешены только настоящие JPG, PNG и WebP');
    }
    await mkdir(this.config.uploadDir, { recursive: true });
    const filename = `${randomUUID()}${extensions[file.mimetype]}`;
    await writeFile(join(this.config.uploadDir, filename), file.buffer, { flag: 'wx', mode: 0o640 });
    return { imageUrl: `/uploads/${filename}` };
  }
}
