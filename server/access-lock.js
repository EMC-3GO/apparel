export const LOGIN_FAILURE_LIMIT=3;
export const RECOVERY_FAILURE_LIMIT=5;
export const RECOVERY_COOLDOWN_MS=30*60*1000;
export function emptyAccessLock(){return {version:1,failures:0,locked:false,lockedAt:0,recoveryFailures:0,recoveryBlockedUntil:0};}
export function validAccessLock(state){
 return state?.version===1&&Number.isInteger(state.failures)&&state.failures>=0&&state.failures<=LOGIN_FAILURE_LIMIT&&typeof state.locked==='boolean'&&Number.isSafeInteger(state.lockedAt)&&state.lockedAt>=0&&Number.isInteger(state.recoveryFailures)&&state.recoveryFailures>=0&&state.recoveryFailures<=RECOVERY_FAILURE_LIMIT&&Number.isSafeInteger(state.recoveryBlockedUntil)&&state.recoveryBlockedUntil>=0&&(state.locked===(state.failures===LOGIN_FAILURE_LIMIT));
}
// This transition must run inside a durable store's atomic update; never trust a browser counter.
export function advanceAccessLock(current,{action='inspect',correct=false,now=Date.now(),autoUnlockMs=0}={}){
 if(!validAccessLock(current)||!['inspect','login','recover'].includes(action)||!Number.isSafeInteger(now)||now<0||!Number.isSafeInteger(autoUnlockMs)||autoUnlockMs<0)throw new Error('Invalid access lock state');
 let state={...current};
 if(state.locked&&autoUnlockMs>0&&now>=state.lockedAt+autoUnlockMs)state=emptyAccessLock();
 if(state.recoveryBlockedUntil>0&&now>=state.recoveryBlockedUntil){state.recoveryFailures=0;state.recoveryBlockedUntil=0;}
 let authenticated=false,unlocked=false;
 if(action==='login'&&!state.locked){
  if(correct){state=emptyAccessLock();authenticated=true;}
  else{state.failures++;if(state.failures===LOGIN_FAILURE_LIMIT){state.locked=true;state.lockedAt=now;}}
 }
 if(action==='recover'&&state.locked&&state.recoveryBlockedUntil<=now){
  if(correct){state=emptyAccessLock();unlocked=true;}
  else{state.recoveryFailures++;if(state.recoveryFailures===RECOVERY_FAILURE_LIMIT)state.recoveryBlockedUntil=now+RECOVERY_COOLDOWN_MS;}
 }
 return {state,authenticated,unlocked};
}
