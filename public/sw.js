const CACHE = "abu-oreiban-v84-network-first";
const SHELL = ["./", "./index.html", "./app.js?v=84", "./manifest.webmanifest", "./assets/fonts/MF_Tahadath_Regular.woff2", "./assets/fonts/MF_Tahadath_Bold.woff2", "./assets/moood-v79-interactions.css", "./assets/moood-v80-motion.css", "./scripts/01-login-log-module.js?v=84", "./scripts/02-family-whatsapp-admin-module.js?v=84", "./scripts/03-home-phase2-behavior.js?v=84", "./scripts/04-home-phase3-analysis-behavior.js?v=84", "./scripts/05-home-phase4-readonly-health.js?v=84", "./scripts/07-moood-interaction-phase2-behavior.js?v=84", "./scripts/08-moood-interaction-phase3-behavior.js?v=84", "./scripts/09-moood-interaction-phase4-behavior.js?v=84", "./scripts/10-moood-v80-motion.js?v=84", "./scripts/11-moood-v81-dashboard.js?v=84"];
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE);await Promise.allSettled(SHELL.map(async path=>{const req=new Request(new URL(path,self.registration.scope),{cache:'reload'});const response=await fetch(req);if(response.ok)await cache.put(req,response)}));await self.skipWaiting()})())});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})())});
function isAsset(path){return /\.(?:js|css|woff2?|ttf|svg|png|jpg|jpeg|webp|ico)$/i.test(path)}
function networkFirst(request,event){return (async()=>{const cache=await caches.open(CACHE);let timer;try{const response=await Promise.race([fetch(request),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('network timeout')),4000)})]);if(response.ok)event.waitUntil(cache.put(request,response.clone()));return response}catch(e){return (await cache.match(request))||Response.error()}finally{clearTimeout(timer)}})()}
function cacheFirst(request,event){return (async()=>{const cache=await caches.open(CACHE);const hit=await cache.match(request);if(hit)return hit;try{const response=await fetch(request);if(response.ok)event.waitUntil(cache.put(request,response.clone()));return response}catch(e){return Response.error()}})()}
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url);if(url.origin!==self.location.origin)return;
 if(url.pathname.startsWith('/sync')||url.pathname.startsWith('/api/')||url.pathname.startsWith('/staff/')||request.headers.has('authorization'))return;
 const path=url.pathname;
 if(request.mode==='navigate'||path.endsWith('/index.html')||path.endsWith('/app.js')||path.includes('/scripts/')&&path.endsWith('.js')||path.endsWith('.css')){event.respondWith(networkFirst(request,event));return;}
 if(/\.(?:woff2?|ttf|svg|png|jpg|jpeg|webp|ico)$/i.test(path)){event.respondWith(cacheFirst(request,event));return;}
});
