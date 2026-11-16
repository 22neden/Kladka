import React from 'react';
import { CatalogScreen } from '../../screens/CatalogScreen';
import { navigate } from '../../lib/navigation';
export default function RequestsRoute() { return <CatalogScreen kind="request" navigate={navigate} />; }
