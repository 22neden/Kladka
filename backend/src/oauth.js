const m=require('./models');
const {fail,text,hash,token}=require('./security');
function registerOAuth(app,c,{sessionPayload,terms,limit}) {
 function provider(name){
  if(name==='google'&&c.googleId&&c.googleSecret)return {id:c.googleId,secret:c.googleSecret,authorize:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',userinfo:'https://openidconnect.googleapis.com/v1/userinfo',scope:'openid email profile'};
  if(name==='facebook'&&c.facebookId&&c.facebookSecret&&/^v\d+\.\d+$/.test(c.facebookVersion))return {id:c.facebookId,secret:c.facebookSecret,authorize:`https://www.facebook.com/${c.facebookVersion}/dialog/oauth`,token:`https://graph.facebook.com/${c.facebookVersion}/oauth/access_token`,userinfo:`https://graph.facebook.com/${c.facebookVersion}/me?fields=id,name,email`,scope:'email,public_profile'};
  fail(503,'Цей спосіб входу ще не налаштовано. Використайте email.');
 }
 app.post('/api/auth/oauth/start',async(req,res)=>{
  terms();const name=req.body.provider,p=provider(name),redirect=text(req.body.redirect,1,2048),challenge=text(req.body.challenge,64,64);
  if(!c.redirects.includes(redirect)||!/^[a-f0-9]{64}$/.test(challenge))fail(400,'Адреса повернення не дозволена.');
  const state=token();await m.OAuth.create({hash:hash(state),provider:name,redirect,challenge,kind:'state',expires:new Date(Date.now()+600000)});
  const url=new URL(p.authorize);url.search=new URLSearchParams({client_id:p.id,redirect_uri:`${c.publicUrl}/api/auth/oauth/${name}/callback`,response_type:'code',scope:p.scope,state}).toString();res.json({url:url.toString()});
 });
 app.get('/api/auth/oauth/:provider/callback',async(req,res)=>{
  const state=typeof req.query.state==='string'?req.query.state:'';
  const flow=await m.OAuth.findOneAndDelete({hash:hash(state),provider:req.params.provider,kind:'state',expires:{$gt:new Date()}});
  if(!flow)fail(400,'Спроба входу прострочена. Поверніться в застосунок.');
  const redirect=new URL(flow.redirect);
  try {
   if(req.query.error)fail(400,'Вхід скасовано.');
   const p=provider(flow.provider),code=text(req.query.code,1,4096);
   const tr=await fetch(p.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:p.id,client_secret:p.secret,code,redirect_uri:`${c.publicUrl}/api/auth/oauth/${flow.provider}/callback`,grant_type:'authorization_code'}),signal:AbortSignal.timeout(15000)});
   if(!tr.ok)fail(400,'Провайдер відхилив вхід.');const tokens=await tr.json();if(!tokens.access_token)fail(400,'Не отримано підтвердження входу.');
   const ur=await fetch(p.userinfo,{headers:{Authorization:`Bearer ${tokens.access_token}`},signal:AbortSignal.timeout(15000)});if(!ur.ok)fail(400,'Не вдалося отримати профіль.');const identity=await ur.json();
   if(flow.provider==='google'&&identity.email_verified!==true)fail(400,'Підтвердьте email у Google.');
   if(typeof identity.email!=='string'||!identity.email.includes('@'))fail(400,'Провайдер не передав email. Використайте реєстрацію через email.');
   const providerId=text(flow.provider==='google'?identity.sub:identity.id,1,200),email=identity.email.toLowerCase();
   let u=await m.User.findOne({provider:flow.provider,providerId,deleting:false});
   if(!u){
    if(await m.User.exists({email}))fail(409,'Цей email уже має акаунт. Увійдіть початковим способом або відновіть пароль.');
    u=await m.User.create({email,verified:true,provider:flow.provider,providerId,profile:{name:typeof identity.name==='string'?identity.name.slice(0,80):'Користувач'}});
    await m.Consent.create({user_id:u._id,type:'terms',value:true,version:c.termsVersion});
   }
   const grant=token();await m.OAuth.create({hash:hash(grant),kind:'grant',user_id:u._id,challenge:flow.challenge,expires:new Date(Date.now()+120000)});
   redirect.searchParams.set('code',grant);
  }catch(e){redirect.searchParams.set('error_description',e.status?e.message:'Не вдалося завершити вхід.');}
  res.redirect(redirect.toString());
 });
 app.post('/api/auth/oauth/exchange',async(req,res)=>{
  const code=text(req.body.code,64,64),verifier=text(req.body.verifier,32,256);
  await limit('oauth-code:'+hash(code),5,300000);
  const grant=await m.OAuth.findOneAndDelete({hash:hash(code),kind:'grant',challenge:hash(verifier),expires:{$gt:new Date()}});
  if(!grant)fail(400,'Спроба входу недійсна або вже використана.');
  const u=await m.User.findOne({_id:grant.user_id,deleting:false,verified:true});if(!u)fail(400,'Акаунт недоступний.');res.json(await sessionPayload(u));
 });
}
module.exports={registerOAuth};
