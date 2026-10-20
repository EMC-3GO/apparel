/* 受注生産管理：既存の財務シートを変更せず、専用シートを追加する。 */
function anffelPreorderTables_(ss){
 var baseFields=AnffelPreorders.orderFields.filter(function(f){return f.key!=='productId';}),headers=baseFields.map(function(f){return f.header;}).concat(['進捗','更新ID']);
 var orders=anffelSheet_(ss,'受注一覧',headers),extra=orders.getRange(1,headers.length+1,1,1).getValues()[0][0];
 if(extra===''||extra===null){anffelWrite_(orders.getRange(1,headers.length+1,1,1),[['対象商品ID']]);SpreadsheetApp.flush();}
 else if(extra!=='対象商品ID')throw new Error('受注一覧の追加列を確認してください。既存データを上書きせず停止しました。');
 return {
  orders:orders,
  campaigns:anffelSheet_(ss,'予約受付',AnffelPreorders.campaignFields.map(function(f){return f.header;}).concat(['更新ID'])),
  log:anffelSheet_(ss,'受注変更履歴',ANFFEL_LOG_HEADERS)
 };
}
function anffelPreorderState_(ss){
 var tables=anffelPreorderTables_(ss),data={orders:[],campaigns:[]},versions={orders:{},campaigns:{}};
 ['campaigns','orders'].forEach(function(entity){
  var fields=entity==='orders'?AnffelPreorders.orderFields.filter(function(f){return f.key!=='productId';}):AnffelPreorders.campaignFields,columns=fields.length+(entity==='orders'?3:1);
  data[entity]=anffelRows_(tables[entity],columns).filter(function(row){return row[0]!=='';}).map(function(row){
   var item={};if(versions[entity][row[0]])throw new Error('受注データに重複IDがあります。シートを確認してください。');
   versions[entity][row[0]]=anffelVersion_(row);
   fields.forEach(function(field,i){var v=row[i];item[field.key]=field.type==='number'?Number(v):field.type==='boolean'?(v===true||String(v).toLowerCase()==='true'?true:v===false||String(v).toLowerCase()==='false'||v===''?false:v):String(v);});
   if(entity==='orders')item.productId=String(row[fields.length+2]||'');
   return item;
  });
 });
 ['campaigns','orders'].forEach(function(entity){data[entity].forEach(function(item){AnffelPreorders.validatePreorderOperation({entity:entity,action:'upsert',item:item},data,{reading:true});});});
 return {data:data,versions:versions};
}
function anffelPreorderApply_(ss,operation,eventId){
 var tables=anffelPreorderTables_(ss),entity=operation.entity,sheet=tables[entity],fields=entity==='orders'?AnffelPreorders.orderFields.filter(function(f){return f.key!=='productId';}):AnffelPreorders.campaignFields;
 var id=operation.action==='delete'?operation.id:operation.item.id,columns=fields.length+(entity==='orders'?3:1),rows=anffelRows_(sheet,columns),index=rows.map(function(row){return row[0];}).indexOf(id);
 if(operation.action==='delete'){if(index>=0)sheet.deleteRow(index+2);return;}
 var values=fields.map(function(field){return operation.item[field.key];});
 if(entity==='orders'){var status=AnffelPreorders.preorderStatus(operation.item);values.push(AnffelPreorders.preorderStatuses.filter(function(s){return s.key===status;})[0].label);}
 values.push(eventId);if(entity==='orders')values.push(operation.item.productId||'');anffelWrite_(sheet.getRange(index<0?sheet.getLastRow()+1:index+2,1,1,columns),[values]);
}
function anffelPreorderRecover_(ss){
 var tables=anffelPreorderTables_(ss),rows=anffelRows_(tables.log,7);
 rows.forEach(function(row,index){
  if(row[2]==='保存済み')return;
  if(row[2]!=='処理中')throw new Error('受注変更履歴の状態を確認できません。');
  anffelPreorderApply_(ss,JSON.parse(row[6]),row[0]);SpreadsheetApp.flush();anffelWrite_(tables.log.getRange(index+2,3,1,1),[['保存済み']]);SpreadsheetApp.flush();
 });
}
function getPreorders(){return anffelLocked_(function(ss,props){
 if(props.getProperty('ANFFEL_INITIALIZED')!=='true')throw new Error('先に既存の保存先の準備を完了してください。');
 anffelPreorderRecover_(ss);return anffelPreorderState_(ss);
});}
function savePreorderOperation(request){return anffelLocked_(function(ss,props){
 if(props.getProperty('ANFFEL_INITIALIZED')!=='true')throw new Error('先に既存の保存先の準備を完了してください。');
 if(!request||typeof request.eventId!=='string'||!request.eventId||request.eventId.length>150)throw new Error('受注の保存内容を確認してください。');
 anffelPreorderRecover_(ss);var tables=anffelPreorderTables_(ss),logs=anffelRows_(tables.log,7);
 if(logs.some(function(row){return row[0]===request.eventId;}))return anffelPreorderState_(ss);
 var state=anffelPreorderState_(ss),entity=request.entity,id=request.action==='delete'?request.id:request.item&&request.item.id;
 if(!state.versions[entity])throw new Error('受注の保存内容を確認してください。');
 if((state.versions[entity][id]||'')!==(request.expectedVersion||''))throw new Error('この受注データは別の画面で変更されています。入力内容を控えてから画面を閉じ、受注の「再読み込み」で最新の内容を確認してください。');
 state.data.products=anffelRows_(anffelTables_(ss).products,9).filter(function(row){return row[0]!=='';}).map(function(row){return {id:String(row[0]),mode:row[3]};});
 var operation=AnffelPreorders.validatePreorderOperation(request,state.data),json=JSON.stringify(operation),row=tables.log.getLastRow()+1;
 if(json.length>45000)throw new Error('入力内容が長すぎます。');
 anffelWrite_(tables.log.getRange(row,1,1,7),[[request.eventId,new Date().toISOString(),'処理中',entity,operation.action,id,json]]);SpreadsheetApp.flush();
 anffelPreorderApply_(ss,operation,request.eventId);SpreadsheetApp.flush();anffelWrite_(tables.log.getRange(row,3,1,1),[['保存済み']]);SpreadsheetApp.flush();
 return anffelPreorderState_(ss);
});}
