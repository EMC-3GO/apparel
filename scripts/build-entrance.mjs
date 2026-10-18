import {mkdir,copyFile} from 'node:fs/promises';
const root=new URL('../dist/',import.meta.url);
// Package Apps Script first; then replace only the Vercel homepage.
await mkdir(new URL('legacy/',root),{recursive:true});
await copyFile(new URL('index.html',root),new URL('legacy/index.html',root));
await copyFile(new URL('../public/entrance/index.html',import.meta.url),new URL('index.html',root));
console.log('Vercel entrance packaged; previous local ledger preserved at /legacy/');
