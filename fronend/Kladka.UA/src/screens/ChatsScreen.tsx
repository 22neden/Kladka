import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { C } from '../theme';
import { Button, Empty, Field, Header, Icon, Notice, Page, RoundButton, Row, T } from '../components/UI';
import { useStore } from '../state/AppStore';
import { initials, otherParticipant } from '../domain/logic';
import { pickPhoto } from '../lib/photos';
import { chatImageUrl } from '../lib/backend';
import { Moderation } from '../components/Moderation';
import type { Route } from '../domain/types';

export function ChatsScreen({ navigate }: { navigate: (route: Route) => void }) {
  const store = useStore();
  const convs = store.conversations.filter(c => !store.blocked.includes(otherParticipant(c, store.profile.id))).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return <Page><Header title="Повідомлення" right={<T style={{ color: C.lime, fontSize: 12 }}>{convs.length} чатів</T>} />
    <ScrollView refreshControl={<RefreshControl refreshing={store.syncing} onRefresh={() => { void store.refresh(); }} tintColor={C.lime} />} contentContainerStyle={{ padding: 22, paddingBottom: 35 }}>
      <T weight="display" style={{ fontSize: 29, lineHeight: 36, marginBottom: 10 }}>Домовляйтеся{'\n'}про важливе.</T>
      <T style={{ color: C.muted, marginBottom: 24 }}>Усі розмови про ваші майбутні проєкти.</T>
      {!store.remote ? <Notice>Локальні повідомлення зберігаються на цьому пристрої. Вони не надсилаються іншим людям.</Notice> : null}
      {convs.length ? convs.map(c => {
        const other = store.profiles.find(p => p.id === otherParticipant(c, store.profile.id));
        const listing = store.listings.find(l => l.id === c.listing_id);
        const messages = store.messages.filter(m => m.conversation_id === c.id);
        const last = messages[messages.length - 1];
        const unread = messages.filter(m => m.sender_id !== store.profile.id && m.created_at > (store.readAt[c.id] || '')).length;
        return <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={'Чат: ' + (other?.name || 'Учасник')} onPress={() => navigate({ name: 'chat', id: c.id })} style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: C.line }}>
          <View style={{ height: 50, width: 50, borderRadius: 18, backgroundColor: C.raised, justifyContent: 'center', alignItems: 'center' }}><T weight="bold" style={{ color: C.lime, fontSize: 17 }}>{initials(other?.name || 'Учасник')}</T></View>
          <View style={{ flex: 1, gap: 5 }}><T weight="bold" style={{ fontSize: 14 }} numberOfLines={1}>{other?.name || 'Учасник'}</T><T style={{ color: C.muted, fontSize: 10 }} numberOfLines={1}>{listing?.title || 'Оголошення видалено'}</T><T style={{ color: last ? C.text : C.muted, fontSize: 12 }} numberOfLines={1}>{last ? last.body || 'Фотографія' : 'Почніть розмову'}</T></View>
          {unread ? <View style={{ borderRadius: 14, minWidth: 24, padding: 4, backgroundColor: C.lime }}><T weight="bold" style={{ color: C.dark, fontSize: 10, textAlign: 'center' }}>{unread}</T></View> : <Icon name="chevron-right" color={C.muted} size={16} />}
        </Pressable>;
      }) : <Empty title="Поки тихо" body="Знайдіть майстра або цікаву заявку й почніть розмову з оголошення." icon="message-circle" />}
    </ScrollView>
  </Page>;
}
function PrivateImage({ path }: { path: string }) {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () => { setFailed(false); chatImageUrl(path).then(value => { if (alive) setUri(value); }).catch(() => { if (alive) setFailed(true); }); };
    load();
    const interval = setInterval(load, 240000);
    return () => { alive = false; clearInterval(interval); };
  }, [path]);
  return uri ? <Image source={{ uri }} style={{ width: 215, height: 180, borderRadius: 12 }} resizeMode="cover" /> : failed ? <T style={{ color: C.danger, fontSize: 11 }}>Фото недоступне. Оновіть чат.</T> : <ActivityIndicator color={C.lime} />;
}
export function ChatScreen({ id, navigate, onBack }: { id: string; navigate: (route: Route) => void; onBack: () => void }) {
  const store = useStore();
  const c = store.conversations.find(c => c.id === id);
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [moderation, setModeration] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const messages = store.messages.filter(m => m.conversation_id === id);
  const lastMessageId = messages[messages.length - 1]?.id;
  const chatExists = Boolean(c);
  const markRead = store.markRead;
  useEffect(() => { if (chatExists) void markRead(id); }, [id, lastMessageId, chatExists, markRead]);
  if (!c) return <Page><Header title="Чат" onBack={onBack} /><Empty title="Чат недоступний" body="Оновіть дані або спробуйте повернутися до оголошення." icon="message-circle" /></Page>;
  const otherId = otherParticipant(c, store.profile.id);
  const other = store.profiles.find(p => p.id === otherId);
  const listing = store.listings.find(l => l.id === c.listing_id);
  const blocked = store.blocked.includes(otherId);
  async function send() {
    if (!text.trim() && !attachment) return;
    setBusy(true); setError('');
    try { await store.sendMessage(id, text, attachment || undefined); setText(''); setAttachment(null); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function attach() {
    try { const image = await pickPhoto(); if (image) setAttachment(image); } catch { setError('Не вдалося додати фотографію.'); }
  }
  return <Page bottom><Header title={other?.name || 'Учасник'} onBack={onBack} right={<RoundButton icon="more-horizontal" label="Дії з користувачем" onPress={() => setModeration(true)} />} />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      {listing ? <Pressable accessibilityRole="button" accessibilityLabel="Відкрити оголошення" onPress={() => navigate({ name: 'listing', id: listing.id })} style={{ paddingHorizontal: 22, paddingVertical: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line }}><Row style={{ gap: 10 }}><Icon name="layers" size={16} color={C.lime} /><T numberOfLines={1} style={{ fontSize: 12, flex: 1 }}>{listing.title}</T><Icon name="arrow-up-right" size={15} color={C.muted} /></Row></Pressable> : null}
      <ScrollView ref={scroll} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, flexGrow: 1, gap: 12 }}>
        {!store.remote ? <Notice>Це локальний чат. Повідомлення не доставляються іншим людям, автоматичних відповідей немає.</Notice> : <T style={{ color: C.muted, textAlign: 'center', fontSize: 10, marginBottom: 8 }}>Останні 200 повідомлень · лише для учасників чату</T>}
        {!messages.length ? <Empty title="Знайомство починається тут" body="Представтеся, опишіть завдання й уточніть деталі робіт." icon="message-circle" /> : null}
        {messages.map(m => {
          const mine = m.sender_id === store.profile.id;
          return <View key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '86%', padding: 14, backgroundColor: mine ? '#323F21' : C.card, borderRadius: 18, borderBottomRightRadius: mine ? 5 : 18, borderBottomLeftRadius: mine ? 18 : 5, gap: 8 }}>
            {m.image_path ? <PrivateImage path={m.image_path} /> : null}
            {m.body ? <T selectable style={{ fontSize: 14, lineHeight: 23 }}>{m.body}</T> : null}
            <T style={{ color: C.muted, fontSize: 9, lineHeight: 13, textAlign: 'right' }}>{new Date(m.created_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })} · {new Date(m.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</T>
          </View>;
        })}
      </ScrollView>
      {error ? <T style={{ color: C.danger, paddingHorizontal: 22, fontSize: 12, paddingVertical: 8 }}>{error}</T> : null}
      {attachment ? <Row style={{ paddingHorizontal: 22, paddingBottom: 10, gap: 12 }}><Image source={{ uri: attachment }} style={{ width: 60, height: 60, borderRadius: 12 }} /><Button title="Прибрати фото" variant="secondary" icon="x" onPress={() => setAttachment(null)} /></Row> : null}
      {blocked ? <View style={{ padding: 20 }}><Notice>Користувача заблоковано. Розблокувати його можна у вашому профілі.</Notice></View> :
        <Row style={{ gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line, alignItems: 'center' }}>
          <RoundButton icon="paperclip" label="Прикріпити фотографію" onPress={() => { void attach(); }} />
          <View style={{ flex: 1 }}><Field accessibilityLabel="Повідомлення" placeholder="Ваше повідомлення…" value={text} onChangeText={setText} multiline maxLength={4000} style={{ minHeight: 48, height: 48, marginBottom: -18, paddingTop: 13 }} /></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Надіслати повідомлення" disabled={busy || (!text.trim() && !attachment)} onPress={() => { void send(); }} style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: C.lime, justifyContent: 'center', alignItems: 'center', opacity: busy || (!text.trim() && !attachment) ? 0.4 : 1 }}>{busy ? <ActivityIndicator color={C.dark} /> : <Icon name="arrow-up" color={C.dark} />}</Pressable>
        </Row>}
    </KeyboardAvoidingView>
    <Moderation open={moderation} onClose={() => setModeration(false)} userId={otherId} listingId={c.listing_id} />
  </Page>;
}
