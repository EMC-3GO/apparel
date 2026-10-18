import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
export function server(){
 const props=new Map(),books=new Map();let activeUser='owner@example.test',failComplete=false,lockHeld=false,blocked=false;
 const rawWrites=[];
 class Range{
  constructor(sheet,row,col,height,width){Object.assign(this,{sheet,row,col,height,width});}
  getValues(){return Array.from({length:this.height},(_,r)=>Array.from({length:this.width},(_,c)=>this.sheet.rows[this.row+r-1]?.[this.col+c-1]??''));}
  setValues(values){
   rawWrites.push(values);
   if(failComplete&&this.sheet.name==='変更履歴'&&this.col===3&&values[0][0]==="'保存済み"){failComplete=false;throw new Error('simulated lost acknowledgement');}
   values.forEach((row,r)=>row.forEach((value,c)=>{this.sheet.rows[this.row+r-1]??=[];this.sheet.rows[this.row+r-1][this.col+c-1]=typeof value==='string'&&value.startsWith("'")?value.slice(1):value;}));return this;
  }
  clearContent(){for(let r=0;r<this.height;r++)for(let c=0;c<this.width;c++)if(this.sheet.rows[this.row+r-1])this.sheet.rows[this.row+r-1][this.col+c-1]='';return this;}
  setNumberFormat(){return this;}setFontFamily(){return this;}setFontSize(){return this;}setVerticalAlignment(){return this;}setWrap(){return this;}setBackground(){return this;}setFontWeight(){return this;}merge(){return this;}
 }
 class Sheet{
  constructor(name){this.name=name;this.rows=[];}
  getRange(...args){return new Range(this,...args);}getLastRow(){for(let i=this.rows.length-1;i>=0;i--)if(this.rows[i]?.some(v=>v!==''))return i+1;return 0;}
  setFrozenRows(){}deleteRow(n){this.rows.splice(n-1,1);}setName(name){this.name=name;return this;}setHiddenGridlines(){}setColumnWidth(){}autoResizeRows(){}setRowHeight(){}
 }
 class Book{
  constructor(id){this.id=id;this.sheets=[];books.set(id,this);}
  getId(){return this.id;}getUrl(){return 'https://docs.google.com/spreadsheets/d/'+this.id+'/edit';}
  getSheetByName(name){return this.sheets.find(s=>s.name===name);}insertSheet(name){const s=new Sheet(name);this.sheets.push(s);return s;}getSheets(){return this.sheets;}
 }
 const ledger=new Book('ledger');
 const context={
  console:{log(){}},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)??null,setProperty:(k,v)=>props.set(k,v),setProperties:obj=>Object.entries(obj).forEach(([k,v])=>props.set(k,v))})},
  Session:{getEffectiveUser:()=>({getEmail:()=> 'owner@example.test'}),getActiveUser:()=>({getEmail:()=>activeUser})},
  LockService:{getScriptLock:()=>({tryLock:()=>{if(blocked||lockHeld)return false;lockHeld=true;return true;},releaseLock:()=>{lockHeld=false;}})},
  SpreadsheetApp:{getActiveSpreadsheet:()=>ledger,openById:id=>{if(!books.has(id))throw new Error('not found');return books.get(id);},flush(){},create:title=>{const b=new Book('report'+books.size);b.title=title;b.insertSheet('Sheet1');return b;}},
  Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,text)=>[...crypto.createHash('sha256').update(text).digest()],base64EncodeWebSafe:bytes=>Buffer.from(bytes).toString('base64url'),base64Encode:bytes=>Buffer.from(bytes).toString('base64'),formatDate:()=> '2026/10/18 12:00'},
  DriveApp:{getFileById:id=>{if(!books.has(id))throw new Error('missing');return {isTrashed:()=>false,getAs:()=>({getContentType:()=> 'application/pdf',getBytes:()=> [...Buffer.from('%PDF-1.7\nmock\n')]})};}},
  MimeType:{PDF:'application/pdf'},
 };
 vm.createContext(context);vm.runInContext(readFileSync(new URL('../../public/apps-script/Code.gs',import.meta.url),'utf8'),context);
 const call=(name,arg)=>JSON.parse(JSON.stringify(context[name](arg)));
 context.setupAnffel();
 return {call,context,ledger,books,props,rawWrites,setUser:v=>{activeUser=v;},failCompletion:()=>{failComplete=true;},block:()=>{blocked=true;},isLocked:()=>lockHeld};
}
