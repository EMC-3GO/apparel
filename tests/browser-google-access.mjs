import {chromium,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {server} from './helpers/apps-script-server.js';
const backend=server({authenticate:false,configured:false});backend.call('initializeLedger',{data:{products:[],records:[]}});
backend.props.set('ANFFEL_ACCESS_LOCK','obsolete lock');
const html=await readFile(new URL('../public/apps-script/ANFFEL.html',import.meta.url),'utf8');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(7000);
 await page.exposeFunction('__invoke',(name,arg)=>backend.call(name,arg));await page.addInitScript(()=>{const runner=(success,fail)=>new Proxy({},{get:(_,name)=>name==='withSuccessHandler'?cb=>runner(cb,fail):name==='withFailureHandler'?cb=>runner(success,cb):arg=>globalThis.__invoke(name,arg).then(success).catch(e=>fail({message:e.message}))});globalThis.google={script:{run:runner(()=>{},()=>{})}};});
 await page.route('https://google-access.test/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));await page.goto('https://google-access.test/');
 await expect(page.getByRole('heading',{name:'ダッシュボード',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'保存先のスプレッドシートを開く'})).toBeVisible();await expect(page.locator('input[type=password]')).toHaveCount(0);await expect(page.getByRole('button',{name:'入口に戻る'})).toHaveCount(0);
 await page.reload();await expect(page.getByRole('link',{name:'保存先のスプレッドシートを開く'})).toBeVisible();
 console.log('Google access passed: direct owner access without password, lock or token; reload works.');
}finally{await browser.close();}
