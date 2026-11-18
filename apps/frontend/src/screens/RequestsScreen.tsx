import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { C } from '../theme';
import { Button, Chip, Empty, Header, ListingCard, Notice, Page, Row, T } from '../components/UI';
import { useStore } from '../state/AppStore';
import type { Route } from '../domain/types';

type Section = 'requests' | 'offers' | 'orders';

export function RequestsScreen({ navigate }: { navigate: (route: Route) => void }) {
  const store = useStore();
  const [section, setSection] = useState<Section>('requests');
  const [actionError, setActionError] = useState('');
  const ownRequests = useMemo(() => store.listings.filter(listing => listing.owner_id === store.profile.id && listing.kind === 'request'), [store.listings, store.profile.id]);
  const myOffers = useMemo(() => store.offers.filter(offer => offer.provider_id === store.profile.id), [store.offers, store.profile.id]);
  const visibleListings = useMemo(() => new Map(store.listings.map(listing => [listing.id, listing])), [store.listings]);
  const title = section === 'requests' ? 'Мої заявки' : section === 'offers' ? 'Мої пропозиції' : 'Замовлення';
  async function changeOrder(orderId: string, status: 'in_progress' | 'completed' | 'cancelled') {
    setActionError('');
    try { await store.updateOrderStatus(orderId, status); }
    catch (error) { setActionError(error instanceof Error ? error.message : String(error)); }
  }

  return <Page bottom>
    <Header title="Заявки" right={<T style={{ color: C.lime, fontSize: 12 }}>{ownRequests.length + myOffers.length + store.orders.length}</T>} />
    <ScrollView refreshControl={<RefreshControl refreshing={store.syncing} onRefresh={() => { void store.refresh(); }} tintColor={C.lime} />} contentContainerStyle={{ padding: 22, paddingBottom: 35 }}>
      <T weight="display" style={{ fontSize: 29, lineHeight: 36, marginBottom: 10 }}>Керуйте{'\n'}своїми проєктами.</T>
      <T style={{ color: C.muted, marginBottom: 22 }}>Заявки, пропозиції та домовленості — в одному місці.</T>
      {actionError ? <T style={{ color: C.danger, marginBottom: 14 }}>{actionError}</T> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 22 }}>
        <Chip title={'Мої заявки · ' + ownRequests.length} active={section === 'requests'} onPress={() => setSection('requests')} />
        <Chip title={'Пропозиції · ' + myOffers.length} active={section === 'offers'} onPress={() => setSection('offers')} />
        <Chip title={'Замовлення · ' + store.orders.length} active={section === 'orders'} onPress={() => setSection('orders')} />
      </ScrollView>

      {section === 'requests' ? ownRequests.length ? ownRequests.map(listing => <ListingCard key={listing.id} listing={listing} onPress={() => navigate({ name: 'listing', id: listing.id })} />) :
        <Empty title="Створіть першу заявку" body="Опишіть будівельну задачу — майстри побачать її та надішлють свої пропозиції." icon="layers" action={<Button title="Створити заявку" icon="plus" onPress={() => navigate({ name: 'edit', kind: 'request' })} />} /> : null}

      {section === 'offers' ? myOffers.length ? myOffers.map(offer => {
        const listing = visibleListings.get(offer.request_id);
        return <View key={offer.id} style={{ backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 16, marginBottom: 12, gap: 8 }}>
          <Row><T weight="bold" style={{ flex: 1 }}>{listing?.title || 'Заявка недоступна'}</T><T weight="bold" style={{ color: C.lime }}>{offer.price} {offer.unit}</T></Row>
          {offer.message ? <T style={{ color: C.muted, lineHeight: 20 }}>{offer.message}</T> : null}
          <T style={{ color: C.muted, fontSize: 11 }}>Статус: {offer.status === 'pending' ? 'очікує рішення' : offer.status === 'accepted' ? 'прийнята' : offer.status === 'rejected' ? 'відхилена' : 'відкликана'}</T>
          {listing ? <Button title="Відкрити заявку" variant="secondary" onPress={() => navigate({ name: 'listing', id: listing.id })} /> : null}
        </View>;
      }) : <Empty title="Пропозицій ще немає" body="Відкрийте заявку в пошуку та запропонуйте свої будівельні послуги." icon="send" /> : null}

      {section === 'orders' ? store.orders.length ? store.orders.map(order => {
        const listing = visibleListings.get(order.request_id);
        const canStart = order.status === 'accepted' && order.provider_id === store.profile.id;
        const canComplete = order.status === 'in_progress' && order.provider_id === store.profile.id;
        const canCancel = (order.status === 'accepted' || order.status === 'in_progress') && [order.provider_id, order.customer_id].includes(store.profile.id);
        return <View key={order.id} style={{ backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 16, marginBottom: 12, gap: 8 }}>
          <Row><T weight="bold" style={{ flex: 1 }}>{listing?.title || 'Будівельний проєкт'}</T><T weight="bold" style={{ color: C.lime }}>{order.agreed_price} {order.unit}</T></Row>
          <T style={{ color: C.muted, fontSize: 11 }}>Статус: {order.status === 'accepted' ? 'прийнято' : order.status === 'in_progress' ? 'у роботі' : order.status === 'completed' ? 'завершено' : 'скасовано'}</T>
          {canStart ? <Button title="Почати роботу" icon="play" onPress={() => { void changeOrder(order.id, 'in_progress'); }} /> : null}
          {canComplete ? <Button title="Завершити роботу" icon="check" onPress={() => { void changeOrder(order.id, 'completed'); }} /> : null}
          {canCancel ? <Button title="Скасувати замовлення" variant="secondary" onPress={() => { void changeOrder(order.id, 'cancelled'); }} /> : null}
          {listing ? <Button title="Відкрити проєкт" variant="secondary" onPress={() => navigate({ name: 'listing', id: listing.id })} /> : null}
        </View>;
      }) : <Empty title="Замовлень ще немає" body="Прийміть пропозицію майстра або дочекайтеся рішення замовника." icon="check-circle" /> : null}

      {!store.remote ? <Notice>Локальний режим: заявки та пропозиції зберігаються лише на цьому пристрої.</Notice> : null}
    </ScrollView>
  </Page>;
}
