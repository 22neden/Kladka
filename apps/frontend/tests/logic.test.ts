import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyFilters, filterListings, priceLabel, validateListing, otherParticipant } from '../src/domain/logic';
import { initialLocalData, sampleListings } from '../src/data';
import type { NewListing } from '../src/domain/types';

test('search combines kind, Ukrainian case-insensitive text, city and category', () => {
  const found = filterListings(sampleListings, 'service', { ...emptyFilters, query: 'ПЛИТКА', city: 'рівне', category: 'tile' });
  assert.equal(found.length, 1);
  assert.equal(found[0].category, 'tile');
});
test('hidden, closed, unapproved and blocked listings never enter the public catalog', () => {
  const original = sampleListings[0];
  const rows = [{ ...original, status: 'hidden' as const }, { ...original, status: 'closed' as const }, { ...original, moderation_status: 'pending' as const }, { ...original, moderation_status: 'rejected' as const }];
  assert.equal(filterListings(rows, 'service', emptyFilters).length, 0);
  assert.equal(filterListings([original], 'service', emptyFilters, [original.owner_id]).length, 0);
});
test('price filters handle zero, null prices and numeric ordering', () => {
  const rows = [null, 0, 150, 20].map((price, i) => ({ ...sampleListings[0], id: String(i), price }));
  assert.deepEqual(filterListings(rows, null, { ...emptyFilters, sort: 'price' }).map(l => l.price), [0, 20, 150, null]);
  assert.deepEqual(filterListings(rows, null, { ...emptyFilters, maxPrice: '20', sort: 'price' }).map(l => l.price), [0, 20]);
});
test('price range and urgency filters combine with listing criteria', () => {
  const rows = sampleListings.map((listing, i) => ({
    ...listing,
    id: String(i),
    price: i * 100,
    urgency: i % 2 ? 'week' as const : 'urgent' as const,
  }));
  const found = filterListings(rows, null, { ...emptyFilters, minPrice: '100', maxPrice: '300', urgency: 'week' });
  assert.deepEqual(found.map(listing => listing.price), [100, 300]);
});
test('invalid budgets cannot be published; optional budget stays negotiable', () => {
  const draft: NewListing = { ...sampleListings[0] };
  assert.equal(validateListing({ ...draft, price: null }), null);
  assert.match(validateListing({ ...draft, price: NaN })!, /ціну/);
  assert.match(validateListing({ ...draft, price: -1 })!, /ціну/);
  assert.match(validateListing({ ...draft, title: 'мало' })!, /Назва/);
  assert.match(validateListing({ ...draft, description: 'коротко' })!, /Опиши/);
  assert.match(validateListing({ ...draft, images: Array(7).fill('photo') })!, /6/);
});
test('fresh local workspaces do not share mutable user state', () => {
  const a = initialLocalData(); const b = initialLocalData();
  a.favorites.push('x');
  assert.deepEqual(b.favorites, []);
  assert.deepEqual(b.messages, []);
});
test('price labels distinguish service rates and job budgets', () => {
  assert.equal(priceLabel({ kind: 'service', price: null, unit: 'м²' }), 'Ціна договірна');
  assert.match(priceLabel({ kind: 'service', price: 850, unit: 'м²' }), /^від 850 ₴ \/ м²$/);
  assert.match(priceLabel({ kind: 'request', price: 850, unit: 'об’єкт' }), /^850 ₴ \/ об’єкт$/);
});
test('chat peer selection works in either participant order', () => {
  assert.equal(otherParticipant({ participant_a: 'a', participant_b: 'b' }, 'a'), 'b');
  assert.equal(otherParticipant({ participant_a: 'a', participant_b: 'b' }, 'b'), 'a');
});
