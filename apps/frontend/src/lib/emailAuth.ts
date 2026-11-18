import { api, setSession, type ApiSession } from './api';
import { passwordRules, validEmail } from './authValidation';
export const termsUrl = process.env.EXPO_PUBLIC_TERMS_URL || '';
const allowInsecureTerms = process.env.EXPO_PUBLIC_ALLOW_INSECURE_TERMS === 'true';
export function requireTerms() {
  const local = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.)/i.test(termsUrl);
  if (!/^https:\/\//i.test(termsUrl) && !(local && allowInsecureTerms)) throw new Error('Умови використання ще не опубліковані. Реєстрація стане доступною після їх налаштування.');
}
export async function emailLogin(email: string, password: string) {
  if (!validEmail(email) || !password) throw new Error('Введіть email і пароль.');
  await setSession(await api<ApiSession>('/api/auth/login', { method: 'POST', authenticated: false, body: { email: email.trim(), password } }));
}
export async function emailSignup(email: string, password: string, name: string, news: boolean) {
  requireTerms(); if (!validEmail(email) || !passwordRules(password).every(r => r.valid)) throw new Error('Перевірте email і вимоги до пароля.');
  await api('/api/auth/register', { method: 'POST', authenticated: false, body: { email: email.trim(), password, name: name.trim(), news } }); return false;
}
export async function confirmEmail(email: string, token: string, password: string) {
  await setSession(await api<ApiSession>('/api/auth/confirm', { method: 'POST', authenticated: false, body: { email: email.trim(), code: token.trim(), password } }));
}
export async function resendConfirmation(email: string) { await api('/api/auth/resend', { method: 'POST', authenticated: false, body: { email: email.trim() } }); }
export function authError(error: unknown) { return error instanceof Error ? error.message : 'Не вдалося виконати дію. Спробуйте ще раз.'; }
