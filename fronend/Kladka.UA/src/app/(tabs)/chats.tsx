import React from 'react';
import { ChatsScreen } from '../../screens/ChatsScreen';
import { navigate } from '../../lib/navigation';
export default function ChatsRoute() { return <ChatsScreen navigate={navigate} />; }
