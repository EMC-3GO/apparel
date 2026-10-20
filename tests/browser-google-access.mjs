import {chromium,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {server} from './helpers/apps-script-server.js';
const backend=server({authenticate:false}),password='test-only-password-123!',code='test-only-recovery-code-456!';
const initial=backend.call('authenticateAccess',{password});backend.call('anffelRpc',{token:initial.token,name:'initializeLedger',arg:{data:{products:[],records:[]}}});backend.call('endAccessSession',{token:initial.token});
const html=await readFile(new URL('../public/apps-script/ANFFEL.html',import.meta.url),'utf8');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 async function client(){const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.setDefaultTimeout(7000);await page.exposeFunction('__invoke',(name,arg)=>backend.call(name,arg));await page.addInitScript(()=>{const runner=(success,fail)=>new Proxy({},{get:(_,name)=>name==='withSuccessHandler'?cb=>runner(cb,fail):name==='withFailureHandler'?cb=>runner(success,cb):arg=>globalThis.__invoke(name,arg).then(success).catch(e=>fail({message:e.message}))});globalThis.google={script:{run:runner(()=>{},()=>{})}};});await page.route('https://google-access.test/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));await page.goto('https://google-access.test/');return page;}
 const a=await client();await a.getByRole('heading',{name:'パスワードを入力',exact:true}).waitFor();
 for(let i=0;i<2;i++){await a.getByLabel('パスワード',{exact:true}).fill('wrong');await a.getByRole('button',{name:'確認する',exact:false}).click();await a.getByRole('status').getByText('パスワードが違います。',{exact:false}).waitFor();}
 const b=await client();await b.getByText('あと1回の誤入力でロックされます。',{exact:true}).waitFor();await b.getByLabel('パスワード',{exact:true}).fill('wrong');await b.getByRole('button',{name:'確認する',exact:false}).click();await b.getByRole('heading',{name:'入口全体をロックしました'}).waitFor();
 await a.reload();await a.getByRole('heading',{name:'入口全体をロックしました'}).waitFor();assert.equal(await a.getByRole('button',{name:'ANFFELを開く',exact:true}).count(),0);
 await a.getByLabel('解除コード',{exact:true}).fill('wrong');await a.getByRole('button',{name:'ロックを解除する',exact:true}).click();await a.getByRole('status').getByText('解除コードが違います。',{exact:true}).waitFor();
 await a.getByLabel('解除コード',{exact:true}).fill(code);await a.getByRole('button',{name:'ロックを解除する',exact:true}).click();await a.getByRole('heading',{name:'パスワードを入力',exact:true}).waitFor();assert.equal(await a.getByRole('button',{name:'ANFFELを開く',exact:true}).count(),0);
 await a.getByLabel('パスワード',{exact:true}).fill(password);await a.getByRole('button',{name:'確認する',exact:false}).click();await a.getByRole('button',{name:'ANFFELを開く',exact:true}).click();await a.getByRole('heading',{name:'ダッシュボード',exact:true}).waitFor();
 await a.reload();await a.getByRole('heading',{name:'認証が完了しました',exact:true}).waitFor();await a.getByRole('button',{name:'ANFFELを開く',exact:true}).click();
 await a.getByRole('heading',{name:'ダッシュボード',exact:true}).waitFor();
 await a.getByRole('button',{name:'メニューを開く',exact:true}).click();await a.getByRole('button',{name:'入口に戻る',exact:true}).click();await a.getByRole('heading',{name:'パスワードを入力',exact:true}).waitFor();
 // Another browser can authenticate after the global recovery; no browser-local reset is needed.
 await b.reload();await b.getByRole('heading',{name:'パスワードを入力',exact:true}).waitFor();
 assert.ok(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await b.screenshot({path:'/tmp/anffel-google-password.png',fullPage:true});
 console.log('Google gate browser passed: cross-browser global lock, reload persistence, recovery, fresh login, token reuse and logout');
}finally{await browser.close();}
