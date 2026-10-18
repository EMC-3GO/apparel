/* ANFFEL / Googleスプレッドシート専用版
 * 初回：スプレッドシートに紐づけたApps ScriptでsetupAnffelを実行。
 * ウェブアプリの実行ユーザーとアクセス可能ユーザーを「自分」に設定する。
 * このファイル末尾のHTMLと集計処理はビルド時に追加されます。
 */
var ANFFEL_PRODUCT_HEADERS=['ID','商品名','販売価格','販売方法','費用確定','商品の種類','説明','色','更新ID'];
var ANFFEL_RECORD_HEADERS=['ID','日付','区分','項目','タイトル','対象商品ID','数量','記録時単価','値引き','金額','メモ','更新ID'];
var ANFFEL_LOG_HEADERS=['操作ID','更新日時','状態','区分','操作','対象ID','保存内容'];

function setupAnffel(){
 var ss=SpreadsheetApp.getActiveSpreadsheet();
 if(!ss)throw new Error('専用スプレッドシートの「拡張機能 → Apps Script」からsetupAnffelを実行してください。');
 var props=PropertiesService.getScriptProperties(),owner=Session.getEffectiveUser().getEmail();
 if(!owner)throw new Error('Googleアカウントでログインしてください。');
 if(props.getProperty('ANFFEL_OWNER')&&props.getProperty('ANFFEL_OWNER')!==owner)throw new Error('この設定は作成者本人のみ実行できます。');
 if(props.getProperty('ANFFEL_SHEET_ID')&&props.getProperty('ANFFEL_SHEET_ID')!==ss.getId())throw new Error('このスクリプトは別のシートに設定済みです。上書きは行いません。');
 props.setProperties({ANFFEL_OWNER:owner,ANFFEL_SHEET_ID:ss.getId()});
 if(!ss.getSheetByName('商品')&&ss.getSheets().length===1&&ss.getSheets()[0].getLastRow()===0)ss.getSheets()[0].setName('商品');
 anffelSheet_(ss,'商品',ANFFEL_PRODUCT_HEADERS);
 anffelSheet_(ss,'収支記録',ANFFEL_RECORD_HEADERS);
 anffelSheet_(ss,'変更履歴',ANFFEL_LOG_HEADERS);
 if(!props.getProperty('ANFFEL_INITIALIZED'))props.setProperty('ANFFEL_INITIALIZED','false');
 console.log('ANFFELの準備ができました。ウェブアプリを「自分のみ」でデプロイしてください。');
}
function anffelOwner_(){
 var props=PropertiesService.getScriptProperties(),owner=props.getProperty('ANFFEL_OWNER');
 if(!owner||!props.getProperty('ANFFEL_SHEET_ID'))throw new Error('先にスクリプトエディタでsetupAnffelを実行してください。');
 if(Session.getActiveUser().getEmail()!==owner)throw new Error('ANFFELは設定したGoogleアカウント本人のみ利用できます。本人のアカウントで開いてください。');
 return props;
}
function anffelLocked_(fn){
 var props=anffelOwner_(),lock=LockService.getScriptLock();
 if(!lock.tryLock(20000))throw new Error('ほかの保存処理を実行中です。少し待ってからお試しください。');
 try{return fn(SpreadsheetApp.openById(props.getProperty('ANFFEL_SHEET_ID')),props);}finally{lock.releaseLock();}
}
function doGet(){anffelOwner_();return HtmlService.createHtmlOutput(ANFFEL_HTML).setTitle('ANFFEL — ブランドの収支管理').addMetaTag('viewport','width=device-width, initial-scale=1.0');}
function anffelLiteral_(value){return typeof value==='string'?"'"+value:value===undefined?'':value;}
function anffelWrite_(range,rows){range.setNumberFormat('@');range.setValues(rows.map(function(row){return row.map(anffelLiteral_);}));}
function anffelSheet_(ss,name,headers){
 var sheet=ss.getSheetByName(name)||ss.insertSheet(name);
 if(sheet.getLastRow()===0)anffelWrite_(sheet.getRange(1,1,1,headers.length),[headers]);
 var actual=sheet.getRange(1,1,1,headers.length).getValues()[0];
 if(headers.some(function(h,i){return actual[i]!==h;}))throw new Error(name+'シートの見出しが一致しません。既存データを上書きせずに停止しました。');
 sheet.setFrozenRows(1);return sheet;
}
function anffelTables_(ss){return {products:anffelSheet_(ss,'商品',ANFFEL_PRODUCT_HEADERS),records:anffelSheet_(ss,'収支記録',ANFFEL_RECORD_HEADERS),log:anffelSheet_(ss,'変更履歴',ANFFEL_LOG_HEADERS)};}
function anffelRows_(sheet,columns){return sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,columns).getValues():[];}
function anffelVersion_(row){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(row)));}
function anffelState_(ss,props){
 var tables=anffelTables_(ss),versions={products:{},records:{}};
 var products=anffelRows_(tables.products,9).filter(function(r){return r[0]!=='';}).map(function(r){if(versions.products[r[0]])throw new Error('商品シートに重複IDがあります。データを確認してください。');versions.products[r[0]]=anffelVersion_(r);return {id:String(r[0]),name:String(r[1]),price:Number(r[2]),mode:r[3],confirmed:String(r[4]).toLowerCase()==='true',shape:r[5]||'tee',subtitle:r[6]||'',color:r[7]||'sand'};});
 var records=anffelRows_(tables.records,12).filter(function(r){return r[0]!=='';}).map(function(r){if(versions.records[r[0]])throw new Error('収支記録シートに重複IDがあります。データを確認してください。');versions.records[r[0]]=anffelVersion_(r);var item={id:String(r[0]),date:String(r[1]),type:r[2],category:r[3],title:String(r[4]),productId:r[5]||'',quantity:Number(r[6]||0),discount:Number(r[8]||0),amount:Number(r[9]||0),memo:r[10]||''};if(r[7]!=='')item.unitPrice=Number(r[7]);return item;});
 var data={products:products,records:records};['products','records'].forEach(function(entity){data[entity].forEach(function(item){AnffelCore.validateOperation({entity:entity,action:'upsert',item:item},data,{migrating:true});});});
 return {data:data,versions:versions,initialized:props.getProperty('ANFFEL_INITIALIZED')==='true',spreadsheetUrl:ss.getUrl()};
}
function anffelRow_(operation,eventId){
 var p=operation.item;
 return operation.entity==='products'?[p.id,p.name,p.price,p.mode,p.confirmed,p.shape||'tee',p.subtitle||'',p.color||'sand',eventId]:[p.id,p.date,p.type,p.category,p.title,p.productId||'',p.quantity===undefined?'':p.quantity,p.unitPrice===undefined?'':p.unitPrice,p.discount||0,p.amount||0,p.memo||'',eventId];
}
function anffelApply_(ss,operation,eventId){
 var tables=anffelTables_(ss),sheet=tables[operation.entity],id=operation.item?operation.item.id:operation.id,columns=operation.entity==='products'?9:12;
 var ids=anffelRows_(sheet,columns).map(function(row){return row[0];}),index=ids.indexOf(id);
 if(operation.action==='delete'){if(index>=0)sheet.deleteRow(index+2);return;}
 var row=anffelRow_(operation,eventId);anffelWrite_(sheet.getRange(index<0?sheet.getLastRow()+1:index+2,1,1,columns),[row]);
}
function anffelRecover_(ss){
 var tables=anffelTables_(ss),rows=anffelRows_(tables.log,7);
 rows.forEach(function(row,index){
  if(row[2]==='保存済み')return;
  if(row[2]!=='処理中')throw new Error('変更履歴の状態を確認できません。上書きせずに停止しました。');
  var operation=JSON.parse(row[6]);anffelApply_(ss,operation,row[0]);SpreadsheetApp.flush();anffelWrite_(tables.log.getRange(index+2,3,1,1),[['保存済み']]);SpreadsheetApp.flush();
 });
}
function getLedger(){return anffelLocked_(function(ss,props){anffelRecover_(ss);return anffelState_(ss,props);});}
function initializeLedger(request){return anffelLocked_(function(ss,props){
 if(props.getProperty('ANFFEL_INITIALIZED')==='true')return anffelState_(ss,props);
 var data=request&&request.data||{products:[],records:[]};
 if(!Array.isArray(data.products)||!Array.isArray(data.records))throw new Error('引き継ぎファイルの形式を確認してください。');
 ['products','records'].forEach(function(entity){var seen={};data[entity].forEach(function(item){if(seen[item.id])throw new Error('引き継ぎデータに重複IDがあります。');seen[item.id]=true;AnffelCore.validateOperation({entity:entity,action:'upsert',item:item},data,{migrating:true});});});
 var digest=Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(data))),previous=props.getProperty('ANFFEL_IMPORT_HASH');
 if(previous&&previous!==digest)throw new Error('途中の引き継ぎ処理があります。同じファイルでもう一度お試しください。');
 props.setProperty('ANFFEL_IMPORT_HASH',digest);
 var tables=anffelTables_(ss);
 ['products','records'].forEach(function(entity){var sheet=tables[entity],columns=entity==='products'?9:12,rows=data[entity].map(function(item){return anffelRow_({entity:entity,item:item},'migration-'+entity+'-'+item.id);});if(sheet.getLastRow()>1)sheet.getRange(2,1,sheet.getLastRow()-1,columns).clearContent();for(var i=0;i<rows.length;i+=300)anffelWrite_(sheet.getRange(i+2,1,Math.min(300,rows.length-i),columns),rows.slice(i,i+300));});
 SpreadsheetApp.flush();props.setProperty('ANFFEL_INITIALIZED','true');return anffelState_(ss,props);
 });}
