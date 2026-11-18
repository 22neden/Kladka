// DOM smoke test of the exported web bundle. Does not replace an iPhone device test.
const { JSDOM, VirtualConsole, requestInterceptor } = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../dist');
const errors = [];
function createWindow(cache) {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', e => { if (!String(e.message).includes('Not implemented')) errors.push(String(e.message)); });
  virtualConsole.on('error', (...args) => errors.push(args.map(String).join(' ')));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script src="([^"]+)"[^>]*><\/script>/g, (_, src) => '<script>' + fs.readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script') + '</script>');
  return new JSDOM(html, {
    resources: { interceptors: [requestInterceptor(request => { const f = path.join(root, new URL(request.url).pathname); return new Response(fs.existsSync(f) ? fs.readFileSync(f) : '', { status: fs.existsSync(f) ? 200 : 404, headers: { 'Content-Type': 'application/javascript' } }); })] },
    url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole,
    beforeParse(w) {
      Object.defineProperty(w, 'innerWidth', { value: 390 });
      Object.defineProperty(w, 'innerHeight', { value: 844 });
      w.matchMedia = query => ({ matches: false, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
      w.FontFace = class { constructor() { this.status = 'loaded'; } load() { return Promise.resolve(this); } };
      Object.defineProperty(w.document, 'fonts', { value: { add() {}, delete() {}, check: () => true, load: () => Promise.resolve([{}]), ready: Promise.resolve() } });
      w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollTo = () => {};
      w.crypto.randomUUID = crypto.randomUUID;
      w.fetch = async url => { const b = fs.readFileSync(path.join(root, new URL(url, 'http://localhost').pathname)); return { ok: true, status: 200, headers: { get: () => 'application/javascript' }, text: async () => b.toString(), json: async () => JSON.parse(b.toString()), arrayBuffer: async () => b.buffer }; };
      if (cache) for (const [key, value] of Object.entries(cache)) w.localStorage.setItem(key, value);
    },
  });
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(fn, label) {
  for (let i = 0; i < 300; i++) { if (fn()) return; await pause(30); }
  throw new Error('Timed out: ' + label);
}
function byLabel(w, label) { return w.document.querySelector('[aria-label="' + label + '"]'); }
async function click(w, label) {
  await waitFor(() => byLabel(w, label), label);
  byLabel(w, label).click(); await pause(100);
}
function fill(w, label, value) {
  const el = byLabel(w, label);
  assert.ok(el, label);
  const proto = el.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new w.Event('input', { bubbles: true }));
  el.dispatchEvent(new w.Event('change', { bubbles: true }));
}
(async () => {
  let dom = createWindow();
  let w = dom.window;
  await waitFor(() => byLabel(w, 'Відкрити локальну версію'), 'auth screen').catch(e => { console.log(w.document.getElementById('root').innerHTML.slice(-5000)); throw e; });
  assert.match(w.document.getElementById('root').textContent, /Kladka/);
  assert.ok(byLabel(w, 'Facebook'));
  assert.ok(!byLabel(w, 'Продовжити з Apple'));
  w.document.querySelector('[data-testid="auth-register"]').click(); await pause(100);
  assert.match(w.document.getElementById('root').textContent, /9 або більше символів/);
  const newsBox = w.document.querySelector('[role="checkbox"]');
  assert.equal(newsBox.getAttribute('aria-checked'), 'false');
  newsBox.click(); await pause(60);
  assert.equal(newsBox.getAttribute('aria-checked'), 'true');
  fill(w, 'Email', 'test@example.com');
  fill(w, 'Пароль', 'Abcdefgh1');
  fill(w, 'Повторіть пароль', 'wrong'); await pause(60);
  assert.equal(byLabel(w, 'Створити профіль').getAttribute('aria-disabled'), 'true');
  fill(w, 'Повторіть пароль', 'Abcdefgh1'); await pause(60);
  assert.notEqual(byLabel(w, 'Створити профіль').getAttribute('aria-disabled'), 'true');
  await click(w, 'Показати пароль');
  assert.equal(byLabel(w, 'Пароль').type, 'text');
  w.document.querySelector('[data-testid="auth-login"]').click(); await pause(100);
  assert.equal(byLabel(w, 'Пароль').value, '');
  await click(w, 'Забули пароль?');
  await waitFor(() => byLabel(w, 'Email для відновлення'), 'recovery modal');
  await click(w, 'Закрити');
  await click(w, 'Відкрити локальну версію');
  await waitFor(() => byLabel(w, 'Ваш простір. Наша майстерність.'), 'catalog');
  assert.match(w.document.getElementById('root').textContent, /ПРИКЛАД/);
  await click(w, 'Профіль');
  await click(w, 'Редагувати профіль');
  await waitFor(() => byLabel(w, 'Ім’я профілю'), 'edit profile route');
  fill(w, 'Ім’я профілю', 'Тестовий Майстер');
  fill(w, 'Місто профілю', 'Рівне');
  await pause(60);
  const clickText = async text => { const el = [...w.document.querySelectorAll('[role="button"]')].find(e => e.textContent === text); assert.ok(el, text); el.click(); await pause(80); };
  await clickText('Надаю послуги');
  await clickText('Плитка');
  fill(w, 'Досвід роботи', '7');
  fill(w, 'Про себе', 'Виконую плиткові роботи та допомагаю з ремонтом оселі.');
  await pause(80);
  await click(w, 'Зберегти профіль');
  await waitFor(() => w.document.getElementById('root').textContent.includes('Тестовий Майстер'), 'profile saved');
  await click(w, 'Переглянути мій профіль');
  await waitFor(() => w.document.getElementById('root').textContent.includes('Досвід: 7 р.'), 'public profile');
  await click(w, 'Назад');
  await click(w, 'Налаштування акаунта');
  await waitFor(() => byLabel(w, 'Номер телефону'), 'settings route');
  fill(w, 'Номер телефону', '+380671234567');
  w.document.querySelector('[role="checkbox"]').click(); await pause(60);
  await click(w, 'Зберегти налаштування');
  await waitFor(() => w.document.getElementById('root').textContent.includes('Налаштування збережено.'), 'settings saved');
  await click(w, 'Назад');
  await click(w, 'Пошук');
  await click(w, 'Ваш простір. Наша майстерність.');
  await click(w, 'Написати майстру');
  await waitFor(() => byLabel(w, 'Повідомлення'), 'chat composer');
  fill(w, 'Повідомлення', 'Тестове повідомлення з локальної версії');
  await pause(60);
  await click(w, 'Надіслати повідомлення');
  await waitFor(() => w.document.getElementById('root').textContent.includes('Тестове повідомлення з локальної версії'), 'sent message');
  await click(w, 'Назад');
  await click(w, 'Назад');
  await click(w, 'Додати');
  await click(w, 'Шукаю майстра / бригаду');
  await waitFor(() => byLabel(w, 'Назва оголошення'), 'listing editor');
  fill(w, 'Назва оголошення', 'Тестова заявка на ремонт кухні');
  fill(w, 'Опис робіт', 'Потрібно оновити кухню, підготувати стіни та встановити нові розетки.');
  fill(w, 'Ціна', '15000');
  await pause(60);
  await click(w, 'Зберегти оголошення');
  await waitFor(() => byLabel(w, 'Редагувати'), 'saved listing');
  assert.match(w.document.getElementById('root').textContent, /Тестова заявка на ремонт кухні/);
  await pause(120);
  const cache = Object.fromEntries(Array.from({ length: w.localStorage.length }, (_, i) => { const key = w.localStorage.key(i); return [key, w.localStorage.getItem(key)]; }));
  const raw = Object.values(cache).find(value => value.includes('Тестова заявка на ремонт кухні'));
  assert.ok(raw, 'listing persisted to device storage');
  assert.ok(Object.values(cache).some(value => value.includes('Тестове повідомлення з локальної версії')), 'message persisted');
  w.close();
  dom = createWindow(cache); w = dom.window;
  await click(w, 'Відкрити локальну версію');
  await click(w, 'Профіль');
  await waitFor(() => w.document.getElementById('root').textContent.includes('Тестовий Майстер'), 'restored profile');
  await click(w, 'Налаштування акаунта');
  await waitFor(() => byLabel(w, 'Номер телефону'), 'restored settings route');
  assert.equal(byLabel(w, 'Номер телефону').value, '+380671234567');
  assert.equal(w.document.querySelector('[role="checkbox"]').getAttribute('aria-checked'), 'true');
  await click(w, 'Назад');
  await click(w, 'Заявки');
  await waitFor(() => byLabel(w, 'Тестова заявка на ремонт кухні'), 'listing restored after restart');
  assert.equal(errors.length, 0, errors.join('\n'));
  w.close();
  console.log('PASS: auth validation, consent, profile edit/public view, private settings, tabs, catalog, chat, listing and persistence');
})().catch(e => { console.error(e); console.error(errors); process.exit(1); });
