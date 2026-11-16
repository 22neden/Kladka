# Доступ без ноутбука: Atlas + Render + вебверсія Expo

Ціль: стабільна HTTPS-адреса, яку ви й друг відкриваєте в Safari/Chrome. Код залишається Expo. Ця інструкція не публікує iOS-збірку в App Store.

## 1. Підготуйте репозиторій
Створіть приватний GitHub-репозиторій і завантажте ВМІСТ папки KLADKA. У корені репозиторію мають бути backend/, Kladka.UA/, render.yaml, package.json. Якщо завантажити ще одну зовнішню папку KLADKA, шляхи в Render не співпадуть.
Не завантажуйте .env, node_modules, .expo, dist, dist-api. Кореневий .gitignore уже виключає їх. Перед комітом перевірте перелік файлів. Архів готової версії не містить паролів із вашого завантаження.

## 2. Підготуйте Atlas
В Atlas використайте наявний Free cluster. Database Access: створіть/використайте користувача лише з readWrite для бази kladka. Пароль, який раніше публікували в чаті, замініть.
Connect → Drivers → скопіюйте URI. Вкажіть справжній пароль (спецсимволи потрібно URL-кодувати) і базу kladka. Не вставляйте URI в клієнтський застосунок.
Network Access: для локальної роботи додайте поточну зовнішню IP-адресу ноутбука. Для Render додайте outbound IP ranges вашого API-сервісу з його Dashboard. Не потрібно відкривати базу для всього інтернету за замовчуванням.

## 3. Розгорніть API
Найпростіше спочатку створити один Web Service вручну: Render → New → Web Service → виберіть репозиторій.

| Поле | Значення |
|---|---|
| Name | довільне вільне ім’я, наприклад kladka-api-yourname |
| Runtime | Node |
| Root Directory | backend |
| Build Command | npm ci --omit=dev |
| Start Command | npm start |
| Instance Type | Free |
| Health Check Path | /health |

Environment:
- NODE_VERSION=24
- NODE_ENV=production
- MONGODB_URI=ваш повний секретний URI
- AUTH_SECRET=випадковий секрет 32+ символів; згенеруйте локально командою нижче
- APP_ORIGINS=точна HTTPS-адреса вебверсії (додасте після кроку 4; тимчасово може бути http://localhost:8081)
- OAUTH_REDIRECTS=https://ВАШ-WEB.onrender.com/auth/callback,onlyconstructions://auth/callback
- MAIL_MODE=resend
- RESEND_API_KEY=ваш ключ Resend (для справжніх листів)
- MAIL_FROM=адреса дозволеного відправника
- TERMS_URL=адреса опублікованих Умов
- TERMS_VERSION=2026-11-15 (або ваша версія документа)
- MODERATION_MODE=manual

Генерація AUTH_SECRET, у будь-якому терміналі з Node:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Не надсилайте результат у чат. PUBLIC_API_URL на Render можна не задавати: сервер використовує RENDER_EXTERNAL_URL. Якщо згодом підключите власний домен API, задайте PUBLIC_API_URL явно і перевірте старі URL фотографій.
PORT встановлює Render; не прив’язуйте сервер лише до localhost. Код уже слухає 0.0.0.0.

Після створення сервісу скопіюйте його outbound IP ranges в Atlas Network Access і за потреби натисніть Redeploy. У Logs має бути «MongoDB підключено». Відкрийте https://ВАШ-API.onrender.com/health — очікується {"ok":true}. Якщо Mongo недоступна, сервер не повідомляє фальшивий успішний запуск.

## 4. Розгорніть вебверсію
Render → New → Static Site → той самий репозиторій.

| Поле | Значення |
|---|---|
| Root Directory | Kladka.UA |
| Build Command | npm ci --include=dev && npx expo export --platform web |
| Publish Directory | dist |

Environment (ці значення не секретні й потрапляють у вебкод):
- NODE_VERSION=24
- EXPO_PUBLIC_API_URL=https://ВАШ-API.onrender.com
- EXPO_PUBLIC_TERMS_URL=той самий URL, що TERMS_URL на сервері
- EXPO_PUBLIC_PRIVACY_URL=ваш URL політики приватності
- EXPO_PUBLIC_SUPPORT_EMAIL=ваш контакт

Redirects/Rewrites: Source /* → Destination /index.html → Action Rewrite. Це потрібно для прямого відкриття /auth/callback і інших маршрутів.
Після створення скопіюйте фактичну адресу вебверсії в APP_ORIGINS та OAUTH_REDIRECTS API, збережіть налаштування. APP_ORIGINS — origin без / наприкінці; кілька значень через кому. Встановлювати CORS '*' замість цього не потрібно.
Після зміни EXPO_PUBLIC_* зробіть нову збірку Static Site: ці змінні вбудовуються під час export.

Альтернатива: у корені є render.yaml для Blueprint із двома сервісами. Він містить поля sync:false для ваших значень. Перший запуск вручну зручніший, бо потрібно отримати фактичні адреси обох сервісів.

## 5. Перевірте реальні акаунти
1. Відкрийте вебадресу на ноутбуці, зареєструйте A, отримайте справжній лист, введіть код.
2. Заповніть профіль, додайте оголошення.
3. Схваліть оголошення в Atlas або командою модерації (docs/MONGODB_UA.md).
4. Відкрийте вебадресу на телефоні/іншому браузері, створіть B. Не використовуйте спільний акаунт.
5. Перевірте оголошення, чат, фото, блокування, відновлення і видалення тестового акаунта.
6. Закрийте VS Code і вимкніть ноутбук. Вебадреса має відкриватися; API може потребувати часу на пробудження.

## Листи, безкоштовні тарифи та межі
Resend використовується через HTTPS API, тому бекенд не покладається на SMTP-порти. Перевірте дозволених одержувачів/відправника у вашому акаунті: тестовий домен провайдера не означає право надсилати будь-якій людині. Для загального доступу зазвичай потрібно підтвердити власний домен. Конкретні квоти й потребу в домені перевірте перед витратами; код не створює домен чи поштовий акаунт автоматично.
На Render production console-mail заблокована: реєстрація не повинна вимагати читання секретних кодів у хмарному логу.
Render Free засинає після 15 хвилин без трафіку; пробудження може тривати близько хвилини. Є місячні квоти. Не використовуйте штучні keep-alive пінги для обходу тарифу. Фото зберігаються в MongoDB, тому не губляться від перезапуску Render, але витрачають ліміт Atlas.
Статична вебверсія й сервер — різні сервіси. Безкоштовна розробка не означає гарантовану безперебійну роботу 24/7.

## Google/Facebook та iOS
OAuth налаштовується окремо за docs/MONGODB_UA.md. Email-вхід достатній для першого тесту повного сценарію. Соціальний вхід у Expo Go на фізичному телефоні не підтримується цим проєктом; використайте вебверсію або власну development build.
Для встановленого iOS-застосунку, TestFlight/App Store/Ad Hoc потрібен окремий процес підписування й відповідний Apple-акаунт. Безкоштовне вебпосилання працює через браузер. Apple guideline 4.8 щодо приватного альтернативного входу потрібно перевірити перед магазинним релізом.

Офіційні джерела, перевірені 15.11.2026:
- https://render.com/docs/free
- https://render.com/docs/deploy-node-express-app
- https://render.com/docs/blueprint-spec
- https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/
- https://docs.expo.dev/guides/publishing-websites/
- https://docs.expo.dev/build/internal-distribution/
- https://resend.com/docs/api-reference/emails/send-email
