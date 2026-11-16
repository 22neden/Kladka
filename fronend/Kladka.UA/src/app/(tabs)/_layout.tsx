import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Tabs, router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../../theme';
import { Button, ChoiceModal, Icon, T, type IconName } from '../../components/UI';
import { useStore } from '../../state/AppStore';
import { navigate } from '../../lib/navigation';
import { otherParticipant } from '../../domain/logic';
const items: { name: string; label: string; icon: IconName; test: string }[] = [
  { name: 'index', label: 'Пошук', icon: 'compass', test: 'catalog' },
  { name: 'requests', label: 'Заявки', icon: 'layers', test: 'requests' },
  { name: 'create', label: 'Додати', icon: 'plus', test: 'create' },
  { name: 'chats', label: 'Чати', icon: 'message-circle', test: 'chats' },
  { name: 'profile', label: 'Профіль', icon: 'user', test: 'profile' },
];
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
function TabBar({ state }: TabBarProps) {
  const store = useStore();
  const insets = useSafeAreaInsets();
  const [createOpen, setCreateOpen] = useState(false);
  const current = state.routes[state.index].name;
  const unread = store.messages.filter(m => {
    const conv = store.conversations.find(c => c.id === m.conversation_id);
    return conv && !store.blocked.includes(otherParticipant(conv, store.profile.id)) && m.sender_id !== store.profile.id && m.created_at > (store.readAt[m.conversation_id] || '');
  }).length;
  return <>
    <View style={{ backgroundColor: '#151812', borderTopWidth: 1, borderTopColor: C.line, paddingBottom: Math.max(insets.bottom, 12), paddingTop: 10, flexDirection: 'row', alignItems: 'center' }}>
      {items.map(t => <Pressable key={t.name} testID={'tab-' + t.test} accessibilityRole="tab" accessibilityState={{ selected: current === t.name }} accessibilityLabel={t.label} onPress={() => t.name === 'create' ? setCreateOpen(true) : router.navigate((t.name === 'index' ? '/(tabs)' : `/(tabs)/${t.name}`) as Href)} style={{ flex: 1, alignItems: 'center', gap: 5 }}>
        <View style={{ height: 34, width: t.name === 'create' ? 48 : 42, backgroundColor: t.name === 'create' ? C.lime : 'transparent', borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}><Icon name={t.icon} size={t.name === 'create' ? 24 : 21} color={t.name === 'create' ? C.dark : current === t.name ? C.lime : C.muted} />{t.name === 'chats' && unread ? <View style={{ position: 'absolute', right: 1, top: 0, borderRadius: 6, width: 7, height: 7, backgroundColor: C.lime }} /> : null}</View>
        <T weight="medium" style={{ fontSize: 9, lineHeight: 14, color: current === t.name ? C.lime : C.muted }}>{t.label}</T>
      </Pressable>)}
    </View>
    <ChoiceModal title="Що хочете додати?" open={createOpen} onClose={() => setCreateOpen(false)}>
      <View style={{ gap: 16 }}><T style={{ color: C.muted, marginBottom: 8 }}>Оголошення — перший крок до спільного проєкту.</T><Button title="Пропоную будівельні послуги" icon="tool" onPress={() => { setCreateOpen(false); navigate({ name: 'edit', kind: 'service' }); }} /><Button title="Шукаю майстра / бригаду" icon="home" variant="secondary" onPress={() => { setCreateOpen(false); navigate({ name: 'edit', kind: 'request' }); }} /></View>
    </ChoiceModal>
  </>;
}
export default function TabsLayout() {
  return <Tabs tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg } }}>
    <Tabs.Screen name="index" options={{ title: 'Пошук' }} />
    <Tabs.Screen name="requests" options={{ title: 'Заявки' }} />
    <Tabs.Screen name="chats" options={{ title: 'Чати' }} />
    <Tabs.Screen name="profile" options={{ title: 'Профіль' }} />
  </Tabs>;
}
