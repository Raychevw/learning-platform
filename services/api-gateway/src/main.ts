import express, { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Readable } from 'node:stream';

// ============================================================================
//  API Gateway — единая точка входа.
//  Отвечает за: CORS-whitelist, проверку JWT, инъекцию доверенных заголовков
//  x-user-*, rate-limit логина, маршрутизацию и корреляцию запросов.
// ============================================================================

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT || 3000);
const COURSE_SERVICE_URL = process.env.COURSE_SERVICE_URL || 'http://localhost:3001';
const ASSIGNMENT_SERVICE_URL = process.env.ASSIGNMENT_SERVICE_URL || 'http://localhost:3002';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3003';
const AUDIT_SERVICE_URL = process.env.AUDIT_SERVICE_URL || 'http://localhost:3004';
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_super_long_random_secret_at_least_32_chars';
const AUDIT_INGEST_TOKEN = process.env.AUDIT_INGEST_TOKEN || JWT_SECRET;

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8080')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// ----------------------------------------------------------------- CORS
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Expose-Headers', 'X-Request-Id');
  res.header('Access-Control-Max-Age', '86400');
  res.header('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// ----------------------------------------------------------------- request id + logging + audit
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startedAt = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - startedAt;
    const who = (req as any).user?.role ? ` role=${(req as any).user.role}` : '';
    console.log(`[GATEWAY] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${ms}ms${who} rid=${requestId}`);
    void sendAudit(req, res);
  });
  next();
});

