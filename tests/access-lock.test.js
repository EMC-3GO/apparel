import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceAccessLock,emptyAccessLock,RECOVERY_COOLDOWN_MS} from '../server/access-lock.js';
function lock(){let state=emptyAccessLock();for(let i=0;i<3;i++)state=advanceAccessLock(state,{action:'login',now:1000+i}).state;return state;}
test('the third incorrect password locks access, and a correct login password cannot bypass it',()=>{
 let state=emptyAccessLock();for(let i=1;i<=3;i++){state=advanceAccessLock(state,{action:'login',now:1000+i}).state;assert.equal(state.failures,i);assert.equal(state.locked,i===3);}
 const result=advanceAccessLock(state,{action:'login',correct:true,now:2000});assert.equal(result.authenticated,false);assert.deepEqual(result.state,state);
});
test('successful authentication before the limit resets consecutive errors',()=>{
 const one=advanceAccessLock(emptyAccessLock(),{action:'login',now:1000});
 const good=advanceAccessLock(one.state,{action:'login',correct:true,now:1001});assert.equal(good.authenticated,true);assert.deepEqual(good.state,emptyAccessLock());
});
test('a separate correct recovery credential resets the lock without granting an authenticated session',()=>{
 const state=lock(),bad=advanceAccessLock(state,{action:'recover',now:2000});assert.equal(bad.unlocked,false);assert.equal(bad.state.locked,true);
 const good=advanceAccessLock(bad.state,{action:'recover',correct:true,now:2001});assert.equal(good.unlocked,true);assert.equal(good.authenticated,false);assert.deepEqual(good.state,emptyAccessLock());
});
test('manual locks persist indefinitely; an optional timer unlocks at the exact boundary',()=>{
 const state=lock(),duration=30*60*1000;
 assert.equal(advanceAccessLock(state,{now:state.lockedAt+duration+1}).state.locked,true);
 assert.equal(advanceAccessLock(state,{now:state.lockedAt+duration-1,autoUnlockMs:duration}).state.locked,true);
 assert.deepEqual(advanceAccessLock(state,{now:state.lockedAt+duration,autoUnlockMs:duration}).state,emptyAccessLock());
});
test('recovery attempts are throttled independently and cannot bypass their cooldown',()=>{
 let state=lock();for(let i=0;i<5;i++)state=advanceAccessLock(state,{action:'recover',now:2000}).state;
 const blocked=advanceAccessLock(state,{action:'recover',correct:true,now:2001});assert.equal(blocked.unlocked,false);
 const later=advanceAccessLock(state,{action:'recover',correct:true,now:2000+RECOVERY_COOLDOWN_MS});assert.equal(later.unlocked,true);
});
test('invalid saved state fails closed rather than resetting the attempt counter',()=>{
 assert.throws(()=>advanceAccessLock({failures:0}));assert.throws(()=>advanceAccessLock({...emptyAccessLock(),failures:3}));
});
