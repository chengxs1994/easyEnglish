import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.mp3':'audio/mpeg','.mp4':'video/mp4','.webm':'video/webm','.srt':'text/plain; charset=utf-8','.svg':'image/svg+xml'};
/** 提供仅本机可访问的静态文件服务，并支持媒体 Range 请求。 */
async function serve(req,res) {
 try {
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)) {res.writeHead(403).end(); return;}
  const info=await stat(file); if(!info.isFile()) throw new Error('not file');
  const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache'};
  let start=0,end=info.size-1,status=200;
  if(req.headers.range) {
   const match=req.headers.range.match(/^bytes=(\d+)-(\d*)$/);
   if(!match) {res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}
   start=+match[1];end=match[2]?Math.min(+match[2],end):end;
   if(start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}
   status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
  }
  headers['Content-Length']=end-start+1; res.writeHead(status,headers);
  if(req.method==='HEAD')res.end();else createReadStream(file,{start,end}).on('error',()=>res.destroy()).pipe(res);
 } catch {res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('页面不存在，请返回 http://127.0.0.1:8765');}
}
http.createServer(serve).listen(8765,'127.0.0.1',()=>console.log('easyEnglish: http://127.0.0.1:8765'));
