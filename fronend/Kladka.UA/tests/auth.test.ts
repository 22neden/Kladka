import assert from 'node:assert/strict';
import test from 'node:test';
import { passwordRules, validEmail } from '../src/lib/authValidation';
test('password boundaries, character classes, Unicode and email validation', () => {
  const valid = (p: string) => passwordRules(p).every(r => r.valid);
  assert.equal(valid('Abcdefg1'), false);
  assert.equal(valid('Abcdefgh1'), true);
  assert.equal(valid('abcdefgh1'), false);
  assert.equal(valid('ABCDEFGH1'), false);
  assert.equal(valid('Abcdefghi'), false);
  assert.equal(valid('Пароль123'), true);
  assert.equal(validEmail(' test@example.com '), true);
  assert.equal(validEmail('test@'), false);
  assert.equal(validEmail('test example@com.ua'), false);
});

import { profileCompletion, validateProfile } from '../src/domain/profile';
test('profile validation and completeness do not imply identity verification', () => {
  const p = { id: 'test', name: 'Майстер', city: 'Рівне', role: 'professional' as const, bio: 'Працюю з плиткою та ремонтую квартири.' };
  assert.equal(validateProfile({ ...p, experience_years: 81 }), 'Досвід: ціле число від 0 до 80 років.');
  assert.equal(validateProfile({ ...p, experience_years: 1.5 }), 'Досвід: ціле число від 0 до 80 років.');
  assert.equal(validateProfile({ ...p, experience_years: 7, specialties: ['tile'] }), null);
  assert.equal(profileCompletion({ ...p, avatar_url: 'https://example.com/avatar.jpg', specialties: ['tile'] }).percent, 100);
  assert.equal(profileCompletion(p).percent, 60);
});
