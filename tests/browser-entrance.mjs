import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createAccessHandler,TARGET_URL} from '../server/access.js';
const access=createAccessHandler();
const server=createServer(async(req,res)=>{try{if(req.url.startsWith('/api/access'))return access(req,res);const path=req.url==='/'?'/entrance/index.html':req.url;if(!['/entrance/index.html','/entrance/style.css','/anffel-logo.png'].includes(path)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',path.endsWith('.css')?'text/css':path.endsWith('.png')?'image/png':'text/html');res.end(await readFile(new URL('../public'+path,import.meta.url)));}catch{res.statusCode=500;res.end();}});
await new Promise(resolve=>server.listen(4178,'localhost',resolve));const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();await page.goto('http://localhost:4178/');await page.getByRole('link',{name:'GoogleでANFFELを開く'}).waitFor();assert.equal(await page.locator('input[type=password]').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const response=await context.request.get('http://localhost:4178/api/access',{maxRedirects:0});assert.equal(response.status(),303);assert.equal(response.headers().location,TARGET_URL);console.log('Entrance browser passed: Google handoff, fixed redirect and mobile layout');}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
