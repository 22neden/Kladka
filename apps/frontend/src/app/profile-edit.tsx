import React from 'react';
import { EditProfileScreen } from '../screens/ProfileScreen';
import { back } from '../lib/navigation';
export default function EditProfileRoute() { return <EditProfileScreen onBack={back} />; }
