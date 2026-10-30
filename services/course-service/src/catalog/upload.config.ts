import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

export const MAX_MATERIAL_BYTES = 60 * 1024 * 1024;

export const ALLOWED_MATERIAL_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

export const materialMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_MATERIAL_BYTES, files: 1 },
  fileFilter: (_req: unknown, file: { mimetype: string }, callback: (error: Error | null, accept: boolean) => void) => {
    if (!ALLOWED_MATERIAL_MIME.has(file.mimetype)) {
      callback(
        new BadRequestException(
          `Непідтримуваний тип матеріалу: ${file.mimetype}. Дозволено PDF, DOC/DOCX, PPT/PPTX, ZIP, TXT/MD, зображення, MP4/WEBM.`,
        ),
        false,
      );
      return;
    }
    callback(null, true);
  },
};

export const MAX_RECORDING_BYTES = 200 * 1024 * 1024;

const RECORDING_MIME = new Set(['video/webm', 'video/mp4', 'video/quicktime']);

export const recordingMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_RECORDING_BYTES, files: 1 },
  fileFilter: (_req: unknown, file: { mimetype: string }, callback: (error: Error | null, accept: boolean) => void) => {
    if (!RECORDING_MIME.has(file.mimetype)) {
      callback(new BadRequestException('Запис має бути у форматі WEBM або MP4'), false);
      return;
    }
    callback(null, true);
  },
};

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${bytes} Б`;
}

export function safeFileName(original: string): string {
  const base = (original || 'file').split(/[\\/]/).pop() || 'file';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
}
