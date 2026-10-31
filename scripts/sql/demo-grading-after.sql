\echo '=== СТАН ПІСЛЯ ОЦІНЮВАННЯ ==='
\echo ''
\echo '--- Робота sub-2: статус і бал ---'
SELECT id, "studentName", "group_name", status, score, "is_late"
FROM submissions
WHERE id = 'sub-2';

\echo ''
\echo '--- Новий запис у журналі оцінок ---'
SELECT id, "studentName", "finalScore", "maxScore", rule, "criteriaScores"
FROM grades
WHERE "submissionId" = 'sub-2';

\echo ''
\echo '--- Скільки робіт у кожному статусі ---'
SELECT status, count(*) AS works
FROM submissions
GROUP BY status
ORDER BY status;
