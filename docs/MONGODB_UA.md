# MongoDB та API v1.2

## Обов’язкова конфігурація
apps/backend/.env: MONGODB_URI, AUTH_SECRET, PUBLIC_API_URL, APP_ORIGINS, TERMS_URL. Для листів у хмарі — MAIL_MODE=resend, RESEND_API_KEY, MAIL_FROM. Локальний console-mode лише для перевірки на власному комп’ютері. Справжню доставку потрібно перевірити окремо.
Сервер вимагає replica set для транзакцій: Atlas його надає. Одиночний локальний mongod без replica set не підходить для всіх операцій. Колекції/індекси створюються на старті, SQL-міграції не потрібні.
Колекції мають префікс kladka_: user, listing, conversation, message, session, challenge, favorite, block, read, media, ticket, report, consent, oauth, rate. Старий items не видаляється.

## Авторизація
- Пароль: 9–128 символів, велика й мала літери (Unicode), цифра. На сервері scrypt із випадковою сіллю. Паролі не пишуться в логи.
- Код email/recovery: 6 цифр, 10 хвилин, максимум 5 перевірок одного challenge, пауза 60 секунд між листами. Хеш коду з серверним HMAC-secret.
- Для підтвердження signup потрібно знати пароль цієї реєстрації: повторна реєстрація не перезаписує чужий незавершений акаунт. Якщо адреса ваша, а пароль невідомий, використайте відновлення.
- Сесії: випадковий токен, у БД лише SHA-256 хеш, 30 днів. Перевірка строку незалежна від затримки TTL-очищення MongoDB. Вихід відкликає поточну сесію, reset — усі, зміна пароля — інші сесії.
- Native токен у SecureStore, web — у сховищі браузера. Не вставляти сторонній неперевірений HTML/скрипти; захист від XSS важливий. Це не наскрізне шифрування чатів.
- Ліміти IP та email зберігаються в MongoDB, а не тільки в пам’яті Render. AUTH_SECRET не змінюйте випадково: поточні коди стануть недійсними.

## Google / Facebook
У backend env налаштуйте GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, FACEBOOK_APP_ID / FACEBOOK_APP_SECRET / FACEBOOK_GRAPH_VERSION. Версію Graph API візьміть із власного Meta Dashboard, не залишайте vNN.N як реальне значення.
Авторизовані callback URL у провайдерів:
- https://ВАШ-API.onrender.com/api/auth/oauth/google/callback
- https://ВАШ-API.onrender.com/api/auth/oauth/facebook/callback
Це серверні URL, не Expo callback.
OAUTH_REDIRECTS на сервері — точні адреси повернення з сервера в застосунок:
- https://ВАШ-WEB.onrender.com/auth/callback
- onlyconstructions://auth/callback
Google — OAuth Web application; Facebook — Facebook Login із дозволом email. Налаштуйте тестових користувачів, дозволи, політику приватності та інструкцію видалення в Meta/Google. Не припускайте доступність для всіх у development mode.
Потік: серверний state → callback → одноразовий grant → обмін із доказом володіння client verifier. Провайдерські access_token/secret не передаються в мобільний застосунок. Існуючий email не зливається автоматично з іншою соціальною особою: користувачеві пропонується початковий вхід або recovery.
Без ключів API повертає зрозуміле повідомлення, а не вигаданий успішний вхід. Живі OAuth-входи в середовищі підготовки не перевірені.

## Модерація
MODERATION_MODE=manual за замовчуванням. Нові/відредаговані оголошення мають pending; їх бачить власник. Після схвалення їх бачать інші. Зміна status на active не обходить moderation_status.
У Atlas Data Explorer → kladka_listing → потрібний документ → moderation_status: approved / rejected / pending.
Або локально, з налаштованим apps/backend/.env, із кореня KLADKA:
```powershell
npm.cmd run moderate --prefix apps/backend -- ID_ОГОЛОШЕННЯ approved
```
Команда має адміністративний доступ до бази, її не додають у клієнт. MODERATION_MODE=auto дозволяє публікацію без перевірки, використовуйте лише для контрольованого тесту. Повноцінної адмінпанелі в цій версії немає.

## Фото
До 5 МБ на фото, загалом за замовчуванням 20 МБ на акаунт. Квота резервується транзакційно. JPG/PNG, дані в MongoDB Binary; це рішення для невеликої бети, не для тисяч портфоліо. Не зберігайте фото на диску Render Free.
Фото портфоліо/аватарів мають публічний URL. Чат-вкладення приватні: учасник отримує URL із ticket на 5 хвилин; сторонній акаунт не може отримати ticket. Вихід/закінчення сесії робить пов’язаний ticket недійсним. Блокування зупиняє нові повідомлення, але не видаляє історію.
Замінені аватари та невикористані завантаження поки рахуються в квоту до видалення акаунта. Для масштабування потрібні очищення orphan-файлів і зовнішнє медіасховище.

## Синхронізація і межі першої бети
GET /api/workspace повертає власний профіль/налаштування, доступні оголошення й чати та лише потрібні публічні профілі. Телефон/згоди інших користувачів не видаються.
Оновлення кожні 10 секунд лише в активному застосунку; після власних змін запитується новий стан. Push та WebSocket ще не підключені. Відповідь обмежена останніми 1000 оголошеннями, 200 розмовами і 200 повідомленнями на розмову. Повної пагінації історії ще немає — не видавайте це за необмежений production-чат.
Видалення акаунта прибирає його профіль, сесії, оголошення, фото, пов’язані розмови/повідомлення, обране/читання/блокування/згоди в транзакції. Перед бетою перевірте це в тестовій Atlas-базі, зокрема одночасні запити.
API має перевірки авторизації й власності, але ще не проходило незалежного аудиту безпеки чи навантажувального тесту.

## Основні маршрути
- /health, /api/auth/register, /api/auth/confirm, /api/auth/login, /api/auth/resend
- /api/auth/recovery, /api/auth/reset, /api/auth/password, /api/auth/logout
- /api/auth/oauth/start, /api/auth/oauth/:provider/callback, /api/auth/oauth/exchange
- /api/workspace, /api/profile, /api/settings
- /api/listings, /api/listings/:id, /api/listings/:id/status
- /api/favorites/:id, /api/conversations, /api/conversations/:id/messages, /api/conversations/:id/read
- /api/media, /api/media/:id/ticket, /api/media/:id
- /api/reports, /api/blocks/:id, /api/account
Тестовий відкритий /api/items замінено цими маршрутами. Захищені маршрути потребують Authorization: Bearer SESSION_TOKEN.
