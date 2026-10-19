import React,{useEffect,useRef,useState} from 'react';
import {Plus,Pencil,X,Check,Trash2,RefreshCw,Search,Package,ChevronDown} from 'lucide-react';
import {preorderSteps,preorderStatuses,preorderStatus,completedPreorderSteps,japanToday,campaignStatus,validatePreorderOperation} from './preorder.js';
import {LocalPreorderStore,AppsScriptPreorderStore} from './storage/preorder.js';
import './preorder.css';
const blankData=()=>({orders:[],campaigns:[]});
export default function PreorderManager({googleMode,products,connected}){
 const [store]=useState(()=>googleMode?new AppsScriptPreorderStore():new LocalPreorderStore());
 const [data,setData]=useState(blankData),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[modal,setModal]=useState(null),[query,setQuery]=useState(''),[campaignId,setCampaignId]=useState('all');
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
 async function save(item){const entity=modal.kind==='order'?'orders':'campaigns';await persist({entity,action:'upsert',item});setModal(null);}
 async function remove(){const entity=modal.kind==='order'?'orders':'campaigns';await persist({entity,action:'delete',id:modal.item.id});if(entity==='campaigns'&&campaignId===modal.item.id)setCampaignId('all');setModal(null);}
 async function toggle(order,key){try{await persist({entity:'orders',action:'upsert',item:{...order,[key]:!order[key]}});}catch(e){setError(e.message+' チェックをもう一度操作して再試行できます。');}}
 const filtered=data.orders.filter(order=>(campaignId==='all'||(campaignId==='none'?!order.campaignId:order.campaignId===campaignId))&&[order.customerName,order.productName,order.size,order.trackingNumber].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.shipBy.localeCompare(b.shipBy)||a.orderedOn.localeCompare(b.orderedOn)||a.id.localeCompare(b.id));
 const selectedCampaign=data.campaigns.find(c=>c.id===campaignId);
 return <section className="preorders" aria-label="受注生産管理">
  {!connected?<p>保存先への接続後に、受注を登録できます。</p>:<>
  <div className="preorder-toolbar"><div className="preorder-intro"><p>注文ごとに、発送までの3つの作業を確認できます。</p><span>{busy?'保存・読み込み中…':ready?'受注データは保存済みです':'受注データを読み込みます'}</span></div><div className="preorder-actions"><button className="secondary small" onClick={read} disabled={busy||Boolean(modal)}><RefreshCw size={15}/>再読み込み</button><button className="primary" disabled={!ready||busy} onClick={()=>setModal({kind:'order'})}><Plus size={16}/>注文を登録</button></div></div>
  {error&&<p className="form-error" role="alert">{error}</p>}
  <details className="campaigns-panel"><summary>予約受付の管理 <span>{data.campaigns.length}件</span><ChevronDown size={16}/></summary><div className="campaigns-body"><div className="section-heading"><p>予約期間と発送予定日を受付枠ごとに管理します。</p><button className="secondary small" disabled={!ready||busy} onClick={()=>setModal({kind:'campaign'})}><Plus size={15}/>受付枠を作成</button></div>{!data.campaigns.length?<p className="preorder-muted">受付枠を作成すると、注文を予約回ごとにまとめられます。</p>:<ul className="campaign-list">{data.campaigns.map(c=>{const orders=data.orders.filter(o=>o.campaignId===c.id);return <li key={c.id}><div><strong>{c.name}</strong><span>{campaignStatus(c,today)} · {c.startsOn} 〜 {c.endsOn}</span><small>発送予定 {c.shipBy} · 注文{orders.length}件 / {orders.reduce((sum,o)=>sum+o.quantity,0)}点</small></div><button className="icon-button" aria-label={`${c.name}の受付枠を編集`} onClick={()=>setModal({kind:'campaign',item:c})} disabled={busy}><Pencil size={16}/></button></li>;})}</ul>}</div></details>
  <div className="preorder-filters"><label>予約受付<select aria-label="予約受付" value={campaignId} onChange={e=>setCampaignId(e.target.value)}><option value="all">すべての受付</option><option value="none">受付枠なし</option>{data.campaigns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="search"><Search size={16}/><input type="search" aria-label="受注を検索" placeholder="氏名・商品・サイズで検索" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
  {selectedCampaign&&<p className="preorder-period">{selectedCampaign.name}：予約 {selectedCampaign.startsOn} 〜 {selectedCampaign.endsOn} / 発送予定 {selectedCampaign.shipBy}</p>}
  <div className="preorder-board">{preorderStatuses.map(status=>{const orders=filtered.filter(o=>preorderStatus(o)===status.key);return <section className="preorder-column" aria-label={status.label} key={status.key}><header><h2>{status.label} <span>{orders.length}</span></h2><small>{orders.reduce((sum,o)=>sum+o.quantity,0)}点</small></header><div className="preorder-cards">{orders.map(order=><article className="preorder-card" key={order.id} aria-label={`${order.customerName}の注文`}><div className="preorder-card-heading"><h3>{order.customerName}</h3><button className="icon-button" aria-label={`${order.customerName}の注文を編集`} onClick={()=>setModal({kind:'order',item:order})} disabled={busy}><Pencil size={15}/></button></div><p className="preorder-product">{order.productName}</p><p className="preorder-variant">{order.size} / {order.quantity}点</p>{order.campaignId&&<p className="preorder-campaign">{data.campaigns.find(c=>c.id===order.campaignId)?.name}</p>}<div className="preorder-dates"><span>注文 {order.orderedOn}</span><strong className={order.shipBy<today&&status.key!=='shipped'?'overdue':''}>発送期限 {order.shipBy}{order.shipBy<today&&status.key!=='shipped'?' · 期限超過':''}</strong></div><fieldset className="preorder-checks" disabled={busy||!ready}><legend className="sr-only">{order.customerName}の発送作業</legend>{preorderSteps.map(step=><label key={step.key}><input type="checkbox" checked={order[step.key]} onChange={()=>toggle(order,step.key)}/><span>{step.label}</span></label>)}</fieldset><div className="preorder-progress"><span>{completedPreorderSteps(order)} / 3 完了</span><div role="progressbar" aria-label={`${order.customerName}の準備状況`} aria-valuemin="0" aria-valuemax="3" aria-valuenow={completedPreorderSteps(order)}><i style={{width:`${completedPreorderSteps(order)/3*100}%`}}/></div></div></article>)}{!orders.length&&<div className="preorder-empty"><Package size={22}/><p>{ready?'注文はありません':'読み込み待ち'}</p></div>}</div></section>;})}</div>
  <p className="preorder-footnote">チェックなしは準備中、1〜2個で対応中、3個すべてで発送完了になります。チェックを外すと状態も戻ります。</p>
  </>}
  {modal&&<PreorderEditor modal={modal} data={data} products={products} selectedCampaign={selectedCampaign} googleMode={googleMode} onSave={save} onDelete={remove} onClose={()=>setModal(null)}/>}
 </section>;
}
function PreorderEditor({modal,data,products,selectedCampaign,googleMode,onSave,onDelete,onClose}){
 const isOrder=modal.kind==='order';
 const [form,setForm]=useState(()=>modal.item?{...modal.item}:isOrder?{id:crypto.randomUUID(),campaignId:selectedCampaign?.id||'',customerName:'',productName:'',quantity:1,size:'',address:'',orderedOn:japanToday(),shipBy:selectedCampaign?.shipBy||'',postalCode:'',phone:'',email:'',trackingNumber:'',memo:'',inspected:false,packed:false,shipped:false}:{id:crypto.randomUUID(),name:'',startsOn:japanToday(),endsOn:'',shipBy:'',memo:''});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[deleting,setDeleting]=useState(false),lock=useRef(false);
 const set=(key,value)=>setForm(f=>({...f,[key]:value}));
 const linkedOrders=!isOrder&&modal.item?data.orders.filter(o=>o.campaignId===modal.item.id).length:0;
 useEffect(()=>{
  const old=document.body.style.overflow;document.body.style.overflow='hidden';
  const handler=e=>{if(e.key==='Escape'&&!lock.current)onClose();if(e.key==='Tab'){const nodes=[...document.querySelectorAll('.preorder-modal button,.preorder-modal input,.preorder-modal select,.preorder-modal textarea,.preorder-modal summary')].filter(n=>!n.disabled&&n.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',handler);return()=>{document.removeEventListener('keydown',handler);document.body.style.overflow=old;};
 },[onClose]);
 async function submit(event){event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');try{const op=validatePreorderOperation({entity:isOrder?'orders':'campaigns',action:'upsert',item:{...form,...(isOrder?{quantity:Number(form.quantity)}:{})}},data);await onSave(op.item);}catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}}
 async function remove(){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await onDelete();}catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}}
 function chooseCampaign(id){const campaign=data.campaigns.find(c=>c.id===id);setForm(f=>({...f,campaignId:id,shipBy:campaign?.shipBy||f.shipBy}));}
 return <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}><section className="modal preorder-modal" role="dialog" aria-modal="true" aria-labelledby="preorder-editor-title"><div className="modal-header"><h2 id="preorder-editor-title">{isOrder?(modal.item?'注文を編集':'注文を登録'):(modal.item?'予約受付を編集':'受付枠を作成')}</h2><button className="icon-button" aria-label="閉じる" onClick={onClose} disabled={busy}><X size={22}/></button></div><form onSubmit={submit}><fieldset className="editor-fields" disabled={busy}>
 {isOrder?<>
 <label>予約受付 <span className="optional">任意</span><select aria-label="注文の予約受付" value={form.campaignId} onChange={e=>chooseCampaign(e.target.value)}><option value="">受付枠なし</option>{data.campaigns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <label>氏名<input autoFocus required maxLength="100" autoComplete="off" value={form.customerName} onChange={e=>set('customerName',e.target.value)}/></label>
 <label>商品（色を含む）<input required maxLength="150" list="preorder-products" placeholder="例：Tシャツ ブラック" value={form.productName} onChange={e=>set('productName',e.target.value)}/><datalist id="preorder-products">{products.map(p=><option key={p.id} value={p.name}/>)}</datalist></label><p className="form-help">商品名に色も含めて入力してください。登録済みの商品名も選べます。</p>
 <div className="form-grid"><label>数量<input required type="number" min="1" max="999999" value={form.quantity} onChange={e=>set('quantity',e.target.value)}/></label><label>サイズ<input required maxLength="50" placeholder="例：M / フリー" value={form.size} onChange={e=>set('size',e.target.value)}/></label></div>
 <label>住所<textarea aria-label="住所" required rows="3" maxLength="500" placeholder="都道府県から建物名・部屋番号まで" value={form.address} onChange={e=>set('address',e.target.value)}/></label>
 <div className="form-grid"><label>注文日<input required type="date" value={form.orderedOn} onChange={e=>set('orderedOn',e.target.value)}/></label><label>発送期限<input required type="date" min={form.orderedOn||undefined} value={form.shipBy} onChange={e=>set('shipBy',e.target.value)}/></label></div>
 <details className="preorder-optional"><summary>連絡先・追跡番号・メモ（任意）</summary><div className="preorder-optional-fields"><label>郵便番号<input maxLength="20" autoComplete="off" value={form.postalCode} onChange={e=>set('postalCode',e.target.value)}/></label><label>電話番号<input type="tel" maxLength="40" autoComplete="off" value={form.phone} onChange={e=>set('phone',e.target.value)}/></label><label>メール<input type="email" maxLength="254" autoComplete="off" value={form.email} onChange={e=>set('email',e.target.value)}/></label><label>追跡番号<input maxLength="100" value={form.trackingNumber} onChange={e=>set('trackingNumber',e.target.value)}/></label><label>メモ<textarea aria-label="メモ" rows="3" maxLength="1000" value={form.memo} onChange={e=>set('memo',e.target.value)}/></label></div></details>
 </>:<>
 <label>受付名<input autoFocus required maxLength="100" placeholder="例：第1回 Tシャツ予約" value={form.name} onChange={e=>set('name',e.target.value)}/></label>
 <div className="form-grid"><label>予約開始日<input required type="date" value={form.startsOn} onChange={e=>set('startsOn',e.target.value)}/></label><label>予約締切日<input required type="date" min={form.startsOn||undefined} value={form.endsOn} onChange={e=>set('endsOn',e.target.value)}/></label></div>
 <label>発送予定日<input required type="date" min={form.endsOn||undefined} value={form.shipBy} onChange={e=>set('shipBy',e.target.value)}/></label><p className="form-help">注文登録時の発送期限の初期値になります。受付枠を後で変更しても、登録済み注文の発送期限は変わりません。</p>
 <label>メモ <span className="optional">任意</span><textarea aria-label="メモ" rows="3" maxLength="1000" value={form.memo} onChange={e=>set('memo',e.target.value)}/></label>
 </>}
 {error&&<p className="form-error" role="alert">{error}</p>}
 <div className="modal-footer">{modal.item&&<button type="button" className="delete-button" onClick={()=>setDeleting(true)}><Trash2 size={16}/>削除</button>}<button type="button" className="secondary" onClick={onClose}>キャンセル</button><button type="submit" className="primary"><Check size={16}/>{busy?'保存中…':modal.item?'変更を保存':'登録する'}</button></div>
 {deleting&&<div className="delete-confirm"><p>{isOrder?'この注文を削除しますか？':'この受付枠を削除しますか？'}</p>{linkedOrders?<p>この受付枠には注文が{linkedOrders}件あります。先に注文の受付枠を変更するか、不要な注文を削除してください。</p>:<p>{googleMode?'保存先スプレッドシートの該当行からも削除します。':'このブラウザーの受注データから削除します。'}この操作は取り消せません。</p>}<button type="button" className="secondary" onClick={()=>setDeleting(false)}>戻る</button><button type="button" className="danger" disabled={linkedOrders>0} onClick={remove}>削除する</button></div>}
 </fieldset></form></section></div>;
}
