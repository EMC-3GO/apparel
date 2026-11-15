/* Google版はGoogleアカウントの本人確認だけを使用。アプリ独自のパスワードは不要。 */
function anffelRpc(request){
 anffelOwner_();
 var methods={getLedger:getLedger_,initializeLedger:initializeLedger_,saveLedgerOperation:saveLedgerOperation_,createIncomeReport:createIncomeReport_,downloadIncomeReport:downloadIncomeReport_,getPreorders:getPreorders_,savePreorderOperation:savePreorderOperation_};
 if(!request||!Object.prototype.hasOwnProperty.call(methods,request.name))throw new Error('この操作には対応していません。');
 return methods[request.name](request.arg);
}
