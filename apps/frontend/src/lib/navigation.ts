import { router } from 'expo-router';
import type { Route } from '../domain/types';
export function navigate(route: Route) {
  switch (route.name) {
    case 'listing': router.push({ pathname: '/listing/[id]', params: { id: route.id } }); break;
    case 'chat': router.push({ pathname: '/chat/[id]', params: { id: route.id } }); break;
    case 'edit': router.push({ pathname: '/edit', params: { ...(route.id ? { id: route.id } : {}), ...(route.kind ? { kind: route.kind } : {}) } }); break;
    case 'favorites': case 'mine': router.push({ pathname: '/saved', params: { kind: route.name } }); break;
    case 'editProfile': router.push('/profile-edit'); break;
    case 'settings': router.push('/settings'); break;
    case 'publicProfile': router.push({ pathname: '/member/[id]', params: { id: route.id } }); break;
    case 'about': router.push('/about'); break;
    case 'requests': router.push('/(tabs)/requests'); break;
    default: router.replace('/(tabs)');
  }
}
export function back() { if (router.canGoBack()) router.back(); else router.replace('/(tabs)'); }
