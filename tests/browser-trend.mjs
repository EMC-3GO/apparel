import {chromium} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {server} from './helpers/apps-script-server.js';
import {yen} from '../src/ledger.js';
const backend=server();backend.call('initializeLedger',{data:{products:[{id:'p',name:'グラフ用商品',price:3000,mode:'stock',confirmed:true}],records:[
 {id:'e1',title:'8月の経費',date:'2026-08-05',type:'expense',category:'広告宣伝費',amount:8000,productId:''},
 {id:'i',title:'9月の収入',date:'2026-09-01',type:'income',category:'その他収入',amount:2000,productId:''},
 {id:'e2',title:'9月の経費',date:'2026-09-05',type:'expense',category:'広告宣伝費',amount:1000,productId:''},
 {id:'refund',title:'10月の返品',date:'2026-10-06',type:'refund',category:'返品・キャンセル',productId:'p',unitPrice:3000,quantity:1,discount:0},
]}});
const html=await readFile(new URL('../public/apps-script/ANFFEL.html',import.meta.url),'utf8'),browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('__invoke',(name,arg)=>backend.call(name,arg));
 await page.addInitScript(token=>{globalThis.ANFFEL_ACCESS_TOKEN=token;const runner=(success,fail)=>new Proxy({},{get:(_,name)=>name==='withSuccessHandler'?cb=>runner(cb,fail):name==='withFailureHandler'?cb=>runner(success,cb):arg=>globalThis.__invoke(name,arg).then(success).catch(e=>fail({message:e.message}))});globalThis.google={script:{run:runner(()=>{},()=>{})}};},backend.token);
 await page.route('https://trend.test/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));await page.goto('https://trend.test/');await page.getByRole('link',{name:'保存先のスプレッドシートを開く'}).waitFor();
 const chart=page.locator('.trend'),zero=()=>chart.locator('.chart-zero-line').getAttribute('y1');
 assert.equal(await chart.locator('path[data-series]').count(),2);
 assert.equal(await chart.locator('.chart-end-value[data-series=spending]').textContent(),'支出 '+await page.locator('.metrics .metric-value').nth(1).textContent());
 assert.equal(await chart.locator('.chart-end-value[data-series=income]').textContent(),'収入 '+yen(-1000));
 assert.equal(await chart.locator('[data-series=profit]').count(),0);assert.equal(await chart.getByText('収支差額',{exact:false}).count(),0);
 assert.ok(Number(await chart.locator('circle[data-series=income]').nth(2).getAttribute('cy'))>Number(await zero()));
 assert.ok(Number(await chart.locator('circle[data-series=income]').nth(1).getAttribute('cy'))<Number(await zero()));
 // Registering a new expense must update the card and final point in the same render.
 await page.getByRole('button',{name:'edit',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'支出',exact:true}).click();
 await dialog.getByLabel('項目',{exact:true}).selectOption('その他経費');await dialog.getByLabel('タイトル',{exact:true}).fill('グラフ一致の検証');await dialog.getByLabel('日付',{exact:true}).fill('2026-10-20');await dialog.getByLabel('金額（円）',{exact:true}).fill('16630');
 await dialog.getByRole('button',{name:'登録する',exact:true}).click();await dialog.waitFor({state:'hidden'});
 assert.equal(await page.locator('.metrics .metric-value').nth(1).textContent(),yen(25630));
 assert.equal(await chart.locator('.chart-end-value[data-series=spending]').textContent(),'支出 '+yen(25630));
 const added=backend.call('getLedger'),id=added.data.records.find(record=>record.title==='グラフ一致の検証').id;
 backend.call('saveLedgerOperation',{entity:'records',action:'delete',id,eventId:'restore-chart-fixture',expectedVersion:added.versions.records[id]});
 await page.reload();await page.getByRole('link',{name:'保存先のスプレッドシートを開く'}).waitFor();
 await chart.getByRole('button',{name:/^8月 収入/}).focus();await chart.locator('.chart-tooltip').getByText('支出 '+yen(8000),{exact:true}).waitFor();
 await page.screenshot({path:'/tmp/anffel-negative-trend.png',fullPage:true});
 await page.getByRole('button',{name:'月別',exact:true}).click();await page.getByLabel('集計月',{exact:true}).fill('2026-08');
 assert.equal(Number(await chart.locator('circle[data-series=income]').first().getAttribute('cy')),Number(await zero()));
 assert.equal(await chart.locator('.chart-end-value[data-series=spending]').textContent(),'支出 '+await page.locator('.metrics .metric-value').nth(1).textContent());
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/tmp/anffel-negative-trend-mobile.png',fullPage:true});
 await page.getByLabel('集計月',{exact:true}).fill('2027-01');const labels=await chart.locator('.chart-axis-label').allTextContents();assert.equal(new Set(labels).size,labels.length);assert.ok(labels.includes('0円'));assert.ok(labels.some(text=>text.startsWith('−')));assert.equal(await chart.locator('path[d*="NaN"]').count(),0);
 for(const id of ['e1','i','e2']){const state=backend.call('getLedger');backend.call('saveLedgerOperation',{entity:'records',action:'delete',id,eventId:'single-month-'+id,expectedVersion:state.versions.records[id]});}
 await page.reload();await page.getByRole('link',{name:'保存先のスプレッドシートを開く'}).waitFor();
 assert.equal(await chart.locator('circle[data-series=income]').count(),1);
 assert.equal(await chart.locator('circle[data-series=income]').getAttribute('cx'),await chart.locator('.chart-zero-line').getAttribute('x1'));
 assert.ok(Number(await chart.locator('circle[data-series=income]').getAttribute('cy'))>Number(await zero()));
 await chart.getByRole('button',{name:/^10月 収入/}).focus();await chart.locator('.chart-tooltip').getByText('収入 '+yen(-3000),{exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('Trend browser passed: income/spending only, negative refund income, signed tooltip, empty ticks, mobile layout and a single month starting at the left edge and final totals matching the cards');
}finally{await browser.close();}
