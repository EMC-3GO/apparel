import {summarize,amountOf} from './ledger.js';

// Existing recorded expenses are already in profit. Only incremental future costs
// belong in the contribution calculation; historical production spend is not deducted twice.
export function analyzeLedger(records,products,costs={}){
 const totals=summarize(records,products);
 const needed=Math.max(0,1-totals.profit);
 const candidates=products.map(product=>{
  const raw=costs[product.id];
  const costKnown=raw!==undefined&&raw!==null&&String(raw).trim()!==''&&Number.isFinite(Number(raw))&&Number(raw)>=0;
  const extraCost=costKnown?Number(raw):null;
  const contribution=costKnown?Number(product.price)-extraCost:null;
  const units=needed>0&&contribution>0?Math.ceil(needed/contribution):null;
  return {id:product.id,name:product.name,price:Number(product.price),extraCost,contribution,units,pending:product.mode==='order'&&!product.confirmed,projected:units===null?null:totals.profit+units*contribution};
 });
 const spending=Object.entries(records.filter(r=>r.type==='expense').reduce((out,r)=>{out[r.category]=(out[r.category]||0)+amountOf(r,products);return out;},{})).sort((a,b)=>b[1]-a[1]);
 const pending=products.filter(p=>p.mode==='order'&&!p.confirmed);
 const ranked=candidates.filter(p=>p.units!==null&&!p.pending).sort((a,b)=>a.units-b.units);
 return {totals,needed,candidates,pending,largestExpense:spending[0]||null,recommended:ranked[0]||null};
}
