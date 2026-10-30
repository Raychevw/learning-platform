import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

export const MAX_SUBMISSION_BYTES = 25 * 1024 * 1024;

/** Разрешённые типы файлов для сдачи работ и материалов. */
export const ALLOWED_SUBMISSION_MIME = new Set([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export const submissionMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_SUBMISSION_BYTES, files: 1 },
  fileFilter: (_req: unknown, file: { mimetype: string }, callback: (error: Error | null, accept: boolean) => void) => {
    if (!ALLOWED_SUBMISSION_MIME.has(file.mimetype)) {
      callback(
        new BadRequestException(
          `Непідтримуваний тип файлу: ${file.mimetype}. Дозволено PDF, DOC/DOCX, ZIP, PPTX, TXT/MD, PNG/JPEG.`,
        ),
        false,
      );
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

/** Безопасное имя файла для ключа в хранилище. */
export function safeFileName(original: string): string {
  const base = (original || 'file').split(/[\\/]/).pop() || 'file';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
}
