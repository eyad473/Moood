
(function(){'use strict';
function setup(){
 const toast=document.getElementById('toast');
 if(toast){
  toast.setAttribute('aria-atomic','true');
  toast.setAttribute('tabindex','0');
  // Observe only text and class changes; never intercept the existing toast function.
  let pending=false;
  const update=()=>{
   pending=false;
   const msg=(toast.textContent||'').trim();
   const error=/تعذر|فشل|خطأ|غير متاح|لم يتم|error|failed/i.test(msg);
   const warning=!error&&/تنبيه|تحذير|انتبه|يرجى|warning/i.test(msg);
   const success=!error&&!warning&&/تم |نجاح|بنجاح|اكتمل|success/i.test(msg);
   toast.classList.toggle('mo-toast-error',error);
   toast.classList.toggle('mo-toast-warning',warning);
   toast.classList.toggle('mo-toast-success',success);
   toast.setAttribute('role',error?'alert':'status');
   toast.setAttribute('aria-live',error?'assertive':'polite');
  };
  new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(update)}}).observe(toast,{childList:true,subtree:true,characterData:true});
  update();
  toast.addEventListener('keydown',e=>{if(e.key==='Escape'&&toast.classList.contains('show')){toast.click();e.preventDefault()}});
 }
 // Visual indicators only: do not debounce or replace application search listeners.
 const fields=document.querySelectorAll('.filters input,.filters select,.dist-filters input,.dist-filters select');
 for(const field of fields){
  const sync=()=>{const value=String(field.value||'').trim();const defaultValue=field.tagName==='SELECT'?(field.options[0]?.value||''):'';field.classList.toggle('mo-filter-active',value!==''&&value!==defaultValue)};
  field.addEventListener('input',sync,{passive:true});field.addEventListener('change',sync);sync();
 }
 // If the existing application explicitly marks a button busy, show a spinner.
 // Never infer loading from a click or declare success before the server confirms it.
 const refreshBusy=(el)=>{
  if(!(el instanceof HTMLElement)||!el.matches('button[aria-busy],.btn[aria-busy]'))return;
  const busy=el.getAttribute('aria-busy')==='true';
  const indicator=el.querySelector(':scope > .mo-busy-indicator');
  if(busy&&!indicator){const i=document.createElement('span');i.className='mo-busy-indicator';i.setAttribute('aria-hidden','true');el.appendChild(i)}
  if(!busy&&indicator)indicator.remove();
 };
 document.querySelectorAll('button[aria-busy],.btn[aria-busy]').forEach(refreshBusy);
 new MutationObserver(records=>{for(const r of records)if(r.type==='attributes')refreshBusy(r.target)}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['aria-busy']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
