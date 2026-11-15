import test from 'node:test';
import assert from 'node:assert/strict';
import {demoStorage,resetDemoData} from '../src/storage/demo.js';
import {LocalLedgerStore} from '../src/storage/local.js';
import {LocalPreorderStore} from '../src/storage/preorder.js';
test('classroom records and orders never reuse personal browser data',async()=>{
 const data=new Map([['atelier-ledger-v1',JSON.stringify({products:[],records:[]})],['anffel-preorders-v1',JSON.stringify({orders:[{customerName:'private'}],campaigns:[]})]]);
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const demo=demoStorage(storage),ledger=new LocalLedgerStore(demo),orders=new LocalPreorderStore(demo);
 assert.equal((await ledger.read()).products.length,3);assert.deepEqual(await orders.read(),{orders:[],campaigns:[]});
 const original=data.get('atelier-ledger-v1');await ledger.save({entity:'records',action:'upsert',item:{id:'demo',title:'demo',date:'2026-10-01',type:'expense',category:'その他経費',amount:100,productId:''}});
 assert.equal(data.get('atelier-ledger-v1'),original);assert.ok(data.has('anffel-classroom:atelier-ledger-v1'));assert.equal(JSON.parse(data.get('anffel-preorders-v1')).orders[0].customerName,'private');
});

test('reset clears only classroom data and remains empty after reload',async()=>{
 const data=new Map([['atelier-ledger-v1','private'],['anffel-preorders-v1','private orders'],['anffel-classroom:anffel-preorders-v1','demo orders'],['anffel-classroom:anffel-advice-costs-v1','costs']]);
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 resetDemoData(storage);
 const store=new LocalLedgerStore(demoStorage(storage),{seed:()=>({products:[],records:[]})});
 assert.deepEqual(await store.read(),{products:[],records:[]});assert.equal(data.get('atelier-ledger-v1'),'private');assert.equal(data.get('anffel-preorders-v1'),'private orders');assert.equal(data.has('anffel-classroom:anffel-preorders-v1'),false);assert.equal(data.has('anffel-classroom:anffel-advice-costs-v1'),false);
});
