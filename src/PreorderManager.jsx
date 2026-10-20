import React,{useEffect,useRef,useState} from 'react';
import {Plus,Pencil,X,Check,Trash2,RefreshCw,Search,Package} from 'lucide-react';
import {preorderSteps,preorderStatuses,preorderStatus,completedPreorderSteps,japanToday,validatePreorderOperation} from './preorder.js';
import {LocalPreorderStore,AppsScriptPreorderStore} from './storage/preorder.js';
import './preorder.css';
const blankData=()=>({orders:[],campaigns:[]});
export default function PreorderManager({googleMode,products,connected}){
 const [store]=useState(()=>googleMode?new AppsScriptPreorderStore():new LocalPreorderStore());
 const [data,setData]=useState(blankData),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[modal,setModal]=useState(null),[query,setQuery]=useState(''),[productId,setProductId]=useState('all');
 const lock=useRef(false),today=japanToday();
 useEffect(()=>{if(connected)read();},[connected,store]);
 async function read(){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{setData(await store.read());setReady(true);}catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}
 }
 async function persist(operation){
  if(!ready||lock.current)throw new Error('読み込み・保存の完了をお待ちください。');
  lock.current=true;setBusy(true);setError('');
  try{setData(await store.save(operation));}finally{lock.current=false;setBusy(false);}
 }
 async function save(item){await persist({entity:'orders',action:'upsert',item});setModal(null);}
 async function remove(){await persist({entity:'orders',action:'delete',id:modal.item.id});setModal(null);}
 async function toggle(order,key){try{await persist({entity:'orders',action:'upsert',item:{...order,[key]:!order[key]}});}catch(e){setError(e.message+' チェックをもう一度操作して再試行できます。');}}
 const filtered=data.orders.filter(order=>(productId==='all'||(productId==='none'?!order.productId:order.productId===productId))&&[order.customerName,order.productName,order.size,order.trackingNumber].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.shipBy.localeCompare(b.shipBy)||a.orderedOn.localeCompare(b.orderedOn)||a.id.localeCompare(b.id));
 const orderProducts=products.filter(product=>product.mode==='order');
 const groups=orderProducts.map(product=>({...product,archived:false}));
 for(const order of data.orders)if(order.productId&&!groups.some(p=>p.id===order.productId)){const product=products.find(p=>p.id===order.productId);groups.push({id:order.productId,name:product?.name||order.productName,archived:true});}
 const unlinked=data.orders.filter(order=>!order.productId);
 const selectedProduct=orderProducts.find(p=>p.id===productId);
 return <section className="preorders" aria-label="受注生産管理">
  {!connected?<p>保存先への接続後に、受注を登録できます。</p>:<>
  <div className="preorder-toolbar"><div className="preorder-intro"><p>注文ごとに、発送までの3つの作業を確認できます。</p><span>{busy?'保存・読み込み中…':ready?'受注データは保存済みです':'受注データを読み込みます'}</span></div><div className="preorder-actions"><button className="secondary small" onClick={read} disabled={busy||Boolean(modal)}><RefreshCw size={15}/>再読み込み</button><button className="primary" disabled={!ready||busy} onClick={()=>setModal({kind:'order'})}><Plus size={16}/>注文を登録</button></div></div>
  {error&&<p className="form-error" role="alert">{error}</p>}
  {!orderProducts.length&&ready&&<p className="preorder-muted">「商品別の収支」で商品を登録し、販売方法を「受注生産」にすると、注文登録で選べます。</p>}
  <div className="preorder-product-groups" aria-label="商品ごとの注文"><button className={productId==='all'?'selected':''} onClick={()=>setProductId('all')}><strong>すべての商品</strong><span>注文{data.orders.length}件 / {data.orders.reduce((sum,o)=>sum+o.quantity,0)}点</span></button>{groups.map(product=>{const orders=data.orders.filter(o=>o.productId===product.id);return <button className={productId===product.id?'selected':''} key={product.id} onClick={()=>setProductId(product.id)}><strong>{product.name}{product.archived?'（販売終了・変更済み）':''}</strong><span>注文{orders.length}件 / {orders.reduce((sum,o)=>sum+o.quantity,0)}点</span></button>;})}{unlinked.length>0&&<button className={productId==='none'?'selected':''} onClick={()=>setProductId('none')}><strong>商品未選択の注文</strong><span>{unlinked.length}件 · 編集から商品を選択できます</span></button>}</div>
  <div className="preorder-filters"><label>商品で絞り込み<select aria-label="商品で絞り込み" value={productId} onChange={e=>setProductId(e.target.value)}><option value="all">すべての商品</option>{groups.map(p=><option key={p.id} value={p.id}>{p.name}{p.archived?'（販売終了・変更済み）':''}</option>)}{unlinked.length>0&&<option value="none">商品未選択の注文</option>}</select></label><label className="search"><Search size={16}/><input type="search" aria-label="受注を検索" placeholder="氏名・商品・サイズで検索" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
  <div className="preorder-board">{preorderStatuses.map(status=>{const orders=filtered.filter(o=>preorderStatus(o)===status.key);return <section className="preorder-column" aria-label={status.label} key={status.key}><header><h2>{status.label} <span>{orders.length}</span></h2><small>{orders.reduce((sum,o)=>sum+o.quantity,0)}点</small></header><div className="preorder-cards">{orders.map(order=><article className="preorder-card" key={order.id} aria-label={`${order.customerName}の注文`}><div className="preorder-card-heading"><h3>{order.customerName}</h3><button className="icon-button" aria-label={`${order.customerName}の注文を編集`} onClick={()=>setModal({kind:'order',item:order})} disabled={busy}><Pencil size={15}/></button></div><p className="preorder-product">{order.productName}</p><p className="preorder-variant">{order.size} / {order.quantity}点</p><div className="preorder-dates"><span>注文 {order.orderedOn}</span><strong className={order.shipBy<today&&status.key!=='shipped'?'overdue':''}>発送期限 {order.shipBy}{order.shipBy<today&&status.key!=='shipped'?' · 期限超過':''}</strong></div><fieldset className="preorder-checks" disabled={busy||!ready}><legend className="sr-only">{order.customerName}の発送作業</legend>{preorderSteps.map(step=><label key={step.key}><input type="checkbox" checked={order[step.key]} onChange={()=>toggle(order,step.key)}/><span>{step.label}</span></label>)}</fieldset><div className="preorder-progress"><span>{completedPreorderSteps(order)} / 3 完了</span><div role="progressbar" aria-label={`${order.customerName}の準備状況`} aria-valuemin="0" aria-valuemax="3" aria-valuenow={completedPreorderSteps(order)}><i style={{width:`${completedPreorderSteps(order)/3*100}%`}}/></div></div></article>)}{!orders.length&&<div className="preorder-empty"><Package size={22}/><p>{ready?'注文はありません':'読み込み待ち'}</p></div>}</div></section>;})}</div>
  <p className="preorder-footnote">チェックなしは準備中、1〜2個で対応中、3個すべてで発送完了になります。チェックを外すと状態も戻ります。</p>
  </>}
  {modal&&<PreorderEditor modal={modal} data={data} products={products} selectedProduct={selectedProduct} googleMode={googleMode} onSave={save} onDelete={remove} onClose={()=>setModal(null)}/>}
 </section>;
}
function PreorderEditor({modal,data,products,selectedProduct,googleMode,onSave,onDelete,onClose}){
 const orderProducts=products.filter(product=>product.mode==='order');
 const [form,setForm]=useState(()=>modal.item?{...modal.item,productId:modal.item.productId||''}:{id:crypto.randomUUID(),campaignId:'',productId:selectedProduct?.id||'',customerName:'',productName:selectedProduct?.name||'',quantity:1,size:'',address:'',orderedOn:japanToday(),shipBy:'',postalCode:'',phone:'',email:'',trackingNumber:'',memo:'',inspected:false,packed:false,shipped:false});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[deleting,setDeleting]=useState(false),lock=useRef(false);
 const set=(key,value)=>setForm(f=>({...f,[key]:value}));
 useEffect(()=>{
  const old=document.body.style.overflow;document.body.style.overflow='hidden';
  const handler=e=>{if(e.key==='Escape'&&!lock.current)onClose();if(e.key==='Tab'){const nodes=[...document.querySelectorAll('.preorder-modal button,.preorder-modal input,.preorder-modal select,.preorder-modal textarea,.preorder-modal summary')].filter(n=>!n.disabled&&n.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',handler);return()=>{document.removeEventListener('keydown',handler);document.body.style.overflow=old;};
 },[onClose]);
 async function submit(event){event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');try{const op=validatePreorderOperation({entity:'orders',action:'upsert',item:{...form,quantity:Number(form.quantity)}},{...data,products});await onSave(op.item);}catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}}
 async function remove(){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await onDelete();}catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}}
 function chooseProduct(id){const product=orderProducts.find(p=>p.id===id);setForm(f=>({...f,productId:id,productName:product?.name||f.productName}));}
 return <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}><section className="modal preorder-modal" role="dialog" aria-modal="true" aria-labelledby="preorder-editor-title"><div className="modal-header"><h2 id="preorder-editor-title">{modal.item?'注文を編集':'注文を登録'}</h2><button className="icon-button" aria-label="閉じる" onClick={onClose} disabled={busy}><X size={22}/></button></div><form onSubmit={submit}><fieldset className="editor-fields" disabled={busy}>
 <label>受注生産の商品<select aria-label="受注生産の商品" required autoFocus value={form.productId} onChange={e=>chooseProduct(e.target.value)}><option value="">商品を選択してください</option>{orderProducts.map(product=><option key={product.id} value={product.id}>{product.name}</option>)}{form.productId&&!orderProducts.some(p=>p.id===form.productId)&&<option value={form.productId}>{products.find(p=>p.id===form.productId)?.name||modal.item?.productName}（販売終了・変更済み）</option>}</select></label>
 <p className="form-help">「商品別の収支」で販売方法を「受注生産」にした商品から選びます。</p>
 <label>氏名<input required maxLength="100" autoComplete="off" value={form.customerName} onChange={e=>set('customerName',e.target.value)}/></label>
 <label>商品（色を含む）<input required maxLength="150" placeholder="例：Tシャツ ブラック" value={form.productName} onChange={e=>set('productName',e.target.value)}/></label><p className="form-help">選択した商品名に、色などの仕様を追記できます。分類先は選択した商品です。</p>
 <div className="form-grid"><label>数量<input required type="number" min="1" max="999999" value={form.quantity} onChange={e=>set('quantity',e.target.value)}/></label><label>サイズ<input required maxLength="50" placeholder="例：M / フリー" value={form.size} onChange={e=>set('size',e.target.value)}/></label></div>
 <label>住所<textarea aria-label="住所" required rows="3" maxLength="500" placeholder="都道府県から建物名・部屋番号まで" value={form.address} onChange={e=>set('address',e.target.value)}/></label>
 <div className="form-grid"><label>注文日<input required type="date" value={form.orderedOn} onChange={e=>set('orderedOn',e.target.value)}/></label><label>発送期限<input required type="date" min={form.orderedOn||undefined} value={form.shipBy} onChange={e=>set('shipBy',e.target.value)}/></label></div>
 <details className="preorder-optional"><summary>連絡先・追跡番号・メモ（任意）</summary><div className="preorder-optional-fields"><label>郵便番号<input maxLength="20" autoComplete="off" value={form.postalCode} onChange={e=>set('postalCode',e.target.value)}/></label><label>電話番号<input type="tel" maxLength="40" autoComplete="off" value={form.phone} onChange={e=>set('phone',e.target.value)}/></label><label>メール<input type="email" maxLength="254" autoComplete="off" value={form.email} onChange={e=>set('email',e.target.value)}/></label><label>追跡番号<input maxLength="100" value={form.trackingNumber} onChange={e=>set('trackingNumber',e.target.value)}/></label><label>メモ<textarea aria-label="メモ" rows="3" maxLength="1000" value={form.memo} onChange={e=>set('memo',e.target.value)}/></label></div></details>
 {error&&<p className="form-error" role="alert">{error}</p>}
 <div className="modal-footer">{modal.item&&<button type="button" className="delete-button" onClick={()=>setDeleting(true)}><Trash2 size={16}/>削除</button>}<button type="button" className="secondary" onClick={onClose}>キャンセル</button><button type="submit" className="primary"><Check size={16}/>{busy?'保存中…':modal.item?'変更を保存':'登録する'}</button></div>
 {deleting&&<div className="delete-confirm"><p>この注文を削除しますか？</p><p>{googleMode?'保存先スプレッドシートの該当行からも削除します。':'このブラウザーの受注データから削除します。'}この操作は取り消せません。</p><button type="button" className="secondary" onClick={()=>setDeleting(false)}>戻る</button><button type="button" className="danger" onClick={remove}>削除する</button></div>}
 </fieldset></form></section></div>;
}
