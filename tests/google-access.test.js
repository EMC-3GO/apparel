import test from 'node:test';
import assert from 'node:assert/strict';
import {server} from './helpers/apps-script-server.js';
const password='test-only-password-123!',code='test-only-recovery-code-456!';
const login=s=>s.call('authenticateAccess',{password}).token;
const rpc=(s,token,name,arg)=>s.call('anffelRpc',{token,name,arg});
test('credentials are required on Google; missing, short or identical values fail closed',()=>{
 const s=server({authenticate:false,configured:false});assert.equal(s.call('getAccessStatus').configured,false);assert.throws(()=>s.call('authenticateAccess',{password}),/設定/);
 s.props.set('ANFFEL_ACCESS_PASSWORD',password);s.props.set('ANFFEL_RECOVERY_CODE',password);assert.equal(s.call('getAccessStatus').configured,false);
 assert.throws(()=>rpc(s,'','getLedger'),/認証/);
});
test('third error globally persists a manual lock across new runtimes and cache eviction, and revokes existing sessions',()=>{
 const s=server({authenticate:false}),token=login(s);assert.ok(s.call('getAccessStatus',{token}).authenticated);
 for(let i=1;i<=3;i++){const result=s.call('authenticateAccess',{password:'incorrect'});assert.equal(result.locked,i===3);assert.equal(result.remainingAttempts,3-i);}
 assert.throws(()=>rpc(s,token,'getLedger'),/認証/);assert.equal(s.call('authenticateAccess',{password}).authenticated,false);
 s.cache.clear();s.restart();s.advanceTime(7*24*3600*1000);assert.equal(s.call('getAccessStatus').locked,true);
 assert.equal(s.call('recoverAccess',{code:'wrong'}).locked,true);
 const recovery=s.call('recoverAccess',{code});assert.equal(recovery.unlocked,true);assert.equal(recovery.authenticated,false);assert.ok(!('token' in recovery));
 assert.throws(()=>rpc(s,token,'getLedger'),/認証/);assert.ok(s.call('authenticateAccess',{password}).authenticated);
});
test('every finance, report and preorder RPC is protected; old public method names are removed',()=>{
 const s=server({authenticate:false});
 for(const name of ['getLedger','initializeLedger','saveLedgerOperation','createIncomeReport','downloadIncomeReport','getPreorders','savePreorderOperation']){
  assert.equal(typeof s.context[name],'undefined');assert.throws(()=>rpc(s,'',name,{}),/認証/);
 }
 const token=login(s);assert.deepEqual(rpc(s,token,'getLedger').data,{products:[],records:[]});
 assert.throws(()=>rpc(s,token,'setupAnffel',{}),/対応していません/);
 assert.throws(()=>s.call('getLedger_'),/認証/);
});
test('session signatures, expiry, credential changes and explicit logout cannot be bypassed',()=>{
 const s=server({authenticate:false}),token=login(s);assert.throws(()=>rpc(s,token+'x','getLedger'),/認証/);
 s.call('endAccessSession',{token});assert.throws(()=>rpc(s,token,'getLedger'),/認証/);
 const next=login(s);s.advanceTime(3600000);assert.throws(()=>rpc(s,next,'getLedger'),/認証/);
 const changed=login(s);s.props.set('ANFFEL_RECOVERY_CODE','changed-recovery-code-999!');assert.throws(()=>rpc(s,changed,'getLedger'),/認証/);
});
test('recovery guessing is throttled in persistent state and Google ownership is required for every access operation',()=>{
 const s=server({authenticate:false});for(let i=0;i<3;i++)s.call('authenticateAccess',{password:'bad'});
 for(let i=0;i<5;i++)s.call('recoverAccess',{code:'bad'});
 s.restart();const blocked=s.call('recoverAccess',{code});assert.equal(blocked.unlocked,false);assert.ok(blocked.recoveryRetryAfter>0);
 s.advanceTime(30*60*1000);assert.equal(s.call('recoverAccess',{code}).unlocked,true);
 s.setUser('other@example.test');for(const name of ['getAccessStatus','authenticateAccess','recoverAccess','endAccessSession','anffelRpc'])assert.throws(()=>s.call(name,{}),/本人/);
});
test('invalid persisted lock state cannot reset the attempt counter and concurrent lock acquisition fails safely',()=>{
 const s=server({authenticate:false});s.props.set('ANFFEL_ACCESS_LOCK','broken');assert.throws(()=>s.call('getAccessStatus'),/ロック状態/);
 s.props.set('ANFFEL_ACCESS_LOCK',JSON.stringify({failures:0}));assert.throws(()=>s.call('authenticateAccess',{password}),/ロック状態/);
 s.block();assert.throws(()=>s.call('recoverAccess',{code}),/ほかの操作/);
});
