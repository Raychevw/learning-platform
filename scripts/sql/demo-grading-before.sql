\echo '=== СТАН ДО ОЦІНЮВАННЯ ==='
\echo ''
\echo '--- Робота sub-2 (Марина Шевченко) ---'
SELECT id, "studentName", "group_name", status, score, "is_late"
FROM submissions
WHERE id = 'sub-2';

\echo ''
\echo '--- Чи є вже оцінка для sub-2? ---'
SELECT id, "studentName", "finalScore", rule
FROM grades
WHERE "submissionId" = 'sub-2';

\echo ''
\echo '--- Скільки робіт у кожному статусі ---'
SELECT status, count(*) AS works
FROM submissions
GROUP BY status
ORDER BY status;
