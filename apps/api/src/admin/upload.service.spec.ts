import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { AppConfigService } from '../common/app-config.service';
import { UploadService } from './upload.service';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function service(): Promise<{ service: UploadService; directory: string }> {
  const directory = await mkdtemp(join(tmpdir(), 'cvetotishina-upload-'));
  directories.push(directory);
  return { service: new UploadService({ uploadDir: directory } as AppConfigService), directory };
}

function pngFile(): Express.Multer.File {
  return {
    fieldname: 'image',
    originalname: 'image.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 8,
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    destination: '',
    filename: '',
    path: '',
    stream: null as never,
  };
}

describe('UploadService', () => {
  it('сохраняет изображение с безопасным случайным именем', async () => {
    const context = await service();
    const result = await context.service.save(pngFile());
    assert.match(result.imageUrl, /^\/uploads\/[a-f0-9-]+\.png$/);
    const file = await readFile(join(context.directory, result.imageUrl.split('/').at(-1)!));
    assert.equal(file.equals(pngFile().buffer), true);
  });

  it('отклоняет поддельный MIME-тип', async () => {
    const context = await service();
    const file = { ...pngFile(), buffer: Buffer.from('not an image') };
    await assert.rejects(context.service.save(file), /настоящие JPG/);
  });

  it('требует файл', async () => {
    const context = await service();
    await assert.rejects(context.service.save(undefined), /обязательно/);
  });
});
