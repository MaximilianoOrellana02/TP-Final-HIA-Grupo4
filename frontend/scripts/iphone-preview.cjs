const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const raiz = path.resolve(__dirname, '../dist/soderia-frontend/browser');
const apiProduccion = 'https://agua-y-soda-juuy-backend.onrender.com/api';
const puerto = 4200;

// La compilación conserva el entorno de producción. Solo en esta vista previa,
// la API pasa por el mismo origen para que funcione en el teléfono.
let archivosActualizados = 0;
for (const nombre of fs.readdirSync(raiz)) {
  if (!nombre.endsWith('.js')) continue;
  const archivo = path.join(raiz, nombre);
  const contenido = fs.readFileSync(archivo, 'utf8');
  if (!contenido.includes(apiProduccion)) continue;
  fs.writeFileSync(archivo, contenido.replaceAll(apiProduccion, '/api'));
  archivosActualizados++;
}

if (archivosActualizados === 0) {
  throw new Error('No se encontró la URL de la API en la compilación. No se inicia una vista previa sin datos.');
}

const tipos = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
  if (/^\/api(?:\/|\?|$)/.test(req.url || '')) {
    const destino = http.request({
      hostname: '127.0.0.1',
      port: 3001,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: '127.0.0.1:3001' },
    }, (respuesta) => {
      res.writeHead(respuesta.statusCode || 502, respuesta.headers);
      respuesta.pipe(res);
    });
    destino.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('La API local no está disponible en el puerto 3001.');
    });
    req.pipe(destino);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }

  let ruta;
  try {
    ruta = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }

  let archivo = path.resolve(raiz, `.${ruta}`);
  if (archivo !== raiz && !archivo.startsWith(raiz + path.sep)) {
    res.writeHead(403).end();
    return;
  }

  try {
    if (!fs.statSync(archivo).isFile()) archivo = path.join(raiz, 'index.html');
  } catch {
    if (path.extname(ruta)) {
      res.writeHead(404).end();
      return;
    }
    archivo = path.join(raiz, 'index.html');
  }

  res.writeHead(200, {
    'Content-Type': tipos[path.extname(archivo)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(archivo).pipe(res);
}).listen(puerto, '0.0.0.0', () => {
  const direcciones = Object.values(os.networkInterfaces())
    .flat()
    .filter((red) => red && red.family === 'IPv4' && !red.internal)
    .map((red) => `http://${red.address}:${puerto}/`);
  console.log('Vista previa para el iPhone:', direcciones.join(' | '));
});
