import { api } from './api';
export async function sendRecovery(email: string) { await api('/api/auth/recovery', { method: 'POST', authenticated: false, body: { email: email.trim() } }); }
export async function finishRecovery(email: string, code: string, password: string) { await api('/api/auth/reset', { method: 'POST', authenticated: false, body: { email: email.trim(), code: code.trim(), password } }); }
