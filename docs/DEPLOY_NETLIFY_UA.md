# Публікація frontend на Netlify

Netlify розміщує web-версію Expo. Express backend і MongoDB мають працювати окремо, наприклад на Render.

## Налаштування Netlify

1. Створіть **Add new site → Import an existing project**.
2. Виберіть репозиторій із вмістом `D:\KLADKA`.
3. Netlify автоматично використає [netlify.toml](../netlify.toml):
   - Base directory: `apps/frontend`
   - Build command: `npm ci --include=dev && npx expo export --platform web`
   - Publish directory: `dist`
4. У **Site configuration → Environment variables** додайте:

```text
EXPO_PUBLIC_API_URL=https://YOUR-API.onrender.com
EXPO_PUBLIC_TERMS_URL=https://YOUR-API.onrender.com/terms
EXPO_PUBLIC_PRIVACY_URL=https://YOUR-PRIVACY-URL
EXPO_PUBLIC_SUPPORT_EMAIL=your@email.example
```

`EXPO_PUBLIC_API_URL` не може бути `localhost` або `192.168.*`, якщо сайт відкриватимуть інші користувачі.

Після зміни цих змінних запустіть **Deploy site** ще раз: Expo вбудовує їх під час web build.

## Backend CORS

У backend на Render додайте Netlify origin до `APP_ORIGINS`, наприклад:

```text
APP_ORIGINS=https://your-site.netlify.app
```

Не додавайте `/` наприкінці та не використовуйте `*`.

Після публікації перевірте:

```text
https://your-site.netlify.app
https://YOUR-API.onrender.com/health
```

Rewrite у [netlify.toml](../netlify.toml) потрібен, щоб пряме відкриття маршрутів Expo Router не повертало Netlify 404.
