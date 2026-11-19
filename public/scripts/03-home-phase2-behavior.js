
(function(){'use strict';
 const $=id=>document.getElementById(id);
 const numeric=id=>{const v=$(id)?.textContent||'';if(!/[0-9٠-٩۰-۹]/.test(v))return null;const normalized=v.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[٬,\s]/g,'');const n=Number(normalized.replace(/[^0-9.]/g,''));return Number.isFinite(n)?n:null};
 const format=n=>n.toLocaleString('ar-EG');
 function update(){const families=numeric('sFamilies'),people=numeric('sPeople'),inside=numeric('sInside'),complete=numeric('sComplete'),partial=numeric('dashPartial'),missing=numeric('dashIncomplete'),issues=numeric('dashErrors');
 const brief=$('homeBriefText'),alerts=$('homeAlertsBody');if(!brief||!alerts)return;
 if(families===null||people===null){brief.textContent='الإحصائيات غير متاحة حالياً. يرجى التأكد من تحميل البيانات.';alerts.textContent='بانتظار اكتمال تحميل فحص البيانات.';return;}
 brief.textContent=`يضم الكشف حالياً ${format(families)} عائلة بإجمالي ${format(people)} فرد. ${inside===null?'':`منها ${format(inside)} عائلة داخل المخيم. `}${complete===null?'':`نسبة اكتمال البيانات ${format(complete)}%.`}`;
 if(issues===null||partial===null||missing===null){alerts.textContent='بانتظار اكتمال فحص جودة السجلات.';return;}
 const parts=[];if(missing>0)parts.push(`${format(missing)} عائلة ببيانات ناقصة`);if(partial>0)parts.push(`${format(partial)} عائلة ببيانات جزئية`);if(issues>0)parts.push(`${format(issues)} ملاحظة في فحص جودة البيانات`);
 alerts.textContent=parts.length?parts.join(' · ')+' — افتح فحص التفاصيل للمراجعة.':'لا توجد ملاحظات ظاهرة في فحص جودة البيانات الحالي.';
 }
 function act(type){try{switch(type){case 'family-add':return typeof openFamilyModal==='function'?openFamilyModal():undefined;case 'person-add':return typeof openPersonModal==='function'?openPersonModal():undefined;case 'families':return typeof showView==='function'?showView('families'):undefined;case 'family-search':return typeof showView==='function'?showView('familySearch'):undefined;case 'support':return typeof window.openSupportInbox==='function'?window.openSupportInbox():undefined;case 'excel':return typeof exportExcel==='function'?exportExcel():undefined;case 'backup':return typeof backup==='function'?backup():undefined;case 'fund':return typeof showView==='function'?showView('campFund'):undefined;case 'quality':return typeof openQualityModal==='function'?openQualityModal():undefined;}}catch(err){console.error('Home shortcut:',err);if(typeof toast==='function')toast('تعذر فتح الإجراء، يرجى المحاولة من القائمة الرئيسية.');}}
 document.addEventListener('click',e=>{const btn=e.target.closest('[data-home-op]');if(btn)act(btn.dataset.homeOp)});
 document.addEventListener('DOMContentLoaded',()=>{update();const ids=['sFamilies','sPeople','sInside','sComplete','dashPartial','dashIncomplete','dashErrors'];let scheduled=false;const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;update()})});ids.forEach(id=>{if($(id))observer.observe($(id),{childList:true,characterData:true,subtree:true})});});
})();
