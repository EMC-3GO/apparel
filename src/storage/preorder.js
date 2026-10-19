import {rpc} from './apps-script.js';
import {validatePreorderOperation} from '../preorder.js';
const STORAGE_KEY='anffel-preorders-v1';
export class LocalPreorderStore {
 constructor(storage=globalThis.localStorage){this.storage=storage;}
 async read(){
  const raw=this.storage.getItem(STORAGE_KEY);if(raw===null)return {orders:[],campaigns:[]};
  let data;try{data=JSON.parse(raw);}catch{throw new Error('受注の保存データを読み込めません。データを削除せずに確認してください。');}
  if(!Array.isArray(data?.orders)||!Array.isArray(data?.campaigns))throw new Error('受注の保存データを確認してください。');
  for(const entity of ['campaigns','orders']){const seen=new Set();for(const item of data[entity]){if(seen.has(item.id))throw new Error('受注の保存データに重複IDがあります。');seen.add(item.id);validatePreorderOperation({entity,action:'upsert',item},data);}}
  return data;
 }
 async save(operation){
  const data=await this.read(),op=validatePreorderOperation(operation,data);
  if(op.action==='delete')data[op.entity]=data[op.entity].filter(item=>item.id!==op.id);
  else{const index=data[op.entity].findIndex(item=>item.id===op.item.id);if(index<0)data[op.entity].push(op.item);else data[op.entity][index]=op.item;}
  this.storage.setItem(STORAGE_KEY,JSON.stringify(data));return data;
 }
}
export class AppsScriptPreorderStore {
 constructor({call=rpc,uuid=()=>crypto.randomUUID()}={}){this.call=call;this.uuid=uuid;this.versions={orders:{},campaigns:{}};this.pending=new Map();}
 accept(result){if(!Array.isArray(result?.data?.orders)||!Array.isArray(result?.data?.campaigns))throw new Error('受注データを確認できませんでした。');this.versions=result.versions;return result.data;}
 async read(){return this.accept(await this.call('getPreorders'));}
 async save(operation){
  const id=operation.item?.id||operation.id,key=operation.entity+':'+id,intent=JSON.stringify(operation);
  let pending=this.pending.get(key);
  if(!pending||pending.intent!==intent){pending={intent,eventId:this.uuid(),expectedVersion:this.versions[operation.entity]?.[id]||''};this.pending.set(key,pending);}
  const result=await this.call('savePreorderOperation',{...operation,eventId:pending.eventId,expectedVersion:pending.expectedVersion});
  const data=this.accept(result);this.pending.delete(key);return data;
 }
}
