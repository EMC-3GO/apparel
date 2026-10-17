import test from 'node:test';
import assert from 'node:assert/strict';
import {amountOf,summarize,initialData} from '../src/ledger.js';
const products=[{id:'p',price:3000}];
test('quantity and discount calculate sales; historical unit price survives price changes',()=>{
 assert.equal(amountOf({type:'income',category:'商品売上',productId:'p',quantity:30,discount:0},products),90000);
 assert.equal(amountOf({type:'income',category:'商品売上',productId:'p',quantity:30,discount:1000,unitPrice:2500},products),74000);
});
test('refunds, cost, operating expenses and received shipping aggregate separately',()=>{
 const records=[{type:'income',category:'商品売上',productId:'p',quantity:30},{type:'refund',category:'返品・キャンセル',productId:'p',quantity:2},{type:'expense',category:'製造費',amount:30000},{type:'expense',category:'発送送料',amount:5000},{type:'income',category:'受取送料',amount:1500}];
 assert.deepEqual(summarize(records,products),{sales:84000,income:85500,cost:30000,expense:5000,refund:6000,spending:35000,gross:54000,profit:50500});
});
test('month and product filtering include only targeted records',()=>{
 const d=initialData();const monthly=d.records.filter(r=>r.date.startsWith('2026-10'));const p=monthly.filter(r=>r.productId==='p2');
 assert.equal(summarize(p,d.products).sales,307200);assert.equal(summarize(p,d.products).spending,24000);
 assert.ok(summarize(monthly,d.products).sales<summarize(d.records,d.products).sales);
 assert.equal(summarize([],products).profit,0);
});
