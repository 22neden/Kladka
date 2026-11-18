import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { C } from '../theme';
import { AppProvider, useStore } from '../state/AppStore';
import { Button, Icon, Notice, Row, T } from '../components/UI';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() { return this.state.error ? <View style={{ flex: 1, padding: 30, backgroundColor: C.bg, justifyContent: 'center', gap: 20 }}><T weight="bold" style={{ fontSize: 22 }}>Потрібен перезапуск</T><T style={{ color: C.muted }}>{this.state.error}</T><Button title="Спробувати ще раз" onPress={() => this.setState({ error: null })} /></View> : this.props.children; }
}
function Routes() {
  const store = useStore();
  const insets = useSafeAreaInsets();
  if (!store.ready || (store.entered && store.remote && !store.profile.id)) return <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 20 }}><ActivityIndicator color={C.lime} /><T style={{ textAlign: 'center' }}>Завантажуємо ваш простір…</T>{store.error ? <><Notice>{store.error}</Notice><Button title="Повторити" onPress={() => { void store.refresh(); }} /><Button title="Вийти" variant="secondary" onPress={() => { void store.signOut(); }} /></> : null}</View>;
  return <View style={{ flex: 1 }}>
    {store.error ? <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 8, backgroundColor: '#38231D' }}><Row style={{ gap: 10 }}><T style={{ color: C.danger, flex: 1, fontSize: 11 }}>{store.error}</T><Pressable accessibilityRole="button" accessibilityLabel="Закрити повідомлення про помилку" onPress={store.clearError}><Icon name="x" color={C.danger} size={16} /></Pressable></Row></View> : null}
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
      <Stack.Protected guard={!store.entered}><Stack.Screen name="index" /></Stack.Protected>
      <Stack.Protected guard={store.entered}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="listing/[id]" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="edit" />
        <Stack.Screen name="profile-edit" />
        <Stack.Screen name="saved" />
        <Stack.Screen name="about" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="member/[id]" />
      </Stack.Protected>
      <Stack.Screen name="auth/callback" />
    </Stack>
  </View>;
}
export default function RootLayout() {
  const [loaded, error] = useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_700Bold, Manrope_800ExtraBold });
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center' }}><ActivityIndicator color={C.lime} /></View>;
  return <ErrorBoundary><SafeAreaProvider><AppProvider><StatusBar style="light" /><View style={{ flex: 1, backgroundColor: '#090B08', alignItems: 'center' }}><View style={{ flex: 1, width: '100%', maxWidth: 520, backgroundColor: C.bg }}><Routes /></View></View></AppProvider></SafeAreaProvider></ErrorBoundary>;
}
