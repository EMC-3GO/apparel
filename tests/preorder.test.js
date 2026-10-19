import test from 'node:test';
import assert from 'node:assert/strict';
import {preorderStatus,completedPreorderSteps} from '../src/preorder.js';
test('all eight checklist combinations derive the required order status',()=>{
 for(let mask=0;mask<8;mask++){
  const order={inspected:Boolean(mask&1),packed:Boolean(mask&2),shipped:Boolean(mask&4)};
  const count=Object.values(order).filter(Boolean).length;
  assert.equal(completedPreorderSteps(order),count);
  assert.equal(preorderStatus(order),count===0?'preparing':count===3?'shipped':'processing');
 }
});
test('unchecking steps returns an order to processing and preparing',()=>{
 const order={inspected:true,packed:true,shipped:true};assert.equal(preorderStatus(order),'shipped');
 order.packed=false;assert.equal(preorderStatus(order),'processing');
 order.shipped=false;order.inspected=false;assert.equal(preorderStatus(order),'preparing');
 assert.equal(preorderStatus({shipped:'false'}),'preparing');
});
