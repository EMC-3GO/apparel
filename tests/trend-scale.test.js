import test from 'node:test';
import assert from 'node:assert/strict';
import {trendScale,trendTickLabel} from '../src/trend-scale.js';
test('signed balances and negative income fit below the zero line while positive spending stays above it',()=>{
 const values=[12000,20000,-8000,-3000,0],scale=trendScale(values);
 assert.ok(scale.min<-8000);assert.ok(scale.max>20000);assert.ok(scale.y(-8000)>scale.y(0));assert.ok(scale.y(12000)<scale.y(0));
 for(const value of values)assert.ok(scale.y(value)>=29&&scale.y(value)<=211);
 assert.ok(scale.ticks.includes(0));assert.ok(scale.ticks.some(t=>t<0));
});
test('zero and small amounts have distinct readable currency ticks, without rounded duplicate 万円 labels',()=>{
 for(const values of [[0],[0,1,-1],[0,1200,-500],[500000,-250000]]){
  const scale=trendScale(values),labels=scale.ticks.map(trendTickLabel);assert.equal(new Set(labels).size,labels.length);assert.ok(Number.isFinite(scale.y(0)));assert.ok(scale.min<scale.max);
 }
 assert.equal(trendTickLabel(0),'0円');assert.equal(trendTickLabel(-500),'−500円');assert.equal(trendTickLabel(-15000),'−1.5万円');
});
