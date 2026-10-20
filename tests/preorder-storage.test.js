import test from 'node:test';
import assert from 'node:assert/strict';
import {server} from './helpers/apps-script-server.js';
import {AppsScriptPreorderStore,LocalPreorderStore} from '../src/storage/preorder.js';
import {preorderStatus,validatePreorderOperation,campaignStatus} from '../src/preorder.js';
const campaign={id:'c',name:'第1回 Tシャツ予約',startsOn:'2026-10-01',endsOn:'2026-10-31',shipBy:'2026-11-10',memo:''};
const order={id:'o',productId:'p',campaignId:'c',customerName:'テスト購入者',productName:'Tシャツ ブラック',quantity:2,size:'M',address:'テスト県テスト市1-1',orderedOn:'2026-10-19',shipBy:'2026-11-10',postalCode:'',phone:'',email:'',trackingNumber:'',memo:'',inspected:false,packed:false,shipped:false};
const setup=()=>{const s=server();s.call('initializeLedger',{data:{products:[{id:'p',name:'既存商品',price:3000,mode:'order',confirmed:true}],records:[{id:'r',type:'income',category:'商品売上',title:'既存売上',date:'2026-10-01',productId:'p',quantity:2,unitPrice:3000,discount:0}]}});return s;};
let sequence=0;
const storeFor=s=>new AppsScriptPreorderStore({call:async(name,arg)=>s.call(name,arg),uuid:()=>`preorder-${++sequence}`});
const upsert=(entity,item)=>({entity,action:'upsert',item});
async function seed(s){const store=storeFor(s);await store.read();await store.save(upsert('campaigns',campaign));await store.save(upsert('orders',order));return store;}

test('required fields, dates and booleans are validated; retired campaign metadata is preserved',()=>{
 const state={orders:[],campaigns:[campaign],products:[{id:'p',mode:'order'}]};
 for(const key of ['customerName','productName','size','address','orderedOn','shipBy'])assert.throws(()=>validatePreorderOperation(upsert('orders',{...order,[key]:''}),state));
 for(const quantity of [0,1.5,-1,1000000])assert.throws(()=>validatePreorderOperation(upsert('orders',{...order,quantity}),state),/数量/);
 assert.throws(()=>validatePreorderOperation(upsert('orders',{...order,orderedOn:'2026-02-30'}),state),/日付/);
 assert.throws(()=>validatePreorderOperation(upsert('orders',{...order,shipBy:'2026-10-01'}),state),/注文日以降/);
 assert.throws(()=>validatePreorderOperation(upsert('orders',{...order,inspected:'true'}),state),/チェック/);
 assert.equal(validatePreorderOperation(upsert('orders',{...order,campaignId:'archived-reference'}),state).item.campaignId,'archived-reference');
 assert.throws(()=>validatePreorderOperation(upsert('campaigns',{...campaign,endsOn:'2026-09-01'}),state),/開始日以降/);
 assert.equal(campaignStatus(campaign,'2026-09-30'),'受付前');assert.equal(campaignStatus(campaign,'2026-10-01'),'受付中');assert.equal(campaignStatus(campaign,'2026-10-31'),'受付中');assert.equal(campaignStatus(campaign,'2026-11-01'),'受付終了');
 assert.equal(validatePreorderOperation(upsert('orders',{...order,campaignId:''}),state).item.campaignId,'');
});
test('new sheets persist orders and status without changing any original finance row or report totals',async()=>{
 const s=setup(),before=s.call('getLedger'),rows=['商品','収支記録','変更履歴'].map(name=>JSON.stringify(s.ledger.getSheetByName(name).rows));
 const store=await seed(s);let saved={...order};
 for(const key of ['inspected','packed','shipped']){saved={...saved,[key]:true};await store.save(upsert('orders',saved));}
 assert.equal(preorderStatus((await storeFor(s).read()).orders[0]),'shipped');
 const sheet=s.ledger.getSheetByName('受注一覧');assert.equal(sheet.rows[1].at(-3),'発送完了');
 await store.save(upsert('orders',{...saved,packed:false}));assert.equal(sheet.rows[1].at(-3),'対応中');
 assert.deepEqual(s.call('getLedger'),before);assert.deepEqual(['商品','収支記録','変更履歴'].map(name=>JSON.stringify(s.ledger.getSheetByName(name).rows)),rows);
 const report=s.call('createIncomeReport',{range:'all'});assert.equal(s.books.get(report.id).getSheets()[0].rows.find(r=>r[0]==='売上（値引き・返品反映後）')[2],6000);
 // Product names in orders remain a snapshot, independent of finance product edits.
 const ledger=s.call('getLedger');s.call('saveLedgerOperation',{entity:'products',action:'upsert',item:{...ledger.data.products[0],name:'変更後の商品'},eventId:'rename',expectedVersion:ledger.versions.products.p});
 assert.equal((await store.read()).orders[0].productName,order.productName);
});
test('order save and delete acknowledgement loss retries once by ID, and campaign deletion cannot orphan orders',async()=>{
 const s=setup(),store=await seed(s);s.failCompletion('受注変更履歴');
 const operation=upsert('orders',{...order,packed:true});await assert.rejects(()=>store.save(operation),/simulated/);await store.save(operation);
 assert.equal((await store.read()).orders.length,1);assert.equal(s.ledger.getSheetByName('受注変更履歴').getLastRow(),4);
 await assert.rejects(()=>store.save({entity:'campaigns',action:'delete',id:'c'}),/注文が登録/);
 s.failCompletion('受注変更履歴');await assert.rejects(()=>store.save({entity:'orders',action:'delete',id:'o'}),/simulated/);await store.save({entity:'orders',action:'delete',id:'o'});
 assert.equal(s.ledger.getSheetByName('受注一覧').getLastRow(),1);
 await store.save({entity:'campaigns',action:'delete',id:'c'});assert.equal(s.ledger.getSheetByName('予約受付').getLastRow(),1);
});
test('stale order edits and late checks do not overwrite another tab or direct sheet changes',async()=>{
 const s=setup(),a=await seed(s),b=storeFor(s);await b.read();await a.save(upsert('orders',{...order,inspected:true}));
 await assert.rejects(()=>b.save(upsert('orders',{...order,packed:true})),/別の画面/);
 await b.read();await b.save(upsert('orders',{...order,inspected:true,packed:true}));
 await a.read();s.ledger.getSheetByName('受注一覧').rows[1][2]='直接編集した氏名';
 await assert.rejects(()=>a.save(upsert('orders',{...order,shipped:true})),/別の画面/);
 assert.equal((await a.read()).orders[0].customerName,'直接編集した氏名');
});
test('owner checks, literal text writes and corrupted data protections also cover customer information',async()=>{
 const s=setup(),store=await seed(s);s.setUser('other@example.test');assert.throws(()=>s.call('getPreorders'),/本人/);assert.throws(()=>s.call('savePreorderOperation',{}),/本人/);s.setUser('owner@example.test');
 await store.save(upsert('orders',{...order,customerName:'=IMPORTDATA("https://example.test")'}));assert.ok(s.rawWrites.flat(2).includes("'=IMPORTDATA(\"https://example.test\")"));
 s.ledger.getSheetByName('受注一覧').rows[1][4]='bad quantity';await assert.rejects(()=>store.read(),/数量/);
});
test('local preorder storage is independent from legacy finance storage and preserves full data after reload',async()=>{
 const finance=JSON.stringify({products:[{id:'p',mode:'order'}],records:[]}),values=new Map([['atelier-ledger-v1',finance]]),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const store=new LocalPreorderStore(storage);await store.save(upsert('campaigns',campaign));await store.save(upsert('orders',order));
 assert.deepEqual((await new LocalPreorderStore(storage).read()).orders,[order]);assert.equal(values.get('atelier-ledger-v1'),finance);
 await assert.rejects(()=>store.save({entity:'campaigns',action:'delete',id:'c'}),/注文が登録/);
 await store.save({entity:'orders',action:'delete',id:'o'});await store.save({entity:'campaigns',action:'delete',id:'c'});assert.deepEqual(await store.read(),{orders:[],campaigns:[]});
});

