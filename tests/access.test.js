import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAccessHandler,issueSession,validSession,TARGET_URL} from '../server/access.js';
const password='test-only-long-password-123!';
function fixture(config={}){
 const handler=createAccessHandler({getPassword:()=>password,limiter:new Map(),...config});
 return async(method='GET',options={})=>{
  const headers={};let body='';
  const res={statusCode:200,setHeader(k,v){headers[k.toLowerCase()]=v;},end(v=''){body=v;}};
  await handler({method,url:options.url||'/api/access',headers:{host:'anffel.example',origin:'https://anffel.example','content-type':'application/json','x-vercel-forwarded-for':'192.0.2.1',...options.headers},body:options.body},res);
  return {status:res.statusCode,headers,body,...(body?{data:JSON.parse(body)}:{})};
 };
}
test('unconfigured entrance fails closed, including direct button endpoint',async()=>{
 const call=fixture({getPassword:()=>undefined});assert.equal((await call()).status,503);assert.equal((await call('GET',{url:'/api/access?action=open'})).status,503);
 assert.equal((await fixture({getPassword:()=> 'short'})('POST',{body:{password:'short'}})).status,503);
});
test('password login issues secure cookie; redirect needs valid session and logout clears cookie',async()=>{
 const call=fixture();assert.equal((await call()).data.authenticated,false);
 assert.equal((await call('GET',{url:'/api/access?action=open'})).status,401);
 assert.equal((await call('POST',{body:{password:'wrong'}})).status,401);
 const good=await call('POST',{body:{password}});assert.equal(good.status,200);
 const setCookie=good.headers['set-cookie'];for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/','Max-Age=3600'])assert.ok(setCookie.includes(flag));
 const cookie=setCookie.split(';')[0];assert.equal((await call('GET',{headers:{cookie}})).data.authenticated,true);
 const open=await call('GET',{url:'/api/access?action=open',headers:{cookie}});assert.equal(open.status,303);assert.equal(open.headers.location,TARGET_URL);
 assert.equal((await call('DELETE',{headers:{cookie}})).headers['set-cookie'].includes('Max-Age=0'),true);
 assert.equal(good.headers['cache-control'],'private, no-store');assert.ok(!good.body.includes(password));assert.ok(!good.body.includes(TARGET_URL));
});
test('forged, expired and password-rotated sessions are rejected',()=>{
 const now=Date.now(),token=issueSession(password,now);
 assert.ok(validSession(token,password,now));assert.ok(!validSession(token+'x',password,now));assert.ok(!validSession(token,password,now+3600000));assert.ok(!validSession(token,'new-password',now));assert.ok(!validSession('invalid',password,now));
});
test('cross-origin attempts and malformed payloads are rejected; local limiter blocks repeated guesses',async()=>{
 const call=fixture();
 assert.equal((await call('POST',{headers:{origin:'https://evil.example'},body:{password}})).status,403);
 assert.equal((await call('DELETE',{headers:{origin:undefined}})).status,403);
 assert.equal((await call('POST',{headers:{'content-type':'text/plain'},body:password})).status,415);
 assert.equal((await call('PUT')).status,405);
 assert.equal((await call('POST',{body:'{broken'})).status,400);
 for(let i=0;i<4;i++)assert.equal((await call('POST',{body:{password:'wrong'}})).status,401);
 const blocked=await call('POST',{body:{password}});assert.equal(blocked.status,429);assert.ok(Number(blocked.headers['retry-after'])>0);
});
