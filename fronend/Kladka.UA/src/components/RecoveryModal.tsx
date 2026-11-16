import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, ChoiceModal, Field, T } from './UI';
import { C } from '../theme';
import { authError } from '../lib/emailAuth';
import { validEmail, passwordRules } from '../lib/authValidation';
import { sendRecovery, finishRecovery } from '../lib/recovery';
export function RecoveryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const pending = useRef(false);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(c => c - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  async function act(finish = false) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      if (finish) { await finishRecovery(email, code, password); setPassword(''); setRepeat(''); setDone(true); }
      else { await sendRecovery(email); setSent(true); setCooldown(60); }
    } catch (e) { setError(authError(e)); } finally { pending.current = false; setBusy(false); }
  }
  return <ChoiceModal title="Відновлення пароля" open={open} onClose={() => { if (!busy) onClose(); }}><View style={{ gap: 12 }}>
    {done ? <><T>Пароль оновлено. Увійдіть із новим паролем.</T><Button title="До входу" onPress={onClose} /></> : <>
      <T style={{ color: C.muted }}>Введіть email профілю. Якщо він зареєстрований, надішлемо код відновлення.</T>
      <Field label="Email для відновлення" accessibilityLabel="Email для відновлення" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!sent && !busy} />
      {sent ? <><Field label="Код відновлення" value={code} onChangeText={setCode} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={10} editable={!busy} /><Field label="Новий пароль" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" editable={!busy} /><T style={{ color: C.muted }}>9+ символів, велика й мала літери та цифра.</T><Field label="Повторіть новий пароль" value={repeat} onChangeText={setRepeat} secureTextEntry autoCapitalize="none" editable={!busy} /><Button title="Зберегти новий пароль" busy={busy} disabled={password !== repeat || !passwordRules(password).every(r => r.valid) || !/^\d{6,10}$/.test(code)} onPress={() => { void act(true); }} /></> : null}
      <Button title={cooldown ? `Надіслати повторно через ${cooldown} с` : sent ? 'Надіслати код повторно' : 'Надіслати код'} variant="secondary" busy={busy} disabled={!validEmail(email) || cooldown > 0} onPress={() => { void act(); }} />
      {sent ? <Button title="Інша адреса email" variant="secondary" disabled={busy} onPress={() => { setSent(false); setCode(''); setPassword(''); setRepeat(''); }} /> : null}
    </>}
    {error ? <T accessibilityRole="alert" style={{ color: C.danger }}>{error}</T> : null}
  </View></ChoiceModal>;
}
