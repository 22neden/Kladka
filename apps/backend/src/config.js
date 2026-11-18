function config(env=process.env) {
 const production=env.NODE_ENV==='production';
 const c={ production, uri:env.MONGODB_URI, port:Number(env.PORT||3000), secret:env.AUTH_SECRET||'', publicUrl:(env.PUBLIC_API_URL||env.RENDER_EXTERNAL_URL||'http://localhost:3000').replace(/\/$/,''), origins:(env.APP_ORIGINS||'http://localhost:8081,http://localhost:3000').split(',').map(s=>s.trim()), redirects:(env.OAUTH_REDIRECTS||'http://localhost:8081/auth/callback,onlyconstructions://auth/callback').split(',').map(s=>s.trim()), mailMode:env.MAIL_MODE||'resend', mailKey:env.RESEND_API_KEY||'', mailFrom:env.MAIL_FROM||'', terms:env.TERMS_URL||'', termsVersion:env.TERMS_VERSION||'2026-11-15', moderation:env.MODERATION_MODE||'manual', googleId:env.GOOGLE_CLIENT_ID||'', googleSecret:env.GOOGLE_CLIENT_SECRET||'', facebookId:env.FACEBOOK_APP_ID||'', facebookSecret:env.FACEBOOK_APP_SECRET||'', facebookVersion:env.FACEBOOK_GRAPH_VERSION||'', mediaLimit:Number(env.MEDIA_USER_LIMIT_MB||20)*1024*1024 };
 if(!c.uri) throw new Error('Додайте MONGODB_URI у apps/backend/.env або налаштування хостингу.');
 if(c.secret.length<32) throw new Error('AUTH_SECRET має містити мінімум 32 випадкових символи.');
 if(production && (!c.publicUrl.startsWith('https://')||c.mailMode==='console')) throw new Error('Production вимагає HTTPS PUBLIC_API_URL і реальну доставку листів.');
 if(!['manual','auto'].includes(c.moderation)) throw new Error('MODERATION_MODE: manual або auto');
 return c;
}
function mailer(c) { return async (to,code,kind) => {
 if(c.mailMode==='console'&&!c.production) { console.log(`[LOCAL MAIL] ${to} ${kind}: ${code}`);return; }
 if(!c.mailKey||!c.mailFrom) { const e=new Error('Сервіс листів ще не налаштовано.');e.status=503;throw e; }
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${c.mailKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:c.mailFrom,to:[to],subject:kind==='signup'?'Код реєстрації Kladka.UA':'Відновлення Kladka.UA',text:`Ваш код: ${code}. Діє 10 хвилин. Нікому не повідомляйте його.`}),signal:AbortSignal.timeout(15000)});
 if(!response.ok) { const e=new Error('Не вдалося надіслати лист. Спробуйте пізніше.');e.status=503;throw e; }
 }; }
module.exports={config,mailer};
