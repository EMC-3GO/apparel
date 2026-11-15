import test from 'node:test';
import assert from 'node:assert/strict';
import {server} from './helpers/apps-script-server.js';
test('Google owner opens ledger without passwords, tokens or recovery configuration',()=>{
 const s=server({authenticate:false,configured:false});assert.deepEqual(s.call('getLedger').data,{products:[],records:[]});
 for(const name of ['authenticateAccess','recoverAccess','getAccessStatus','endAccessSession'])assert.equal(typeof s.context[name],'undefined');
 s.props.set('ANFFEL_ACCESS_LOCK','broken old lock');s.props.set('ANFFEL_ACCESS_PASSWORD','old');s.props.set('ANFFEL_RECOVERY_CODE','old');s.restart();assert.deepEqual(s.call('getLedger').data,{products:[],records:[]});
});
test('Google owner check still protects all finance and order endpoints',()=>{
 const s=server({configured:false});s.setUser('other@example.test');
 for(const name of ['getLedger','initializeLedger','saveLedgerOperation','createIncomeReport','downloadIncomeReport','getPreorders','savePreorderOperation'])assert.throws(()=>s.call(name,{}),/本人/);
 assert.throws(()=>s.context.getLedger_(),/本人/);
});
test('unsupported methods and concurrent writes remain rejected',()=>{
 const s=server();assert.throws(()=>s.call('anffelRpc',{name:'setupAnffel'}),/対応していません/);s.block();assert.throws(()=>s.call('getLedger'),/ほかの保存処理/);
});
