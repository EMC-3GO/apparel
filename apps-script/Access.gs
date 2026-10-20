/* ロック状態はScript Propertiesに永続保存。Cacheは失効してよい認証セッションだけに使用する。 */
var ANFFEL_RPC_TOKEN_='';
function anffelAccessConfig_(props){
 var password=props.getProperty('ANFFEL_ACCESS_PASSWORD'),recovery=props.getProperty('ANFFEL_RECOVERY_CODE');
 if(!password||password.length<16||password.length>1024||!recovery||recovery.length<16||recovery.length>1024||password===recovery)return null;
 return {password:password,recovery:recovery};
}
function anffelAccessState_(props){
 var raw=props.getProperty('ANFFEL_ACCESS_LOCK');
 if(!raw)return AnffelAccess.emptyAccessLock();
 var state;try{state=JSON.parse(raw);}catch(error){throw new Error('ロック状態を確認できません。Google側の設定を確認してください。');}
 if(!AnffelAccess.validAccessLock(state))throw new Error('ロック状態を確認できません。Google側の設定を確認してください。');
 return state;
}
function anffelAccessLocked_(fn){
 var props=anffelOwner_(),lock=LockService.getScriptLock();
 if(!lock.tryLock(20000))throw new Error('ほかの操作を処理中です。少し待ってからお試しください。');
 try{return fn(props);}finally{lock.releaseLock();}
}
function anffelAccessHash_(value){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value));}
function anffelAccessMac_(value,config){return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(value,JSON.stringify(['ANFFEL access v1',config.password,config.recovery])));}
function anffelAccessEqual_(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;var result=0;for(var i=0;i<a.length;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);return result===0;}
function anffelAccessCorrect_(value,expected,config){return typeof value==='string'&&value.length<=1024&&anffelAccessEqual_(anffelAccessMac_(value,config),anffelAccessMac_(expected,config));}
function anffelAccessSession_(token,props,config,state){
 if(!config||state.locked||typeof token!=='string'||token.length>1024)return false;
 try{
  var split=token.lastIndexOf('.'),payloadText=token.slice(0,split);if(split<1||!anffelAccessEqual_(token.slice(split+1),anffelAccessMac_(payloadText,config)))return false;
  var payload=JSON.parse(payloadText),now=Date.now();
  if(!Number.isSafeInteger(payload.expires)||payload.expires<=now||payload.expires>now+3600000||payload.epoch!==(props.getProperty('ANFFEL_ACCESS_EPOCH')||'0'))return false;
  return CacheService.getScriptCache().get('anffel-session-'+anffelAccessHash_(token))==='active';
 }catch(error){return false;}
}
function anffelRequireAccess_(token,props){
 var config=anffelAccessConfig_(props),state=anffelAccessState_(props);
 if(!anffelAccessSession_(token,props,config,state))throw new Error('認証が必要です。入力中の内容を控えてから「入口に戻る」でパスワードを入力してください。');
}
function anffelAccessPublic_(props,token){
 var config=anffelAccessConfig_(props),state=anffelAccessState_(props);
 return {configured:Boolean(config),authenticated:anffelAccessSession_(token,props,config,state),locked:state.locked,remainingAttempts:3-state.failures,recoveryRetryAfter:Math.max(0,Math.ceil((state.recoveryBlockedUntil-Date.now())/1000))};
}
function getAccessStatus(request){return anffelAccessLocked_(function(props){return anffelAccessPublic_(props,request&&request.token);});}
function authenticateAccess(request){return anffelAccessLocked_(function(props){
 var config=anffelAccessConfig_(props);if(!config)throw new Error('Google側のパスワード・解除コードの設定が必要です。更新手順を確認してください。');
 if(!request||typeof request.password!=='string'||request.password.length>1024)throw new Error('入力内容を確認してください。');
 var previous=anffelAccessState_(props),result=AnffelAccess.advanceAccessLock(previous,{action:'login',correct:anffelAccessCorrect_(request.password,config.password,config),now:Date.now()});
 props.setProperty('ANFFEL_ACCESS_LOCK',JSON.stringify(result.state));
 if(result.state.locked&&!previous.locked)props.setProperty('ANFFEL_ACCESS_EPOCH',Utilities.getUuid());
 var response=anffelAccessPublic_(props);
 if(result.authenticated){
  var payload=JSON.stringify({expires:Date.now()+3600000,epoch:props.getProperty('ANFFEL_ACCESS_EPOCH')||'0',nonce:Utilities.getUuid()});
  var token=payload+'.'+anffelAccessMac_(payload,config);CacheService.getScriptCache().put('anffel-session-'+anffelAccessHash_(token),'active',3600);
  response.authenticated=true;response.token=token;
 }else response.error=response.locked?'3回間違えたため、入口全体をロックしました。解除コードで解除してください。':'パスワードが違います。あと'+response.remainingAttempts+'回でロックされます。';
 return response;
});}
function recoverAccess(request){return anffelAccessLocked_(function(props){
 var config=anffelAccessConfig_(props);if(!config)throw new Error('Google側のパスワード・解除コードの設定が必要です。');
 if(!request||typeof request.code!=='string'||request.code.length>1024)throw new Error('入力内容を確認してください。');
 var previous=anffelAccessState_(props),result=AnffelAccess.advanceAccessLock(previous,{action:'recover',correct:anffelAccessCorrect_(request.code,config.recovery,config),now:Date.now()});
 props.setProperty('ANFFEL_ACCESS_LOCK',JSON.stringify(result.state));
 if(result.unlocked)props.setProperty('ANFFEL_ACCESS_EPOCH',Utilities.getUuid());
 var response=anffelAccessPublic_(props);response.unlocked=result.unlocked;
 if(!result.unlocked)response.error=response.recoveryRetryAfter>0?'解除コードの試行回数が多いため、しばらく待ってからお試しください。':'解除コードが違います。';
 return response;
});}
function endAccessSession(request){return anffelAccessLocked_(function(props){
 var token=request&&request.token;
 if(typeof token==='string'&&token.length<=1024)CacheService.getScriptCache().remove('anffel-session-'+anffelAccessHash_(token));
 return {authenticated:false};
});}
function anffelRpc(request){
 anffelOwner_();
 var methods={getLedger:getLedger_,initializeLedger:initializeLedger_,saveLedgerOperation:saveLedgerOperation_,createIncomeReport:createIncomeReport_,downloadIncomeReport:downloadIncomeReport_,getPreorders:getPreorders_,savePreorderOperation:savePreorderOperation_};
 if(!request||!Object.prototype.hasOwnProperty.call(methods,request.name))throw new Error('この操作には対応していません。');
 ANFFEL_RPC_TOKEN_=request.token||'';
 try{return methods[request.name](request.arg);}finally{ANFFEL_RPC_TOKEN_='';}
}
