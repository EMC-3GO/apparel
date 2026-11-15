export function isDemo(){return !globalThis.ANFFEL_APPS_SCRIPT&&!globalThis.google?.script?.run&&globalThis.location?.pathname!=='/legacy'&&!globalThis.location?.pathname?.startsWith('/legacy/');}
// Keep classroom data separate from any prior personal browser records.
export function demoStorage(storage=globalThis.localStorage){
 if(!isDemo())return storage;
 return {getItem:key=>storage.getItem('anffel-classroom:'+key),setItem:(key,value)=>storage.setItem('anffel-classroom:'+key,value),removeItem:key=>storage.removeItem('anffel-classroom:'+key)};
}
