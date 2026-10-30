import { useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../api/client.js';

/** Приводит пользователя из auth-service к форме, привычной UI. */
function mapUser(user) {
  const role = String(user?.role || 'STUDENT').toLowerCase();
  const name = user?.fullName || user?.name || user?.email || 'Користувач';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return {
    id: user?.id,
    email: user?.email,
    username: user?.username,
    name,
    role,
    dept: user?.department || '',
    initials,
  };
}

/**
 * Состояние аутентификации: JWT в localStorage, профиль из /api/auth/me.
 * Автоматически разлогинивает при 401 от любого запроса.
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(() => Boolean(getToken()));

  useEffect(() => {
    let cancelled = false;
    if (!getToken()) return;
    api
      .me()
      .then((profile) => {
        if (!cancelled && profile) setUser(mapUser(profile));
      })
      .catch(() => {
        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener('studevo:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('studevo:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async (loginValue, password) => {
    const result = await api.login(loginValue, password);
    setToken(result.accessToken);
    const mapped = mapUser(result.user);
    setUser(mapped);
    return mapped;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return { user, booting, login, logout };
}
