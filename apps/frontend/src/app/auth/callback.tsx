import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { C } from '../../theme';
import { Button, T } from '../../components/UI';
import { completeOAuthCode } from '../../lib/backend';
export default function CallbackRoute() {
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [error, setError] = useState(error_description || '');
  useEffect(() => {
    if (!code) { if (!error_description) router.replace('/'); return; }
    completeOAuthCode(code).then(() => router.replace('/(tabs)')).catch(e => setError(e.message));
  }, [code, error_description]);
  return <View style={{ flex: 1, justifyContent: 'center', padding: 26, gap: 20 }}>{error ? <><T style={{ color: C.danger }}>{error}</T><Button title="Повернутися до входу" onPress={() => router.replace('/')} /></> : <ActivityIndicator color={C.lime} />}</View>;
}
