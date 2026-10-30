/**
 * ============================================================================
 *  Baseline для существующих баз данных.
 *
 *  Сервисы теперь используют TypeORM migrations (synchronize: false) и
 *  применяют их автоматически при старте. Если БД уже содержит таблицы
 *  (например, после предыдущей версии проекта), начальную миграцию нужно
 *  пометить как применённую, иначе TypeORM попытается создать существующие
 *  таблицы.
 *
 *  Использование:
 *    npm run db:baseline            # локальный PostgreSQL (DB_PORT)
 *    npm run db:baseline:docker     # порты из docker-compose (5433..5436)
 *
 *  Свежие БД (без таблиц) скрипт пропускает — миграции создадут схему сами.
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadDotEnv() {
  const envPath = path.join(root, '.env');
  const result = {};
  if (!fs.existsSync(envPath)) return result;
  for (const raw of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1);
    result[key] = value;
  }
  return result;
}

const env = { ...loadDotEnv(), ...process.env };
const useDockerPorts = process.argv.includes('--docker');
const migration = { timestamp: 1730000000000, name: 'Init1730000000000' };

const targets = [
  { service: 'auth-service', db: env.AUTH_DB_NAME || 'auth_db', port: env.AUTH_DB_PORT || '5435' },
  { service: 'course-service', db: env.COURSE_DB_NAME || 'course_db', port: env.COURSE_DB_PORT || '5433' },
  {
    service: 'assignment-service',
    db: env.ASSIGNMENT_DB_NAME || 'assignment_db',
    port: env.ASSIGNMENT_DB_PORT || '5434',
  },
  { service: 'audit-service', db: env.AUDIT_DB_NAME || 'audit_db', port: env.AUDIT_DB_PORT || '5436' },
];

const host = env.DB_HOST || 'localhost';
const user = env.DB_USER || 'postgres';
const password = env.DB_PASSWORD || 'postgres';

let failed = 0;

for (const target of targets) {
  const port = Number(useDockerPorts ? target.port : env.DB_PORT || '5432');
  const client = new Client({ host, port, user, password, database: target.db });

  try {
    await client.connect();

    const { rows: tableRows } = await client.query(
      `SELECT count(*)::int AS count
         FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name <> 'migrations'`,
    );
    const appTables = tableRows[0]?.count ?? 0;

    if (appTables === 0) {
      console.log(`- ${target.service} (${target.db}): пустая БД, baseline не нужен`);
      continue;
    }

    await client.query(
      `CREATE TABLE IF NOT EXISTS "migrations" (
         "id" SERIAL NOT NULL,
         "timestamp" bigint NOT NULL,
         "name" character varying NOT NULL,
         CONSTRAINT "PK_migrations" PRIMARY KEY ("id")
       )`,
    );

    const { rows: existing } = await client.query('SELECT 1 FROM "migrations" WHERE "name" = $1', [
      migration.name,
    ]);
    if (existing.length > 0) {
      console.log(`- ${target.service} (${target.db}): уже помечено как применённое`);
      continue;
    }

    await client.query('INSERT INTO "migrations" ("timestamp", "name") VALUES ($1, $2)', [
      migration.timestamp,
      migration.name,
    ]);
    console.log(`- ${target.service} (${target.db}): baseline выполнен (${appTables} tables)`);
  } catch (error) {
    failed += 1;
    console.error(`- ${target.service} (${target.db}): ОШИБКА — ${error.message}`);
  } finally {
    await client.end().catch(() => undefined);
  }
}

if (failed > 0) {
  console.error(`\nBaseline завершён с ошибками: ${failed} из ${targets.length}`);
  process.exit(1);
}
console.log('\nBaseline завершён: существующие БД совместимы с миграциями.');
