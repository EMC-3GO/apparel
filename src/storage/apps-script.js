export async function rpc(name,arg){
 for(let i=0;i<100&&!globalThis.google?.script?.run;i++)await new Promise(resolve=>setTimeout(resolve,100));
 return new Promise((resolve,reject)=>{
  const bridge=globalThis.google?.script?.run;
  if(!bridge){reject(new Error('Googleの専用URLからANFFELを開いてください。'));return;}
  bridge.withSuccessHandler(resolve).withFailureHandler(error=>reject(new Error(error?.message||'Googleへの保存に失敗しました。もう一度お試しください。'))).anffelRpc({name,arg,token:globalThis.ANFFEL_ACCESS_TOKEN||''});
 });
}
export class AppsScriptLedgerStore {
 constructor({call=rpc,uuid=()=>crypto.randomUUID()}={}){this.call=call;this.uuid=uuid;this.snapshot={products:[],records:[]};this.versions={products:{},records:{}};this.pending=new Map();this.url=null;this.lastReport=null;}
 accept(result){
  if(!result||!Array.isArray(result.data?.products)||!Array.isArray(result.data?.records))throw new Error('Googleから取得したデータを確認できませんでした。');
  this.snapshot=result.data;this.versions=result.versions||{products:{},records:{}};this.url=result.spreadsheetUrl;return result.data;
 }
 async connect(){const result=await this.call('getLedger');return {data:this.accept(result),needsInitialization:!result.initialized};}
 async read(){return this.accept(await this.call('getLedger'));}
 async initialize(data){return this.accept(await this.call('initializeLedger',{data}));}
 async save(operation){
  const id=operation.item?.id||operation.id,key=`${operation.entity}:${id}`,intent=JSON.stringify(operation);
  let pending=this.pending.get(key);
  if(!pending||pending.intent!==intent){pending={intent,eventId:this.uuid(),expectedVersion:this.versions[operation.entity]?.[id]||''};this.pending.set(key,pending);}
  const result=await this.call('saveLedgerOperation',{...operation,eventId:pending.eventId,expectedVersion:pending.expectedVersion});
  const data=this.accept(result);this.pending.delete(key);return data;
 }
 async createReport(options){const result=await this.call('createIncomeReport',options);this.lastReport=result;return result;}
 async downloadReport(report){
  const result=await this.call('downloadIncomeReport',{id:report.id});
  const bytes=Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0));
  const blob=new Blob([bytes],{type:'application/pdf'});
  if(!(await blob.slice(0,5).text()).startsWith('%PDF-'))throw new Error('PDFを確認できませんでした。報告書のシートは保存されています。再取得をお試しください。');
  return blob;
 }
}
export function parseTransferFile(text){
 let value;try{value=JSON.parse(text);}catch{throw new Error('ANFFELの引き継ぎファイル（JSON）を選択してください。');}
 if(value.format!=='anffel-ledger-transfer'||value.version!==1||!Array.isArray(value.data?.products)||!Array.isArray(value.data?.records))throw new Error('ANFFELの引き継ぎファイル（JSON）を選択してください。');
 return value.data;
}
export function transferContents(data){return JSON.stringify({format:'anffel-ledger-transfer',version:1,exportedAt:new Date().toISOString(),data},null,2);}
