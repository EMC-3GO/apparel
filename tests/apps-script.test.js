import test from 'node:test';
import assert from 'node:assert/strict';
import {server} from './helpers/apps-script-server.js';
import {AppsScriptLedgerStore,parseTransferFile,transferContents} from '../src/storage/apps-script.js';


const product={id:'p',name:'Tシャツ',price:3000,mode:'stock',confirmed:true,shape:'tee'};
const record={id:'r',date:'2026-10-18',title:'売上',type:'income',category:'商品売上',productId:'p',quantity:2,unitPrice:3000,discount:0,amount:0,memo:''};
const initialize=s=>s.call('initializeLedger',{data:{products:[product],records:[]}});
const op=(entity,item,eventId,expectedVersion='')=>({entity,action:'upsert',item,eventId,expectedVersion});

test('owner-only access and lock protect every ledger operation',()=>{
 const s=server();s.setUser('other@example.test');assert.throws(()=>s.call('getLedger'),/本人/);
 s.setUser('owner@example.test');s.block();assert.throws(()=>s.call('getLedger'),/保存処理/);assert.equal(s.isLocked(),false);
});
test('spreadsheet writes persist across client instances; deletion and shared classification apply on server',async()=>{
 const s=server();initialize(s);
 let counter=0;const call=async(name,arg)=>s.call(name,arg),uuid=()=> 'event-'+(++counter),a=new AppsScriptLedgerStore({call,uuid});
 await a.connect();await a.save({entity:'records',action:'upsert',item:record});
 const b=new AppsScriptLedgerStore({call,uuid});assert.equal((await b.connect()).data.records.length,1);
 await b.save({entity:'records',action:'upsert',item:{...record,type:'expense',category:'人件費',amount:1000}});
 assert.equal((await a.read()).records[0].productId,'');
 await a.save({entity:'records',action:'delete',id:'r'});assert.equal((await b.read()).records.length,0);
});
test('lost acknowledgement is recovered and retried without a duplicate record or operation',()=>{
 const s=server();initialize(s);const request=op('records',record,'once');s.failCompletion();
 assert.throws(()=>s.call('saveLedgerOperation',request),/simulated/);
 assert.equal(s.isLocked(),false);
 const result=s.call('saveLedgerOperation',request);assert.equal(result.data.records.length,1);
 assert.equal(s.ledger.getSheetByName('変更履歴').getLastRow(),2);
 assert.equal(s.ledger.getSheetByName('変更履歴').rows[1][2],'保存済み');
});
test('stale edits are rejected, while changes to unrelated records do not overwrite each other',()=>{
 const s=server();const start=initialize(s);
 s.call('saveLedgerOperation',op('products',{...product,price:4000},'price',start.versions.products.p));
 assert.throws(()=>s.call('saveLedgerOperation',op('products',{...product,price:5000},'stale',start.versions.products.p)),/別の画面/);
 s.call('saveLedgerOperation',op('records',record,'a'));
 const result=s.call('saveLedgerOperation',op('records',{...record,id:'r2'},'b'));
 assert.equal(result.data.records.length,2);assert.equal(result.data.products[0].price,4000);
});
test('migration preserves IDs and historical prices, never seeds demo records, and cannot overwrite initialized data',()=>{
 const s=server();assert.deepEqual(s.call('getLedger').data,{products:[],records:[]});
 const initial=s.call('initializeLedger',{data:{products:[{...product,price:5000}],records:[record]}});
 assert.equal(initial.data.records[0].unitPrice,3000);
 const second=s.call('initializeLedger',{data:null});assert.equal(second.data.records.length,1);
});
test('formula-like content is escaped before writing and restored as literal data',()=>{
 const s=server();initialize(s);const title='=IMPORTDATA("https://example.com")';
 const state=s.call('saveLedgerOperation',op('records',{...record,title},'literal'));
 assert.equal(state.data.records[0].title,title);
 assert.ok(s.rawWrites.flat(2).includes("'"+title));
});
test('reports use stored data; unchanged requests reuse their report; PDF access is limited to created reports',()=>{
 const s=server();initialize(s);s.call('saveLedgerOperation',op('records',record,'report-data'));
 const report=s.call('createIncomeReport',{range:'month',month:'2026-10'});
 assert.equal(s.call('createIncomeReport',{range:'month',month:'2026-10'}).id,report.id);
 const rows=s.books.get(report.id).getSheets()[0].rows;
 assert.equal(rows.find(r=>r[0]==='売上（値引き・返品反映後）')[2],6000);
 assert.ok(Buffer.from(s.call('downloadIncomeReport',{id:report.id}).base64,'base64').toString().startsWith('%PDF-'));
 assert.throws(()=>s.call('downloadIncomeReport',{id:'ledger'}),/報告書/);
});
test('transfer format keeps the source data intact and rejects unrelated JSON',()=>{
 const data={products:[product],records:[record]},before=JSON.stringify(data);
 assert.deepEqual(parseTransferFile(transferContents(data)),data);
 assert.equal(JSON.stringify(data),before);assert.throws(()=>parseTransferFile('{}'),/引き継ぎ/);
});

test('manual spreadsheet edits invalidate stale versions and corrupted rows stop reads',()=>{
 const s=server();const initial=initialize(s);s.ledger.getSheetByName('商品').rows[1][2]=4500;
 assert.throws(()=>s.call('saveLedgerOperation',op('products',{...product,price:5000},'stale-manual',initial.versions.products.p)),/別の画面/);
 s.ledger.getSheetByName('商品').rows[1][2]='壊れた価格';
 assert.throws(()=>s.call('getLedger'),/価格/);
});
