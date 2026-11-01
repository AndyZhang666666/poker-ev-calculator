import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../out');
const base='/poker-ev-calculator';
const port=Number(process.env.PORT||8854);
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.txt':'text/plain'};
http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/'||pathname===base){res.writeHead(302,{Location:base+'/'});res.end();return;}
    if(!pathname.startsWith(base+'/')){res.writeHead(404);res.end('Not found');return;}
    let file=path.resolve(root,'.'+pathname.slice(base.length));
    if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');
    const body=await fs.readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(body);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log('Poker Lab: http://127.0.0.1:'+port+base+'/'));
