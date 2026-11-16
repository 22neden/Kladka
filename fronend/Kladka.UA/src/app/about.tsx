import React from 'react';
import { AboutScreen } from '../screens/ProfileScreen';
import { back } from '../lib/navigation';
export default function AboutRoute() { return <AboutScreen onBack={back} />; }
