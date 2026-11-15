import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const root=resolve('dist'),policy=JSON.parse(await readFile('vercel.json','utf8')).headers.find(r=>r.source==='/').headers;
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname,file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root+'/')){res.statusCode=404;return res.end();}if(path==='/')for(const h of policy)res.setHeader(h.key,h.value);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});
await new Promise(resolve=>server.listen(4180,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const a=await browser.newContext(),b=await browser.newContext();
 const page=await a.newPage(),errors=[],remote=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4180/'))remote.push(r.url());});
 await page.goto('http://127.0.0.1:4180');await expect(page.getByRole('heading',{name:'ダッシュボード',exact:true})).toBeVisible();await expect(page.locator('.demo-banner')).toContainText('授業用デモ');await expect(page.locator('input[type=password]')).toHaveCount(0);
 await page.evaluate(()=>{localStorage.setItem('atelier-ledger-v1',JSON.stringify({products:[],records:[]}));localStorage.setItem('anffel-preorders-v1',JSON.stringify({orders:[{customerName:'非公開の個人情報'}],campaigns:[]}));});await page.reload();await expect(page.locator('.metrics .metric-value').first()).toHaveText('￥2,014,200');
 await page.getByRole('button',{name:'edit',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('タイトル',{exact:true}).fill('閲覧者Aのデモ操作');await dialog.getByLabel('日付',{exact:true}).fill('2026-10-18');await dialog.getByRole('button',{name:'登録する',exact:true}).click();await expect(dialog).toHaveCount(0);
 await page.getByRole('button',{name:'収入一覧',exact:true}).click();await expect(page.getByRole('button',{name:'閲覧者Aのデモ操作を編集',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'収入一覧',exact:true}).click();await expect(page.getByRole('button',{name:'閲覧者Aのデモ操作を編集',exact:true})).toBeVisible();
 const other=await b.newPage();await other.goto('http://127.0.0.1:4180');await other.getByRole('button',{name:'収入一覧',exact:true}).click();await expect(other.getByRole('button',{name:'閲覧者Aのデモ操作を編集',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'受注生産管理',exact:true}).click();await expect(page.getByText('受注データは保存済みです',{exact:true})).toBeVisible();await expect(page.getByText('非公開の個人情報')).toHaveCount(0);assert.equal(await page.locator('.preorder-card').count(),0);
 await page.getByRole('button',{name:'ダッシュボード',exact:true}).click();await page.screenshot({path:'/workspace/apparel-dashboard-update/dashboard.png',fullPage:true});await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/workspace/apparel-dashboard-update/dashboard-mobile.png',fullPage:true});assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);
 console.log('Public demo passed: built homepage, no login, CSP, local persistence, separate visitors, private-data isolation, no external requests, mobile.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
