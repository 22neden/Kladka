// DOM smoke test of the exported web bundle. Does not replace an iPhone device test.
const { JSDOM, VirtualConsole, requestInterceptor } = require('../Kladka.UA/node_modules/jsdom');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../Kladka.UA/dist-api');
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
      w.AbortController = global.AbortController;
      const localFetch = async url => { const b = fs.readFileSync(path.join(root, new URL(url, 'http://localhost').pathname)); return { ok: true, status: 200, headers: { get: () => 'application/javascript' }, text: async () => b.toString(), json: async () => JSON.parse(b.toString()), arrayBuffer: async () => b.buffer }; };
      w.fetch = (url, options) => String(url).startsWith('http://127.0.0.1:3099') ? fetch(url, options) : localFetch(url);
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
const {installMemoryRepository} = require('../backend/tests/memory-repository');
const {createApp} = require('../backend/src/app');
(async () => {
 installMemoryRepository();
 const mail=[];
 const app=createApp({secret:'test'.repeat(16),publicUrl:'http://127.0.0.1:3099',origins:['http://localhost'],redirects:[],terms:'https://example.test/terms',termsVersion:'test',moderation:'auto',mediaLimit:20*1024*1024,testNoRate:true},async(email,code,kind)=>mail.push({email,code,kind}));
 const server=app.listen(3099,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});
 let dom;
 try {
  dom=createWindow();let w=dom.window;
  await waitFor(()=>w.document.querySelector('[data-testid="auth-register"]'),'auth loaded');
  assert.equal(byLabel(w,'Відкрити локальну версію'),null,'remote build does not silently fall back to local');
  w.document.querySelector('[data-testid="auth-register"]').click();await pause(80);
  fill(w,'Email','remote@example.test');fill(w,'Пароль','Password123');fill(w,'Повторіть пароль','Password123');await pause(80);
  await click(w,'Створити профіль');await waitFor(()=>byLabel(w,'Код із листа'),'confirmation form');
  assert.equal(mail.length,1);fill(w,'Код із листа',mail[0].code);await pause(80);await click(w,'Підтвердити email');
  await click(w,'Профіль');await click(w,'Редагувати профіль');await waitFor(()=>byLabel(w,'Ім’я профілю'),'profile form');
  fill(w,'Ім’я профілю','Хмарний Майстер');fill(w,'Місто профілю','Рівне');await pause(80);await click(w,'Зберегти профіль');
  await waitFor(()=>w.document.getElementById('root').textContent.includes('Хмарний Майстер'),'server profile saved');
  await click(w,'Налаштування акаунта');await waitFor(()=>byLabel(w,'Номер телефону'),'settings');fill(w,'Номер телефону','+380671234567');await pause(80);await click(w,'Зберегти налаштування');
  await waitFor(()=>w.document.getElementById('root').textContent.includes('Налаштування збережено.'),'server settings saved');
  const cache=Object.fromEntries(Array.from({length:w.localStorage.length},(_,i)=>{const key=w.localStorage.key(i);return[key,w.localStorage.getItem(key)];}));
  w.close();dom=createWindow(cache);w=dom.window;
  await click(w,'Профіль');await waitFor(()=>w.document.getElementById('root').textContent.includes('Хмарний Майстер'),'session and profile restored from API');
  await click(w,'Налаштування акаунта');await waitFor(()=>byLabel(w,'Номер телефону'),'restored settings');assert.equal(byLabel(w,'Номер телефону').value,'+380671234567');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: exported Expo web → Express HTTP → in-memory test repository: signup, OTP, session, profile, settings and restart. MongoDB itself is not covered by this test.');
 } finally {dom?.window.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
