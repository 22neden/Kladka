import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ChatScreen } from '../../screens/ChatsScreen';
import { back, navigate } from '../../lib/navigation';
export default function ChatRoute() { const { id } = useLocalSearchParams<{ id: string }>(); return <ChatScreen id={id} onBack={back} navigate={navigate} />; }
