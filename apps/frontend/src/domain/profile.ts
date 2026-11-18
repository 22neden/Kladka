import { categories } from '../theme';
import type { Profile } from './types';
export function validateProfile(p: Profile) {
  if (p.name.trim().length < 2 || p.name.trim().length > 80) return 'Ім’я має містити 2–80 символів.';
  if (p.city.trim().length < 2 || p.city.trim().length > 80) return 'Вкажіть населений пункт (2–80 символів).';
  if (p.bio.length > 1500) return 'Опис має містити до 1500 символів.';
  if (!['customer', 'professional'].includes(p.role)) return 'Виберіть роль.';
  if (!Number.isInteger(p.experience_years ?? 0) || (p.experience_years ?? 0) < 0 || (p.experience_years ?? 0) > 80) return 'Досвід: ціле число від 0 до 80 років.';
  if (p.specialties?.some(id => !categories.some(c => c.id === id))) return 'Перевірте спеціалізації.';
  if (p.availability && !['available', 'busy'].includes(p.availability)) return 'Перевірте статус доступності.';
  return null;
}
export function profileCompletion(p: Profile) {
  const steps = [{ label: 'Ім’я', done: p.name.trim().length >= 2 }, { label: 'Місто', done: p.city.trim().length >= 2 }, { label: 'Про себе', done: p.bio.trim().length >= 20 }, { label: 'Фото профілю', done: Boolean(p.avatar_url) }, ...(p.role === 'professional' ? [{ label: 'Спеціалізації', done: Boolean(p.specialties?.length) }] : [])];
  return { steps, percent: Math.round(100 * steps.filter(s => s.done).length / steps.length) };
}
