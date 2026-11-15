import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeLedger} from '../src/advice.js';
const product={id:'p',name:'Tシャツ',price:1000,mode:'stock',confirmed:true};
const expense=amount=>({id:'e',type:'expense',category:'製造費',productId:'p',amount});
test('break-even requires strictly positive profit and does not double-count recorded production costs',()=>{
 const a=analyzeLedger([expense(2000)],[product],{p:'0'});
 assert.equal(a.candidates[0].units,3);assert.equal(a.candidates[0].projected,1000);
 const b=analyzeLedger([expense(2000)],[product],{p:'200'});
 assert.equal(b.candidates[0].units,3);assert.equal(b.candidates[0].projected,400);
});
test('missing, invalid and non-positive contributions do not promise break-even',()=>{
 for(const value of [undefined,'',-1,'bad',Infinity,1000,1100])assert.equal(analyzeLedger([expense(100)],[product],{p:value}).candidates[0].units,null);
});
test('zero and positive balances, pending costs and refunds are represented correctly',()=>{
 assert.equal(analyzeLedger([],[product],{p:0}).candidates[0].units,1);
 const income={type:'income',category:'その他収入',amount:2000};
 assert.equal(analyzeLedger([income],[product],{p:0}).needed,0);
 const pending={...product,mode:'order',confirmed:false};
 assert.equal(analyzeLedger([expense(100)],[pending],{p:0}).recommended,null);
 const refund={type:'refund',category:'返品・キャンセル',quantity:3,unitPrice:1000,discount:0};
 assert.equal(analyzeLedger([income,refund],[product],{p:0}).candidates[0].units,2);
});
