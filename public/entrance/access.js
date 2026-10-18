const login=document.querySelector('#login'),success=document.querySelector('#success'),message=document.querySelector('#message'),input=document.querySelector('#password'),submit=document.querySelector('#submit');
let expiry;
function show(authenticated){login.hidden=authenticated;success.hidden=!authenticated;message.textContent='';message.className='';input.value='';clearTimeout(expiry);if(authenticated)expiry=setTimeout(check,60*60*1000);}
function error(text){message.textContent=text;message.className='error';}
async function request(method='GET',password){const response=await fetch('/api/access',{method,credentials:'same-origin',cache:'no-store',headers:method==='POST'?{'Content-Type':'application/json'}:{},body:method==='POST'?JSON.stringify({password}):undefined});const result=await response.json();if(!response.ok)throw new Error(result.error||'時間をおいてお試しください。');return result;}
async function check(){try{show((await request()).authenticated);}catch(e){show(false);error(e.message||'通信できませんでした。再読み込みしてください。');}}
document.querySelector('#form').addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;submit.textContent='確認しています…';try{show((await request('POST',input.value)).authenticated);}catch(e){error(e.message);input.value='';input.focus();}finally{submit.disabled=false;submit.innerHTML='確認する <span aria-hidden="true">→</span>';}});
document.querySelector('#logout').addEventListener('click',async e=>{e.target.disabled=true;try{await request('DELETE');show(false);input.focus();}catch(err){error(err.message);}finally{e.target.disabled=false;}});
window.addEventListener('pageshow',e=>{if(e.persisted)check();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
check();
