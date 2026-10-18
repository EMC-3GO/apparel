import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createAccessHandler,TARGET_URL} from '../server/access.js';
const password='test-only-long-password-123!';
const access=createAccessHandler({getPassword:()=>password,limiter:new Map()});
// Local HTTP harness models Vercel's TLS termination. Production requires HTTPS Origin.
const server=createServer(async(req,res)=>{
 try{
  if(req.url.startsWith('/api/access')){
   let body='';for await(const chunk of req)body+=chunk;req.body=body||undefined;
   if(req.headers.origin===`http://${req.headers.host}`)req.headers.origin=`https://${req.headers.host}`;
   return access(req,res);
  }
  const path=req.url==='/'?'/entrance/index.html':req.url;
  if(!['/entrance/index.html','/entrance/style.css','/entrance/access.js','/anffel-logo.png'].includes(path)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':path.endsWith('.png')?'image/png':'text/html');res.end(await readFile(new URL('../public'+path,import.meta.url)));
 }catch(e){res.statusCode=500;res.end(e.message);}
});
await new Promise(resolve=>server.listen(4178,'localhost',resolve));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const context=await browser.newContext(),page=await context.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:4178/');
 await page.getByRole('heading',{name:'パスワードを入力'}).waitFor();
 assert.equal(await page.getByRole('link',{name:'ANFFELを開く'}).count(),0);
 await page.getByLabel('パスワード',{exact:true}).fill('wrong');await page.getByRole('button',{name:'確認する'}).click();await page.getByText('パスワードが違います。').waitFor();
 await page.getByLabel('パスワード',{exact:true}).fill(password);await page.getByRole('button',{name:'確認する'}).click();await page.getByRole('link',{name:'ANFFELを開く'}).waitFor();
 const cookies=await context.cookies();assert.ok(cookies.some(c=>c.httpOnly&&c.secure&&c.sameSite==='Strict'));
 await page.reload();await page.getByRole('link',{name:'ANFFELを開く'}).waitFor();
 const response=await context.request.get('http://localhost:4178/api/access?action=open',{maxRedirects:0});assert.equal(response.status(),303);assert.equal(response.headers().location,TARGET_URL);
 await page.getByRole('button',{name:'ロックする'}).click();await page.getByRole('heading',{name:'パスワードを入力'}).waitFor();assert.equal((await context.request.get('http://localhost:4178/api/access?action=open')).status(),401);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/tmp/anffel-entrance-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('Entrance browser: wrong/correct password, secure cookie, reload, authorized redirect, lock and mobile passed');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
