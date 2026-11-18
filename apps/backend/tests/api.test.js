const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const request=require('supertest');
const {MongoMemoryReplSet}=require('mongodb-memory-server');
const m=require('../src/models');
const {createApp}=require('../src/app');
const {hash,passwordHash,verifyPassword}=require('../src/security');
const {config}=require('../src/config');

test('password hashing and fail-closed production settings',async()=>{
 const h=await passwordHash('Пароль123');assert.notEqual(h,'Пароль123');assert.equal(await verifyPassword('Пароль123',h),true);assert.equal(await verifyPassword('wrong',h),false);
 assert.throws(()=>config({MONGODB_URI:'mongodb://localhost/test',AUTH_SECRET:'short'}),/AUTH_SECRET/);
 assert.throws(()=>config({NODE_ENV:'production',MONGODB_URI:'mongodb://localhost/test',AUTH_SECRET:'x'.repeat(32),PUBLIC_API_URL:'https://api.example.com',MAIL_MODE:'console'}),/Production/);
});

test(process.env.KLADKA_REAL_MONGO ? 'real MongoDB replica-set API integration' : 'HTTP contracts using in-memory repository (not Atlas)' , {timeout:240000},async t=>{
 const real=Boolean(process.env.KLADKA_REAL_MONGO);
 const repl=real ? await MongoMemoryReplSet.create({binary:{version:process.env.MONGOMS_VERSION||'8.0.17'},replSet:{count:1}}) : null;
 if(!real) require('./memory-repository').installMemoryRepository();
 try {
 if(real) await mongoose.connect(repl.getUri());await Promise.all(Object.values(m).map(x=>x.init()));
 const mail=[];
 const cfg={secret:'test-only-secret-'.repeat(4),publicUrl:'https://api.example.test',origins:['https://app.example.test'],redirects:['https://app.example.test/auth/callback'],terms:'https://example.test/terms',termsVersion:'test-1',moderation:'manual',mediaLimit:20*1024*1024,testNoRate:true};
 const app=createApp(cfg,async(email,code,kind)=>mail.push({email,code,kind}));
 const call=(method,path,token,body)=>{let q=request(app)[method](path);if(token)q=q.set('Authorization','Bearer '+token);return body===undefined?q:q.send(body);};
 const pass='Password123';
 const signup=async email=>{await call('post','/api/auth/register',null,{email,password:pass,name:email.split('@')[0],news:false}).expect(202);const code=mail.findLast(x=>x.email===email&&x.kind==='signup').code;return (await call('post','/api/auth/confirm',null,{email,code,password:pass}).expect(200)).body;};
 let a,b,c,listing,requestListing,offer,order,conv,privateImage;
 await t.test('registration, confirmation, validation, no anonymous access',async()=>{
  await call('get','/api/workspace').expect(401);
  await call('post','/api/auth/register',null,{email:'a@test.com',password:'weak'}).expect(400);
  await call('post','/api/auth/login',null,{email:{$ne:null},password:pass}).expect(400);
  a=await signup('a@test.com');b=await signup('b@test.com');c=await signup('c@test.com');
  assert.ok(a.token);assert.ok((await m.User.findOne({email:'a@test.com'})).passwordHash!==pass);
  await call('post','/api/auth/confirm',null,{email:'a@test.com',code:mail[0].code,password:pass}).expect(400);
  await call('post','/api/auth/login',null,{email:'a@test.com',password:'wrong'}).expect(401);
  assert.equal((await call('get','/api/auth/me',a.token).expect(200)).body.user.id,a.user.id);
 });
 await t.test('unverified account cannot be taken over by repeated registration',async()=>{
  await call('post','/api/auth/register',null,{email:'pending@test.com',password:pass,name:'Pending'}).expect(202);
  const code=mail.findLast(x=>x.email==='pending@test.com').code;
  await call('post','/api/auth/confirm',null,{email:'pending@test.com',code,password:'Different123'}).expect(400);
  await call('post','/api/auth/login',null,{email:'pending@test.com',password:pass}).expect(403);
 });
 await t.test('profile whitelist, private settings and server consent',async()=>{
  await call('patch','/api/profile',a.token,{id:b.user.id,name:'Майстер А',city:'Рівне',bio:'Працюю з плиткою',role:'professional',specialties:['tile'],experience_years:7,availability:'available',avatar_url:'',verified:true}).expect(200);
  await call('patch','/api/settings',a.token,{phone:'+380671234567',newsletter_opt_in:true,user_id:b.user.id}).expect(200);
  assert.equal((await m.User.findById(b.user.id)).phone,'');
  const own=(await call('get','/api/workspace',a.token)).body;assert.equal(own.settings.phone,'+380671234567');assert.equal(own.profile.name,'Майстер А');
  const other=(await call('get','/api/workspace',b.token)).body;assert.ok(!JSON.stringify(other).includes('+380671234567'));assert.ok(!JSON.stringify(other).includes('passwordHash'));
  assert.equal(await m.Consent.countDocuments({user_id:a.user.id,type:'newsletter',value:true}),1);
  await call('patch','/api/profile',a.token,{...own.profile,experience_years:99}).expect(400);
 });
 const draft={kind:'service',title:'Ремонт квартири під ключ',description:'Виконую ремонт квартир та будинків за узгодженим кошторисом.',category:'renovation',city:'Рівне',price:1500,unit:'м²',team_name:'Команда',images:[]};
 await t.test('listing moderation, forged owner, ownership and favorites',async()=>{
  listing=(await call('post','/api/listings',a.token,{...draft,owner_id:b.user.id,moderation_status:'approved'}).expect(201)).body;
  assert.equal(listing.owner_id,a.user.id);assert.equal(listing.moderation_status,'pending');
  assert.equal((await call('get','/api/workspace',b.token)).body.listings.length,0);
  await call('post','/api/conversations',b.token,{listing_id:listing.id}).expect(404);
  await call('patch','/api/listings/'+listing.id,b.token,draft).expect(404);
  await m.Listing.updateOne({_id:listing.id},{$set:{moderation_status:'approved'}});
  const remote=(await call('get','/api/workspace',b.token)).body;assert.equal(remote.listings.length,1);assert.ok(remote.profiles.some(p=>p.id===a.user.id));assert.ok(!JSON.stringify(remote).includes('+380671234567'));
  await call('put','/api/favorites/'+listing.id,b.token).expect(200);await call('put','/api/favorites/'+listing.id,b.token).expect(200);
  assert.equal(await m.Favorite.countDocuments({user_id:b.user.id}),1);
 });
  await t.test('request offers and order lifecycle',async()=>{
   requestListing=(await call('post','/api/listings',a.token,{...draft,kind:'request',title:'Потрібен майстер для ремонту',price:null}).expect(201)).body;
   await m.Listing.updateOne({_id:requestListing.id},{$set:{moderation_status:'approved'}});
   offer=(await call('post','/api/requests/'+requestListing.id+'/offers',b.token,{message:'Готовий виконати роботу.',price:1700,unit:'м²'}).expect(201)).body;
   await call('post','/api/requests/'+requestListing.id+'/offers',c.token,{message:'Можу взяти в роботу.',price:1800,unit:'м²'}).expect(201);
   await call('post','/api/offers/'+offer.id+'/accept',b.token).expect(404);
   assert.equal((await call('get','/api/requests/'+requestListing.id+'/offers',a.token).expect(200)).body.length,2);
   order=(await call('post','/api/offers/'+offer.id+'/accept',a.token).expect(201)).body;
   assert.equal(order.status,'accepted');assert.equal((await m.Listing.findById(requestListing.id)).status,'closed');
   assert.equal((await m.Offer.findOne({request_id:requestListing.id,provider_id:c.user.id})).status,'rejected');
   await call('patch','/api/orders/'+order.id+'/status',c.token,{status:'in_progress'}).expect(404);
   await call('patch','/api/orders/'+order.id+'/status',b.token,{status:'in_progress'}).expect(200);
   await call('patch','/api/orders/'+order.id+'/status',a.token,{status:'completed'}).expect(200);
   assert.equal((await m.Order.findById(order.id)).status,'completed');
  });
 await t.test('chat idempotency, ownership, messages and sender spoofing',async()=>{
  conv=(await call('post','/api/conversations',b.token,{listing_id:listing.id}).expect(200)).body;
  assert.equal((await call('post','/api/conversations',b.token,{listing_id:listing.id})).body.id,conv.id);
  await call('post',`/api/conversations/${conv.id}/messages`,c.token,{body:'Чужий',client_id:'x'}).expect(404);
  const msg=(await call('post',`/api/conversations/${conv.id}/messages`,b.token,{body:'Вітаю!',client_id:'m1',sender_id:a.user.id}).expect(201)).body;assert.equal(msg.sender_id,b.user.id);
  await call('post',`/api/conversations/${conv.id}/messages`,b.token,{body:'Вітаю!',client_id:'m1'}).expect(201);assert.equal(await m.Message.countDocuments(),1);
  assert.equal((await call('get','/api/workspace',a.token)).body.messages[0].body,'Вітаю!');assert.equal((await call('get','/api/workspace',c.token)).body.messages.length,0);
  await call('put',`/api/conversations/${conv.id}/read`,a.token).expect(200);
 });
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
 await t.test('persistent media, private tickets and image ownership',async()=>{
  await call('post','/api/media',a.token,{base64:Buffer.from('<svg/>').toString('base64'),visibility:'public'}).expect(400);
  const image=(await call('post','/api/media',a.token,{base64:png,visibility:'public'}).expect(201)).body;
  await call('get',`/api/media/${image.id}`).expect(200);
  await call('post','/api/listings',b.token,{...draft,images:[image.url]}).expect(400);
  privateImage=(await call('post','/api/media',a.token,{base64:png,visibility:'private',conversation_id:conv.id}).expect(201)).body;
  await call('get',`/api/media/${privateImage.id}`).expect(403);
  await call('post',`/api/media/${privateImage.id}/ticket`,c.token).expect(404);
  const ticket=(await call('post',`/api/media/${privateImage.id}/ticket`,b.token).expect(200)).body.url;
  await call('get',new URL(ticket).pathname+new URL(ticket).search).expect(200);
 });
 await t.test('blocking works in both directions and hiding does not publish',async()=>{
  await call('put','/api/blocks/'+a.user.id,b.token).expect(200);
  await call('post',`/api/conversations/${conv.id}/messages`,a.token,{body:'blocked',client_id:'m2'}).expect(403);
  await call('post','/api/conversations',b.token,{listing_id:listing.id}).expect(404);
  await call('delete','/api/blocks/'+a.user.id,b.token).expect(200);
  await call('patch','/api/listings/'+listing.id,a.token,{...draft,title:'Нова назва ремонту квартири'}).expect(200);
  assert.equal((await m.Listing.findById(listing.id)).moderation_status,'pending');
 });
 await t.test('reset password, revoke sessions, failed OTP and no session disclosure',async()=>{
  await call('post','/api/auth/recovery',null,{email:'b@test.com'}).expect(200);
  const code=mail.findLast(x=>x.email==='b@test.com'&&x.kind==='recovery').code;
  await call('post','/api/auth/reset',null,{email:'b@test.com',code:'000000',password:'NewPassword123'}).expect(400);
  await call('post','/api/auth/reset',null,{email:'b@test.com',code,password:'NewPassword123'}).expect(200);
  await call('get','/api/workspace',b.token).expect(401);
  b=(await call('post','/api/auth/login',null,{email:'b@test.com',password:'NewPassword123'}).expect(200)).body;
  await call('post','/api/auth/reset',null,{email:'b@test.com',code,password:'AnotherPass123'}).expect(400);
 });
 await t.test('OAuth unavailable fails clearly; PKCE grants are one-use',async()=>{
  await call('post','/api/auth/oauth/start',null,{provider:'facebook',redirect:cfg.redirects[0],challenge:'a'.repeat(64)}).expect(503);
  const grant='b'.repeat(64),verifier='v'.repeat(64);
  await m.OAuth.create({hash:hash(grant),kind:'grant',user_id:a.user.id,challenge:hash(verifier),expires:new Date(Date.now()+60000)});
  await call('post','/api/auth/oauth/exchange',null,{code:grant,verifier:'wrong'.repeat(10)}).expect(400);
  await call('post','/api/auth/oauth/exchange',null,{code:grant,verifier}).expect(200);
  await call('post','/api/auth/oauth/exchange',null,{code:grant,verifier}).expect(400);
 });
 await t.test('account deletion cascades through chats, photos and sessions',async()=>{
  await call('delete','/api/account',a.token).expect(200);
  assert.equal(await m.User.countDocuments({_id:a.user.id}),0);assert.equal(await m.Listing.countDocuments({owner_id:a.user.id}),0);assert.equal(await m.Message.countDocuments({conversation_id:conv.id}),0);assert.equal(await m.Media.countDocuments({owner_id:a.user.id}),0);
  assert.equal(await m.Session.countDocuments({user_id:a.user.id}),0);assert.equal(await m.Consent.countDocuments({user_id:a.user.id}),0);
  await call('get','/api/workspace',a.token).expect(401);await call('get',`/api/media/${privateImage.id}`).expect(404);
 });
 await t.test('rate limits enforced independently from client controls',async()=>{
  const limited=createApp({...cfg,testNoRate:false},async()=>{});
  for(let i=0;i<10;i++)await request(limited).post('/api/auth/login').send({email:'c@test.com',password:'wrong'}).expect(401);
  await request(limited).post('/api/auth/login').send({email:'c@test.com',password:'wrong'}).expect(429);
 });
 }finally{if(real){await mongoose.disconnect();await repl.stop();}}
});
