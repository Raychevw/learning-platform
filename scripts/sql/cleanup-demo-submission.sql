-- Повертає демо-здачу sub-prev-2 до початкового вигляду
-- (раніше використовувалась для тесту завантаження файлу).
UPDATE submissions
SET "fileName" = 'Практична_1_Петренко_ІПЗ412.pdf',
    "fileSize" = '0.9 МБ',
    "fileKey" = NULL,
    "mimeType" = NULL,
    "submittedAt" = '2026-10-09T14:00:00+03:00',
    is_late = false,
    status = 'GRADED',
    score = 97
WHERE id = 'sub-prev-2';

\echo '=== ДЕМО-ЗДАЧА sub-prev-2 ==='
SELECT id, "fileName", "fileSize", "submittedAt", is_late, status, score
FROM submissions
WHERE id = 'sub-prev-2';
