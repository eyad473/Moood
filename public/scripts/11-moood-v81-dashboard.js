/* V81 dashboard reveal: visual-only, never modifies app state or records. */
(function(){'use strict';
function init(){
 const dashboard=document.getElementById('dashboard');if(!dashboard)return;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 let activeAnimations=[], timer=0, wasActive=false, lastRun=0;
 function clear(){clearTimeout(timer);activeAnimations.forEach(a=>{try{a.cancel()}catch(_){}});activeAnimations=[];}
 function reveal(){
  if(reduced.matches||!dashboard.classList.contains('active')||!dashboard.getClientRects().length)return;
  clear();lastRun=Date.now();
  const cards=[...dashboard.querySelectorAll('.grid.stats > .stat')].slice(0,8);
  const charts=[...dashboard.querySelectorAll('.dashboard-charts > .chart-card')].slice(0,4);
  if(!Element.prototype.animate)return;
  cards.forEach((el,i)=>{
   const a=el.animate([{opacity:0,transform:'translate3d(0,32px,0) scale(.94)'},{opacity:1,transform:'translate3d(0,0,0) scale(1)'}],{duration:640,delay:i*125,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'});
   activeAnimations.push(a);
  });
  charts.forEach((el,i)=>{
   const a=el.animate([{opacity:0,transform:'translate3d(0,22px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:520,delay:240+i*100,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'});
   activeAnimations.push(a);
  });
 }
 function onViewChange(){const now=dashboard.classList.contains('active');if(now&&!wasActive){timer=setTimeout(reveal,50)}else if(!now&&wasActive){clear()}wasActive=now;}
 new MutationObserver(onViewChange).observe(dashboard,{attributes:true,attributeFilter:['class']});
 wasActive=dashboard.classList.contains('active');
 // First load: wait for startup screen to leave, then play once.
 if(wasActive){let started=false;const splash=document.getElementById('abu-startup');
  function ready(){if(started)return;if(splash&&splash.isConnected&&getComputedStyle(splash).display!=='none'&&getComputedStyle(splash).visibility!=='hidden'&&Number(getComputedStyle(splash).opacity)>0)return;started=true;reveal();observer.disconnect();}
  const observer=new MutationObserver(ready);if(splash)observer.observe(splash,{attributes:true,attributeFilter:['class','style','hidden']});
  setTimeout(()=>{if(!started){started=true;observer.disconnect();reveal()}},2400);
  setTimeout(ready,80);
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear()});
 reduced.addEventListener?.('change',()=>{if(reduced.matches)clear()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
