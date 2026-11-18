const fs=require('node:fs');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const root=path.resolve(__dirname,'..');
for(const folder of ['apps/backend','apps/frontend']) {
 const target=path.join(root,folder,'.env');
 if(fs.existsSync(target)){console.log(folder+'/.env уже існує — залишено без змін.');continue;}
 let source=fs.readFileSync(path.join(root,folder,'.env.example'),'utf8');
 if(folder==='apps/backend') source=source.replace(/^AUTH_SECRET=$/m,'AUTH_SECRET='+randomBytes(32).toString('hex'));
 else source=source.replace(/^EXPO_PUBLIC_API_URL=$/m,'EXPO_PUBLIC_API_URL=http://localhost:3000');
 fs.writeFileSync(target,source,{mode:0o600});console.log('Створено '+folder+'/.env');
}
console.log('Заповніть apps/backend/.env: MONGODB_URI та TERMS_URL. У apps/frontend/.env задайте адресу API й той самий EXPO_PUBLIC_TERMS_URL. Для iPhone замініть localhost на IPv4 ноутбука.');
