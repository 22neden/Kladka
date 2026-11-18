import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import { createUuid } from './uuid';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { File } from 'expo-file-system';
import { api, hasBackend, setSession, type ApiSession } from './api';
WebBrowser.maybeCompleteAuthSession();
const exchanges = new Map<string, Promise<void>>();
export async function completeOAuthCode(code: string) {
  if (!exchanges.has(code)) exchanges.set(code, (async () => {
    const verifier = await AsyncStorage.getItem('kladka.oauth-verifier');
    if (!verifier) throw new Error('Спроба входу прострочена. Почніть вхід знову.');
    const result = await api<ApiSession>('/api/auth/oauth/exchange', { method: 'POST', authenticated: false, body: { code, verifier } });
    await AsyncStorage.removeItem('kladka.oauth-verifier'); await setSession(result);
  })());
  return exchanges.get(code)!;
}
export async function signIn(provider: 'google' | 'facebook') {
  if (!hasBackend) throw new Error('Сервіс входу ще не підключено.');
  if (Platform.OS !== 'web' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) throw new Error('У Expo Go використовуйте email. Google/Facebook доступні у вебверсії та власній збірці застосунку.');
  const verifier = createUuid() + createUuid();
  await AsyncStorage.setItem('kladka.oauth-verifier', verifier);
  const challenge = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier);
  const redirect = AuthSession.makeRedirectUri({ scheme: 'onlyconstructions', path: 'auth/callback' });
  const result = await api<{ url: string }>('/api/auth/oauth/start', { method: 'POST', authenticated: false, body: { provider, redirect, challenge } });
  if (Platform.OS === 'web') { window.location.assign(result.url); return; }
  const opened = await WebBrowser.openAuthSessionAsync(result.url, redirect);
  if (opened.type !== 'success') return;
  const callback = new URL(opened.url); const code = callback.searchParams.get('code');
  if (!code) throw new Error(callback.searchParams.get('error_description') || 'Вхід скасовано.');
  await completeOAuthCode(code);
}
export async function uploadPhoto(uri: string, folder: string, bucket: 'portfolio' | 'chat-images') {
  if (!hasBackend) return uri;
  let base64: string;
  if (Platform.OS === 'web') {
    if (uri.startsWith('data:')) base64 = uri.split(',')[1];
    else {
      const blob = await (await fetch(uri)).blob();
      base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
    }
  } else base64 = await new File(uri).base64();
  const result = await api<{ id: string; url: string | null }>('/api/media', { method: 'POST', body: { base64, visibility: bucket === 'portfolio' ? 'public' : 'private', conversation_id: bucket === 'chat-images' ? folder.split('/')[0] : undefined } });
  return bucket === 'portfolio' ? result.url! : result.id;
}
export async function chatImageUrl(path: string) { if (!hasBackend) return path; const result = await api<{ url: string }>('/api/media/' + encodeURIComponent(path) + '/ticket', { method: 'POST' }); return result.url; }
