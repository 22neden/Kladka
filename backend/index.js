require('dotenv').config();
const mongoose = require('mongoose');
const { config, mailer } = require('./src/config');
const models = require('./src/models');
const { createApp } = require('./src/app');
async function main() {
 const c=config();
 await mongoose.connect(c.uri,{serverSelectionTimeoutMS:15000,maxPoolSize:10});
 await Promise.all(Object.values(models).map(m=>m.init()));
 console.log('MongoDB підключено.');
 const server=createApp(c,mailer(c)).listen(c.port,'0.0.0.0',()=>console.log(`Kladka API: порт ${c.port}`));
 const stop=()=>server.close(()=>mongoose.disconnect().then(()=>process.exit(0)));
 process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
main().catch(()=>{console.error('Не вдалося запустити сервер. Перевірте MONGODB_URI, доступ Atlas, AUTH_SECRET та production-конфігурацію. Секрети в лог не виводяться.');process.exit(1);});
