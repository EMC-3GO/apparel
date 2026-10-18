import test from 'node:test';
import assert from 'node:assert/strict';
import {buildIncomeReport} from '../src/report.js';
const product={id:'p',name:'商品A',price:3000,mode:'stock',confirmed:true};
const records=[
 {id:'sale',date:'2026-10-01',title:'売上',type:'income',category:'商品売上',productId:'p',quantity:30,unitPrice:3000,discount:1000},
 {id:'refund',date:'2026-10-02',title:'返品',type:'refund',category:'返品・キャンセル',productId:'p',quantity:2,unitPrice:3000,discount:0},
 {id:'cost',date:'2026-10-03',title:'製造',type:'expense',category:'製造費',productId:'p',amount:30000},
 {id:'ad',date:'2026-10-04',title:'広告',type:'expense',category:'広告宣伝費',productId:'',amount:5000},
 {id:'shipping',date:'2026-10-05',title:'送料収入',type:'income',category:'受取送料',productId:'',amount:1000},
 {id:'old',date:'2026-09-30',title:'前月',type:'expense',category:'人件費',productId:'',amount:100000},
];
test('monthly report includes discounts, refunds, received shipping and shared costs without allocating them to a product',()=>{
 const report=buildIncomeReport({products:[product],records},{range:'month',month:'2026-10',now:new Date('2026-10-18T00:00:00Z')});
 assert.equal(report.records.length,5);
 assert.equal(report.totals.sales,83000);
 assert.equal(report.totals.income,84000);
 assert.equal(report.totals.spending,35000);
 assert.equal(report.totals.profit,49000);
 const row=report.rows.find(r=>r[0]==='商品A');
 assert.deepEqual(row.slice(2,5),[83000,30000,53000]);
 assert.equal(report.rows.find(r=>r[0]==='2026-10-02')[5],-6000);
});
test('unconfirmed order costs hide report profit while preserving the recorded difference',()=>{
 const report=buildIncomeReport({products:[{...product,mode:'order',confirmed:false}],records},{range:'month',month:'2026-10'});
 assert.equal(report.rows.find(r=>r[0]==='売上総利益')[2],'未確定');
 assert.equal(report.rows.find(r=>r[0]==='経費を引いた利益')[2],'未確定');
 assert.equal(report.rows.find(r=>r[0]==='収支差額')[2],49000);
});
test('empty month produces a valid zero report, not seed data; cumulative report includes previous periods',()=>{
 const data={products:[product],records};
 const empty=buildIncomeReport(data,{range:'month',month:'2026-08'});
 assert.equal(empty.records.length,0);assert.equal(empty.totals.profit,0);
 assert.ok(empty.rows.some(r=>r[0]==='対象期間の記録はありません。'));
 assert.equal(buildIncomeReport(data).totals.profit,-51000);
 assert.throws(()=>buildIncomeReport(data,{range:'month',month:'2026-13'}));
});
