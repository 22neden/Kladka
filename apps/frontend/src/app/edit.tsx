import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { EditScreen } from '../screens/EditScreen';
import { back } from '../lib/navigation';
export default function EditRoute() { const { id, kind } = useLocalSearchParams<{ id?: string; kind?: string }>(); return <EditScreen id={id} initialKind={kind === 'request' ? 'request' : 'service'} onBack={back} onSaved={savedId => router.replace({ pathname: '/listing/[id]', params: { id: savedId } })} />; }
