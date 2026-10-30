/**
 * ============================================================================
 *  Studevo LMS — верификация архитектурных требований (лабораторная №3/№4)
 *
 *  Проверяет:
 *    1. Наличие и валидность machine-readable контрактов (/contracts)
 *    2. Database-per-service и наличие брокера/шлюза в docker-compose.yml
 *    3. Graceful degradation синхронного вызова Course Service (fallback, 2s timeout)
 *    4. Идемпотентность асинхронного consumer'а событий course.published
 *    5. (опционально) живой health-check поднятого стека через API Gateway
 *
 *  Запуск: npm run verify:lab3
 *  Требует собранных сервисов: npm run build:services
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const results = [];
let failures = 0;

function ok(message, details = '') {
  results.push({ status: 'PASS', message, details });
  console.log(`  \x1b[32m✔\x1b[0m ${message}${details ? ` \x1b[90m(${details})\x1b[0m` : ''}`);
}

function fail(message, details = '') {
  failures++;
  results.push({ status: 'FAIL', message, details });
  console.log(`  \x1b[31m✘\x1b[0m ${message}${details ? ` \x1b[90m(${details})\x1b[0m` : ''}`);
}

function section(title) {
  console.log(`\n\x1b[36m▶ ${title}\x1b[0m`);
}

async function main() {
  console.log('\n===============================================================');
  console.log('  STUDEVO LMS — АРХИТЕКТУРНАЯ ВЕРИФИКАЦИЯ');
  console.log('===============================================================');

  // ------------------------------------------------------------------ 1. contracts
  section('1. Machine-readable контракты');

  const contractDir = path.join(rootDir, 'contracts');
  const contracts = [
    { file: 'course-service-api.json', kind: 'OpenAPI' },
    { file: 'assignment-service-api.json', kind: 'OpenAPI' },
    { file: 'audit-service-api.json', kind: 'OpenAPI' },
    { file: 'events-schema.json', kind: 'JSON Schema' },
  ];

  for (const c of contracts) {
    const fullPath = path.join(contractDir, c.file);
    if (!fs.existsSync(fullPath)) {
      fail(`Отсутствует контракт ${c.file}`);
      continue;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      const title = parsed.info?.title || parsed.title || '—';
      const paths = parsed.paths ? Object.keys(parsed.paths).length : null;
      ok(`${c.kind}: ${c.file}`, paths !== null ? `${paths} endpoint(s)` : title);
    } catch (err) {
      fail(`Некорректный JSON в ${c.file}`, err.message);
    }
  }

  // ------------------------------------------------------------------ 2. compose
  section('2. Изоляция данных и топология (docker-compose.yml)');

  const composePath = path.join(rootDir, 'docker-compose.yml');
  if (!fs.existsSync(composePath)) {
    fail('docker-compose.yml не найден');
  } else {
    const compose = fs.readFileSync(composePath, 'utf8');
    const required = [
      { token: 'course-db', label: 'БД course-db (database-per-service)' },
      { token: 'assignment-db', label: 'БД assignment-db (database-per-service)' },
      { token: 'auth-db', label: 'БД auth-db (database-per-service)' },
      { token: 'audit-db', label: 'БД audit-db (database-per-service)' },
      { token: 'redis_broker', label: 'Redis-брокер событий' },
      { token: 'api-gateway', label: 'API Gateway (единая точка входа)' },
      { token: 'course-service', label: 'course-service' },
      { token: 'assignment-service', label: 'assignment-service' },
      { token: 'auth-service', label: 'auth-service' },
      { token: 'audit-service', label: 'audit-service' },
    ];
    for (const r of required) {
      if (compose.includes(r.token)) ok(r.label);
      else fail(`В compose отсутствует: ${r.label}`);
    }
  }

  // ------------------------------------------------------------------ 3. build artifacts
  section('3. Собранные артефакты сервисов');

  const artifacts = [
    'services/course-service/dist/main.js',
    'services/assignment-service/dist/main.js',
    'services/auth-service/dist/main.js',
    'services/audit-service/dist/main.js',
    'services/api-gateway/dist/main.js',
  ];
  let artifactsOk = true;
  for (const a of artifacts) {
    if (fs.existsSync(path.join(rootDir, a))) ok(a);
    else { fail(`Не собран ${a}`, 'запустите npm run build:services'); artifactsOk = false; }
  }

  if (!artifactsOk) {
    finish();
    return;
  }

  // ------------------------------------------------------------------ 4. sync fallback
  section('4. Синхронный вызов: timeout + graceful degradation');

  const courseClientUrl = pathToFileURL(
    path.join(rootDir, 'services/assignment-service/dist/infrastructure/clients/CourseServiceClient.js'),
  ).href;
  const { CourseServiceClient } = await import(courseClientUrl);

  const mockConfig = {
    get: (key, defaultValue) => (key === 'COURSE_SERVICE_URL' ? 'http://127.0.0.1:59999' : defaultValue),
  };

  const client = new CourseServiceClient(mockConfig);
  const startedAt = Date.now();
  const fallback = await client.getCourse('course-verification-test');
  const elapsed = Date.now() - startedAt;

  if (fallback.isVerified === false && fallback.isAvailable === false && fallback.fallbackNotice) {
    ok('Fallback активирован: сервис недоступен, исключения нет', `${elapsed} ms`);
  } else {
    fail('Fallback не сработал', JSON.stringify(fallback));
  }
  if (elapsed <= 3000) ok('Уложились в таймаут 2s (+ overhead)', `${elapsed} ms`);
  else fail('Таймаут не соблюдён', `${elapsed} ms`);

  // ------------------------------------------------------------------ 5. async idempotency
  section('5. Асинхронные события: подписка и идемпотентность');

  const consumerUrl = pathToFileURL(
    path.join(rootDir, 'services/assignment-service/dist/infrastructure/events/RedisEventConsumer.js'),
  ).href;
  const { RedisEventConsumer } = await import(consumerUrl);

  const saved = [];
  const mockRepo = {
    findByCourseId: async (courseId) => saved.filter((a) => a.getCourseId() === courseId),
    save: async (assignment) => { saved.push(assignment); },
  };
  const consumer = new RedisEventConsumer({ get: (_k, d) => d }, mockRepo);

  const event = JSON.stringify({
    eventId: 'evt-verification-001',
    eventType: 'course.published',
    version: '1.0',
    timestamp: new Date().toISOString(),
    data: {
      courseId: 'course-verification-test',
      title: 'Advanced Distributed Systems',
      publishedAt: new Date().toISOString(),
    },
  });

  await consumer.handleCoursePublished(event);
  if (saved.length === 1) ok('Событие обработано, assignment создан', saved[0].getTitle());
  else fail('Consumer не создал assignment', `saved=${saved.length}`);

  await consumer.handleCoursePublished(event);
  if (saved.length === 1) ok('Дубликат события проигнорирован (идемпотентность)');
  else fail('Идемпотентность нарушена', `saved=${saved.length}`);

  // ------------------------------------------------------------------ 6. live (optional)
  section('6. Живая проверка стека (если запущен)');

  const gatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:3000';

  async function tryFetch(url, timeoutMs = 2500) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      return { ok: res.ok, status: res.status, json: await res.json().catch(() => null) };
    } catch {
      return null;
    }
  }

  const health = await tryFetch(`${gatewayUrl}/health`);
  if (!health) {
    console.log('  \x1b[90m— gateway не запущен, живая проверка пропущена\x1b[0m');
  } else {
    const downstream = health.json?.downstreamServices || {};
    const up = (s) => s?.status === 'UP';
    if (health.ok) ok('API Gateway /health отвечает', `status=${health.json?.status}`);
    else fail('API Gateway /health вернул ошибку', `status=${health.status}`);

    for (const [name, info] of Object.entries(downstream)) {
      if (up(info)) ok(`downstream ${name} — UP`, info.url);
      else fail(`downstream ${name} — DOWN`, info.url);
    }

    // Каталог защищён JWT — логинимся демо-студентом.
    const demoPassword = process.env.DEMO_PASSWORD || '123456';
    let token = null;
    try {
      const loginRes = await fetch(`${gatewayUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: 'student', password: demoPassword }),
        signal: AbortSignal.timeout(5000),
      });
      const loginJson = await loginRes.json().catch(() => null);
      token = loginJson?.accessToken || null;
      if (token) ok('POST /api/auth/login выдаёт JWT', `role=${loginJson?.user?.role}`);
      else fail('Не удалось получить JWT демо-студента', `status=${loginRes.status}`);
    } catch (err) {
      fail('POST /api/auth/login недоступен', err.message);
    }

    if (token) {
      try {
        const catalogRes = await fetch(`${gatewayUrl}/api/catalog?userId=usr-student`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5000),
        });
        const catalogJson = await catalogRes.json().catch(() => null);
        if (catalogRes.ok && Array.isArray(catalogJson)) {
          ok('GET /api/catalog возвращает каталог', `${catalogJson.length} course(s)`);
        } else {
          fail('GET /api/catalog вернул неожиданный ответ', `status=${catalogRes.status}`);
        }
      } catch (err) {
        fail('GET /api/catalog недоступен', err.message);
      }

      const noAuth = await fetch(`${gatewayUrl}/api/catalog`, { signal: AbortSignal.timeout(5000) });
      if (noAuth.status === 401) ok('GET /api/catalog без токена отклонён (401)');
      else fail('Каталог доступен без авторизации', `status=${noAuth.status}`);
    }

    // Аудит: логин уже породил событие, читаем его админом (с небольшим retry).
    try {
      const adminLogin = await fetch(`${gatewayUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: 'admin', password: demoPassword }),
        signal: AbortSignal.timeout(5000),
      });
      const adminJson = await adminLogin.json().catch(() => null);
      const adminToken = adminJson?.accessToken;
      if (!adminToken) {
        fail('Не удалось войти администратором для проверки аудита');
      } else {
        let auditOk = false;
        let auditStatus = 0;
        for (let attempt = 0; attempt < 5 && !auditOk; attempt++) {
          const auditRes = await fetch(`${gatewayUrl}/api/audit/logs?limit=10`, {
            headers: { Authorization: `Bearer ${adminToken}` },
            signal: AbortSignal.timeout(5000),
          });
          auditStatus = auditRes.status;
          const auditJson = await auditRes.json().catch(() => null);
          if (auditRes.ok && Array.isArray(auditJson?.items)) {
            auditOk = true;
            ok('GET /api/audit/logs доступен админу', `${auditJson.items.length} event(s)`);
          } else {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
        if (!auditOk) fail('GET /api/audit/logs не вернул журнал', `status=${auditStatus}`);
      }
    } catch (err) {
      fail('Проверка аудита не удалась', err.message);
    }
  }

  finish();
}

function finish() {
  console.log('\n===============================================================');
  if (failures === 0) {
    console.log(`  \x1b[32m✔ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ (${results.length})\x1b[0m`);
    console.log('===============================================================\n');
    process.exit(0);
  }
  console.log(`  \x1b[31m✘ ПРОВАЛЕНО ПРОВЕРОК: ${failures} из ${results.length}\x1b[0m`);
  console.log('===============================================================\n');
  process.exit(1);
}

main().catch((err) => {
  console.error('\n\x1b[31mКритическая ошибка верификации:\x1b[0m', err);
  process.exit(1);
});