function saveLedgerOperation(request){return anffelLocked_(function(ss,props){
 if(props.getProperty('ANFFEL_INITIALIZED')!=='true')throw new Error('先にデータの引き継ぎまたは新規開始を完了してください。');
 if(!request||typeof request.eventId!=='string'||!request.eventId||request.eventId.length>150)throw new Error('保存内容を確認してください。');
 anffelRecover_(ss);var tables=anffelTables_(ss),logs=anffelRows_(tables.log,7);
 if(logs.some(function(row){return row[0]===request.eventId;}))return anffelState_(ss,props);
 var state=anffelState_(ss,props),id=request.item?request.item.id:request.id;
 if(!state.versions[request.entity])throw new Error('保存する内容を確認してください。');
 if((state.versions[request.entity][id]||'')!==(request.expectedVersion||''))throw new Error('この記録は別の画面で変更されています。最新の内容を再読み込みしてから編集してください。');
 var operation=AnffelCore.validateOperation(request,state.data),json=JSON.stringify(operation);
 if(json.length>45000)throw new Error('記録が長すぎます。内容を短くしてください。');
 var row=tables.log.getLastRow()+1;
 anffelWrite_(tables.log.getRange(row,1,1,7),[[request.eventId,new Date().toISOString(),'処理中',operation.entity,operation.action,id,json]]);SpreadsheetApp.flush();
 anffelApply_(ss,operation,request.eventId);SpreadsheetApp.flush();anffelWrite_(tables.log.getRange(row,3,1,1),[['保存済み']]);SpreadsheetApp.flush();
 return anffelState_(ss,props);
 });}
