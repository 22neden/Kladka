import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { DetailScreen } from '../../screens/DetailScreen';
import { back, navigate } from '../../lib/navigation';
export default function ListingRoute() { const { id } = useLocalSearchParams<{ id: string }>(); return <DetailScreen id={id} onBack={back} navigate={navigate} />; }
