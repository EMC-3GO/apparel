import {categories,normalizeRecordProduct,isSharedExpense} from './ledger.js';
function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
export function validateOperation(operation,state,{migrating=false}={}){
 if(!['products','records'].includes(operation.entity)||!['upsert','delete'].includes(operation.action))throw new Error('保存する内容を確認してください。');
 if(operation.action==='delete'){
  if(!state[operation.entity].some(item=>item.id===operation.id))throw new Error('この'+(operation.entity==='products'?'商品':'記録')+'は既に削除されています。再読み込みしてください。');
  if(operation.entity==='products'&&state.records.some(r=>r.productId===operation.id))throw new Error('この商品には収入・支出などの記録があります。先に関連する記録を削除するか、対象商品を変更してください。');
  return operation;
 }
 const item={...operation.item};
 if(typeof item.id!=='string'||!item.id||item.id.length>150)throw new Error('記録IDを確認してください。');
 if(operation.entity==='products'){
  if(typeof item.name!=='string'||!item.name.trim()||item.name.length>60||!Number.isSafeInteger(item.price)||item.price<1||item.price>99999999||!['stock','order'].includes(item.mode))throw new Error('商品名・価格・販売方法を確認してください。');
 }else{
  if(!categories[item.type]?.includes(item.category)||typeof item.title!=='string'||!item.title.trim()||item.title.length>100||!validDate(item.date))throw new Error('記録のタイトル・日付・項目を確認してください。');
  if(!migrating)Object.assign(item,normalizeRecordProduct(item));
  const product=state.products.find(p=>p.id===item.productId);
  const sale=item.category==='商品売上'||item.type==='refund';
  const productRequired=sale||(item.type==='expense'&&!isSharedExpense(item));
  if((productRequired&&!product)||(item.productId&&!product))throw new Error('対象商品を選択してください。');
  if(sale){
   const unitPrice=item.unitPrice??product.price;
   if(!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>999999||!Number.isSafeInteger(unitPrice)||unitPrice<1||!Number.isSafeInteger(item.discount)||item.discount<0||item.discount>unitPrice*item.quantity)throw new Error('販売数量・単価・値引き額を確認してください。');
   item.unitPrice=unitPrice;
  }else if(!Number.isSafeInteger(item.amount)||item.amount<1||item.amount>999999999)throw new Error('金額を確認してください。');
  if(typeof (item.memo??'')!=='string'||(item.memo||'').length>500)throw new Error('メモは500文字以内で入力してください。');
 }
 return {...operation,item};
}

