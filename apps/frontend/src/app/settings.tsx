import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { C } from '../theme';
import { back } from '../lib/navigation';
import { authError } from '../lib/emailAuth';
import { changePassword as updatePassword } from '../lib/api';
import { passwordRules } from '../lib/authValidation';
import { useStore } from '../state/AppStore';
import { Button, Divider, Field, Header, Icon, Notice, Page, T } from '../components/UI';
export default function Settings() {
  const store = useStore();
  const [draft, setDraft] = useState(store.settings || { phone: '', newsletter_opt_in: false });
  const [password, setPassword] = useState('');
  const [current, setCurrent] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function act(action: () => Promise<void>, success: string) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); setMessage(success); } catch (e) { setError(authError(e)); } finally { setBusy(false); }
  }
  async function changePassword() {
    if (!passwordRules(password).every(r => r.valid) || repeat !== password) throw new Error('Перевірте вимоги до пароля та його повтор.');
    await updatePassword(current, password);
    setCurrent(''); setPassword(''); setRepeat('');
  }
  return <Page bottom><Header title="Налаштування акаунта" onBack={back} /><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 22 }}>
    <T weight="bold" style={{ fontSize: 20, marginBottom: 16 }}>Контакти та новини</T>
    <T selectable style={{ color: C.muted, marginBottom: 18 }}>{store.email || 'Локальний профіль · email не прив’язаний'}</T>
    <Field label="Номер телефону (необов’язково)" accessibilityLabel="Номер телефону" keyboardType="phone-pad" maxLength={24} value={draft.phone} onChangeText={phone => setDraft(p => ({ ...p, phone }))} editable={!busy} />
    <Notice>Номер зберігається приватно. Він не показується у профілі й не вважається підтвердженим.</Notice>
    <Pressable accessibilityRole="checkbox" aria-checked={draft.newsletter_opt_in} accessibilityState={{ checked: draft.newsletter_opt_in }} disabled={busy} onPress={() => setDraft(p => ({ ...p, newsletter_opt_in: !p.newsletter_opt_in }))} style={{ flexDirection: 'row', gap: 12, paddingVertical: 16 }}><Icon name={draft.newsletter_opt_in ? 'check-square' : 'square'} color={C.lime} /><T style={{ flex: 1 }}>Хочу отримувати новини Kladka.UA електронною поштою</T></Pressable>
    <Button title="Зберегти налаштування" busy={busy} onPress={() => { void act(() => store.saveSettings(draft), 'Налаштування збережено.'); }} />
    <Divider /><T weight="bold" style={{ fontSize: 20, marginBottom: 16 }}>Безпека</T>
    {store.remote ? <><Field label="Поточний пароль" accessibilityLabel="Поточний пароль" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" editable={!busy} /><Field label="Новий пароль" accessibilityLabel="Новий пароль" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" editable={!busy} /><T style={{ color: C.muted, marginBottom: 16 }}>Від 9 символів, велика й мала літери, мінімум одна цифра.</T><Field label="Повтор нового пароля" value={repeat} onChangeText={setRepeat} secureTextEntry autoCapitalize="none" editable={!busy} /><Button title="Змінити пароль" variant="secondary" busy={busy} disabled={!current || !passwordRules(password).every(r => r.valid) || password !== repeat} onPress={() => { void act(changePassword, 'Пароль змінено.'); }} /><T style={{ color: C.muted, fontSize: 12, marginTop: 12 }}>Якщо пароль забутий або ви входили через соцмережу, скористайтеся відновленням на екрані входу.</T></> : <Notice>У локальному режимі пароль не створюється. Дані зберігаються тільки на цьому пристрої.</Notice>}
    <Divider /><T weight="bold" style={{ fontSize: 20, marginBottom: 16 }}>Документи та підтримка</T>
    {([{ title: 'Умови використання', url: process.env.EXPO_PUBLIC_TERMS_URL }, { title: 'Політика приватності', url: process.env.EXPO_PUBLIC_PRIVACY_URL }, { title: 'Написати підтримці', url: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ? 'mailto:' + process.env.EXPO_PUBLIC_SUPPORT_EMAIL : undefined }]).map(item => <View key={item.title} style={{ marginBottom: 10 }}><Button title={item.title} variant="secondary" disabled={busy} onPress={() => { void act(async () => { if (!item.url) throw new Error('Цей розділ ще готується до публікації.'); await Linking.openURL(item.url); }, ''); }} /></View>)}
    {error ? <T accessibilityRole="alert" style={{ color: C.danger, marginVertical: 16 }}>{error}</T> : null}
    {message ? <T accessibilityLiveRegion="polite" style={{ color: C.lime, marginVertical: 16 }}>{message}</T> : null}
  </ScrollView></Page>;
}
