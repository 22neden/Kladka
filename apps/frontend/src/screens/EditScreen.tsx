import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { C, categories, workItems } from '../theme';
import { Button, Chip, Field, Header, Icon, Notice, Page, Row, T } from '../components/UI';
import { useStore } from '../state/AppStore';
import type { CategoryId, ListingKind, NewListing } from '../domain/types';
import { pickPhoto } from '../lib/photos';
import { imageSource } from '../lib/media';
import { validateListing } from '../domain/logic';

export function EditScreen({ id, initialKind = 'service', onBack, onSaved }: { id?: string; initialKind?: ListingKind; onBack: () => void; onSaved: (id: string) => void }) {
  const store = useStore();
  const existing = store.listings.find(l => l.id === id);
  const [kind, setKind] = useState<ListingKind>(existing?.kind || initialKind);
  const [category, setCategory] = useState<CategoryId>(existing?.category || 'rough');
  const [title, setTitle] = useState(existing?.title || '');
  const [description, setDescription] = useState(existing?.description || '');
  const [city, setCity] = useState(existing?.city || store.profile.city);
  const [price, setPrice] = useState(existing?.price?.toString() || '');
  const [unit, setUnit] = useState(existing?.unit || 'м²');
  const [team, setTeam] = useState(existing?.team_name || '');
  const [images, setImages] = useState<string[]>(existing?.images || []);
  const [workItemsSelected, setWorkItemsSelected] = useState<string[]>(existing?.work_items || []);
  const [urgency, setUrgency] = useState<'urgent' | 'week' | 'month'>(existing?.urgency || 'week');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function photo() {
    setError('');
    try { const uri = await pickPhoto(); if (uri) setImages(p => [...p, uri].slice(0, 6)); }
    catch { setError('Не вдалося відкрити фотографію. Перевір доступ до фототеки.'); }
  }
  async function save() {
    const draft: NewListing = { title, description, kind, category, city, price: price.trim() ? Number(price.replace(',', '.')) : null, unit: kind === 'request' ? 'об’єкт' : unit, images, team_name: kind === 'service' ? team.trim() || store.profile.name : '', work_items: workItemsSelected, urgency };
    const validation = validateListing(draft);
    if (validation) { setError(validation); return; }
    setBusy(true); setError('');
    try { const savedId = await store.saveListing(draft, id); onSaved(savedId); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <Page bottom><Header title={id ? 'Редагувати оголошення' : 'Нове оголошення'} onBack={onBack} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 22, paddingBottom: 40 }}>
        <T weight="display" style={{ fontSize: 29, lineHeight: 36, marginBottom: 10 }}>{kind === 'service' ? 'Покажіть, що\nви вмієте.' : 'Знайдіть людей\nдля вашої ідеї.'}</T>
        <T style={{ color: C.muted, marginBottom: 24 }}>Чим більше деталей, тим легше знайти одне одного.</T>
        {!id ? <Row style={{ gap: 10, marginBottom: 24 }}><Chip title="Пропоную послуги" active={kind === 'service'} onPress={() => setKind('service')} /><Chip title="Шукаю майстра" active={kind === 'request'} onPress={() => setKind('request')} /></Row> : null}
        <Field label="НАЗВА" accessibilityLabel="Назва оголошення" placeholder={kind === 'service' ? 'Наприклад, ремонт квартир під ключ' : 'Наприклад, потрібен ремонт ванної'} value={title} onChangeText={setTitle} maxLength={100} />
        <T weight="bold" style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>КАТЕГОРІЯ</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>{categories.map(c => <Chip key={c.id} title={c.short} icon={c.icon} active={category === c.id} onPress={() => { setCategory(c.id); setWorkItemsSelected([]); }} />)}</View>
        <T weight="bold" style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>ПЕРЕЛІК РОБІТ</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>{(workItems[category] || []).map(item => <Chip key={item} title={item} active={workItemsSelected.includes(item)} onPress={() => setWorkItemsSelected(items => items.includes(item) ? items.filter(value => value !== item) : [...items, item])} />)}</View>
        {kind === 'request' ? <View style={{ marginBottom: 22 }}><T weight="bold" style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>ТЕРМІНОВІСТЬ</T><Row style={{ gap: 8, flexWrap: 'wrap' }}>{([['urgent','Терміново'],['week','До тижня'],['month','До місяця']] as const).map(([value,title]) => <Chip key={value} title={title} active={urgency === value} onPress={() => setUrgency(value)} />)}</Row></View> : null}
        <Field label="ОПИС РОБІТ" accessibilityLabel="Опис робіт" placeholder={kind === 'service' ? 'Які роботи виконуєте? Що входить у вартість? Як працюєте?' : 'Що потрібно зробити? Вкажіть площу, стан об’єкта та бажані терміни.'} value={description} onChangeText={setDescription} multiline maxLength={5000} />
        <Field label="МІСТО / НАСЕЛЕНИЙ ПУНКТ" accessibilityLabel="Місто" placeholder="Рівне" value={city} onChangeText={setCity} maxLength={80} />
        {kind === 'service' ? <Field label="НАЗВА БРИГАДИ АБО ВАШЕ ІМ’Я" placeholder={store.profile.name} value={team} onChangeText={setTeam} maxLength={100} /> : null}
        <Field label={kind === 'service' ? 'ЦІНА ВІД, ₴' : 'ОРІЄНТОВНИЙ БЮДЖЕТ, ₴'} accessibilityLabel="Ціна" placeholder="Залиште порожнім, якщо договірна" value={price} onChangeText={setPrice} keyboardType="decimal-pad" maxLength={12} />
        {kind === 'service' ? <View style={{ marginBottom: 24 }}><T weight="bold" style={{ color: C.muted, fontSize: 12, marginBottom: 10 }}>ОДИНИЦЯ ВИМІРЮВАННЯ</T><Row style={{ gap: 8, flexWrap: 'wrap' }}>{['м²', 'точка', 'год', 'об’єкт', 'м.п.'].map(u => <Chip key={u} title={u} active={unit === u} onPress={() => setUnit(u)} />)}</Row></View> : null}
        <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}><T weight="bold" style={{ color: C.muted, fontSize: 12 }}>ФОТОГРАФІЇ</T><T style={{ color: C.muted, fontSize: 11 }}>{images.length} / 6</T></Row>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginBottom: 20 }}>
          {images.map((uri, i) => <View key={uri + i} style={{ width: 100, height: 110, borderRadius: 14, overflow: 'hidden' }}><Image source={imageSource(uri)} style={{ width: '100%', height: '100%' }} /><Pressable accessibilityRole="button" accessibilityLabel={'Видалити фото ' + (i + 1)} onPress={() => setImages(p => p.filter((_, j) => j !== i))} style={{ position: 'absolute', right: 5, top: 5, borderRadius: 12, padding: 5, backgroundColor: C.bg }}><Icon name="x" size={14} /></Pressable></View>)}
          {images.length < 6 ? <Pressable accessibilityRole="button" accessibilityLabel="Додати фото" onPress={() => { void photo(); }} style={{ width: 100, height: 110, backgroundColor: C.card, borderWidth: 1, borderStyle: 'dashed', borderColor: C.line, borderRadius: 14, justifyContent: 'center', alignItems: 'center', gap: 8 }}><Icon name="plus" color={C.lime} /><T style={{ fontSize: 10, color: C.muted }}>Додати</T></Pressable> : null}
        </ScrollView>
        <Notice>{store.remote ? 'Оголошення надійде на перевірку. Після схвалення його побачать інші користувачі. Додавайте власні фото та правдиву інформацію.' : 'Це оголошення збережеться лише на вашому пристрої. Після підключення сервісу можна буде публікувати для всіх.'}</Notice>
        {error ? <T accessibilityRole="alert" style={{ color: C.danger, marginBottom: 16 }}>{error}</T> : null}
        <Button testID="save-listing" title={id ? 'Зберегти зміни' : store.remote ? 'Опублікувати оголошення' : 'Зберегти оголошення'} icon="arrow-up-right" busy={busy} onPress={() => { void save(); }} />
      </ScrollView>
    </KeyboardAvoidingView>
  </Page>;
}
