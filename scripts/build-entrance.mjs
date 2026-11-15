import {mkdir,copyFile} from 'node:fs/promises';
const root=new URL('../dist/',import.meta.url);
await mkdir(new URL('legacy/',root),{recursive:true});
await copyFile(new URL('index.html',root),new URL('legacy/index.html',root));
console.log('Public demo packaged at /; existing browser version available at /legacy/');
