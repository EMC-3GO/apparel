import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTrendPoints} from '../src/trend-data.js';
import {summarize} from '../src/ledger.js';
const expense=(date,amount)=>({date,type:'expense',category:'その他経費',amount,productId:''});
test('cumulative spending finishes at the exact 46,630 yen total across October and November',()=>{
 const records=[expense('2026-10-20',10400),expense('2026-11-13',36230)];
 const points=buildTrendPoints(records,[],{range:'all',month:'2026-11'});
 assert.deepEqual(points.map(point=>point.spending),[10400,46630]);
 assert.equal(points.at(-1).spending,summarize(records,[]).spending);
});
test('monthly running totals partition dates correctly and exclude other months',()=>{
 const records=[expense('2026-10-31',999),expense('2026-11-01',100),expense('2026-11-10',200),expense('2026-11-20',300),expense('2026-11-30',400)];
 const points=buildTrendPoints(records,[],{range:'month',month:'2026-11'});
 assert.deepEqual(points.map(point=>point.spending),[100,300,600,1000]);
 assert.equal(points.at(-1).spending,summarize(records.filter(record=>record.date.startsWith('2026-11')),[]).spending);
});
test('history before the visible 12 months is included, including across year boundaries',()=>{
 const records=[expense('2024-12-01',4000),expense('2026-01-01',500),expense('2026-11-13',700)];
 const points=buildTrendPoints(records,[],{range:'all',month:'2026-11'});
 assert.equal(points.length,12);assert.equal(points[0].spending,4000);assert.equal(points.at(-1).spending,5200);
});
test('refunds remain signed and zero periods have valid totals, including leap-year February',()=>{
 const products=[{id:'p',price:3000}],records=[{date:'2026-10-01',type:'income',category:'その他収入',amount:2000},{date:'2026-11-01',type:'refund',category:'返品・キャンセル',productId:'p',quantity:1,discount:0}];
 const points=buildTrendPoints(records,products,{range:'all',month:'2026-11'});assert.deepEqual(points.map(point=>point.income),[2000,-1000]);
 const empty=buildTrendPoints([],[],{range:'month',month:'2028-02'});assert.equal(empty.at(-1).label,'29日');assert.ok(empty.every(point=>point.spending===0&&point.income===0));
});
