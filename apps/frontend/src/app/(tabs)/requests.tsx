import React from 'react';
import { RequestsScreen } from '../../screens/RequestsScreen';
import { navigate } from '../../lib/navigation';
export default function RequestsRoute() { return <RequestsScreen navigate={navigate} />; }
