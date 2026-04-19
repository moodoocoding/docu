const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = 'C:\\Users\\panth\\Documents\\바이브 코딩\\학교문서';
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, 'http://localhost:3000');
  const pathname = decodeURIComponent(parsedUrl.pathname);
  const filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath).slice(1);
    const ct = { html: 'text/html', css: 'text/css', js: 'text/javascript' }[ext] || 'text/plain';
    res.writeHead(200, { 'Content-Type': ct + ';charset=utf-8' });
    res.end(data);
  });
});
server.listen(3000, () => console.log('Server: http://localhost:3000'));
