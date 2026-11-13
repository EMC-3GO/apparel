import {summarize} from './ledger.js';

// Every point is a running total. The final point uses the same period as the cards.
export function buildTrendPoints(records,products,{range,month}){
 if(range==='month'){
  const scoped=records.filter(record=>record.date.startsWith(month));
  const [year,number]=month.split('-').map(Number);
  const days=new Date(Date.UTC(year,number,0)).getUTCDate();
  return [8,16,24,days].map(day=>({
   label:`${day}日`,
   ...summarize(scoped.filter(record=>Number(record.date.slice(8))<=day),products),
  }));
 }
 const months=records.map(record=>record.date.slice(0,7)).sort();
 const first=months[0]||month,last=months.at(-1)||month;
 const index=key=>Number(key.slice(0,4))*12+Number(key.slice(5))-1;
 const end=index(last),count=Math.min(12,end-index(first)+1);
 return Array.from({length:count},(_,i)=>{
  const value=end-count+1+i;
  const key=`${Math.floor(value/12)}-${String(value%12+1).padStart(2,'0')}`;
  // Include earlier history even when only the last 12 months are drawn.
  return {label:`${value%12+1}月`,...summarize(records.filter(record=>record.date.slice(0,7)<=key),products)};
 });
}
