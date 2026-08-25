// Demo host: starts an ephemeral local Hardhat chain and exposes it only through /rpc.
// This is intentionally not a production blockchain architecture.
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');

const root = __dirname;
const rpcPort = 8545;
const app = express();
let chainReady = false;

function run(command, args) {
  return spawn(command, args, { cwd: root, shell: process.platform === 'win32', stdio: 'inherit' });
}
function rpcRequest(method = 'GET') {
  return new Promise(resolve => {
    const request = http.request({ hostname: '127.0.0.1', port: rpcPort, path: '/', method }, response => resolve(response.statusCode && response.statusCode < 500));
    request.on('error', () => resolve(false)); request.end();
  });
}
async function bootChain() {
  const hardhat = run('npx', ['hardhat', 'node', '--hostname', '127.0.0.1']);
  process.on('exit', () => hardhat.kill());
  for (let count = 0; count < 60; count += 1) {
    if (await rpcRequest()) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!await rpcRequest()) throw new Error('Hardhat node did not start');
  await new Promise((resolve, reject) => {
    const deploy = run('npx', ['hardhat', 'run', 'scripts/deploy.js', '--network', 'localhost']);
    deploy.on('exit', code => code === 0 ? resolve() : reject(new Error(`Deploy failed with code ${code}`)));
  });
  chainReady = true;
}

app.get('/health', (_request, response) => response.status(chainReady ? 200 : 503).json({ chainReady }));
app.get('/deployment.json', (_request, response) => response.sendFile(path.join(root, 'deployment.json')));
app.use('/rpc', express.raw({ type: '*/*' }), (request, response) => {
  const proxy = http.request({ hostname: '127.0.0.1', port: rpcPort, path: '/', method: request.method, headers: { 'content-type': request.headers['content-type'] || 'application/json' } }, upstream => {
    response.status(upstream.statusCode || 502); upstream.pipe(response);
  });
  proxy.on('error', () => response.status(503).json({ error: 'Local demo chain is starting' }));
  proxy.end(request.body);
});
app.use(express.static(path.join(root, 'frontend', 'dist')));
app.get('*', (_request, response) => response.sendFile(path.join(root, 'frontend', 'dist', 'index.html')));

bootChain().then(() => app.listen(process.env.PORT || 10000, '0.0.0.0', () => console.log('LegacyChain demo host is ready.'))).catch(error => { console.error(error); process.exit(1); });
