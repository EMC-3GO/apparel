import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalLedgerStore,LEGACY_STORAGE} from '../src/storage/local.js';
test('local product and record deletion use the same reference checks and persist after reload',async()=>{
 const product={id:'p',name:'Tシャツ',price:3000,mode:'stock'},record={id:'r',date:'2026-10-18',title:'売上',type:'income',category:'商品売上',productId:'p',quantity:1,discount:0};
 const values=new Map([[LEGACY_STORAGE,JSON.stringify({products:[product],records:[record]})]]),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const store=new LocalLedgerStore(storage);
 await assert.rejects(()=>store.save({entity:'products',action:'delete',id:'p'}),/関連する記録/);
 await store.save({entity:'records',action:'delete',id:'r'});await store.save({entity:'products',action:'delete',id:'p'});
 assert.deepEqual(await new LocalLedgerStore(storage).read(),{products:[],records:[]});
});
