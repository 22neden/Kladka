import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createUuid } from '../lib/uuid';
import { AppState, Platform } from 'react-native';
import { api, hasBackend, loadSession, onSession, logout, setSession, type ApiUser as User } from '../lib/api';
import { initialLocalData, sampleProfiles } from '../data';
import type { AccountSettings, Conversation, Listing, ListingStatus, LocalData, Message, NewListing, Offer, Order, OrderStatus, Profile } from '../domain/types';
import { otherParticipant, validateListing } from '../domain/logic';
import { uploadPhoto } from '../lib/backend';
import { validateProfile } from '../domain/profile';
import { clearLocalPhotos } from '../lib/photos';

const CACHE_KEY = 'only-constructions.workspace.v1';
type State = LocalData & { profiles: Profile[] };
type Store = State & {
  ready: boolean; entered: boolean; remote: boolean; syncing: boolean; error: string | null;
  enterLocal: () => void; refresh: () => Promise<void>; clearError: () => void;
  saveListing: (draft: NewListing, id?: string) => Promise<string>;
  changeStatus: (id: string, status: ListingStatus) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  saveProfile: (profile: Profile) => Promise<void>;
  email: string; saveSettings: (settings: AccountSettings) => Promise<void>;
  openConversation: (listing: Listing) => Promise<string>;
  sendMessage: (id: string, body: string, image?: string) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  submitOffer: (requestId: string, offer: { message: string; price: number; unit: string }) => Promise<Offer>;
  updateOfferStatus: (offerId: string, status: 'rejected' | 'withdrawn') => Promise<void>;
  acceptOffer: (offerId: string) => Promise<Order>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  report: (listingId: string | null, userId: string, reason: string) => Promise<void>;
  block: (userId: string) => Promise<void>; unblock: (userId: string) => Promise<void>;
  signOut: () => Promise<void>; deleteAccount: () => Promise<void>;
};
const Context = createContext<Store | null>(null);
export function useStore() {
  const store = useContext(Context);
  if (!store) throw new Error('AppProvider missing');
  return store;
}
function fresh(): State { return { ...initialLocalData(), profiles: sampleProfiles }; }
function emptyRemote(): State { return { ...fresh(), profile: { id: '', name: '', city: '', bio: '', role: 'customer' }, profiles: [], listings: [], conversations: [], messages: [], offers: [], orders: [], favorites: [], blocked: [], readAt: {}, settings: { phone: '', newsletter_opt_in: false } }; }

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => hasBackend ? emptyRemote() : fresh());
  const [ready, setReady] = useState(false);
  const [entered, setEntered] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const userRef = useRef<User | null>(null);
  const stateRef = useRef(state);
  useLayoutEffect(() => { stateRef.current = state; }, [state]);
  const loadSequence = useRef(0);
  const persistQueue = useRef(Promise.resolve());
  const remote = hasBackend;

  useEffect(() => {
    if (hasBackend) {
      const update = (session: Awaited<ReturnType<typeof loadSession>>) => {
        const nextUser = session?.user || null;
        if (nextUser?.id !== userRef.current?.id) { loadSequence.current++; setState(emptyRemote()); setError(null); }
        userRef.current = nextUser; setUser(nextUser); setEntered(Boolean(session)); setReady(true);
      };
      const unsubscribe = onSession(update);
      void loadSession().then(update).catch(() => { setError('Не вдалося відновити сесію.'); setReady(true); });
      return unsubscribe;
    }
    AsyncStorage.getItem(CACHE_KEY).then(raw => {
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached.version === 1 && cached.data?.profile && Array.isArray(cached.data.listings)) setState({ ...fresh(), ...cached.data, profiles: sampleProfiles });
      }
    }).catch(() => setError('Не вдалося прочитати локальні дані. Можливо, сховище пристрою переповнене.')).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (remote || !ready) return;
    // Serialize writes so an older snapshot never overwrites a newer one.
    const snapshot = JSON.stringify({ version: 1, data: state });
    persistQueue.current = persistQueue.current.then(() => AsyncStorage.setItem(CACHE_KEY, snapshot))
      .catch(() => setError('Не вдалося зберегти зміни на пристрої.'));
  }, [state, ready, remote]);

  const refreshing = useRef<Promise<void> | null>(null);
  const refresh = useCallback(async function refreshNow(): Promise<void> {
    if (!hasBackend || !userRef.current) return;
    if (refreshing.current) { await refreshing.current; return refreshNow(); }
    const uid = userRef.current.id;
    const sequence = ++loadSequence.current;
    setSyncing(true);
    const task = (async () => {
      try {
        const next = await api<State>('/api/workspace');
        if (sequence !== loadSequence.current || uid !== userRef.current?.id) return;
        setState(next); setError(null);
      } catch (e) { if (sequence === loadSequence.current) setError(e instanceof Error ? e.message : String(e)); }
      finally { if (sequence === loadSequence.current) setSyncing(false); }
    })();
    refreshing.current = task;
    try { await task; } finally { if (refreshing.current === task) refreshing.current = null; }
  }, []);

  const uid = user?.id;
  useEffect(() => {
    if (!hasBackend || !uid) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const visible = () => Platform.OS === 'web' ? document.visibilityState !== 'hidden' : AppState.currentState === 'active';
    const poll = async () => {
      if (stopped) return;
      if (visible()) await refresh();
      if (!stopped) timer = setTimeout(() => { void poll(); }, 10000);
    };
    void poll();
    const subscription = AppState.addEventListener('change', status => { if (status === 'active') void refresh(); });
    return () => { stopped = true; clearTimeout(timer); subscription.remove(); };
  }, [uid, refresh]);

  async function saveListing(draft: NewListing, id?: string) {
    const validation = validateListing(draft);
    if (validation) throw new Error(validation);
    const owner = remote ? userRef.current?.id : state.profile.id;
    if (!owner) throw new Error('Спочатку увійдіть в обліковий запис.');
    const existing = id ? stateRef.current.listings.find(l => l.id === id) : null;
    if (id && (!existing || existing.owner_id !== owner)) throw new Error('Редагувати можна лише власні оголошення.');
    const images = await Promise.all(draft.images.map(uri => /^(https?:|sample:)/.test(uri) ? uri : uploadPhoto(uri, owner, 'portfolio')));
    const listing: Listing = { ...draft, title: draft.title.trim(), description: draft.description.trim(), city: draft.city.trim(), images, id: id || createUuid(), owner_id: owner, status: existing?.status || 'active', created_at: existing?.created_at || new Date().toISOString() };
    if (hasBackend) {
      const saved = await api<Listing>(id ? '/api/listings/' + id : '/api/listings', { method: id ? 'PATCH' : 'POST', body: { ...draft, images } });
      await refresh();
      return saved.id;
    } else setState(s => ({ ...s, listings: id ? s.listings.map(l => l.id === id ? listing : l) : [listing, ...s.listings] }));
    return listing.id;
  }
  async function changeStatus(id: string, status: ListingStatus) {
    const listing = stateRef.current.listings.find(l => l.id === id);
    if (!listing || listing.owner_id !== stateRef.current.profile.id) throw new Error('Це оголошення належить іншому користувачу.');
    if (hasBackend) { await api('/api/listings/' + id + '/status', { method: 'PATCH', body: { status } }); await refresh(); }
    else setState(s => ({ ...s, listings: s.listings.map(l => l.id === id ? { ...l, status } : l) }));
  }
  async function toggleFavorite(id: string) {
    const exists = stateRef.current.favorites.includes(id);
    if (hasBackend) await api('/api/favorites/' + id, { method: exists ? 'DELETE' : 'PUT' });
    setState(s => ({ ...s, favorites: exists ? s.favorites.filter(f => f !== id) : [...s.favorites, id] }));
  }
  async function saveProfile(profile: Profile) {
    if (profile.id !== stateRef.current.profile.id) throw new Error('Чужий профіль недоступний для редагування.');
    const invalid = validateProfile(profile);
    if (invalid) throw new Error(invalid);
    let avatar_url = profile.avatar_url || '';
    if (avatar_url && !/^https?:/.test(avatar_url) && hasBackend) avatar_url = await uploadPhoto(avatar_url, profile.id, 'portfolio');
    const clean = { ...profile, name: profile.name.trim(), city: profile.city.trim(), bio: profile.bio.trim(), avatar_url,
      specialties: profile.specialties || [], experience_years: profile.experience_years || 0, availability: profile.availability || 'available' };
    if (hasBackend) await api('/api/profile', { method: 'PATCH', body: clean });
    setState(s => ({ ...s, profile: clean, profiles: [...s.profiles.filter(p => p.id !== clean.id), clean] }));
  }
  async function saveSettings(settings: AccountSettings) {
    const phone = settings.phone.trim();
    if (phone && !/^\+?[0-9 ()-]{7,24}$/.test(phone)) throw new Error('Перевірте номер телефону (7–24 символи).');
    const clean = { phone, newsletter_opt_in: settings.newsletter_opt_in };
    if (hasBackend) await api('/api/settings', { method: 'PATCH', body: clean });
    setState(s => ({ ...s, settings: clean }));
  }
  async function openConversation(listing: Listing) {
    const uid = stateRef.current.profile.id;
    if (listing.owner_id === uid) throw new Error('Це ваше оголошення. Його можна редагувати у профілі.');
    if (stateRef.current.blocked.includes(listing.owner_id)) throw new Error('Спочатку розблокуйте цього користувача у профілі.');
    const existing = stateRef.current.conversations.find(c => c.listing_id === listing.id && [c.participant_a, c.participant_b].includes(listing.owner_id));
    if (existing) return existing.id;
    let id = createUuid();
    if (hasBackend) {
      const data = await api<Conversation>('/api/conversations', { method: 'POST', body: { listing_id: listing.id } });
      id = data.id;
      await refresh();
    } else {
      const now = new Date().toISOString();
      const c: Conversation = { id, participant_a: uid, participant_b: listing.owner_id, listing_id: listing.id, created_at: now, updated_at: now };
      setState(s => ({ ...s, conversations: [c, ...s.conversations] }));
    }
    return id;
  }
  async function sendMessage(id: string, body: string, image?: string) {
    if (!body.trim() && !image) return;
    if (body.trim().length > 4000) throw new Error('Повідомлення має містити до 4000 символів.');
    const uid = stateRef.current.profile.id;
    const c = stateRef.current.conversations.find(c => c.id === id);
    if (!c || ![c.participant_a, c.participant_b].includes(uid)) throw new Error('Немає доступу до чату.');
    if (stateRef.current.blocked.includes(otherParticipant(c, uid))) throw new Error('Користувача заблоковано.');
    const imagePath = image ? await uploadPhoto(image, id + '/' + uid, 'chat-images') : null;
    const message: Message = { id: createUuid(), conversation_id: id, sender_id: uid, body: body.trim(), image_path: imagePath, created_at: new Date().toISOString() };
    if (hasBackend) { await api('/api/conversations/' + id + '/messages', { method: 'POST', body: { body: message.body, image_path: imagePath, client_id: message.id } }); await refresh(); }
    else setState(s => ({ ...s, messages: [...s.messages, message], conversations: s.conversations.map(c => c.id === id ? { ...c, updated_at: message.created_at } : c) }));
  }
  const markRead = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    if (hasBackend) {
      try { await api('/api/conversations/' + id + '/read', { method: 'PUT' }); }
      catch (e) { setError(e instanceof Error ? e.message : String(e)); return; }
    }
    setState(s => ({ ...s, readAt: { ...s.readAt, [id]: now } }));
  }, []);
  async function submitOffer(requestId: string, offer: { message: string; price: number; unit: string }) {
    if (!hasBackend) throw new Error('Пропозиції доступні після підключення сервера.');
    const saved = await api<Offer>('/api/requests/' + requestId + '/offers', { method: 'POST', body: offer });
    await refresh();
    return saved;
  }
  async function updateOfferStatus(offerId: string, status: 'rejected' | 'withdrawn') {
    if (!hasBackend) throw new Error('Пропозиції доступні після підключення сервера.');
    await api('/api/offers/' + offerId + '/status', { method: 'PATCH', body: { status } });
    await refresh();
  }
  async function acceptOffer(offerId: string) {
    if (!hasBackend) throw new Error('Замовлення доступні після підключення сервера.');
    const order = await api<Order>('/api/offers/' + offerId + '/accept', { method: 'POST' });
    await refresh();
    return order;
  }
  async function updateOrderStatus(orderId: string, status: OrderStatus) {
    if (!hasBackend) throw new Error('Замовлення доступні після підключення сервера.');
    await api('/api/orders/' + orderId + '/status', { method: 'PATCH', body: { status } });
    await refresh();
  }
  async function report(listingId: string | null, userId: string, reason: string) {
    if (!reason.trim()) throw new Error('Опишіть причину скарги.');
    if (hasBackend) await api('/api/reports', { method: 'POST', body: { listing_id: listingId, reported_id: userId, reason: reason.trim() } });
    else {
      const raw = await AsyncStorage.getItem(CACHE_KEY + '.reports');
      const reports = raw ? JSON.parse(raw) : [];
      await AsyncStorage.setItem(CACHE_KEY + '.reports', JSON.stringify([...reports, { listingId, userId, reason, created_at: new Date().toISOString() }]));
    }
  }
  async function block(userId: string) {
    if (userId === state.profile.id) return;
    if (hasBackend) await api('/api/blocks/' + userId, { method: 'PUT' });
    setState(s => ({ ...s, blocked: [...new Set([...s.blocked, userId])] }));
  }
  async function unblock(userId: string) {
    if (hasBackend) await api('/api/blocks/' + userId, { method: 'DELETE' });
    setState(s => ({ ...s, blocked: s.blocked.filter(id => id !== userId) }));
  }
  async function signOut() {
    if (hasBackend) await logout();
    setEntered(false);
  }
  async function deleteAccount() {
    if (hasBackend) {
      await api('/api/account', { method: 'DELETE' });
      await setSession(null);
    } else {
      await persistQueue.current;
      await AsyncStorage.multiRemove([CACHE_KEY, CACHE_KEY + '.reports']);
    }
    clearLocalPhotos();
    setEntered(false);
    setState(fresh());
  }
  return <Context.Provider value={{ ...state, email: user?.email || '', saveSettings, ready, entered, remote, syncing, error, enterLocal: () => setEntered(true), clearError: () => setError(null), refresh, saveListing, changeStatus, toggleFavorite, saveProfile, openConversation, sendMessage, markRead, submitOffer, updateOfferStatus, acceptOffer, updateOrderStatus, report, block, unblock, signOut, deleteAccount }}>{children}</Context.Provider>;
}
