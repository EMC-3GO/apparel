import {validateOperation} from '../ledger-data.js';
import {initialData} from '../ledger.js';
export const LEGACY_STORAGE='atelier-ledger-v1';
export function legacyData(storage=globalThis.localStorage){
 const raw=storage.getItem(LEGACY_STORAGE);
 if(raw===null)return null;
 try{const data=JSON.parse(raw);if(Array.isArray(data?.products)&&Array.isArray(data?.records))return data;}catch{}
 throw new Error('このブラウザの保存データを読み込めませんでした。データを削除せず、内容を確認してください。');
}
export class LocalLedgerStore {
 constructor(storage=globalThis.localStorage){this.storage=storage;}
 async read(){return legacyData(this.storage)||initialData();}
 async save(operation){
  const data=await this.read();operation=validateOperation(operation,data);const key=operation.entity;
  if(operation.action==='delete')data[key]=data[key].filter(item=>item.id!==operation.id);
  else{const index=data[key].findIndex(item=>item.id===operation.item.id);if(index<0)data[key].push(operation.item);else data[key][index]=operation.item;}
  this.storage.setItem(LEGACY_STORAGE,JSON.stringify(data));
  return data;
 }
}
