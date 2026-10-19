export const preorderSteps=[
 {key:'inspected',label:'検品・タグ付け完了'},
 {key:'packed',label:'梱包完了'},
 {key:'shipped',label:'発送完了'},
];
export const preorderStatuses=[
 {key:'preparing',label:'準備中'},
 {key:'processing',label:'対応中'},
 {key:'shipped',label:'発送完了'},
];
export function completedPreorderSteps(order){return preorderSteps.filter(step=>order[step.key]===true).length;}
export function preorderStatus(order){const count=completedPreorderSteps(order);return count===0?'preparing':count===preorderSteps.length?'shipped':'processing';}

export const orderFields=[
 {key:'id',header:'ID',required:true,max:150},
 {key:'campaignId',header:'予約受付ID',max:150},
 {key:'customerName',header:'氏名',required:true,max:100},
 {key:'productName',header:'商品（色を含む）',required:true,max:150},
 {key:'quantity',header:'数量',type:'number',required:true},
 {key:'size',header:'サイズ',required:true,max:50},
 {key:'address',header:'住所',required:true,max:500},
 {key:'orderedOn',header:'注文日',type:'date',required:true},
 {key:'shipBy',header:'発送期限',type:'date',required:true},
 {key:'postalCode',header:'郵便番号',max:20},
 {key:'phone',header:'電話番号',max:40},
 {key:'email',header:'メール',max:254},
 {key:'trackingNumber',header:'追跡番号',max:100},
 {key:'memo',header:'メモ',max:1000},
 ...preorderSteps.map(step=>({...step,header:step.label,type:'boolean'})),
];
export const campaignFields=[
 {key:'id',header:'ID',required:true,max:150},
 {key:'name',header:'受付名',required:true,max:100},
 {key:'startsOn',header:'予約開始日',type:'date',required:true},
 {key:'endsOn',header:'予約締切日',type:'date',required:true},
 {key:'shipBy',header:'発送予定日',type:'date',required:true},
 {key:'memo',header:'メモ',max:1000},
];
export function japanToday(){return new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});}
export function validPreorderDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
export function campaignStatus(campaign,today=japanToday()){return today<campaign.startsOn?'受付前':today>campaign.endsOn?'受付終了':'受付中';}
export function validatePreorderOperation(operation,state){
 if(!operation||!['orders','campaigns'].includes(operation.entity)||!['upsert','delete'].includes(operation.action))throw new Error('保存する受注内容を確認してください。');
 const entity=operation.entity;
 if(operation.action==='delete'){
  if(!state[entity].some(item=>item.id===operation.id))throw new Error('このデータは既に削除されています。再読み込みしてください。');
  if(entity==='campaigns'&&state.orders.some(order=>order.campaignId===operation.id))throw new Error('注文が登録されている受付枠は削除できません。先に注文の受付枠を変更するか、不要な注文を削除してください。');
  return {entity,action:'delete',id:operation.id};
 }
 const source=operation.item||{},item={};
 for(const field of entity==='orders'?orderFields:campaignFields){
  const value=source[field.key];
  if(field.type==='boolean'){if(value!==undefined&&typeof value!=='boolean')throw new Error('作業チェックの内容を確認してください。');item[field.key]=value===true;continue;}
  if(field.type==='number'){if(!Number.isSafeInteger(value)||value<1||value>999999)throw new Error('数量は1〜999999の整数で入力してください。');item[field.key]=value;continue;}
  if(value!==undefined&&typeof value!=='string')throw new Error(field.header+'を確認してください。');
  item[field.key]=(value||'').trim();
  if(field.required&&!item[field.key])throw new Error(field.header+'を入力してください。');
  if(item[field.key].length>(field.max||10))throw new Error(field.header+'が長すぎます。');
  if(field.type==='date'&&!validPreorderDate(item[field.key]))throw new Error(field.header+'を正しい日付で入力してください。');
 }
 if(entity==='orders'){
  if(item.campaignId&&!state.campaigns.some(campaign=>campaign.id===item.campaignId))throw new Error('予約受付枠を選び直してください。');
  if(item.shipBy<item.orderedOn)throw new Error('発送期限は注文日以降にしてください。');
  if(item.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email))throw new Error('メールアドレスを確認してください。');
 }else{
  if(item.endsOn<item.startsOn)throw new Error('予約締切日は予約開始日以降にしてください。');
  if(item.shipBy<item.endsOn)throw new Error('発送予定日は予約締切日以降にしてください。');
 }
 return {entity,action:'upsert',item};
}
