export const C = {
  bg: '#10120F',
  card: '#1C1F19',
  raised: '#252920',
  line: '#34382F',
  text: '#F2F3EB',
  muted: '#A6AC9C',
  lime: '#D4FA65',
  dark: '#161C0B',
  danger: '#FF9E91',
  white: '#FFFFFF',
};
export const fonts = { regular: 'Manrope_400Regular', medium: 'Manrope_500Medium', bold: 'Manrope_700Bold', display: 'Manrope_800ExtraBold' };
export const categories = [
  { id: 'renovation', title: 'Ремонт під ключ', short: 'Ремонт', icon: 'home' },
  { id: 'electric', title: 'Електромонтаж', short: 'Електрика', icon: 'zap' },
  { id: 'plumbing', title: 'Сантехніка', short: 'Сантехніка', icon: 'droplet' },
  { id: 'tile', title: 'Плиткові роботи', short: 'Плитка', icon: 'grid' },
  { id: 'painting', title: 'Оздоблення та фарбування', short: 'Оздоблення', icon: 'edit-3' },
  { id: 'building', title: 'Будівництво', short: 'Будівництво', icon: 'tool' },
  { id: 'roof', title: 'Покрівельні роботи', short: 'Покрівля', icon: 'triangle' },
  { id: 'design', title: 'Дизайн інтер’єру', short: 'Дизайн', icon: 'layout' },
] as const;
export const cities = ['Рівне', 'Київ', 'Львів', 'Луцьк', 'Тернопіль', 'Хмельницький', 'Івано-Франківськ', 'Вінниця', 'Одеса', 'Дніпро', 'Харків', 'Житомир', 'Чернівці', 'Ужгород'];
export function categoryTitle(id: string) { return categories.find(c => c.id === id)?.title ?? id; }
