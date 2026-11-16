import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { C, categories, cities } from '../theme';
import { Button, Chip, ChoiceModal, Empty, Field, Icon, ListingCard, Notice, Page, RoundButton, Row, T } from '../components/UI';
import { emptyFilters, filterListings, type Filters } from '../domain/logic';
import type { ListingKind, Route } from '../domain/types';
import { useStore } from '../state/AppStore';

export function CatalogScreen({ kind, navigate }: { kind: ListingKind; navigate: (route: Route) => void }) {
  const store = useStore();
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters });
  const [draft, setDraft] = useState<Filters>({ ...emptyFilters });
  const [filterOpen, setFilterOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const listings = useMemo(() => filterListings(store.listings, kind, filters, store.blocked), [store.listings, store.blocked, kind, filters]);
  const filtered = Boolean(filters.city || filters.maxPrice || filters.category !== 'all' || filters.query);
  const service = kind === 'service';
  function openFilter() { setDraft({ ...filters }); setFilterOpen(true); }
  return <Page>
    <ScrollView keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={store.syncing} onRefresh={() => { void store.refresh(); }} tintColor={C.lime} />} contentContainerStyle={{ paddingBottom: 26 }}>
      <Row style={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 28, justifyContent: 'space-between' }}>
        <Row style={{ gap: 9 }}><View style={{ width: 33, height: 33, backgroundColor: C.lime, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}><Icon name="layers" color={C.dark} size={18} /></View><T weight="display" style={{ fontSize: 10, lineHeight: 14, letterSpacing: 0.4 }}>KLADKA.UA</T></Row>
        <Pressable accessibilityRole="button" accessibilityLabel="Обрати місто" onPress={() => setCityOpen(true)} style={{ backgroundColor: C.card, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="map-pin" size={13} color={C.lime} /><T weight="medium" style={{ fontSize: 11 }}>{filters.city || 'Уся Україна'}</T><Icon name="chevron-down" size={13} color={C.muted} />
        </Pressable>
      </Row>
      <View style={{ paddingHorizontal: 22 }}>
        <T weight="bold" style={{ fontSize: 10, letterSpacing: 2, color: C.lime, marginBottom: 10 }}>{service ? 'БУДІВНИЦТВО · РЕМОНТ · ДИЗАЙН' : 'НОВІ МОЖЛИВОСТІ ДЛЯ МАЙСТРІВ'}</T>
        <T weight="display" style={{ fontSize: 35, lineHeight: 42, letterSpacing: -1.3, marginBottom: 12 }}>{service ? 'Ваш простір.\nПравильні люди.' : 'Ваш наступний\nвеликий проєкт.'}</T>
        <T style={{ color: C.muted, fontSize: 13, lineHeight: 21, marginBottom: 22 }}>{service ? 'Знайдіть майстра, з яким усе складеться.' : 'Знаходьте роботу, у якій ви найкращі.'}</T>
        <Row style={{ gap: 10, marginBottom: 22 }}>
          <View style={{ flex: 1, position: 'relative' }}>
            <Field accessibilityLabel="Пошук оголошень" placeholder={service ? 'Який майстер вам потрібен?' : 'Знайти роботи…'} value={filters.query} onChangeText={query => setFilters(f => ({ ...f, query }))} style={{ paddingLeft: 42, marginBottom: -18 }} />
            <View style={{ position: 'absolute', left: 15, top: 18 }} pointerEvents="none"><Icon name="search" color={C.muted} size={17} /></View>
          </View>
          <RoundButton icon="sliders" label="Фільтри" active={Boolean(filters.maxPrice || filters.sort !== 'newest')} onPress={openFilter} />
        </Row>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, gap: 15, paddingBottom: 23 }}>
        <Pressable accessibilityRole="button" onPress={() => setFilters(f => ({ ...f, category: 'all' }))} style={{ alignItems: 'center', gap: 9, width: 66 }}><View style={{ width: 56, height: 56, borderRadius: 19, backgroundColor: filters.category === 'all' ? C.lime : C.card, alignItems: 'center', justifyContent: 'center' }}><Icon name="compass" size={23} color={filters.category === 'all' ? C.dark : C.muted} /></View><T weight="medium" style={{ fontSize: 10, color: filters.category === 'all' ? C.text : C.muted }}>Усі послуги</T></Pressable>
        {categories.map(cat => <Pressable key={cat.id} accessibilityRole="button" accessibilityLabel={cat.title} onPress={() => setFilters(f => ({ ...f, category: cat.id }))} style={{ alignItems: 'center', gap: 9, width: 66 }}><View style={{ width: 56, height: 56, borderRadius: 19, backgroundColor: filters.category === cat.id ? C.lime : C.card, alignItems: 'center', justifyContent: 'center' }}><Icon name={cat.icon} size={23} color={filters.category === cat.id ? C.dark : C.muted} /></View><T weight="medium" numberOfLines={1} style={{ fontSize: 10, color: filters.category === cat.id ? C.text : C.muted }}>{cat.short}</T></Pressable>)}
      </ScrollView>
      <View style={{ paddingHorizontal: 22 }}>
        {!store.remote ? <Row style={{ gap: 7, marginBottom: 22 }}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.lime }} /><T style={{ fontSize: 10, color: C.muted }}>Локальна версія · приклади та ваші записи</T></Row> : null}
        <Row style={{ justifyContent: 'space-between', marginBottom: 18 }}>
          <T weight="bold" style={{ fontSize: 19 }}>{service ? 'Знайдіть свою команду' : 'Заявки на роботи'}</T><T style={{ fontSize: 11, color: C.muted }}>{listings.length} {listings.length === 1 ? 'результат' : 'знайдено'}</T>
        </Row>
        {filtered ? <Row style={{ gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>{filters.city ? <Chip title={filters.city + ' ×'} active onPress={() => setFilters(f => ({ ...f, city: '' }))} /> : null}<Chip title="Скинути фільтри" icon="x" onPress={() => setFilters({ ...emptyFilters })} /></Row> : null}
        {listings.length ? listings.map(listing => <ListingCard key={listing.id} listing={listing} onPress={() => navigate({ name: 'listing', id: listing.id })} />) : <Empty title={filtered ? 'Поки без збігів' : 'Тут починається спільнота'} body={filtered ? 'Змініть місто, категорію або пошуковий запит.' : 'Опублікуйте перше оголошення. У підключеному сервісі воно з’явиться після перевірки.'} action={<Button title={filtered ? 'Скинути фільтри' : 'Додати оголошення'} onPress={() => filtered ? setFilters({ ...emptyFilters }) : navigate({ name: 'edit', kind })} />} />}
        <View style={{ paddingTop: 5, paddingBottom: 10 }}><T style={{ fontSize: 10, color: C.muted, textAlign: 'center', letterSpacing: 1 }}>ВІД ІДЕЇ — ДО ВАШОГО ПРОСТОРУ</T></View>
      </View>
    </ScrollView>
    <ChoiceModal title="Де шукаємо?" open={cityOpen} onClose={() => setCityOpen(false)}>
      <Field label="Місто або населений пункт" value={citySearch} onChangeText={setCitySearch} placeholder="Наприклад, Рівне" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 18 }}>
        <Chip title="Уся Україна" active={!filters.city} onPress={() => { setFilters(f => ({ ...f, city: '' })); setCityOpen(false); }} />
        {cities.filter(c => !citySearch || c.toLowerCase().includes(citySearch.toLowerCase())).map(city => <Chip key={city} title={city} active={filters.city === city} onPress={() => { setFilters(f => ({ ...f, city })); setCityOpen(false); }} />)}
      </View>
      {citySearch.trim().length >= 2 ? <Button title={'Шукати: ' + citySearch.trim()} onPress={() => { setFilters(f => ({ ...f, city: citySearch.trim() })); setCityOpen(false); }} /> : null}
    </ChoiceModal>
    <ChoiceModal title="Уточнимо пошук" open={filterOpen} onClose={() => setFilterOpen(false)}>
      <Field label="Максимальна ціна, ₴" value={draft.maxPrice} onChangeText={maxPrice => setDraft(f => ({ ...f, maxPrice: maxPrice.replace(/[^0-9]/g, '') }))} placeholder="Без обмежень" keyboardType="numeric" />
      <Notice>Звертайте увагу на одиниці: ціна за м², точку та весь об’єкт відрізняється. Остаточний кошторис погоджується з майстром.</Notice>
      <T weight="bold" style={{ marginBottom: 12 }}>Сортування</T>
      <Row style={{ gap: 8, marginBottom: 24 }}><Chip title="Спочатку нові" active={draft.sort === 'newest'} onPress={() => setDraft(f => ({ ...f, sort: 'newest' }))} /><Chip title="За ціною" active={draft.sort === 'price'} onPress={() => setDraft(f => ({ ...f, sort: 'price' }))} /></Row>
      <Button title="Показати результати" icon="arrow-right" onPress={() => { setFilters(draft); setFilterOpen(false); }} />
    </ChoiceModal>
  </Page>;
}
