import {amountOf, summarize, categories} from './ledger.js';

export function buildIncomeReport(data, {range='all', month='', now=new Date(), generatedAt:suppliedGeneratedAt}={}) {
 if (!['all','month'].includes(range) || (range==='month'&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))) throw new Error('集計期間を確認してください。');
 const records=data.records.filter(r=>range==='all'||r.date.startsWith(month)).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 const totals=summarize(records,data.products);
 const pending=data.products.filter(p=>p.mode==='order'&&!p.confirmed&&records.some(r=>r.productId===p.id));
 const period=range==='month'?`${month.slice(0,4)}年${Number(month.slice(5))}月`:'累計';
 const generatedAt=suppliedGeneratedAt||new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',dateStyle:'medium',timeStyle:'short'}).format(now);
 const rows=[], merges=[], headings=[], currencyRanges=[];
 const add=(...values)=>{rows.push(values);return rows.length-1;};
 const wide=text=>{const i=add(text);merges.push(i);return i;};
 const heading=text=>{const i=wide(text);headings.push(i);};
 const money=(r,start,end)=>currencyRanges.push({startRowIndex:r,endRowIndex:r+1,startColumnIndex:start,endColumnIndex:end});
 wide('ANFFEL 収支報告書');
 wide(`集計期間：${period}${records.length?`（${records[0].date} ～ ${records[records.length-1].date}）`:''}`);
 wide(`作成日時：${generatedAt}（日本時間）`);
 heading('ブランド全体の収支');
 for(const [label,value] of [
  ['売上（値引き・返品反映後）',totals.sales],['その他収入',totals.income-totals.sales],['収入合計',totals.income],
  ['製造原価',totals.cost],['その他経費',totals.expense],['支出合計',totals.spending],['収支差額',totals.profit],
  ['売上総利益',pending.length?'未確定':totals.gross],['経費を引いた利益',pending.length?'未確定':totals.profit]
 ]) {const i=add(label,'',value);money(i,2,3);}
 if(pending.length)wide(`費用未確定の商品：${pending.map(p=>p.name).join('、')}。利益は費用確定後に表示します。`);
 wide('集計基準：記録日付・円。共通費用は商品別に配賦しません。収支差額は登録済み収入−支出です。');
 add();heading('商品別の収支');
 add('商品','販売方法','売上','支出','利益','費用状態');
 for(const p of data.products){
  const rs=records.filter(r=>r.productId===p.id),s=summarize(rs,data.products),unconfirmed=p.mode==='order'&&!p.confirmed;
  const i=add(p.name,p.mode==='order'?'受注生産':'在庫販売',s.sales,s.spending,unconfirmed?'未確定':s.profit,unconfirmed?'未確定':'確定');money(i,2,5);
 }
 if(!data.products.length)wide('登録された商品はありません。');
 add();heading('支出項目の内訳');add('項目','','支出額');
 for(const category of categories.expense){const total=records.filter(r=>r.type==='expense'&&r.category===category).reduce((sum,r)=>sum+amountOf(r,data.products),0);const i=add(category,'',total);money(i,2,3);}
 add();heading('収入・支出の明細');add('日付','内容','対象商品','項目','区分','金額');
 for(const r of records){const product=data.products.find(p=>p.id===r.productId);const i=add(r.date,r.title,product?.name||(r.type==='expense'?'共通の支出':'共通'),r.category,r.type==='income'?'収入':r.type==='refund'?'返品':'支出',(r.type==='income'?1:-1)*amountOf(r,data.products));money(i,5,6);}
 if(!records.length)wide('対象期間の記録はありません。');
 return {period,generatedAt,totals,pending:pending.map(p=>p.id),records,rows,merges,headings,currencyRanges,title:`ANFFEL 収支報告書 ${period}`,fileName:`ANFFEL_収支報告書_${range==='month'?month:'累計'}.pdf`};
}

