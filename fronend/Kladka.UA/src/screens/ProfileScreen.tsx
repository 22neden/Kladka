import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { C, categories } from '../theme';
import { Button, Chip, ChoiceModal, Divider, Empty, Field, Header, Icon, ListingCard, Notice, Page, Row, T, type IconName } from '../components/UI';
import { useStore } from '../state/AppStore';
import { initials } from '../domain/logic';
import { pickPhoto } from '../lib/photos';
import { profileCompletion } from '../domain/profile';
import type { Profile, Route } from '../domain/types';
function MenuItem({ icon, title, subtitle, onPress, danger = false }: { icon: IconName; title: string; subtitle?: string; onPress: () => void; danger?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={{ paddingVertical: 18, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderBottomColor: C.line }}><View style={{ width: 37, height: 37, borderRadius: 12, backgroundColor: C.raised, justifyContent: 'center', alignItems: 'center' }}><Icon name={icon} color={danger ? C.danger : C.lime} size={18} /></View><View style={{ flex: 1, gap: 4 }}><T weight="bold" style={{ color: danger ? C.danger : C.text, fontSize: 14 }}>{title}</T>{subtitle ? <T style={{ color: C.muted, fontSize: 11 }}>{subtitle}</T> : null}</View><Icon name="chevron-right" size={17} color={C.muted} /></Pressable>;
}
export function ProfileScreen({ navigate }: { navigate: (route: Route) => void }) {
  const store = useStore();
  const [confirm, setConfirm] = useState<'logout' | 'delete' | 'blocks' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const completion = profileCompletion(store.profile);
  const mine = store.listings.filter(l => l.owner_id === store.profile.id);
  async function act() {
    setBusy(true); setError('');
    try { if (confirm === 'delete') await store.deleteAccount(); else await store.signOut(); setConfirm(null); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <Page><Header title="Мій профіль" />
    <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40 }}>
      <View style={{ backgroundColor: C.card, borderRadius: 25, padding: 22, gap: 20 }}>
        <Row style={{ gap: 16 }}><View style={{ width: 64, height: 64, backgroundColor: C.lime, borderRadius: 22, justifyContent: 'center', alignItems: 'center' }}><>{store.profile.avatar_url ? <Image source={{ uri: store.profile.avatar_url }} style={{ width: 64, height: 64, borderRadius: 22 }} /> : <T weight="display" style={{ color: C.dark, fontSize: 23 }}>{initials(store.profile.name)}</T>}</></View><View style={{ flex: 1, gap: 6 }}><T weight="bold" style={{ fontSize: 21, lineHeight: 27 }}>{store.profile.name}</T><Row style={{ gap: 5 }}><Icon name="map-pin" size={12} color={C.muted} /><T style={{ color: C.muted, fontSize: 12 }}>{store.profile.city || 'Додайте місто'}</T></Row></View></Row>
        <T style={{ color: C.muted, fontSize: 12 }}>{store.profile.role === 'professional' ? 'Майстер / представник бригади' : 'Замовник'} · можна замовляти й надавати послуги</T>
        <View style={{ gap: 8 }}><Row style={{ justifyContent: 'space-between' }}><T style={{ color: C.muted, fontSize: 12 }}>Заповнення профілю</T><T style={{ color: C.lime }}>{completion.percent}%</T></Row><View style={{ height: 5, backgroundColor: C.line, borderRadius: 3 }}><View style={{ width: `${completion.percent}%`, height: 5, borderRadius: 3, backgroundColor: C.lime }} /></View><T style={{ color: C.muted, fontSize: 11 }}>{completion.steps.filter(s => !s.done).map(s => s.label).join(' · ') || 'Профіль заповнено. Це не перевірка особи.'}</T></View>
        <Button title="Редагувати профіль" icon="edit-2" variant="secondary" onPress={() => navigate({ name: 'editProfile' })} />
      </View>
      <Row style={{ marginTop: 20, marginBottom: 10, gap: 12 }}>
        {[{ n: mine.length, label: 'Оголошень' }, { n: store.favorites.length, label: 'В обраному' }, { n: store.conversations.length, label: 'Розмов' }].map(metric => <View key={metric.label} style={{ flex: 1, paddingVertical: 18, borderRadius: 17, backgroundColor: C.card, alignItems: 'center', gap: 4 }}><T weight="display" style={{ color: C.lime, fontSize: 26, lineHeight: 34 }}>{metric.n}</T><T style={{ color: C.muted, fontSize: 10 }}>{metric.label}</T></View>)}
      </Row>
      <MenuItem icon="user" title="Переглянути мій профіль" subtitle="Так вас бачать інші користувачі" onPress={() => navigate({ name: 'publicProfile', id: store.profile.id })} />
      <MenuItem icon="settings" title="Налаштування акаунта" subtitle="Контакти, новини та безпека" onPress={() => navigate({ name: 'settings' })} />
      <MenuItem icon="layers" title="Мої оголошення" subtitle="Послуги, заявки та завершені роботи" onPress={() => navigate({ name: 'mine' })} />
      <MenuItem icon="heart" title="Обране" subtitle="Майстри й проєкти, які ви зберегли" onPress={() => navigate({ name: 'favorites' })} />
      <MenuItem icon="shield" title="Заблоковані користувачі" subtitle={store.blocked.length ? String(store.blocked.length) + ' користувачів' : 'Список порожній'} onPress={() => setConfirm('blocks')} />
      <MenuItem icon="info" title="Про застосунок і дані" subtitle="Режим роботи, приватність і підтримка" onPress={() => navigate({ name: 'about' })} />
      <MenuItem icon="log-out" title="Вийти" onPress={() => { setError(''); setConfirm('logout'); }} />
      <MenuItem icon="trash-2" title="Видалити обліковий запис" danger onPress={() => { setError(''); setConfirmText(''); setConfirm('delete'); }} />
      <View style={{ marginTop: 24 }}><Notice lime>{store.remote ? 'Підключено до сервісу. Профіль і дані синхронізуються між вашими пристроями.' : 'Локальна версія. Дані зберігаються на цьому пристрої та не синхронізуються.'}</Notice></View>
      <T style={{ color: C.muted, textAlign: 'center', fontSize: 10 }}>KLADKA.UA · v1.2.0</T>
    </ScrollView>
    <ChoiceModal title={confirm === 'blocks' ? 'Заблоковані користувачі' : confirm === 'delete' ? 'Видалення облікового запису' : 'Вийти з застосунку?'} open={Boolean(confirm)} onClose={() => setConfirm(null)}>
      {confirm === 'blocks' ? store.blocked.length ? store.blocked.map(id => <View key={id} style={{ gap: 12, marginBottom: 20 }}><T weight="bold">{store.profiles.find(p => p.id === id)?.name || 'Користувач'}</T><Button title="Розблокувати" variant="secondary" onPress={async () => { try { await store.unblock(id); } catch (e) { setError(String(e)); } }} /></View>) : <Empty title="Список порожній" body="Тут з’являтимуться заблоковані користувачі." icon="shield" /> :
        <View style={{ gap: 18 }}>
          <T style={{ color: C.muted }}>{confirm === 'delete' ? store.remote ? 'Профіль, ваші оголошення, фото та переписка будуть видалені. Скасувати цю дію неможливо.' : 'Ваші локальні оголошення, обране, фото та переписка будуть видалені. Приклади можна буде відкрити заново.' : 'Ваші збережені дані залишаться. Ви зможете повернутися пізніше.'}</T>
          {confirm === 'delete' ? <Field label="Для підтвердження введіть ВИДАЛИТИ" value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" placeholder="ВИДАЛИТИ" /> : null}
          <Button title={confirm === 'delete' ? 'Видалити назавжди' : 'Вийти'} variant={confirm === 'delete' ? 'danger' : 'primary'} busy={busy} disabled={confirm === 'delete' && confirmText !== 'ВИДАЛИТИ'} onPress={() => { void act(); }} />
        </View>}
      {error ? <T style={{ color: C.danger, marginTop: 16 }}>{error}</T> : null}
    </ChoiceModal>
  </Page>;
}
export function EditProfileScreen({ onBack }: { onBack: () => void }) {
  const store = useStore();
  const [draft, setDraft] = useState<Profile>(store.profile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function photo() { setBusy(true); setError(''); try { const uri = await pickPhoto(); if (uri) setDraft(p => ({ ...p, avatar_url: uri })); } catch { setError('Не вдалося відкрити фотографію.'); } finally { setBusy(false); } }
  async function save() { setBusy(true); setError(''); try { await store.saveProfile(draft); onBack(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } }
  return <Page bottom><Header title="Редагування профілю" onBack={onBack} /><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 22 }}>
    <Row style={{ gap: 16, marginBottom: 24 }}>{draft.avatar_url ? <Image source={{ uri: draft.avatar_url }} style={{ width: 72, height: 72, borderRadius: 24 }} /> : <Icon name="user" size={44} color={C.lime} />}<Button title="Змінити фото" variant="secondary" busy={busy} onPress={() => { void photo(); }} />{draft.avatar_url ? <Pressable accessibilityRole="button" accessibilityLabel="Прибрати фото" disabled={busy} onPress={() => setDraft(p => ({ ...p, avatar_url: '' }))}><Icon name="x" color={C.muted} /></Pressable> : null}</Row>
    <Field label="ІМ’Я АБО НАЗВА КОМАНДИ" accessibilityLabel="Ім’я профілю" value={draft.name} maxLength={80} onChangeText={name => setDraft(p => ({ ...p, name }))} />
    <Field label="МІСТО / НАСЕЛЕНИЙ ПУНКТ" accessibilityLabel="Місто профілю" value={draft.city} maxLength={80} onChangeText={city => setDraft(p => ({ ...p, city }))} />
    <T weight="bold" style={{ color: C.muted, marginBottom: 12, fontSize: 12 }}>Я ПЕРЕВАЖНО</T><Row style={{ gap: 8, marginBottom: 24 }}><Chip title="Замовляю роботи" active={draft.role === 'customer'} onPress={() => setDraft(p => ({ ...p, role: 'customer' }))} /><Chip title="Надаю послуги" active={draft.role === 'professional'} onPress={() => setDraft(p => ({ ...p, role: 'professional' }))} /></Row>
    {draft.role === 'professional' ? <View style={{ gap: 12, marginBottom: 20 }}><T weight="bold">Спеціалізації</T><Row style={{ gap: 8, flexWrap: 'wrap' }}>{categories.map(c => <Chip key={c.id} title={c.short} active={draft.specialties?.includes(c.id)} onPress={() => setDraft(p => ({ ...p, specialties: p.specialties?.includes(c.id) ? p.specialties.filter(id => id !== c.id) : [...(p.specialties || []), c.id] }))} />)}</Row><Field label="Досвід роботи (років)" accessibilityLabel="Досвід роботи" keyboardType="number-pad" value={String(draft.experience_years ?? 0)} onChangeText={value => setDraft(p => ({ ...p, experience_years: value ? Number(value) : 0 }))} /><T weight="bold">Доступність</T><Row style={{ gap: 8 }}><Chip title="Відкритий до замовлень" active={draft.availability !== 'busy'} onPress={() => setDraft(p => ({ ...p, availability: 'available' }))} /><Chip title="Зараз зайнятий" active={draft.availability === 'busy'} onPress={() => setDraft(p => ({ ...p, availability: 'busy' }))} /></Row></View> : null}
    <Field label="ПРО СЕБЕ" accessibilityLabel="Про себе" value={draft.bio} onChangeText={bio => setDraft(p => ({ ...p, bio }))} multiline maxLength={1500} placeholder="Досвід, підхід до роботи або кілька слів про вас." />
    <Notice>Фото, ім’я, місто, опис і професійні відомості будуть видимі іншим користувачам у підключеному сервісі.</Notice>
    {error ? <T style={{ color: C.danger, marginBottom: 16 }}>{error}</T> : null}
    <Button title="Зберегти профіль" icon="check" busy={busy} onPress={() => { void save(); }} />
  </ScrollView></KeyboardAvoidingView></Page>;
}
export function SavedListingsScreen({ kind, onBack, navigate }: { kind: 'mine' | 'favorites'; onBack: () => void; navigate: (route: Route) => void }) {
  const store = useStore();
  const mine = kind === 'mine';
  const [status, setStatus] = useState<'all' | 'active' | 'hidden' | 'closed'>('all');
  const listings = store.listings.filter(l => !store.blocked.includes(l.owner_id) && (mine ? l.owner_id === store.profile.id && (status === 'all' || l.status === status) : store.favorites.includes(l.id)));
  return <Page><Header title={mine ? 'Мої оголошення' : 'Обране'} onBack={onBack} /><ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 35 }}>
    <T style={{ color: C.muted, marginBottom: 22 }}>{mine ? 'Усі ваші послуги та заявки. Відкрийте оголошення, щоб змінити його або завершити.' : 'Повертайтеся до майстрів і проєктів, які вас зацікавили.'}</T>
    {mine ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }} contentContainerStyle={{ gap: 8 }}>{([{ id: 'all', text: 'Усі' }, { id: 'active', text: 'Активні' }, { id: 'hidden', text: 'Приховані' }, { id: 'closed', text: 'Завершені' }] as const).map(s => <Chip key={s.id} title={s.text} active={status === s.id} onPress={() => setStatus(s.id)} />)}</ScrollView> : null}
    {listings.length ? listings.map(l => <ListingCard key={l.id} listing={l} onPress={() => navigate({ name: 'listing', id: l.id })} />) : <Empty title={mine ? (status === 'all' ? 'Почнімо з першого оголошення' : 'У цій категорії поки порожньо') : 'Збережіть щось особливе'} body={mine ? 'Розкажіть про свої послуги або опублікуйте завдання для майстра.' : 'Натисніть сердечко на картці послуги або заявки.'} icon={mine ? 'layers' : 'heart'} action={mine ? <Button title="Створити оголошення" icon="plus" onPress={() => navigate({ name: 'edit' })} /> : undefined} />}
  </ScrollView></Page>;
}
export function AboutScreen({ onBack }: { onBack: () => void }) {
  const store = useStore();
  const support = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;
  return <Page bottom><Header title="Про застосунок і дані" onBack={onBack} /><ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40 }}>
    <T weight="display" style={{ fontSize: 30, lineHeight: 38, marginBottom: 16 }}>Kladka.UA</T>
    <T style={{ color: C.muted, lineHeight: 24 }}>Майданчик, що поєднує людей, які створюють простір, із тими, кому потрібна їхня майстерність.</T><Divider />
    <T weight="bold" style={{ marginBottom: 12 }}>Режим роботи</T>
    <Notice lime>{store.remote ? 'Підключений сервіс: дані зберігаються в MongoDB через сервер Kladka.UA та синхронізуються. Власник сервісу обробляє скарги й підтримку.' : 'Локальна версія: дані зберігаються на пристрої. Приклади бригад та заявки вигадані. Повідомлення й скарги нікуди не надсилаються.'}</Notice>
    <T weight="bold" style={{ marginBottom: 12 }}>Ваші дані</T><T style={{ color: C.muted, lineHeight: 24 }}>Публічний профіль містить фото, ім’я, місто, опис та професійні відомості. Телефон і налаштування новин доступні лише власнику акаунта. Оголошення й фотографії портфоліо доступні користувачам сервісу. Особисті повідомлення доступні учасникам відповідного чату. Власник сервісу технічно адмініструє базу: наскрізного шифрування в цій версії немає.</T>
    <Divider /><T weight="bold" style={{ marginBottom: 12 }}>Видалення та блокування</T><T style={{ color: C.muted, lineHeight: 24 }}>У профілі можна видалити обліковий запис та пов’язані дані. У картці оголошення та чаті доступні скарга й блокування. Блокування забороняє нові повідомлення, але не видаляє попередню переписку.</T>
    <Divider /><T weight="bold" style={{ marginBottom: 12 }}>Правила спільноти</T><T style={{ color: C.muted, lineHeight: 24 }}>Розміщуйте правдиві описи та власні фотографії. Спам, шахрайство, погрози, дискримінація й незаконний контент заборонені. Погоджуйте обсяг робіт, кошторис і терміни до початку співпраці.</T>
    <Divider /><T weight="bold" style={{ marginBottom: 12 }}>Підтримка</T><T selectable style={{ color: C.muted, lineHeight: 24 }}>{support || 'Контакт підтримки ще не налаштований. Перед публічним запуском власник має додати email підтримки та повну політику приватності.'}</T>
    <Divider /><T style={{ color: C.muted, fontSize: 11 }}>Версія 1.2.0 · Авторські фотографії інтер’єрів: Unsplash, лише для ілюстрації локальних прикладів.</T>
  </ScrollView></Page>;
}