/** Аудит пишется только для изменяющих запросов и отказов — без чтения и без паролей. */
async function sendAudit(req: Request, res: Response): Promise<void> {
  if (!AUDIT_SERVICE_URL || !req.originalUrl.startsWith('/api')) return;

  const statusCode = res.statusCode;
  const isMutation = req.method !== 'GET';
  const isDenied = statusCode === 401 || statusCode === 403;
  const isError = statusCode >= 500;
  if (!isMutation && !isDenied && !isError) return;

  const user = (req as any).user as { sub?: string; role?: string; name?: string } | undefined;
  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  const login = typeof body.login === 'string' ? body.login : '';
  const cleanPath = req.originalUrl.split('?')[0];
  const resource = cleanPath.replace(/^\/api\/?/, '').split('/')[0] || 'api';

  const payload = {
    userId: user?.sub || 'anonymous',
    userRole: user?.role || '',
    userName: user?.name || login || '',
    action: `${req.method} ${cleanPath}`.slice(0, 128),
    resource,
    method: req.method,
    path: req.originalUrl.slice(0, 512),
    statusCode,
    status: statusCode < 400 ? 'ALLOWED' : isDenied ? 'DENIED' : 'ERROR',
    ip: (req.ip || '').slice(0, 64),
    requestId: String((req as any).requestId || '').slice(0, 64),
  };

  try {
    const response = await fetch(`${AUDIT_SERVICE_URL}/audit/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-audit-secret': AUDIT_INGEST_TOKEN },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) {
      console.warn(`[AUDIT] ingest rejected with status ${response.status}`);
    }
  } catch (error) {
    // Аудит не должен влиять на основной запрос.
    console.warn(`[AUDIT] ingest failed: ${(error as Error).message}`);
  }
}

// ----------------------------------------------------------------- auth
const PUBLIC_API_PATHS = new Set(['/auth/login']);

/** Убираем любые клиентские попытки выдать себя за другого пользователя. */
function stripIdentityHeaders(req: Request) {
  delete req.headers['x-user-id'];
  delete req.headers['x-user-role'];
  delete req.headers['x-user-email'];
  delete req.headers['x-user-name'];
}

interface LoginBucket {
  count: number;
  resetAt: number;
}
const loginAttempts = new Map<string, LoginBucket>();
const LOGIN_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 20;

function loginRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = loginAttempts.get(ip);
  if (!bucket || bucket.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > LOGIN_MAX_ATTEMPTS;
}

app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  stripIdentityHeaders(req);

  const path = req.path;
  if (PUBLIC_API_PATHS.has(path)) {
    if (path === '/auth/login' && req.method === 'POST' && loginRateLimited(req.ip || 'unknown')) {
      res.status(429).json({
        statusCode: 429,
        message: 'Забагато спроб входу. Спробуйте пізніше.',
        error: 'Too Many Requests',
      });
      return;
    }
    next();
    return;
  }

  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ statusCode: 401, message: 'Потрібна авторизація', error: 'Unauthorized' });
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7).trim(), JWT_SECRET) as jwt.JwtPayload;
    if (!payload.sub || !payload.role) throw new Error('Malformed token payload');

    (req as any).user = payload;
    req.headers['x-user-id'] = String(payload.sub);
    req.headers['x-user-role'] = String(payload.role);
    if (payload.email) req.headers['x-user-email'] = String(payload.email);
    // HTTP-заголовки обязаны быть ASCII — имя может содержать кириллицу.
    if (payload.name) req.headers['x-user-name'] = encodeURIComponent(String(payload.name));
    next();
  } catch {
    res.status(401).json({ statusCode: 401, message: 'Недійсний або прострочений токен', error: 'Unauthorized' });
  }
});

// ----------------------------------------------------------------- health
async function checkDownstream(name: string, url: string) {
  try {
    const resp = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1500) });
    return { name, url, status: resp.ok ? 'UP' : 'DOWN', httpStatus: resp.status };
  } catch {
    return { name, url, status: 'DOWN', httpStatus: null };
  }
}

async function healthPayload() {
  const [course, assignment, auth, audit] = await Promise.all([
    checkDownstream('courseService', COURSE_SERVICE_URL),
    checkDownstream('assignmentService', ASSIGNMENT_SERVICE_URL),
    checkDownstream('authService', AUTH_SERVICE_URL),
    checkDownstream('auditService', AUDIT_SERVICE_URL),
  ]);
  const services = [course, assignment, auth, audit];
  return {
    status: 'UP',
    gateway: { port: PORT, status: 'HEALTHY' },
    downstreamServices: Object.fromEntries(services.map((s) => [s.name, s])),
    timestamp: new Date().toISOString(),
  };
}

app.get('/health', async (_req: Request, res: Response) => {
  res.json(await healthPayload());
});
app.get('/api/health', async (_req: Request, res: Response) => {
  res.json(await healthPayload());
});

// ----------------------------------------------------------------- root registry
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Studevo API Gateway',
    version: '2.0.0',
    auth: 'POST /api/auth/login -> JWT; все /api/* требуют Authorization: Bearer <token>',
    endpoints: {
      health: 'GET /health',
      auth: 'POST /api/auth/login, GET /api/auth/me, GET|POST /api/auth/users',
      catalog: 'GET|POST /api/catalog, POST /api/catalog/:courseId/modules, POST /api/catalog/modules/:moduleId/lessons, POST /api/catalog/lessons/:lessonId/toggle',
      courses: 'GET /api/courses, GET /api/courses/:id, POST /api/courses, POST /api/courses/:id/publish',
      assignments: 'GET|POST /api/assignments-full, POST /api/assignments/:id/submit, GET /api/assignments',
      grading: 'POST /api/grading/grade, GET /api/grades',
      groups: 'GET|POST /api/groups, POST /api/groups/:id/toggle-course, POST|DELETE /api/groups/:id/students',
      webinars: 'GET|POST /api/webinars, PATCH /api/webinars/:id/status, POST /api/webinars/:id/chat, DELETE /api/webinars/:id',
    },
  });
});

// ----------------------------------------------------------------- proxy
async function proxyRequest(targetUrl: string, req: Request, res: Response) {
  const requestId = (req as any).requestId || crypto.randomUUID();
  try {
    const incomingContentType = String(req.headers['content-type'] || '');
    const isMultipart = incomingContentType.startsWith('multipart/form-data');
    const acceptsSse =
      String(req.headers.accept || '').includes('text/event-stream') ||
      req.originalUrl.includes('/stream');

    const headers: Record<string, string> = {
      'X-Request-Id': requestId,
    };

    // Content-Type пробрасываем как есть: для multipart там критичен boundary.
    if (incomingContentType) headers['content-type'] = incomingContentType;
    else headers['Content-Type'] = 'application/json';
    // Content-Length пробрасываем только для multipart (тело не пересобирается).
    // Для JSON тело сериализуется заново, и длина может отличаться — пусть её считает fetch.
    if (isMultipart && req.headers['content-length']) {
      headers['content-length'] = String(req.headers['content-length']);
    }

    if (req.headers.authorization) headers.authorization = req.headers.authorization;
    for (const name of ['x-user-id', 'x-user-role', 'x-user-email', 'x-user-name']) {
      const value = req.headers[name];
      if (value) headers[name] = String(value);
    }

    const fetchOptions: RequestInit & { duplex?: 'half' } = {
      method: req.method,
      headers,
      // SSE-соединение живёт долго — таймаут для него не ставим.
      ...(acceptsSse ? {} : { signal: AbortSignal.timeout(isMultipart ? 60_000 : 15_000) }),
    };

    if (isMultipart) {
      // Стримим тело запроса вниз, не буферизуя файл в памяти gateway.
      fetchOptions.body = Readable.toWeb(req) as unknown as ReadableStream;
      fetchOptions.duplex = 'half';
    } else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type') || '';
    res.status(response.status);

    // SSE: не буферизуем, сразу отдаём поток клиенту.
    if (contentType.includes('text/event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();

      if (!response.body) {
        res.end();
        return;
      }

      const upstream = Readable.fromWeb(response.body as unknown as import('node:stream/web').ReadableStream);
      upstream.pipe(res);
      req.on('close', () => {
        upstream.destroy();
        response.body?.cancel().catch(() => undefined);
      });
      return;
    }

    if (contentType.includes('application/json')) {
      res.json(await response.json());
      return;
    }

    // Бинарные ответы (скачивание файлов) пробрасываем с заголовками.
    const disposition = response.headers.get('content-disposition');
    if (disposition) res.setHeader('Content-Disposition', disposition);
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    console.error(`[GATEWAY ERROR] ${req.method} ${targetUrl}: ${(error as Error).message} rid=${requestId}`);
    if (!res.headersSent) {
      res.status(502).json({
        statusCode: 502,
        error: 'Bad Gateway',
        message: `Сервис недоступен: ${targetUrl}`,
        requestId,
      });
    }
  }
}

function mountProxy(prefix: string, targetBase: string, rewriteFrom: string, rewriteTo: string) {
  app.all(`${prefix}*`, (req: Request, res: Response) => {
    const targetPath = req.originalUrl.replace(rewriteFrom, rewriteTo);
    proxyRequest(`${targetBase}${targetPath}`, req, res);
  });
}

// Auth
mountProxy('/api/auth', AUTH_SERVICE_URL, '/api/auth', '/auth');
// Course service
mountProxy('/api/courses', COURSE_SERVICE_URL, '/api/courses', '/courses');
mountProxy('/api/catalog', COURSE_SERVICE_URL, '/api/catalog', '/catalog');
mountProxy('/api/webinars', COURSE_SERVICE_URL, '/api/webinars', '/webinars');
// Assignment service
mountProxy('/api/assignments', ASSIGNMENT_SERVICE_URL, '/api/assignments', '/assignments');
mountProxy('/api/grading', ASSIGNMENT_SERVICE_URL, '/api/grading', '/grading');
mountProxy('/api/grades', ASSIGNMENT_SERVICE_URL, '/api/grades', '/grades');
mountProxy('/api/groups', ASSIGNMENT_SERVICE_URL, '/api/groups', '/groups');
mountProxy('/api/enrollments', ASSIGNMENT_SERVICE_URL, '/api/enrollments', '/enrollments');
mountProxy('/api/submissions', ASSIGNMENT_SERVICE_URL, '/api/submissions', '/submissions');
mountProxy('/api/students', ASSIGNMENT_SERVICE_URL, '/api/students', '/students');
mountProxy('/api/audit', AUDIT_SERVICE_URL, '/api/audit', '/audit');

// ----------------------------------------------------------------- fallbacks
app.use('/api', (req: Request, res: Response) => {
  res.status(404).json({ statusCode: 404, message: `Маршрут ${req.method} ${req.originalUrl} не найден` });
});

app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;

  // Битый JSON от клиента — это 400, а не 500.
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400)) {
    res.status(400).json({ statusCode: 400, message: 'Некоректний JSON у тілі запиту' });
    return;
  }
  if (err.status && err.status >= 400 && err.status < 500) {
    res.status(err.status).json({ statusCode: err.status, message: err.message });
    return;
  }

  console.error('[GATEWAY UNHANDLED]', err.message);
  res.status(500).json({ statusCode: 500, message: 'Внутренняя ошибка шлюза' });
});

const server = app.listen(PORT, () => {
  console.log(`[API GATEWAY] Running on http://localhost:${PORT}`);
  console.log(`[API GATEWAY] auth       -> ${AUTH_SERVICE_URL}`);
  console.log(`[API GATEWAY] catalog    -> ${COURSE_SERVICE_URL}`);
  console.log(`[API GATEWAY] assignments-> ${ASSIGNMENT_SERVICE_URL}`);
  console.log(`[API GATEWAY] CORS origins: ${ALLOWED_ORIGINS.join(', ')}`);
});

function shutdown(signal: string) {
  console.log(`[API GATEWAY] ${signal} received, shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
