export const yen = n => new Intl.NumberFormat('ja-JP', {style:'currency', currency:'JPY', maximumFractionDigits:0}).format(n);
export const categories = {income:['商品売上','受取送料','その他収入'], expense:['製造費','サンプル代','タグ・資材','発送送料','販売手数料','人件費','広告宣伝費','その他経費'], refund:['返品・キャンセル']};
const productExpenseCategories = ['製造費','サンプル代'];
export const isSharedExpense = record => record.type === 'expense' && !productExpenseCategories.includes(record.category);
export const normalizeRecordProduct = record => isSharedExpense(record) ? {...record, productId:''} : record;
export function amountOf(r, products) {
 if (r.category === '商品売上' || r.type === 'refund') return Math.max(0, (r.unitPrice ?? products.find(p=>p.id===r.productId)?.price ?? 0) * Number(r.quantity || 0) - Number(r.discount || 0));
 return Number(r.amount || 0);
}
export function summarize(records, products) {
 const s={sales:0,income:0,cost:0,expense:0,refund:0};
 for(const r of records){ const a=amountOf(r,products); if(r.type==='income'){s.income+=a;if(r.category==='商品売上')s.sales+=a;} else if(r.type==='refund'){s.refund+=a;s.income-=a;s.sales-=a;}else if(['製造費','タグ・資材'].includes(r.category))s.cost+=a;else s.expense+=a; }
 return {...s, spending:s.cost+s.expense, gross:s.sales-s.cost, profit:s.income-s.cost-s.expense};
}
export function initialData(){
 const products=[{id:'p1',name:'Essential T-shirt',subtitle:'日常に寄り添う、定番の一着。',price:5800,mode:'stock',confirmed:true,color:'sand',shape:'tee'},{id:'p2',name:'Relaxed Shirt',subtitle:'軽やかに纏う、リラックスシャツ。',price:12800,mode:'order',confirmed:false,color:'sage',shape:'shirt'},{id:'p3',name:'Canvas Tote',subtitle:'毎日にちょうどいい、キャンバストート。',price:3200,mode:'stock',confirmed:true,color:'clay',shape:'tote'}];
 const records=[]; let seq=0;
 const add=(date,type,category,productId,amount,quantity,title)=>records.push({id:'seed'+seq++,date,type,category,productId,amount,quantity,discount:0,title,memo:''});
 for(let month=5;month<=10;month++){
  const m=String(month).padStart(2,'0');
  add(`2026-${m}-05`,'income','商品売上','p1',0,18+month*3,'オンラインストア 売上');
  add(`2026-${m}-08`,'income','商品売上','p3',0,8+month,'オンラインストア 売上');
  add(`2026-${m}-09`,'expense','製造費','p1',45000+month*5000,0,'Tシャツ 製造費');
  add(`2026-${m}-11`,'expense','発送送料','p1',6200+month*300,0,'商品発送送料');
  add(`2026-${m}-12`,'expense','広告宣伝費','',18000,0,'ブランド広告');
  add(`2026-${m}-14`,'expense','製造費','p3',13000,0,'トートバッグ 製造費');
 }
 add('2026-10-15','income','商品売上','p2',0,24,'秋の受注会 予約販売');
 add('2026-10-16','expense','サンプル代','p2',24000,0,'シャツ サンプル制作');
 add('2026-10-17','expense','タグ・資材','p1',8500,0,'ブランドタグ 追加発注');
 return {products,records:records.map(r=>({...r,unitPrice:products.find(p=>p.id===r.productId)?.price}))};
}
