import test from 'node:test';
import assert from 'node:assert/strict';
import {productTypes} from '../src/product-types.js';
import {server} from './helpers/apps-script-server.js';
test('product types cover apparel groups, retain saved keys and persist expanded categories',()=>{
 assert.ok(productTypes.length>=90);assert.equal(new Set(productTypes.map(t=>t.value)).size,productTypes.length);
 for(const key of ['tee','shirt','tote','hoodie','jeans','coat','dress','swimwear','sneakers','cap','other'])assert.ok(productTypes.some(t=>t.value===key));
 const s=server();s.call('initializeLedger',{data:{products:[],records:[]}});
 const p={id:'hoodie-test',name:'パーカー',price:5000,mode:'order',shape:'hoodie'};
 s.call('saveLedgerOperation',{entity:'products',action:'upsert',item:p,eventId:'new-type',expectedVersion:''});assert.equal(s.call('getLedger').data.products[0].shape,'hoodie');
});
