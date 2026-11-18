import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');
export const hasBackend = Boolean(API_URL) || Platform.OS === 'web';
export type ApiUser = { id: string; email: string };
export type ApiSession = { token: string; user: ApiUser };
export class ApiError extends Error { constructor(message: string, public status: number, public code?: string) { super(message); } }
let session: ApiSession | null = null;
let loaded: Promise<ApiSession | null> | undefined;
const listeners = new Set<(session: ApiSession | null) => void>();
const KEY = 'kladka.api-session.v1';
const storage = Platform.OS === 'web' ? AsyncStorage : {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};
export async function loadSession() {
  return loaded ||= storage.getItem(KEY).then(raw => {
    if (raw) { try { const value = JSON.parse(raw); if (typeof value.token === 'string' && value.user?.id) session = value; } catch { /* Invalid saved session is ignored. */ } }
    return session;
  });
}
export async function setSession(value: ApiSession | null) {
  if (value) await storage.setItem(KEY, JSON.stringify(value)); else await storage.removeItem(KEY);
  session = value; loaded = Promise.resolve(value); listeners.forEach(fn => fn(value));
}
export function onSession(fn: (session: ApiSession | null) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export async function api<T = { ok: boolean }>(path: string, options: { method?: string; body?: unknown; authenticated?: boolean } = {}): Promise<T> {
  if (!API_URL && Platform.OS !== 'web') throw new ApiError('Адресу сервера ще не налаштовано.', 503);
  const active = await loadSession();
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch((API_URL || '') + path, { method: options.method || 'GET', headers: { Accept: 'application/json', ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(options.authenticated !== false && active ? { Authorization: 'Bearer ' + active.token } : {}) }, body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: controller.signal });
    const raw = await response.text();
    let data: { error?: string; code?: string };
    try { data = JSON.parse(raw); } catch { throw new ApiError('Сервер запускається або повернув неправильну відповідь. Повторіть за хвилину.', response.status); }
    if (!response.ok) {
      if (response.status === 401 && options.authenticated !== false && active && session?.token === active.token) await setSession(null);
      throw new ApiError(data.error || 'Не вдалося виконати запит.', response.status, data.code);
    }
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('Немає відповіді від сервера. Перевірте інтернет і повторіть: безкоштовний сервер може запускатися до хвилини.', 0);
  } finally { clearTimeout(timer); }
}
export async function logout() { try { await api('/api/auth/logout', { method: 'POST' }); } finally { await setSession(null); } }
export async function changePassword(current_password: string, password: string) { await api('/api/auth/password', { method: 'POST', body: { current_password, password } }); }