test('campaign schedule edits do not silently reschedule existing orders',async()=>{
 const s=setup(),store=await seed(s);await store.save(upsert('campaigns',{...campaign,shipBy:'2026-11-20'}));
 assert.equal((await store.read()).orders[0].shipBy,'2026-11-10');
 assert.equal((await store.read()).campaigns[0].shipBy,'2026-11-20');
});

test('new orders require a registered made-to-order product; existing order snapshots remain usable after product removal',async()=>{
 const s=setup(),store=storeFor(s);await store.read();
 for(const productId of ['', 'missing'])await assert.rejects(()=>store.save(upsert('orders',{...order,campaignId:'',productId})),/受注生産の商品/);
 const ledger=s.call('getLedger');s.call('saveLedgerOperation',{entity:'products',action:'upsert',item:{...ledger.data.products[0],mode:'stock'},eventId:'stock-mode',expectedVersion:ledger.versions.products.p});
 await assert.rejects(()=>store.save(upsert('orders',{...order,campaignId:''})),/受注生産の商品/);
 const current=s.call('getLedger');s.call('saveLedgerOperation',{entity:'products',action:'upsert',item:{...current.data.products[0],mode:'order'},eventId:'order-mode',expectedVersion:current.versions.products.p});
 await store.save(upsert('orders',{...order,campaignId:''}));
 const again=s.call('getLedger');s.call('saveLedgerOperation',{entity:'products',action:'upsert',item:{...again.data.products[0],mode:'stock'},eventId:'change-again',expectedVersion:again.versions.products.p});
 await store.save(upsert('orders',{...order,campaignId:'',inspected:true}));assert.equal((await store.read()).orders[0].productId,'p');
});

test('old sheet layout upgrades by appending a product column without changing existing order data or campaign history',async()=>{
 const s=setup(),store=await seed(s),sheet=s.ledger.getSheetByName('受注一覧');
 sheet.rows.forEach(row=>row.pop()); // Previous release had no final 対象商品ID column.
 const oldRows=JSON.parse(JSON.stringify(sheet.rows)),oldCampaign=JSON.stringify(s.ledger.getSheetByName('予約受付').rows),oldLog=JSON.stringify(s.ledger.getSheetByName('受注変更履歴').rows);
 const result=await store.read();assert.equal(result.orders[0].productId,'');assert.equal(result.orders[0].customerName,order.customerName);
 assert.deepEqual(sheet.rows[0].slice(0,-1),oldRows[0]);assert.deepEqual(sheet.rows[1],oldRows[1]);assert.equal(sheet.rows[0].at(-1),'対象商品ID');
 assert.equal(JSON.stringify(s.ledger.getSheetByName('予約受付').rows),oldCampaign);assert.equal(JSON.stringify(s.ledger.getSheetByName('受注変更履歴').rows),oldLog);
 await store.save(upsert('orders',{...result.orders[0],inspected:true}));assert.equal((await store.read()).orders[0].productId,'');
 await store.save(upsert('orders',{...(await store.read()).orders[0],productId:'p'}));assert.equal((await store.read()).orders[0].productId,'p');assert.equal(sheet.rows[1].at(-1),'p');
});
