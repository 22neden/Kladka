import React from 'react';
import { CatalogScreen } from '../../screens/CatalogScreen';
import { navigate } from '../../lib/navigation';
export default function CatalogRoute() { return <CatalogScreen kind="service" navigate={navigate} />; }
