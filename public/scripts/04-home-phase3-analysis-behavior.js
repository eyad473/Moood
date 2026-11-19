
(function(){'use strict';
 const $=id=>document.getElementById(id);
 const number=id=>{const raw=$(id)?.textContent||'';if(!/[0-9٠-٩۰-۹]/.test(raw))return null;const v=raw.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٬,\s]/g,'').replace(/[^0-9.]/g,'');const n=Number(v);return Number.isFinite(n)?n:null};
 const fmt=n=>n.toLocaleString('ar-EG');
 function update(){
  const families=number('sFamilies'),inside=number('sInside'),people=number('sPeople');
  const outside=$('homeOutsideCount'),pop=$('homePopulationSummary'),health=$('homeHealthSummary');
  if(!outside||!pop||!health)return;
  outside.textContent=families===null||inside===null||inside>families?'غير متاح':fmt(families-inside);
  if(people===null){pop.textContent='بانتظار البيانات';health.textContent='بانتظار البيانات';return}
  const genders=$('genderChart');const labels=genders?.querySelectorAll('svg g[transform="translate(250 62)"] text')||[];
  pop.textContent=people===0?'لا توجد سجلات':fmt(people)+' فرد مسجل';
  const rows=Array.from($('healthChart')?.querySelectorAll('.health-item')||[]);
  let total=0,valid=0;for(const row of rows){const b=row.querySelector('.health-top b');if(!b)continue;const n=Number(b.textContent.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٬,\s]/g,''));if(Number.isFinite(n)){total+=n;valid++}}
  health.textContent=people===0?'لا توجد سجلات':valid?fmt(total)+' حالة مصنفة':'غير متاح';
 }
 function setup(){const ids=['sFamilies','sInside','sPeople','healthChart'];let queued=false;const observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;update()})});ids.forEach(id=>{const el=$(id);if(el)observer.observe(el,{childList:true,subtree:true,characterData:true})});update()}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
