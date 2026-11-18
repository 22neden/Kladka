import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, ChoiceModal, Field, Notice, T } from './UI';
import { useStore } from '../state/AppStore';
import { C } from '../theme';
export function Moderation({ open, onClose, userId, listingId, onBlocked }: { open: boolean; onClose: () => void; userId: string; listingId: string | null; onBlocked?: () => void }) {
  const store = useStore();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  async function report() {
    setBusy(true); setError('');
    try { await store.report(listingId, userId, reason); setDone(true); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function block() {
    setBusy(true); setError('');
    try { await store.block(userId); onClose(); onBlocked?.(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <ChoiceModal title="Безпека спільноти" open={open} onClose={onClose}>
    {done ? <Notice lime>{store.remote ? 'Скаргу надіслано на розгляд адміністратору.' : 'Скаргу збережено локально. Без підключеного сервісу вона не надсилається адміністратору.'}</Notice> : <>
      <T style={{ color: C.muted, marginBottom: 18 }}>Побачили неправдиве оголошення, спам чи неприйнятну поведінку? Розкажіть про це.</T>
      <Field label="Причина скарги" value={reason} onChangeText={setReason} placeholder="Що саме сталося?" multiline maxLength={1000} />
      <Button title="Надіслати скаргу" icon="flag" busy={busy} onPress={() => { void report(); }} />
    </>}
    <View style={{ gap: 14, marginTop: 22 }}>
      <T style={{ color: C.muted, fontSize: 12 }}>Блокування приховає оголошення користувача та зупинить переписку. Розблокувати можна у профілі.</T>
      <Button title="Заблокувати користувача" icon="slash" variant="danger" busy={busy} onPress={() => { void block(); }} />
      {error ? <T style={{ color: C.danger }}>{error}</T> : null}
    </View>
  </ChoiceModal>;
}
