import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../theme';
import { T, Button, Icon, Row, Notice, Field } from '../components/UI';
import { signIn } from '../lib/backend';
import { authError, resendConfirmation, confirmEmail, emailLogin, emailSignup, requireTerms, termsUrl } from '../lib/emailAuth';
import { passwordRules, validEmail } from '../lib/authValidation';
import { RecoveryModal } from '../components/RecoveryModal';
import { useStore } from '../state/AppStore';

type Mode = 'login' | 'register' | 'confirm';
export function AuthScreen() {
  const store = useStore();
  const [recovery, setRecovery] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(c => c - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  const [mode, setMode] = useState<Mode>('login');
  const [busy, setBusy] = useState<string | null>(null);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [visible, setVisible] = useState(false);
  const [news, setNews] = useState(false);
  const [code, setCode] = useState('');
  const register = mode === 'register';
  const rules = passwordRules(password);
  const valid = validEmail(email) && Boolean(password) && (!register || (rules.every(r => r.valid) && repeat === password));
  function switchMode(next: Mode) { setMode(next); setError(''); setPassword(''); setRepeat(''); setVisible(false); setCode(''); }
  async function run(key: string, action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(key); setError('');
    try { await action(); } catch (e) { setError(authError(e)); if ((e as { code?: string }).code === 'email_not_confirmed') { setMode('confirm'); } }
    finally { pending.current = false; setBusy(null); }
  }
  async function submit() {
    if (mode === 'confirm') { await confirmEmail(email, code, password); return; }
    if (!valid) throw new Error('Перевірте email та пароль.');
    if (register) {
      const active = await emailSignup(email, password, name, news);
      setRepeat('');
      if (!active) { setMode('confirm'); setCooldown(60); }
    } else await emailLogin(email, password);
  }
  async function openTerms() {
    try { requireTerms(); await Linking.openURL(termsUrl); }
    catch (e) { setError(authError(e)); }
  }
  return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingBottom: 40, gap: 22 }}>
        <Row style={{ justifyContent: 'space-between', paddingTop: 12 }}>
          <Row style={{ gap: 10 }}><View style={{ backgroundColor: C.lime, borderRadius: 13, padding: 11 }}><Icon name="layers" color={C.dark} /></View><T weight="display" style={{ fontSize: 24, lineHeight: 32 }}>Kladka<T weight="display" style={{ fontSize: 24, color: C.lime }}>.UA</T></T></Row>
          <T style={{ color: C.muted, fontSize: 10 }}>БУДУЄМО ЗВ’ЯЗКИ</T>
        </Row>
        <View style={{ gap: 8, paddingTop: 16 }}>
          <T style={{ color: C.lime, fontSize: 11, letterSpacing: 2 }}>ВАШ ПРОСТІР МОЖЛИВОСТЕЙ</T>
          <T weight="display" style={{ fontSize: 34, lineHeight: 42 }}>{mode === 'confirm' ? 'Перевірте пошту' : register ? 'Почнімо будувати.' : 'З поверненням.'}</T>
          <T style={{ color: C.muted }}>{mode === 'confirm' ? 'Якщо реєстрація доступна для цієї адреси, ви отримаєте лист із кодом підтвердження.' : register ? 'Створіть профіль, щоб знаходити майстрів і нові замовлення.' : 'Увійдіть, щоб продовжити свої проєкти.'}</T>
        </View>
        {mode !== 'confirm' ? <Row style={{ backgroundColor: C.raised, padding: 5, borderRadius: 16 }}>
          {(['login', 'register'] as const).map(value => <Pressable key={value} testID={'auth-' + value} accessibilityRole="tab" accessibilityState={{ selected: mode === value }} disabled={Boolean(busy)} onPress={() => switchMode(value)} style={{ flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: mode === value ? C.lime : 'transparent' }}><T weight="bold" style={{ textAlign: 'center', color: mode === value ? C.dark : C.muted }}>{value === 'login' ? 'Увійти' : 'Зареєструватися'}</T></Pressable>)}
        </Row> : null}
        <View>
          {mode === 'confirm' ? <>
            <T style={{ color: C.lime, marginBottom: 16 }}>{email}</T>
            <Field label="Код із листа" accessibilityLabel="Код із листа" value={code} onChangeText={setCode} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={10} editable={!busy} />
          </> : <>
            {register ? <Field label="Ім’я (необов’язково)" accessibilityLabel="Ім’я" placeholder="Як до вас звертатися?" value={name} onChangeText={setName} autoComplete="name" maxLength={80} editable={!busy} /> : null}
            <Field testID="auth-email" label="Email" accessibilityLabel="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" editable={!busy} />
            <View><Field testID="auth-password" label="Пароль" accessibilityLabel="Пароль" placeholder="Введіть пароль" value={password} onChangeText={setPassword} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} textContentType={register ? 'newPassword' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} editable={!busy} style={{ paddingRight: 60 }} /><Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Приховати пароль' : 'Показати пароль'} onPress={() => setVisible(!visible)} style={{ position: 'absolute', right: 6, top: 27, padding: 14 }}><Icon name={visible ? 'eye-off' : 'eye'} color={C.muted} /></Pressable></View>
            {register ? <>
              <View style={{ padding: 16, backgroundColor: C.raised, borderRadius: 16, gap: 7, marginBottom: 20 }}>
                <T weight="bold" style={{ marginBottom: 3, fontSize: 12 }}>Ваш пароль має містити:</T>
                {rules.map(rule => <Row key={rule.label} style={{ gap: 8 }}><Icon name={rule.valid ? 'check-circle' : 'circle'} size={15} color={rule.valid ? C.lime : C.muted} /><T style={{ fontSize: 12, color: rule.valid ? C.lime : C.muted }}>{rule.label}</T></Row>)}
              </View>
              <Field label="Повторіть пароль" accessibilityLabel="Повторіть пароль" value={repeat} onChangeText={setRepeat} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} textContentType="newPassword" editable={!busy} />
              {repeat && repeat !== password ? <T style={{ color: C.danger, fontSize: 12, marginBottom: 16 }}>Паролі не збігаються.</T> : null}
              <Pressable testID="newsletter-checkbox" accessibilityRole="checkbox" aria-checked={news} accessibilityState={{ checked: news }} disabled={Boolean(busy)} onPress={() => setNews(!news)} style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, marginBottom: 14 }}><Icon name={news ? 'check-square' : 'square'} color={news ? C.lime : C.muted} /><T style={{ flex: 1, fontSize: 12, color: C.muted }}>Так, я хочу отримувати інформацію про новини Kladka.UA.</T></Pressable>
            </> : null}
          </>}
          {error ? <T accessibilityRole="alert" style={{ color: C.danger, marginBottom: 16 }}>{error}</T> : null}
          <Button testID="auth-submit" title={mode === 'confirm' ? 'Підтвердити email' : register ? 'Створити профіль' : 'Увійти'} icon="arrow-right" busy={busy === 'email'} disabled={Boolean(busy) || (mode === 'confirm' ? !/^\d{6,10}$/.test(code) : !valid)} onPress={() => { void run('email', submit); }} />
          {mode === 'login' ? <Button title="Забули пароль?" variant="secondary" style={{ marginTop: 12 }} disabled={Boolean(busy)} onPress={() => setRecovery(true)} /> : null}
          {mode === 'confirm' ? <Button title={cooldown ? `Повторний код через ${cooldown} с` : 'Надіслати код повторно'} variant="secondary" style={{ marginTop: 12 }} disabled={Boolean(busy) || cooldown > 0} onPress={() => { void run('resend', async () => { await resendConfirmation(email); setCooldown(60); }); }} /> : null}
          {mode === 'confirm' ? <Button title="Повернутися до входу" variant="secondary" disabled={Boolean(busy)} style={{ marginTop: 12 }} onPress={() => switchMode('login')} /> : null}
        </View>
        {mode !== 'confirm' ? <>
          {!register ? <><Row style={{ gap: 12 }}><View style={{ flex: 1, height: 1, backgroundColor: C.line }} /><T style={{ color: C.muted, fontSize: 12 }}>або продовжити через</T><View style={{ flex: 1, height: 1, backgroundColor: C.line }} /></Row>
          <View style={{ gap: 10 }}>{(['google', 'facebook'] as const).map(provider => <Button key={provider} title={provider === 'google' ? 'Google' : 'Facebook'} icon={provider === 'google' ? 'log-in' : 'facebook'} variant="secondary" busy={busy === provider} disabled={Boolean(busy)} onPress={() => { void run(provider, async () => { requireTerms(); await signIn(provider); }); }} />)}</View></> : null}
          <T style={{ fontSize: 12, lineHeight: 19, color: C.muted, textAlign: 'center' }}>Створюючи профіль на Kladka.UA, ви погоджуєтеся з{' '}<T accessibilityRole="link" onPress={() => { void openTerms(); }} style={{ color: C.lime, fontSize: 12, textDecorationLine: 'underline' }}>Умовами використання</T>.</T>
        </> : null}
        {!store.remote ? <><Button testID="enter-local" title="Відкрити локальну версію" variant="secondary" disabled={Boolean(busy)} onPress={store.enterLocal} /><Notice>Локальний перегляд доступний без акаунта. Реєстрація та вхід запрацюють після підключення сервісу.</Notice></> : null}
        <T style={{ color: C.muted, fontSize: 10, textAlign: 'center', letterSpacing: 2 }}>KLADKA.UA · РАЗОМ БУДУЄМО БІЛЬШЕ</T>
      </ScrollView>
    </KeyboardAvoidingView>
    {recovery ? <RecoveryModal open onClose={() => setRecovery(false)} /> : null}
  </SafeAreaView>;
}
