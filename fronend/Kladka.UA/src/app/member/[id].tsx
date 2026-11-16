import React from 'react';
import { Image, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { back, navigate } from '../../lib/navigation';
import { useStore } from '../../state/AppStore';
import { C, categoryTitle } from '../../theme';
import { Empty, Header, ListingCard, Notice, Page, Pill, Row, T } from '../../components/UI';
import { initials } from '../../domain/logic';
export default function MemberProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const profile = store.profile.id === id ? store.profile : store.profiles.find(p => p.id === id);
  if (!profile || store.blocked.includes(id)) return <Page><Header title="Профіль" onBack={back} /><Empty title="Профіль недоступний" body="Користувача видалено або заблоковано." /></Page>;
  const listings = store.listings.filter(l => l.owner_id === id && l.status === 'active' && (!l.moderation_status || l.moderation_status === 'approved'));
  return <Page><Header title="Профіль користувача" onBack={back} /><ScrollView contentContainerStyle={{ padding: 22, gap: 18 }}>
    <View style={{ backgroundColor: C.card, padding: 24, borderRadius: 24, gap: 16 }}>
      {profile.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={{ width: 80, height: 80, borderRadius: 26 }} /> : <T weight="display" style={{ color: C.lime, fontSize: 36, lineHeight: 46 }}>{initials(profile.name)}</T>}
      <T weight="display" style={{ fontSize: 26, lineHeight: 34 }}>{profile.name}</T>
      <T style={{ color: C.muted }}>{profile.city || 'Місто не вказане'} · {profile.role === 'professional' ? 'Майстер / бригада' : 'Замовник'}</T>
      {profile.role === 'professional' ? <><Pill lime={profile.availability !== 'busy'}>{profile.availability === 'busy' ? 'Зараз зайнятий' : 'Відкритий до замовлень'}</Pill>{Boolean(profile.experience_years) ? <T>Досвід: {profile.experience_years} р. · зі слів користувача</T> : null}<Row style={{ flexWrap: 'wrap', gap: 8 }}>{profile.specialties?.map(s => <Pill key={s}>{categoryTitle(s)}</Pill>)}</Row></> : null}
      <T style={{ color: C.muted }}>{profile.bio || 'Користувач ще не додав опис.'}</T>
    </View>
    {!store.remote ? <Notice>Локальний перегляд. Дані прикладів не є перевіреними профілями реальних майстрів.</Notice> : null}
    <T weight="bold" style={{ fontSize: 20 }}>Активні оголошення · {listings.length}</T>
    {listings.length ? listings.map(l => <ListingCard key={l.id} listing={l} onPress={() => navigate({ name: 'listing', id: l.id })} />) : <Empty title="Оголошень ще немає" body="Тут з’являться опубліковані послуги та заявки." />}
  </ScrollView></Page>;
}
