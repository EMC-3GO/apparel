import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {server} from './helpers/apps-script-server.js';
import {preorderStatus,orderFields} from '../src/preorder.js';
const backend=server();backend.call('initializeLedger',{data:{products:[{id:'p',name:'既存商品',price:3000,mode:'order',confirmed:true},{id:'stock',name:'在庫販売の商品',price:2000,mode:'stock',confirmed:true},{id:'second',name:'別の受注生産商品',price:2500,mode:'order',confirmed:true}],records:[{id:'r',title:'既存の売上',date:'2026-10-01',type:'income',category:'商品売上',productId:'p',quantity:2,unitPrice:3000,discount:0}]}});
const original=backend.call('getLedger'),html=await readFile(new URL('../public/apps-script/ANFFEL.html',import.meta.url),'utf8');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('__appsScriptInvoke',(name,arg)=>backend.call(name,arg));
 await page.addInitScript(token=>{globalThis.ANFFEL_ACCESS_TOKEN=token;const runner=(success,fail)=>new Proxy({}, {get:(_,name)=>name==='withSuccessHandler'?callback=>runner(callback,fail):name==='withFailureHandler'?callback=>runner(success,callback):arg=>globalThis.__appsScriptInvoke(name,arg).then(success).catch(error=>fail({message:error.message}))});globalThis.google={script:{run:runner(()=>{},()=>{})}};},backend.token);
 await page.route('https://anffel-preorders.test/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
 await page.goto('https://anffel-preorders.test/');await page.getByRole('link',{name:'保存先のスプレッドシートを開く'}).waitFor();
 assert.equal(await page.locator('.metrics .metric-value').first().textContent(),'￥6,000');
 await page.getByRole('button',{name:'受注生産管理',exact:true}).click();await page.getByText('受注データは保存済みです',{exact:true}).waitFor();
 assert.equal(await page.locator('.filterbar').count(),0);assert.equal(await page.locator('.preorder-column').count(),3);
 assert.equal(await page.getByText('予約受付の管理',{exact:false}).count(),0);
 await page.getByRole('button',{name:'既存商品 注文0件 / 0点',exact:true}).click();
 await page.getByRole('button',{name:'注文を登録',exact:true}).click();
 let dialog=page.getByRole('dialog');
 assert.equal(await dialog.getByLabel('受注生産の商品',{exact:true}).inputValue(),'p');
 assert.equal(await dialog.getByLabel('受注生産の商品',{exact:true}).locator('option[value=stock]').count(),0);
 for(const field of ['氏名','商品（色を含む）','数量','サイズ','住所','注文日','発送期限'])assert.ok(await dialog.getByLabel(field,{exact:true}).evaluate(e=>e.required));
 await dialog.getByLabel('発送期限',{exact:true}).fill('2026-11-10');
 await dialog.getByLabel('氏名',{exact:true}).fill('テスト購入者');await dialog.getByLabel('商品（色を含む）',{exact:true}).fill('Tシャツ ブラック');await dialog.getByLabel('数量',{exact:true}).fill('2');await dialog.getByLabel('サイズ',{exact:true}).fill('M');await dialog.getByLabel('住所',{exact:true}).fill('テスト県テスト市1-1');await dialog.getByLabel('注文日',{exact:true}).fill('2026-10-19');
 await dialog.getByText('連絡先・追跡番号・メモ（任意）',{exact:true}).click();await dialog.getByLabel('追跡番号',{exact:true}).fill('TEST-123');
 backend.failCompletion('受注変更履歴');await dialog.getByRole('button',{name:'登録する',exact:true}).click();await dialog.getByRole('alert').waitFor();assert.equal(await dialog.getByLabel('住所',{exact:true}).inputValue(),'テスト県テスト市1-1');
 await dialog.getByRole('button',{name:'登録する',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(backend.call('getPreorders').data.orders.length,1);
 const column=key=>page.getByRole('region',{name:key,exact:true}),card=()=>page.getByRole('article',{name:'テスト購入者の注文',exact:true});
 await column('準備中').getByRole('article').waitFor();assert.equal(await page.getByText('テスト県テスト市1-1',{exact:true}).count(),0);
 for(const [label,status] of [['検品・タグ付け完了','対応中'],['梱包完了','対応中'],['発送完了','発送完了']]){await card().getByLabel(label,{exact:true}).click();await expect(card().getByLabel(label,{exact:true})).toBeChecked();await column(status).getByRole('article').waitFor();assert.equal(backend.ledger.getSheetByName('受注一覧').rows[1].at(-3),status);}
 for(const label of ['梱包完了','発送完了','検品・タグ付け完了']){await card().getByLabel(label,{exact:true}).click();await expect(card().getByLabel(label,{exact:true})).not.toBeChecked();await page.getByText('受注データは保存済みです',{exact:true}).waitFor();}await column('準備中').getByRole('article').waitFor();
 // Another tab edits the same order. A stale checkbox must never overwrite that change.
 const snapshot=backend.call('getPreorders'),order=snapshot.data.orders[0];backend.call('savePreorderOperation',{entity:'orders',action:'upsert',item:{...order,inspected:true},eventId:'another-tab',expectedVersion:snapshot.versions.orders[order.id]});
 await card().getByLabel('梱包完了',{exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(preorderStatus(backend.call('getPreorders').data.orders[0]),'processing');assert.equal(backend.call('getPreorders').data.orders[0].packed,false);
 await page.getByRole('button',{name:'再読み込み',exact:true}).click();await expect(card().getByLabel('検品・タグ付け完了',{exact:true})).toBeChecked();
 await page.getByRole('button',{name:'テスト購入者の注文を編集',exact:true}).click();dialog=page.getByRole('dialog');assert.equal(await dialog.getByLabel('住所',{exact:true}).inputValue(),'テスト県テスト市1-1');await dialog.getByLabel('サイズ',{exact:true}).fill('L');await dialog.getByRole('button',{name:'変更を保存',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.getByText('L / 2点',{exact:true}).waitFor();
 await page.getByRole('searchbox',{name:'受注を検索',exact:true}).fill('TEST-123');assert.equal(await page.locator('.preorder-card').count(),1);await page.getByRole('searchbox',{name:'受注を検索',exact:true}).fill('存在しない商品');assert.equal(await page.locator('.preorder-card').count(),0);await page.getByRole('searchbox',{name:'受注を検索',exact:true}).fill('');
 await page.getByLabel('商品で絞り込み',{exact:true}).selectOption('second');assert.equal(await page.locator('.preorder-card').count(),0);await page.getByLabel('商品で絞り込み',{exact:true}).selectOption('p');
 await page.screenshot({path:'/tmp/anffel-preorders-desktop.png',fullPage:true});
 await page.reload();await page.getByRole('link',{name:'保存先のスプレッドシートを開く'}).waitFor();await page.getByRole('button',{name:'受注生産管理',exact:true}).click();await card().waitFor();assert.equal(await card().getByLabel('検品・タグ付け完了',{exact:true}).isChecked(),true);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/anffel-preorders-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'テスト購入者の注文を編集',exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/anffel-preorder-editor-mobile.png',fullPage:true});
 await page.getByRole('dialog').getByRole('button',{name:'削除',exact:true}).click();await page.getByRole('button',{name:'削除する',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(backend.ledger.getSheetByName('受注一覧').getLastRow(),1);
 // Old orders with no product link remain visible and can be explicitly assigned.
 const legacy={...order,id:'legacy-order',productId:'',customerName:'以前のお客様'};
 const values=orderFields.filter(field=>field.key!=='productId').map(field=>legacy[field.key]);values.push('準備中','legacy-update');backend.ledger.getSheetByName('受注一覧').rows.push(values);
 await page.getByRole('button',{name:'再読み込み',exact:true}).click();
 await page.getByRole('button',{name:'商品未選択の注文 1件 · 編集から商品を選択できます',exact:true}).click();
 await page.getByRole('button',{name:'以前のお客様の注文を編集',exact:true}).click();
 assert.equal(await page.getByRole('dialog').getByLabel('受注生産の商品',{exact:true}).inputValue(),'');
 await page.getByRole('dialog').getByLabel('受注生産の商品',{exact:true}).selectOption('p');
 await page.getByRole('dialog').getByRole('button',{name:'変更を保存',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 assert.equal(backend.call('getPreorders').data.orders[0].productId,'p');assert.equal(backend.call('getPreorders').data.orders[0].address,'テスト県テスト市1-1');
 assert.deepEqual(backend.call('getLedger'),original);
 await page.getByRole('button',{name:'メニューを開く',exact:true}).click();await page.getByRole('button',{name:'ダッシュボード',exact:true}).click();assert.equal(await page.locator('.metrics .metric-value').first().textContent(),'￥6,000');
 assert.deepEqual(errors,[]);console.log('Preorder UI passed: required fields, registered-product selection/grouping, registration failure/retry, status transitions and undo, conflicts, edit/search/reload, mobile, row deletion and finance preservation');
}finally{await browser.close();}
