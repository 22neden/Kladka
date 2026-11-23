import React, { useEffect, useState } from 'react';
import { Image, ScrollView, View, useWindowDimensions } from 'react-native';
import { C, categoryTitle } from '../theme';
import { Button, Divider, Empty, Field, Header, Icon, Notice, Page, Pill, RoundButton, Row, T } from '../components/UI';
import { Moderation } from '../components/Moderation';
import { useStore } from '../state/AppStore';
import { imageSource } from '../lib/media';
import { initials, priceLabel, shortDate } from '../domain/logic';
import type { Route } from '../domain/types';

export function DetailScreen({ id, onBack, navigate }: { id: string; onBack: () => void; navigate: (route: Route) => void }) {
  const store = useStore();
  const listing = store.listings.find(l => l.id === id);
  const [imageIndex, setImageIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [moderation, setModeration] = useState(false);
  const requestOffers = listing?.kind === 'request' ? store.offers.filter(offer => offer.request_id === listing.id) : [];
  const ownOffer = requestOffers.find(offer => offer.provider_id === store.profile.id);
  const requestOrder = listing?.kind === 'request' ? store.orders.find(order => order.request_id === listing.id) : undefined;
  const [offerMessage, setOfferMessage] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  useEffect(() => {
    if (ownOffer) { setOfferMessage(ownOffer.message); setOfferPrice(String(ownOffer.price)); }
  }, [ownOffer?.id]);
  const width = Math.min(useWindowDimensions().width, 520) - 44;
  if (!listing) return <Page><Header title="Оголошення" onBack={onBack} /><Empty title="Оголошення недоступне" body="Його могли видалити, приховати або змінити доступ." /></Page>;
  const owner = listing.owner_id === store.profile.id;
  const profile = store.profiles.find(p => p.id === listing.owner_id) || (owner ? store.profile : undefined);
  const favorite = store.favorites.includes(id);
  const blocked = store.blocked.includes(listing.owner_id);
  const sample = listing.id.startsWith('10000000-');
  async function contact() {
    setBusy(true); setError('');
    try { const conversationId = await store.openConversation(listing!); navigate({ name: 'chat', id: conversationId }); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function favoriteAction() {
    try { await store.toggleFavorite(id); } catch { setError('Не вдалося змінити обране. Спробуйте ще раз.'); }
  }
  async function statusAction() {
    setBusy(true); setError('');
    try { await store.changeStatus(id, listing!.status === 'active' ? 'closed' : 'active'); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function submitOffer() {
    const price = Number(offerPrice.replace(',', '.'));
    if (!Number.isFinite(price) || price < 0) { setError('Вкажіть коректну ціну пропозиції.'); return; }
    setBusy(true); setError('');
    try { await store.submitOffer(id, { message: offerMessage.trim(), price, unit: listing?.unit || '' }); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function acceptOffer(offerId: string) {
    setBusy(true); setError('');
    try { await store.acceptOffer(offerId); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function changeOrderStatus(status: 'in_progress' | 'completed' | 'cancelled') {
    if (!requestOrder) return;
    setBusy(true); setError('');
    try { await store.updateOrderStatus(requestOrder.id, status); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <Page bottom>
    <Header title={listing.kind === 'service' ? 'Послуга' : 'Заявка на роботи'} onBack={onBack} right={!owner ? <RoundButton icon="more-horizontal" label="Поскаржитися або заблокувати" onPress={() => setModeration(true)} /> : undefined} />
    <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 20 }}>
      {listing.images.length ? <View style={{ borderRadius: 22, overflow: 'hidden', height: 300, marginBottom: 24 }}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={e => setImageIndex(Math.round(e.nativeEvent.contentOffset.x / width))}>
          {listing.images.map((uri, i) => <Image key={uri + i} source={imageSource(uri)} resizeMode="cover" style={{ width, height: 300 }} />)}
        </ScrollView>
        <View style={{ position: 'absolute', left: 14, top: 14 }}><Pill lime>{categoryTitle(listing.category)}</Pill></View>
        <View style={{ position: 'absolute', right: 14, bottom: 14 }}><Pill>{imageIndex + 1} / {listing.images.length}</Pill></View>
      </View> : null}
      {sample ? <Notice>Приклад оголошення. Профіль, вартість та роботи не є реальною пропозицією послуг.</Notice> : null}
      {listing.moderation_status === 'pending' ? <Notice lime>Оголошення на перевірці. Воно з’явиться в каталозі після схвалення адміністратором.</Notice> : listing.moderation_status === 'rejected' ? <Notice>Оголошення відхилено. Виправте опис або фото та збережіть його для повторної перевірки.</Notice> : null}
      <Row style={{ gap: 6, marginBottom: 12 }}><Icon name="map-pin" size={14} color={C.muted} /><T style={{ color: C.muted, fontSize: 12 }}>{listing.city} · {shortDate(listing.created_at)}</T></Row>
      <T weight="display" style={{ fontSize: 30, lineHeight: 38, letterSpacing: -0.8, marginBottom: 18 }}>{listing.title}</T>
      <T weight="bold" style={{ fontSize: 23, lineHeight: 32, color: C.lime }}>{priceLabel(listing)}</T>
      <T style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>Остаточну вартість і терміни погоджуйте в чаті.</T>
      <Divider />
      <T weight="bold" style={{ fontSize: 18, marginBottom: 12 }}>Про {listing.kind === 'service' ? 'послугу' : 'завдання'}</T>
      <T selectable style={{ color: '#C8CDBE', lineHeight: 25 }}>{listing.description}</T>
      {listing.work_items?.length ? <View style={{ marginTop: 18, gap: 8 }}><T weight="bold" style={{ fontSize: 15 }}>Перелік робіт</T><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{listing.work_items.map(item => <Pill key={item}>{item}</Pill>)}</View></View> : null}
      {listing.urgency ? <Notice lime><T style={{ color: C.lime, fontSize: 12 }}>{listing.urgency === 'urgent' ? 'Терміново' : listing.urgency === 'week' ? 'Потрібно до тижня' : 'Потрібно до місяця'}</T></Notice> : null}
      <Divider />
      <Row style={{ gap: 13, marginBottom: 14 }}><View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' }}><T weight="bold" style={{ color: C.lime, fontSize: 18 }}>{initials(profile?.name || listing.team_name || 'Учасник')}</T></View><View style={{ flex: 1, gap: 4 }}><T weight="bold" style={{ fontSize: 16 }}>{listing.team_name || profile?.name || 'Учасник'}</T><T style={{ color: C.muted, fontSize: 11 }}>{listing.kind === 'service' ? 'Майстер / будівельна бригада' : 'Замовник'}</T></View></Row>
      <Button title="Профіль користувача" variant="secondary" style={{ marginBottom: 14 }} onPress={() => navigate({ name: 'publicProfile', id: listing.owner_id })} />
      {profile?.bio ? <T style={{ color: C.muted, fontSize: 13, lineHeight: 22 }}>{profile.bio}</T> : null}
      {listing.kind === 'request' && !owner && listing.status === 'active' ? <View style={{ marginTop: 24 }}>
        <Divider />
        <T weight="bold" style={{ fontSize: 18, marginBottom: 12 }}>{ownOffer ? 'Ваша пропозиція' : 'Запропонувати виконання'}</T>
        <Field label="Ваша ціна" value={offerPrice} onChangeText={setOfferPrice} keyboardType="decimal-pad" placeholder="Наприклад, 1500" />
        <Field label="Повідомлення замовнику" value={offerMessage} onChangeText={setOfferMessage} multiline placeholder="Коротко опишіть досвід і терміни." />
        <Button title={ownOffer ? 'Оновити пропозицію' : 'Надіслати пропозицію'} icon="send" busy={busy} onPress={() => { void submitOffer(); }} />
      </View> : null}
      {listing.kind === 'request' && owner && requestOffers.length ? <View style={{ marginTop: 24 }}>
        <Divider />
        <T weight="bold" style={{ fontSize: 18, marginBottom: 12 }}>Пропозиції майстрів · {requestOffers.length}</T>
        {requestOffers.map(offer => {
          const provider = store.profiles.find(item => item.id === offer.provider_id);
          return <View key={offer.id} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, marginBottom: 10, gap: 8 }}>
            <Row><T weight="bold" style={{ flex: 1 }}>{provider?.name || 'Майстер'}</T><T weight="bold" style={{ color: C.lime }}>{offer.price} {offer.unit}</T></Row>
            {offer.message ? <T style={{ color: C.muted, lineHeight: 20 }}>{offer.message}</T> : null}
            <T style={{ color: C.muted, fontSize: 12 }}>Статус: {offer.status === 'pending' ? 'очікує рішення' : offer.status}</T>
            {offer.status === 'pending' ? <Row style={{ gap: 8 }}><Button style={{ flex: 1 }} title="Прийняти" busy={busy} onPress={() => { void acceptOffer(offer.id); }} /><Button style={{ flex: 1 }} title="Відхилити" variant="secondary" onPress={() => { void store.updateOfferStatus(offer.id, 'rejected').catch(e => setError(String(e))); }} /></Row> : null}
          </View>;
        })}
      </View> : null}
      {requestOrder ? <View style={{ marginTop: 24 }}>
        <Divider />
        <T weight="bold" style={{ fontSize: 18, marginBottom: 8 }}>Замовлення</T>
        <T style={{ color: C.muted, marginBottom: 12 }}>Статус: {requestOrder.status === 'accepted' ? 'прийнято' : requestOrder.status === 'in_progress' ? 'у роботі' : requestOrder.status === 'completed' ? 'завершено' : 'скасовано'} · {requestOrder.agreed_price} {requestOrder.unit}</T>
        {requestOrder.status === 'accepted' ? <Button title="Почати роботу" icon="play" busy={busy} onPress={() => { void changeOrderStatus('in_progress'); }} /> : null}
        {requestOrder.status === 'in_progress' ? <Row style={{ gap: 8 }}><Button style={{ flex: 1 }} title="Завершити" icon="check" busy={busy} onPress={() => { void changeOrderStatus('completed'); }} /><Button style={{ flex: 1 }} title="Скасувати" variant="secondary" onPress={() => { void changeOrderStatus('cancelled'); }} /></Row> : null}
      </View> : null}
      {owner ? <View style={{ gap: 10, marginTop: 22 }}><Button title={listing.status === 'active' ? 'Позначити як завершене' : 'Повернути в публікацію'} icon="check-circle" variant="secondary" busy={busy} onPress={() => { void statusAction(); }} /><Button title={listing.status === 'hidden' ? 'Показати оголошення' : 'Приховати оголошення'} icon="eye-off" variant="secondary" onPress={async () => { try { await store.changeStatus(id, listing.status === 'hidden' ? 'active' : 'hidden'); } catch (e) { setError(String(e)); } }} /></View> : null}
      {error ? <T style={{ color: C.danger, marginTop: 16 }}>{error}</T> : null}
    </ScrollView>
    <Row style={{ paddingHorizontal: 22, paddingVertical: 14, gap: 12, borderTopWidth: 1, borderTopColor: C.line }}>
      {!owner ? <RoundButton icon="heart" label={favorite ? 'Прибрати з обраного' : 'Додати в обране'} active={favorite} onPress={() => { void favoriteAction(); }} /> : null}
      <Button style={{ flex: 1 }} title={owner ? 'Редагувати' : blocked ? 'Користувача заблоковано' : listing.status !== 'active' ? 'Оголошення неактивне' : listing.kind === 'service' ? 'Написати майстру' : 'Відгукнутися на заявку'} icon={owner ? 'edit-2' : 'message-circle'} disabled={!owner && (blocked || listing.status !== 'active')} busy={busy} onPress={() => owner ? navigate({ name: 'edit', id }) : void contact()} />
    </Row>
    <Moderation open={moderation} onClose={() => setModeration(false)} userId={listing.owner_id} listingId={listing.id} onBlocked={onBack} />
  </Page>;
}
