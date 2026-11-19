
(function(){'use strict';
 // Display-only observer: never calls APIs, changes records or alters existing render functions.
 const ready=()=>{
  const panel=document.getElementById('homeReadiness'),label=document.getElementById('homeReadinessText'),stamp=document.getElementById('homeReadinessTime');
  if(!panel||!label||!stamp)return;
  const ids=['sFamilies','sPeople','sInside','sComplete'];
  const els=ids.map(id=>document.getElementById(id));
  const hasNumber=el=>el&&/[0-9٠-٩۰-۹]/.test(el.textContent||'');
  let lastSnapshot='',lastValidAt=null;
  const refresh=()=>{
   const online=navigator.onLine;
   const valid=els.every(hasNumber);
   const snapshot=els.map(el=>(el?.textContent||'').trim()).join('|');
   if(valid&&snapshot!==lastSnapshot){lastSnapshot=snapshot;lastValidAt=new Date();}
   const status=!online?'offline':valid?'ready':'waiting';panel.dataset.status=status;
   label.textContent=!online?'الجهاز غير متصل بالإنترنت؛ قد تكون الأرقام المعروضة محلية أو قديمة':valid?'الإحصائيات ظاهرة في الواجهة (لا يؤكد هذا نجاح المزامنة السحابية)':'بانتظار ظهور الإحصائيات؛ تحقق من تحميل البيانات';
   stamp.textContent=lastValidAt?'آخر تغيّر ظاهر: '+lastValidAt.toLocaleTimeString('ar-PS',{hour:'2-digit',minute:'2-digit'}):'لم يُرصد تحديث بعد';
  };
  let pending=false;const schedule=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;refresh()})};
  const observer=new MutationObserver(schedule);
  els.filter(Boolean).forEach(el=>observer.observe(el,{childList:true,characterData:true,subtree:true}));
  window.addEventListener('online',schedule);window.addEventListener('offline',schedule);
  refresh();
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