function createIncomeReport(options){return anffelLocked_(function(ss,props){
 if(props.getProperty('ANFFEL_INITIALIZED')!=='true')throw new Error('先に保存先の準備を完了してください。');
 anffelRecover_(ss);var state=anffelState_(ss,props),report=AnffelCore.buildIncomeReport(state.data,{range:options&&options.range||'all',month:options&&options.month||'',generatedAt:Utilities.formatDate(new Date(),'Asia/Tokyo','yyyy/MM/dd HH:mm')});
 var key=Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify([options,state.versions]))),cached=props.getProperty('ANFFEL_LAST_REPORT');
 if(cached){var last=JSON.parse(cached);if(last.key===key){try{if(!DriveApp.getFileById(last.id).isTrashed())return last;}catch(error){/* A deleted report may be recreated; source records are retained. */}}}
 var book=SpreadsheetApp.create(report.title,Math.max(100,report.rows.length+5),6),sheet=book.getSheets()[0];sheet.setName('収支報告書');
 props.setProperty('ANFFEL_REPORT_'+book.getId(),'true');
 var rows=report.rows.map(function(row){return Array.from({length:6},function(_,i){return row[i]===undefined?'':row[i];});});
 anffelWrite_(sheet.getRange(1,1,rows.length,6),rows);
 var whole=sheet.getRange(1,1,rows.length,6);whole.setFontFamily('Noto Sans').setFontSize(9).setVerticalAlignment('top').setWrap(true);sheet.setHiddenGridlines(true);
 [80,165,120,90,60,110].forEach(function(w,i){sheet.setColumnWidth(i+1,w);});
 report.merges.forEach(function(i){sheet.getRange(i+1,1,1,6).merge();});
 for(var i=4;i<=12;i++)sheet.getRange(i+1,1,1,2).merge();
 report.headings.forEach(function(i){sheet.getRange(i+1,1,1,6).setBackground('#eeeeee').setFontWeight('bold');});
 report.currencyRanges.forEach(function(r){sheet.getRange(r.startRowIndex+1,r.startColumnIndex+1,r.endRowIndex-r.startRowIndex,r.endColumnIndex-r.startColumnIndex).setNumberFormat('"¥"#,##0;"−¥"#,##0;"¥"0');});
 sheet.getRange(1,1,1,6).setFontSize(16).setFontWeight('bold');sheet.autoResizeRows(1,rows.length);report.merges.forEach(function(i){sheet.setRowHeight(i+1,Math.max(24,Math.ceil(String(report.rows[i][0]).length/60)*16));});sheet.setRowHeight(1,32);SpreadsheetApp.flush();
 var result={id:book.getId(),url:book.getUrl(),fileName:report.fileName,ready:true,key:key};props.setProperty('ANFFEL_LAST_REPORT',JSON.stringify(result));return result;
 });}
function downloadIncomeReport(request){
 var props=anffelOwner_(),id=request&&request.id;
 if(typeof id!=='string'||props.getProperty('ANFFEL_REPORT_'+id)!=='true')throw new Error('ANFFELで作成した報告書を選択してください。');
 var blob;
 try{blob=DriveApp.getFileById(id).getAs(MimeType.PDF);}catch(error){throw new Error('報告書のシートは作成済みですが、PDFの取得に失敗しました。少し待って「PDFを再取得」を押してください。');}
 if(blob.getContentType()!=='application/pdf')throw new Error('PDFの取得結果を確認できませんでした。報告書のシートは保存されています。');
 return {base64:Utilities.base64Encode(blob.getBytes()),mimeType:'application/pdf'};
}
