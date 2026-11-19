const CACHE = "abu-oreiban-v79-uiverse-inspired";
const SHELL = ["./assets/moood-v79-interactions.css","./", "./index.html", "./app.js", "./manifest.webmanifest", "./assets/fonts/MF_Tahadath_Regular.woff2", "./assets/fonts/MF_Tahadath_Bold.woff2","./scripts/01-login-log-module.js","./scripts/02-family-whatsapp-admin-module.js","./scripts/03-home-phase2-behavior.js","./scripts/04-home-phase3-analysis-behavior.js","./scripts/05-home-phase4-readonly-health.js","./scripts/06-inline.js","./scripts/07-moood-interaction-phase2-behavior.js","./scripts/08-moood-interaction-phase3-behavior.js","./scripts/09-moood-interaction-phase4-behavior.js"];
self.addEventListener("install", event => {event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener("activate", event => {event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('abu-oreiban-')&&k!==CACHE).map(k=>caches.delete(k)));if(self.registration.navigationPreload){try{await self.registration.navigationPreload.enable()}catch(e){}}await self.clients.claim();const clients=await self.clients.matchAll({type:'window'});clients.forEach(c=>c.postMessage({type:'APP_UPDATE_AVAILABLE',version:CACHE}));})());});
self.addEventListener("fetch", event => {
 const req=event.request;if(req.method!=="GET")return;
 const url=new URL(req.url);if(url.origin!==self.location.origin)return;
 // Never cache data endpoints, requests with query parameters other than versioned static assets, or API calls.
 if(url.pathname.includes('/api/')||url.pathname.startsWith('/sync')||req.headers.has('authorization'))return;
 const path=url.pathname;
 const shell= req.mode==='navigate'||SHELL.some(s=>new URL(s,self.registration.scope).pathname===path);
 if(shell){event.respondWith((async()=>{const cache=await caches.open(CACHE);const key=req.mode==='navigate'?new URL('./index.html',self.registration.scope):new URL(path,self.location.origin);const cached=await cache.match(key);if(cached)return cached;try{const response=await fetch(req);if(response.ok)event.waitUntil(cache.put(key,response.clone()));return response}catch(e){return (await cache.match('./index.html'))||Response.error()}})());return}
 if(!/\.(?:css|js|woff2?|ttf|svg|png|jpg|jpeg|webp|ico|json)$/i.test(path))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(req);const network=fetch(req).then(r=>{if(r.ok)event.waitUntil(cache.put(req,r.clone()));return r}).catch(()=>null);return cached||(await network)||Response.error()})());
});
