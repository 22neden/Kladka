const express=require('express');
const cors=require('cors');
const mongoose=require('mongoose');
const fs=require('node:fs');
const path=require('node:path');
const {randomInt}=require('node:crypto');
const m=require('./models');
const {ApiError,fail,hash,token,otpHash,text,email,password,choice,passwordHash,verifyPassword,publicProfile,wire}=require('./security');
const {registerOAuth}=require('./oauth');
const categories=['renovation','electric','plumbing','tile','painting','building','roof','design'];
function createApp(c,sendMail) {
 const app=express();app.disable('x-powered-by');app.set('trust proxy',1);
 const webRoot=path.join(__dirname,'..','public');
 const webIndex=path.join(webRoot,'index.html');
 app.use(cors({origin(origin,cb){cb(null,!origin||c.origins.includes(origin));}}));
 app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store'});next();});
 app.use(express.static(webRoot));
 app.use(express.json({limit:'7mb'}));
 app.use('/api',(req,_res,next)=>{if(req.body===undefined)req.body={};if(!req.body||typeof req.body!=='object'||Array.isArray(req.body))fail(400,'Очікується JSON-об’єкт.');next();});
 app.get('/',(_req,res)=>fs.existsSync(webIndex)?res.sendFile(webIndex):res.json({message:'Бекенд Kladka працює!',version:'1.2.0'}));
 app.get('/terms',(_req,res)=>res.type('html').send('<!doctype html><html lang="uk"><meta charset="utf-8"><title>Умови використання Kladka.UA</title><body><main><h1>Умови використання Kladka.UA</h1><p>Використовуючи Kladka.UA, ви погоджуєтеся на створення облікового запису та обробку даних, необхідних для роботи сервісу.</p><p>Користувач відповідає за достовірність оголошень, повідомлень і завантажених матеріалів та не має розміщувати незаконний або шкідливий контент.</p><p>Ми можемо видаляти матеріали, що порушують ці умови, і обмежувати доступ до сервісу у разі зловживань.</p><p>Версія умов: 2026-11-15.</p></main></body></html>'));
 app.get('/health',(_req,res)=>res.status(mongoose.connection.readyState===1?200:503).json({ok:mongoose.connection.readyState===1}));
 async function limit(key,max,ms) {
  if(c.testNoRate) return;
  const slot=Math.floor(Date.now()/ms),_id=hash(`${key}:${slot}`);
  let r;try {r=await m.Rate.findOneAndUpdate({_id},{$inc:{count:1},$setOnInsert:{expires:new Date((slot+2)*ms)}},{upsert:true,new:true});}catch(e){if(e.code!==11000)throw e;r=await m.Rate.findOneAndUpdate({_id},{$inc:{count:1}},{new:true});}
  if(r.count>max) fail(429,'Забагато спроб. Зачекайте та повторіть.');
 }
 app.use('/api',async(req,_res,next)=>{await limit('all:'+req.ip,600,300000);next();});
 app.use('/api/auth',async(req,_res,next)=>{await limit('auth:'+req.ip,40,900000);next();});
 const sessionPayload=async u=>{const raw=token();await m.Session.create({user_id:u._id,hash:hash(raw),expires:new Date(Date.now()+30*86400000)});return {token:raw,user:{id:u._id,email:u.email}};};
 async function auth(req,_res,next) {
  const raw=req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  const s=raw?await m.Session.findOne({hash:hash(raw),expires:{$gt:new Date()}}):null;
  const u=s?await m.User.findOne({_id:s.user_id,verified:true,deleting:false}):null;
  if(!u)fail(401,'Увійдіть у свій акаунт.','session_expired');req.user=u;req.session=s;next();
 }
 async function issue(u,kind) {
  await limit(`mail:${u.email}`,4,3600000);
  const old=await m.Challenge.findOne({user_id:u._id,kind});
  if(old?.sent_at && Date.now()-old.sent_at.getTime()<60000)fail(429,'Наступний код можна надіслати через хвилину.');
  const code=String(randomInt(100000,1000000));
  const record=await m.Challenge.findOneAndUpdate({user_id:u._id,kind},{$set:{hash:otpHash(c.secret,u._id,kind,code),attempts:0,expires:new Date(Date.now()+600000),sent_at:new Date()}},{new:true,upsert:true});
  try{await sendMail(u.email,code,kind);}catch(e){await m.Challenge.deleteOne({_id:record._id,hash:record.hash});throw e;}
 }
 async function consume(u,kind,code) {
  if(typeof code!=='string'||!/^\d{6}$/.test(code))fail(400,'Введіть шестизначний код.');
  const challenge=await m.Challenge.findOneAndUpdate({user_id:u._id,kind,expires:{$gt:new Date()},attempts:{$lt:5}},{$inc:{attempts:1}},{new:true});
  if(!challenge||challenge.hash!==otpHash(c.secret,u._id,kind,code))fail(400,'Код недійсний або прострочений.','otp_expired');
  const deleted=await m.Challenge.deleteOne({_id:challenge._id,hash:challenge.hash});
  if(!deleted.deletedCount)fail(400,'Код уже використано.');
 }
 function terms() {const local=/^http:\/\/(localhost|127\.0\.0\.1|192\.168\.)/.test(c.terms);if(!/^https:\/\//.test(c.terms)&&!(local&&!c.production))fail(503,'Умови використання ще не налаштовано.');}
 app.post('/api/auth/register',async(req,res)=>{
  terms();const e=email(req.body.email),p=password(req.body.password);const name=text(req.body.name||'Користувач',1,80);await limit('register:'+e,5,3600000);
  let u=await m.User.findOne({email:e});
  if(!u){try{u=await m.User.create({email:e,passwordHash:await passwordHash(p),profile:{name},newsletter_opt_in:req.body.news===true});await m.Consent.create([{user_id:u._id,type:'terms',value:true,version:c.termsVersion},{user_id:u._id,type:'newsletter',value:req.body.news===true,version:c.termsVersion}]);}catch(err){if(err.code!==11000)throw err;u=await m.User.findOne({email:e});}}
  // Never overwrite the password or verify a pre-registered account on a repeated signup.
  if(!u.verified)await issue(u,'signup');
  res.status(202).json({message:'Якщо реєстрація доступна, код надіслано.'});
 });
 app.post('/api/auth/confirm',async(req,res)=>{
  const u=await m.User.findOne({email:email(req.body.email),deleting:false});if(!u||!await verifyPassword(req.body.password,u.passwordHash))fail(400,'Для підтвердження потрібен пароль, указаний під час реєстрації. Якщо ви його не знаєте, відновіть пароль.');await consume(u,'signup',req.body.code);
  u.verified=true;await u.save();res.json(await sessionPayload(u));
 });
 app.post('/api/auth/resend',async(req,res)=>{const u=await m.User.findOne({email:email(req.body.email),verified:false,deleting:false});if(u)await issue(u,'signup');res.json({ok:true});});
 app.post('/api/auth/login',async(req,res)=>{
  const e=email(req.body.email);await limit('login:'+e,10,900000);const u=await m.User.findOne({email:e,deleting:false});
  if(!await verifyPassword(req.body.password,u?.passwordHash))fail(401,'Неправильний email або пароль.','invalid_credentials');
  if(!u.verified)fail(403,'Підтвердьте email.','email_not_confirmed');res.json(await sessionPayload(u));
 });
 app.post('/api/auth/recovery',async(req,res)=>{const u=await m.User.findOne({email:email(req.body.email),deleting:false});if(u)await issue(u,'recovery');res.json({ok:true});});
 app.post('/api/auth/reset',async(req,res)=>{
  const p=password(req.body.password);const u=await m.User.findOne({email:email(req.body.email),deleting:false});if(!u)fail(400,'Код недійсний.');await consume(u,'recovery',req.body.code);
  const h=await passwordHash(p);
  await mongoose.connection.transaction(async session=>{await m.User.updateOne({_id:u._id},{$set:{passwordHash:h,verified:true}},{session});await m.Session.deleteMany({user_id:u._id},{session});});res.json({ok:true});
 });
 app.get('/api/auth/me',auth,(req,res)=>res.json({user:{id:req.user._id,email:req.user.email}}));
 app.post('/api/auth/logout',auth,async(req,res)=>{await m.Session.deleteOne({_id:req.session._id});res.json({ok:true});});
 app.post('/api/auth/password',auth,async(req,res)=>{
  const p=password(req.body.password);if(!await verifyPassword(req.body.current_password,req.user.passwordHash))fail(400,'Поточний пароль неправильний.');
  const h=await passwordHash(p);await mongoose.connection.transaction(async session=>{await m.User.updateOne({_id:req.user._id},{$set:{passwordHash:h}},{session});await m.Session.deleteMany({user_id:req.user._id,_id:{$ne:req.session._id}},{session});});res.json({ok:true});
 });
 registerOAuth(app,c,{sessionPayload,terms,limit});
 async function isBlocked(a,b){return Boolean(await m.Block.exists({$or:[{blocker_id:a,blocked_id:b},{blocker_id:b,blocked_id:a}]}));}
 async function conversationFor(id,uid,writing=false){const v=await m.Conversation.findOne({_id:text(id,1,80),$or:[{participant_a:uid},{participant_b:uid}]});if(!v)fail(404,'Чат недоступний.');if(writing&&await isBlocked(v.participant_a,v.participant_b))fail(403,'Надсилання заборонено через блокування.');return v;}
 async function visibleListing(id,uid){
  const l=await m.Listing.findById(text(id,1,80));if(!l)fail(404,'Оголошення недоступне.');
  const workflowAccess=await m.Order.exists({request_id:l._id,$or:[{customer_id:uid},{provider_id:uid}]});
  if(l.owner_id!==uid&&(l.status!=='active'||l.moderation_status!=='approved')&&!workflowAccess)fail(404,'Оголошення недоступне.');
  if(l.owner_id!==uid&&await isBlocked(uid,l.owner_id))fail(404,'Оголошення недоступне.');
  return l;
 }
 const mediaUrl=id=>`${c.publicUrl}/api/media/${id}`;
 async function ownedImage(url,uid){if(!url)return '';const id=url.startsWith(c.publicUrl+'/api/media/')?url.slice((c.publicUrl+'/api/media/').length):'';if(!id||!await m.Media.exists({_id:id,owner_id:uid,visibility:'public'}))fail(400,'Фото не належить цьому акаунту.');return url;}
 app.get('/api/workspace',auth,async(req,res)=>{
  const uid=req.user._id;
  const blocks=await m.Block.find({$or:[{blocker_id:uid},{blocked_id:uid}]}).lean();
  const hidden=blocks.map(b=>b.blocker_id===uid?b.blocked_id:b.blocker_id);
  const [userOffers,userOrders]=await Promise.all([m.Offer.find({provider_id:uid}).select('request_id').lean(),m.Order.find({$or:[{customer_id:uid},{provider_id:uid}]}).select('request_id').lean()]);
  const workflowListingIds=[...new Set([...userOffers,...userOrders].map(item=>item.request_id))];
  const listings=await m.Listing.find({$or:[{owner_id:uid},{owner_id:{$nin:hidden},status:'active',moderation_status:'approved'},{_id:{$in:workflowListingIds}}]}).sort({created_at:-1}).limit(1000).lean();
  const conversations=await m.Conversation.find({$or:[{participant_a:uid},{participant_b:uid}]}).sort({updated_at:-1}).limit(200).lean();
  const messages=[];for(const v of conversations){const batch=await m.Message.find({conversation_id:v._id}).sort({created_at:-1}).limit(200).lean();messages.push(...batch);}
  const ids=[...new Set([uid,...listings.map(l=>l.owner_id),...conversations.flatMap(v=>[v.participant_a,v.participant_b])])];
  const profiles=await m.User.find({_id:{$in:ids},deleting:false}).select('profile').lean();
  const [favorites,reads,offers,orders]=await Promise.all([m.Favorite.find({user_id:uid}).lean(),m.Read.find({user_id:uid}).lean(),m.Offer.find({$or:[{provider_id:uid},{request_id:{$in:listings.filter(l=>l.owner_id===uid).map(l=>l._id)}}]}).sort({updated_at:-1}).limit(500).lean(),m.Order.find({$or:[{customer_id:uid},{provider_id:uid}]}).sort({updated_at:-1}).limit(200).lean()]);
  res.json({profile:publicProfile(req.user),profiles:profiles.map(publicProfile),settings:{phone:req.user.phone,newsletter_opt_in:req.user.newsletter_opt_in},listings:listings.map(wire),conversations:conversations.map(wire),messages:messages.map(wire).sort((a,b)=>a.created_at-b.created_at),favorites:favorites.map(f=>f.listing_id),blocked:blocks.filter(b=>b.blocker_id===uid).map(b=>b.blocked_id),readAt:Object.fromEntries(reads.map(r=>[r.conversation_id,r.last_read_at])),offers:offers.map(wire),orders:orders.map(wire),limits:{listings:1000,conversations:200,messagesPerConversation:200,offers:500,orders:200}});
 });
 app.patch('/api/profile',auth,async(req,res)=>{
  const b=req.body,profile={name:text(b.name,1,80),city:text(b.city,0,80),bio:text(b.bio,0,1500),role:choice(b.role,['customer','professional']),avatar_url:await ownedImage(text(b.avatar_url||'',0,2048),req.user._id),specialties:b.specialties||[],experience_years:b.experience_years??0,availability:choice(b.availability||'available',['available','busy'])};
  if(!Array.isArray(profile.specialties)||profile.specialties.length>8||profile.specialties.some(s=>!categories.includes(s)))fail(400,'Перевірте спеціалізації.');
  if(!Number.isInteger(profile.experience_years)||profile.experience_years<0||profile.experience_years>80)fail(400,'Досвід: 0–80 років.');
  await m.User.updateOne({_id:req.user._id},{$set:{profile}});res.json({ok:true});
 });
 app.patch('/api/settings',auth,async(req,res)=>{
  const phone=text(req.body.phone,0,24),news=req.body.newsletter_opt_in;if(typeof news!=='boolean'||phone&&!/^\+?[0-9 ()-]{7,24}$/.test(phone))fail(400,'Перевірте налаштування.');
  await mongoose.connection.transaction(async session=>{await m.User.updateOne({_id:req.user._id},{$set:{phone,newsletter_opt_in:news}},{session});if(news!==req.user.newsletter_opt_in)await m.Consent.create([{user_id:req.user._id,type:'newsletter',value:news,version:c.termsVersion}],{session});});res.json({ok:true});
 });
 async function listingInput(b,uid){
  const price=b.price;if(price!==null&&(typeof price!=='number'||!Number.isFinite(price)||price<0||price>100000000))fail(400,'Перевірте ціну.');
  if(!Array.isArray(b.images)||b.images.length>6)fail(400,'До 6 фото.');
  const images=[];for(const url of b.images)images.push(await ownedImage(text(url,1,2048),uid));
  return {kind:choice(b.kind,['service','request']),title:text(b.title,8,100),description:text(b.description,30,5000),category:choice(b.category,categories),city:text(b.city,2,80),price,unit:text(b.unit||'',0,30),team_name:text(b.team_name||'',0,100),images};
 }
 app.post('/api/listings',auth,async(req,res)=>{await limit('listing:'+req.user._id,20,3600000);const input=await listingInput(req.body,req.user._id);const l=await m.Listing.create({...input,owner_id:req.user._id,moderation_status:c.moderation==='auto'?'approved':'pending'});res.status(201).json(wire(l));});
 app.patch('/api/listings/:id',auth,async(req,res)=>{const input=await listingInput(req.body,req.user._id);const l=await m.Listing.findOneAndUpdate({_id:req.params.id,owner_id:req.user._id},{$set:{...input,moderation_status:c.moderation==='auto'?'approved':'pending'}},{new:true});if(!l)fail(404,'Оголошення недоступне.');res.json(wire(l));});
 app.patch('/api/listings/:id/status',auth,async(req,res)=>{const status=choice(req.body.status,['active','closed','hidden']);const l=await m.Listing.findOneAndUpdate({_id:req.params.id,owner_id:req.user._id},{$set:{status}},{new:true});if(!l)fail(404,'Оголошення недоступне.');res.json({ok:true});});
 app.put('/api/favorites/:id',auth,async(req,res)=>{await visibleListing(req.params.id,req.user._id);await m.Favorite.updateOne({user_id:req.user._id,listing_id:req.params.id},{$setOnInsert:{user_id:req.user._id,listing_id:req.params.id}},{upsert:true});res.json({ok:true});});
 app.delete('/api/favorites/:id',auth,async(req,res)=>{await m.Favorite.deleteOne({user_id:req.user._id,listing_id:req.params.id});res.json({ok:true});});
 app.post('/api/requests/:id/offers',auth,async(req,res)=>{
  const request=await m.Listing.findById(text(req.params.id,1,80));if(!request||request.kind!=='request'||request.status!=='active'||request.moderation_status!=='approved')fail(404,'Заявка недоступна.');
  if(request.owner_id===req.user._id)fail(400,'Не можна відгукнутися на власну заявку.');
  const price=req.body.price;if(typeof price!=='number'||!Number.isFinite(price)||price<0||price>100000000)fail(400,'Перевірте ціну пропозиції.');
  const message=text(req.body.message||'',0,2000),unit=text(req.body.unit||request.unit||'',0,30);
  const existing=await m.Offer.findOne({request_id:request._id,provider_id:req.user._id});
  if(existing?.status==='accepted')fail(409,'Цю пропозицію вже прийнято.');
  const offer=existing?await m.Offer.findOneAndUpdate({_id:existing._id},{$set:{message,price,unit,status:'pending',updated_at:new Date()}},{new:true}):await m.Offer.create({request_id:request._id,provider_id:req.user._id,message,price,unit});
  res.status(existing?200:201).json(wire(offer));
 });
 app.get('/api/requests/:id/offers',auth,async(req,res)=>{
  const request=await m.Listing.findById(text(req.params.id,1,80));if(!request)fail(404,'Заявка недоступна.');
  if(request.owner_id!==req.user._id&&!await m.Offer.exists({request_id:request._id,provider_id:req.user._id}))fail(404,'Заявка недоступна.');
  const offers=await m.Offer.find({request_id:request._id}).sort({created_at:1}).limit(200);res.json(offers.map(wire));
 });
 app.patch('/api/offers/:id/status',auth,async(req,res)=>{
  const status=choice(req.body.status,['rejected','withdrawn']);const offer=await m.Offer.findById(text(req.params.id,1,80));if(!offer||offer.status!=='pending')fail(404,'Пропозиція недоступна.');
  const request=await m.Listing.findById(offer.request_id);if(!request)fail(404,'Заявка недоступна.');
  if(status==='withdrawn'&&offer.provider_id!==req.user._id)fail(403,'Відкликати можна лише власну пропозицію.');
  if(status==='rejected'&&request.owner_id!==req.user._id)fail(403,'Відхилити пропозицію може лише автор заявки.');
  const updated=await m.Offer.findOneAndUpdate({_id:offer._id,status:'pending'},{$set:{status,updated_at:new Date()}},{new:true});res.json(wire(updated));
 });
 app.post('/api/offers/:id/accept',auth,async(req,res)=>{
  const offer=await m.Offer.findById(text(req.params.id,1,80));if(!offer||offer.status!=='pending')fail(404,'Пропозиція недоступна.');
  const request=await m.Listing.findById(offer.request_id);if(!request||request.owner_id!==req.user._id||request.kind!=='request'||request.status!=='active')fail(404,'Заявка недоступна.');
  let order;
  await mongoose.connection.transaction(async session=>{
   const locked=await m.Offer.findOne({_id:offer._id,status:'pending'}).session(session);if(!locked)fail(409,'Пропозицію вже оброблено.');
   await m.Offer.updateMany({request_id:request._id,status:'pending',_id:{$ne:offer._id}},{$set:{status:'rejected',updated_at:new Date()}},{session});
   await m.Offer.updateOne({_id:offer._id},{$set:{status:'accepted',updated_at:new Date()}},{session});
   order=await m.Order.create([{request_id:request._id,offer_id:offer._id,customer_id:request.owner_id,provider_id:offer.provider_id,agreed_price:offer.price,unit:offer.unit}],{session});
   await m.Listing.updateOne({_id:request._id},{$set:{status:'closed'}},{session});
  });
  res.status(201).json(wire(Array.isArray(order)?order[0]:order));
 });
 app.patch('/api/orders/:id/status',auth,async(req,res)=>{
  const status=choice(req.body.status,['in_progress','completed','cancelled']);const order=await m.Order.findById(text(req.params.id,1,80));if(!order||![order.customer_id,order.provider_id].includes(req.user._id))fail(404,'Замовлення недоступне.');
  const allowed=(order.status==='accepted'&&['in_progress','cancelled'].includes(status))||(order.status==='in_progress'&&['completed','cancelled'].includes(status));if(!allowed)fail(409,'Цей перехід статусу неможливий.');
  const update={status,updated_at:new Date()};if(status==='completed')update.completed_at=new Date();
  const updated=await m.Order.findOneAndUpdate({_id:order._id,status:order.status},{$set:update},{new:true});if(!updated)fail(409,'Замовлення вже оновлено.');
  res.json(wire(updated));
 });
 app.post('/api/conversations',auth,async(req,res)=>{
  const l=await visibleListing(req.body.listing_id,req.user._id);if(l.owner_id===req.user._id)fail(400,'Це ваше оголошення.');
  const pair=[req.user._id,l.owner_id].sort(),query={participant_a:pair[0],participant_b:pair[1],listing_id:l._id};let v;
  try{v=await m.Conversation.findOneAndUpdate(query,{$setOnInsert:query},{upsert:true,new:true});}catch(e){if(e.code!==11000)throw e;v=await m.Conversation.findOne(query);}res.json(wire(v));
 });
 app.post('/api/conversations/:id/messages',auth,async(req,res)=>{
  await limit('message:'+req.user._id,60,60000);const v=await conversationFor(req.params.id,req.user._id,true),body=text(req.body.body||'',0,4000),image=req.body.image_path?text(req.body.image_path,1,80):null,client_id=text(req.body.client_id,1,80);
  if(!body&&!image)fail(400,'Порожнє повідомлення.');if(image&&!await m.Media.exists({_id:image,owner_id:req.user._id,conversation_id:v._id,visibility:'private'}))fail(400,'Вкладення недоступне.');
  let msg;try{msg=await m.Message.create({conversation_id:v._id,sender_id:req.user._id,body,image_path:image,client_id});}catch(e){if(e.code!==11000)throw e;msg=await m.Message.findOne({sender_id:req.user._id,client_id});if(msg.conversation_id!==v._id)fail(409,'Повторний ідентифікатор повідомлення.');}
  await m.Conversation.updateOne({_id:v._id},{$max:{updated_at:msg.created_at}});res.status(201).json(wire(msg));
 });
 app.put('/api/conversations/:id/read',auth,async(req,res)=>{await conversationFor(req.params.id,req.user._id);const now=new Date();await m.Read.updateOne({user_id:req.user._id,conversation_id:req.params.id},{$set:{last_read_at:now}},{upsert:true});res.json({last_read_at:now});});
 app.post('/api/reports',auth,async(req,res)=>{await limit('report:'+req.user._id,10,3600000);const reported_id=text(req.body.reported_id,1,80);if(!await m.User.exists({_id:reported_id}))fail(404,'Користувач недоступний.');await m.Report.create({reporter_id:req.user._id,reported_id,listing_id:req.body.listing_id?text(req.body.listing_id,1,80):null,reason:text(req.body.reason,3,2000)});res.status(201).json({ok:true});});
 app.put('/api/blocks/:id',auth,async(req,res)=>{if(req.params.id===req.user._id||!await m.User.exists({_id:req.params.id}))fail(400,'Користувач недоступний.');await m.Block.updateOne({blocker_id:req.user._id,blocked_id:req.params.id},{$setOnInsert:{blocker_id:req.user._id,blocked_id:req.params.id}},{upsert:true});res.json({ok:true});});
 app.delete('/api/blocks/:id',auth,async(req,res)=>{await m.Block.deleteOne({blocker_id:req.user._id,blocked_id:req.params.id});res.json({ok:true});});
 app.post('/api/media',auth,async(req,res)=>{
  await limit('upload:'+req.user._id,20,3600000);const visibility=choice(req.body.visibility,['public','private']);const cid=visibility==='private'?text(req.body.conversation_id,1,80):null;if(cid)await conversationFor(cid,req.user._id,true);
  const data64=req.body.base64;if(typeof data64!=='string'||data64.length>7*1024*1024||!/^[-A-Za-z0-9+/=]+$/.test(data64))fail(400,'Некоректне зображення.');const data=Buffer.from(data64,'base64');
  const jpeg=data.length>3&&data[0]===255&&data[1]===216&&data[2]===255;const png=data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));if(!jpeg&&!png)fail(400,'Дозволено JPEG або PNG.');if(data.length>5*1024*1024)fail(413,'Максимум 5 МБ.');
  let media;
  await mongoose.connection.transaction(async session=>{
   const owner=await m.User.findOneAndUpdate({_id:req.user._id,deleting:false,mediaBytes:{$lte:c.mediaLimit-data.length}},{$inc:{mediaBytes:data.length}},{new:true,session});
   if(!owner)fail(413,'Ліміт фото акаунта вичерпано.');
   [media]=await m.Media.create([{owner_id:req.user._id,conversation_id:cid,visibility,mime:jpeg?'image/jpeg':'image/png',bytes:data.length,data}],{session});
  });
  res.status(201).json({id:media._id,url:visibility==='public'?mediaUrl(media._id):null});
 });
 app.post('/api/media/:id/ticket',auth,async(req,res)=>{const media=await m.Media.findById(req.params.id);if(!media)fail(404,'Фото недоступне.');if(media.visibility==='private')await conversationFor(media.conversation_id,req.user._id);const raw=token();await m.Ticket.create({hash:hash(raw),user_id:req.user._id,session_id:req.session._id,media_id:media._id,expires:new Date(Date.now()+300000)});res.json({url:mediaUrl(media._id)+'?ticket='+raw});});
 app.get('/api/media/:id',async(req,res)=>{
  const media=await m.Media.findById(req.params.id).select('+data');if(!media)fail(404,'Фото недоступне.');
  if(media.visibility==='private'){const raw=typeof req.query.ticket==='string'?req.query.ticket:'';const t=await m.Ticket.findOne({hash:hash(raw),media_id:media._id,expires:{$gt:new Date()}});if(!t||!await m.Session.exists({_id:t.session_id,user_id:t.user_id,expires:{$gt:new Date()}}))fail(403,'Посилання на фото прострочене.');await conversationFor(media.conversation_id,t.user_id);}
  res.type(media.mime).send(media.data);
 });
 app.delete('/api/account',auth,async(req,res)=>{
  const uid=req.user._id;
  await mongoose.connection.transaction(async session=>{
   const convs=await m.Conversation.find({$or:[{participant_a:uid},{participant_b:uid}]}).session(session).select('_id');const ids=convs.map(v=>v._id);
   const listings=await m.Listing.find({owner_id:uid}).session(session).select('_id');const lids=listings.map(v=>v._id);
   await m.User.deleteOne({_id:uid},{session});await m.Session.deleteMany({user_id:uid},{session});await m.Challenge.deleteMany({user_id:uid},{session});
   await m.Offer.deleteMany({$or:[{provider_id:uid},{request_id:{$in:lids}}]},{session});await m.Order.deleteMany({$or:[{customer_id:uid},{provider_id:uid},{request_id:{$in:lids}}]},{session});
   await m.Listing.deleteMany({owner_id:uid},{session});await m.Conversation.deleteMany({_id:{$in:ids}},{session});await m.Message.deleteMany({$or:[{sender_id:uid},{conversation_id:{$in:ids}}]},{session});
   await m.Media.deleteMany({$or:[{owner_id:uid},{conversation_id:{$in:ids}}]},{session});await m.Ticket.deleteMany({user_id:uid},{session});await m.Favorite.deleteMany({$or:[{user_id:uid},{listing_id:{$in:lids}}]},{session});
   await m.Read.deleteMany({$or:[{user_id:uid},{conversation_id:{$in:ids}}]},{session});await m.Block.deleteMany({$or:[{blocker_id:uid},{blocked_id:uid}]},{session});await m.Report.deleteMany({$or:[{reporter_id:uid},{reported_id:uid}]},{session});await m.Consent.deleteMany({user_id:uid},{session});await m.OAuth.deleteMany({user_id:uid},{session});
  });res.json({ok:true});
 });
 app.use((req,res,next)=>{if(req.method==='GET'&&!req.path.startsWith('/api')&&req.accepts('html')&&fs.existsSync(webIndex))return res.sendFile(webIndex);next();});
 app.use('/api',(_req,_res)=>fail(404,'Маршрут не знайдено.'));
 app.use((err,_req,res,_next)=>{const status=err.status||(err.code===11000?409:500);res.status(status).json({error:status<500||err.status===503?err.message:'Помилка сервера. Спробуйте пізніше.',code:err.code&&typeof err.code==='string'?err.code:undefined});});
 return app;
}
module.exports={createApp};
