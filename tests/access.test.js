import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAccessHandler,TARGET_URL} from '../server/access.js';
test('existing entrance forwards only to the fixed owner-only Google app and ignores injected destinations',()=>{
 for(const url of ['/api/access','/api/access?action=open','/api/access?url=https://example.test']){
  const headers={},res={setHeader:(k,v)=>headers[k]=v,end(){}};createAccessHandler()({method:'GET',url},res);
  assert.equal(res.statusCode,303);assert.equal(headers.Location,TARGET_URL);assert.equal(headers['Cache-Control'],'private, no-store');assert.equal(headers['Referrer-Policy'],'no-referrer');
 }
});
test('old Vercel password and recovery mutations are no longer authentication endpoints',()=>{
 for(const method of ['POST','PUT','DELETE']){const res={setHeader(){},end(){}};createAccessHandler()({method},res);assert.equal(res.statusCode,405);}
});
