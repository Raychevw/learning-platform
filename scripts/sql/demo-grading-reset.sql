-- Повертає роботу sub-2 у стан «на перевірці» після демонстрації.
DELETE FROM grades
WHERE "submissionId" = 'sub-2';

UPDATE submissions
SET status = 'READY_FOR_GRADING',
    score = NULL
WHERE id = 'sub-2';

\echo '=== ПІСЛЯ СКИДАННЯ ==='
SELECT id, status, score
FROM submissions
WHERE id = 'sub-2';
