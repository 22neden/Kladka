import type { CategoryId, Listing, ListingKind, NewListing } from './types';

export type Filters = { query: string; city: string; category: CategoryId | 'all'; maxPrice: string; sort: 'newest' | 'price' };
export const emptyFilters: Filters = { query: '', city: '', category: 'all', maxPrice: '', sort: 'newest' };
export function filterListings(listings: Listing[], kind: ListingKind | null, filters: Filters, blocked: string[] = []) {
  const q = filters.query.trim().toLocaleLowerCase('uk');
  const city = filters.city.trim().toLocaleLowerCase('uk');
  const max = Number(filters.maxPrice.replace(',', '.'));
  return listings.filter(l =>
    l.status === 'active' &&
    (!l.moderation_status || l.moderation_status === 'approved') &&
    (!kind || l.kind === kind) &&
    !blocked.includes(l.owner_id) &&
    (!q || [l.title, l.description, l.team_name].join(' ').toLocaleLowerCase('uk').includes(q)) &&
    (!city || l.city.toLocaleLowerCase('uk') === city) &&
    (filters.category === 'all' || l.category === filters.category) &&
    (!filters.maxPrice || (l.price !== null && l.price <= max))
  ).sort((a, b) => filters.sort === 'price'
    ? (a.price ?? Infinity) - (b.price ?? Infinity) || b.created_at.localeCompare(a.created_at)
    : b.created_at.localeCompare(a.created_at));
}
export function validateListing(l: NewListing): string | null {
  if (l.title.trim().length < 8 || l.title.trim().length > 100) return 'Назва має містити від 8 до 100 символів.';
  if (l.description.trim().length < 30 || l.description.trim().length > 5000) return 'Опиши роботи: від 30 до 5000 символів.';
  if (l.city.trim().length < 2 || l.city.trim().length > 80) return 'Вкажи місто або населений пункт (2–80 символів).';
  if (l.price !== null && (!Number.isFinite(l.price) || l.price < 0 || l.price > 100000000)) return 'Вкажи коректну ціну від 0 до 100 000 000 грн.';
  if (l.images.length > 6) return 'Можна додати до 6 фотографій.';
  return null;
}
export function priceLabel(l: Pick<Listing, 'price' | 'unit' | 'kind'>) {
  if (l.price === null) return 'Ціна договірна';
  const price = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(l.price);
  return (l.kind === 'service' ? 'від ' : '') + price + ' ₴' + (l.unit ? ' / ' + l.unit : '');
}
export function shortDate(value: string) {
  return new Date(value).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}
export function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase(); }
export function otherParticipant(c: { participant_a: string; participant_b: string }, userId: string) { return c.participant_a === userId ? c.participant_b : c.participant_a; }
