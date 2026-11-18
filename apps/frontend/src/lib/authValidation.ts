export function passwordRules(password: string) {
  return [
    { label: '9 або більше символів', valid: Array.from(password).length >= 9 },
    { label: 'Велику літеру', valid: /\p{Lu}/u.test(password) },
    { label: 'Малу літеру', valid: /\p{Ll}/u.test(password) },
    { label: 'Мінімум одну цифру', valid: /[0-9]/.test(password) },
  ];
}
export function validEmail(email: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()); }
