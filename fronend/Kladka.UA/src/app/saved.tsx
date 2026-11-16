import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SavedListingsScreen } from '../screens/ProfileScreen';
import { back, navigate } from '../lib/navigation';
export default function SavedRoute() { const { kind } = useLocalSearchParams<{ kind?: string }>(); return <SavedListingsScreen kind={kind === 'mine' ? 'mine' : 'favorites'} onBack={back} navigate={navigate} />; }
