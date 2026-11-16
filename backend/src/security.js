const { scrypt, randomBytes, createHash, createHmac, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const derive = promisify(scrypt);
class ApiError extends Error { constructor(status, message, code) { super(message); this.status = status; this.code = code; } }
const fail = (status, message, code) => { throw new ApiError(status,message,code); };
const hash = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('hex');
const otpHash = (secret, user, kind, code) => createHmac('sha256',secret).update(`${user}:${kind}:${code}`).digest('hex');
function text(value, min=0, max=5000) { if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(400,`Текст має містити ${min}–${max} символів.`); return value.trim(); }
function email(value) { const result=text(value,3,254).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail(400,'Перевірте email.'); return result; }
function password(value) { if (typeof value!=='string' || Array.from(value).length<9 || value.length>128 || !/\p{Lu}/u.test(value) || !/\p{Ll}/u.test(value) || !/\d/.test(value)) fail(400,'Пароль: 9–128 символів, велика й мала літери, цифра.'); return value; }
function choice(value, allowed) { if (!allowed.includes(value)) fail(400,'Недопустиме значення поля.'); return value; }
async function passwordHash(value) { const salt=randomBytes(16).toString('hex'); const bytes=await derive(value,salt,64,{N:16384,r:8,p:1}); return `${salt}:${bytes.toString('hex')}`; }
async function verifyPassword(value, stored) { if(typeof value!=='string'||value.length>128) return false; const [salt,key]=(stored||'').split(':'); const bytes=await derive(value,salt||'invalid-user-salt',64,{N:16384,r:8,p:1}); return Boolean(key && key.length===128 && timingSafeEqual(bytes,Buffer.from(key,'hex'))); }
const publicProfile = u => ({ id: u._id, ...(typeof u.profile?.toObject === 'function' ? u.profile.toObject() : u.profile) });
const wire = d => { const obj=d.toObject ? d.toObject() : {...d}; const {_id,...rest}=obj; return { id:_id,...rest }; };
module.exports={ ApiError,fail,hash,token,otpHash,text,email,password,choice,passwordHash,verifyPassword,publicProfile,wire };
