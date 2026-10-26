// Shared scale for income, spending and the signed balance (income - spending).
export function trendScale(values){
 const finite=values.filter(Number.isFinite);
 let min=Math.min(0,...finite),max=Math.max(0,...finite);
 if(min===max){min=-10000;max=10000;}
 else{const padding=(max-min)*0.08;if(min<0)min-=padding;if(max>0)max+=padding;}
 const rawStep=(max-min)/5,power=10**Math.floor(Math.log10(rawStep));
 const step=Math.max(1,([1,2,2.5,5,10].find(n=>n*power>=rawStep)||10)*power);
 min=Math.floor(min/step)*step;max=Math.ceil(max/step)*step;
 const ticks=Array.from({length:Math.round((max-min)/step)+1},(_,i)=>Math.round((min+i*step)*1000000)/1000000);
 return {min,max,ticks,y:value=>211-(value-min)/(max-min)*182};
}
export function trendTickLabel(value){
 if(value===0)return '0円';
 const magnitude=Math.abs(value),number=new Intl.NumberFormat('ja-JP',{maximumFractionDigits:3});
 return (value<0?'−':'')+(magnitude>=10000?number.format(magnitude/10000)+'万円':number.format(magnitude)+'円');
}
