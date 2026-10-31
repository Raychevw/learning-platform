-- Вирівнює склад груп із таблицею enrollments (демо-дані).
-- Ігор Бондаренко має бути в ІПЗ-412, а не в КН-301.
UPDATE enrollments
SET group_id = 'g-1'
WHERE user_id = 'usr-student-3';

UPDATE academic_groups g
SET "studentsCount" = sub.cnt,
    "studentsList" = sub.names
FROM (
    SELECT group_id,
           count(*)::int AS cnt,
           jsonb_agg(student_name ORDER BY student_name) AS names
    FROM enrollments
    GROUP BY group_id
) sub
WHERE g.id = sub.group_id;

\echo '=== ГРУПИ ПІСЛЯ СИНХРОНІЗАЦІЇ ==='
SELECT name, "studentsCount", "studentsList" FROM academic_groups ORDER BY name;
