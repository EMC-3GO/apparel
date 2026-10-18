import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

export const TARGET_URL='https://script.google.com/a/macros/stu.musashino-u.ac.jp/s/AKfycbwDeECBD1UE0K7Qe6T3QThhkA2Ok-9KQ2rc68URAwXDARh2rx1AuAyn96WQdOqao7nBkA/exec';
const COOKIE='__Host-anffel_access';
const TTL=60*60;
const attempts=new Map(); // Supplementary protection within one function instance, not a distributed limiter.
function mac(value,key){return createHmac('sha256',key).update(value).digest('base64url');}
function equal(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
function signingKey(password){return mac('ANFFEL session signing v1',password);}
export function issueSession(password,now=Date.now()){
 const payload=Buffer.from(JSON.stringify({expires:Math.floor(now/1000)+TTL,nonce:randomBytes(16).toString('hex')})).toString('base64url');
 return `${payload}.${mac(payload,signingKey(password))}`;
}
export function validSession(token,password,now=Date.now()){
 try{
  if(typeof token!=='string'||token.length>1024)return false;
  const [payload,signature,...rest]=token.split('.');
  if(rest.length||!signature||!equal(signature,mac(payload,signingKey(password))))return false;
  const data=JSON.parse(Buffer.from(payload,'base64url').toString());
  const time=Math.floor(now/1000);
  return Number.isInteger(data.expires)&&data.expires>time&&data.expires<=time+TTL;
 }catch{return false;}
}
export function createAccessHandler({getPassword=()=>process.env.ANFFEL_ACCESS_PASSWORD,now=()=>Date.now(),limiter=attempts}={}){
 return async function access(req,res){
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  const json=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body));};
  const password=getPassword();
  if(!password||password.length<16)return json(503,{error:'入口のパスワードを設定中です。しばらくしてからお試しください。'});
  const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  const authenticated=validSession(cookie,password,now());
  const requestUrl=new URL(req.url,'https://anffel.invalid');
  if(req.method==='GET'){
   if(requestUrl.searchParams.get('action')==='open'){
    if(!authenticated)return json(401,{error:'パスワードを入力してください。'});
    res.statusCode=303;res.setHeader('Location',TARGET_URL);return res.end();
   }
   return json(200,{authenticated});
  }
  if(!['POST','DELETE'].includes(req.method)){res.setHeader('Allow','GET, POST, DELETE');return json(405,{error:'この操作には対応していません。'});}
  if(req.headers.origin!==`https://${req.headers.host}`)return json(403,{error:'画面を開き直してお試しください。'});
  if(req.method==='DELETE'){
   res.setHeader('Set-Cookie',`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
   return json(200,{authenticated:false});
  }
  if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{error:'入力形式を確認してください。'});
  const key=req.headers['x-vercel-forwarded-for']||req.socket?.remoteAddress||'unknown';
  const time=now();
  if(limiter.size>10000)for(const [k,v] of limiter)if(v.until<=time)limiter.delete(k);
  let entry=limiter.get(key);
  if(!entry||entry.until<=time){entry={count:0,until:time+15*60*1000};limiter.set(key,entry);}
  if(entry.count>=5){res.setHeader('Retry-After',String(Math.ceil((entry.until-time)/1000)));return json(429,{error:'試行回数が多いため、15分ほど待ってからお試しください。'});}
  entry.count++;
  let body=req.body;
  if(typeof body==='string'){try{if(body.length>4096)throw Error();body=JSON.parse(body);}catch{return json(400,{error:'入力内容を確認してください。'});}}
  const input=body?.password;
  if(typeof input!=='string'||input.length>1024||!equal(mac(input,signingKey(password)),mac(password,signingKey(password))))return json(401,{error:'パスワードが違います。'});
  limiter.delete(key);
  res.setHeader('Set-Cookie',`${COOKIE}=${issueSession(password,time)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL}`);
  return json(200,{authenticated:true});
 };
}
