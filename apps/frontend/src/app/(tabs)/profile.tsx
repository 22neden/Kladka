import React from 'react';
import { ProfileScreen } from '../../screens/ProfileScreen';
import { navigate } from '../../lib/navigation';
export default function ProfileRoute() { return <ProfileScreen navigate={navigate} />; }
