// ============================================================================
//  HTTP-клиент платформы.
//  - В dev и prod работает с относительным /api (Vite proxy / nginx).
//  - Автоматически прикладывает Bearer-токен.
//  - Приводит ошибки к единому ApiError с человекочитаемым сообщением.
//  - При 401 рассылает событие studevo:unauthorized (см. useAuth).
// ============================================================================

export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
export const TOKEN_KEY = 'studevo_access_token';

const DEFAULT_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  constructor(message, status = 0, payload = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* приватный режим браузера — работаем без сохранения */
  }
}

export async function request(path, options = {}) {
  const {
    method = 'GET',
    body,
    auth = true,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
  } = options;

  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });

  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent('studevo:unauthorized'));
      }
      const rawMessage =
        (data && typeof data === 'object' && (data.message || data.error)) || `Помилка запиту (${response.status})`;
      const message = Array.isArray(rawMessage) ? rawMessage.join('; ') : String(rawMessage);
      throw new ApiError(message, response.status, data);
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === 'AbortError') {
      throw new ApiError('Сервер не відповів вчасно. Перевірте з’єднання.', 0, null);
    }
    throw new ApiError('Не вдалося з’єднатися з сервером. Увімкнено демонстраційний режим.', 0, null);
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  login: (login, password) => request('/api/auth/login', { method: 'POST', body: { login, password }, auth: false }),
  me: () => request('/api/auth/me'),
  health: () => request('/health', { auth: false }),
};
