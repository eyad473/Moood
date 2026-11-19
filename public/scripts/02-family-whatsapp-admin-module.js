
(function(){
 'use strict';
 var DEFAULT_BASE='https://moood.eyad2000515.workers.dev',CAP={base:'',auth:'',device:''};
 var priorFetch=window.fetch;
 function header(h,n){try{if(!h)return '';if(typeof h.get==='function')return h.get(n)||'';if(Array.isArray(h)){var x=h.find(function(a){return String(a[0]).toLowerCase()===n.toLowerCase()});return x?x[1]:''}var k=Object.keys(h).find(function(x){return x.toLowerCase()===n.toLowerCase()});return k?h[k]:''}catch(e){return ''}}
 window.fetch=function(input,init){
  try{var raw=typeof input==='string'?input:((input&&input.url)||String(input));var u=new URL(raw,location.href);
   if(/^\/(sync|support|announcements)\//.test(u.pathname)){var h=(init&&init.headers)||(input&&input.headers);var d=header(h,'X-Device-Id'),a=header(h,'Authorization');if(d||a){CAP.base=u.origin;if(d)CAP.device=d;if(a)CAP.auth=a;}}
  }catch(e){}
  return priorFetch.apply(this,arguments);
 };
 var $=function(id){return document.getElementById(id)},items=[],busy=false;
 function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
 function status(t,err){var e=$('waStatus');if(e){e.textContent=t;e.style.background=err?'#fff1f2':'';e.style.color=err?'#991b1b':''}}
 function render(){
  var q=($('waSearch').value||'').trim().toLowerCase(),f=$('waFilter').value;
  var rows=items.filter(function(x){var hit=!q||(String(x.familyName||'').toLowerCase().includes(q)||String(x.familyId||'').toLowerCase().includes(q));return hit&&(f==='all'||(f==='has'?!!x.whatsappNumber:!x.whatsappNumber));});
  $('waList').innerHTML=rows.length?rows.map(function(x){
   var action=x.whatsappNumber?'<a class="wa-send" target="_blank" rel="noopener" href="https://wa.me/'+encodeURIComponent(x.whatsappNumber.replace(/\D/g,''))+'">إرسال رسالة واتساب ↗</a>':'<span class="wa-missing">لم يُسجّل رقم بعد</span>';
   return '<article class="wa-family-row"><div class="wa-family-main"><b>'+esc(x.familyName||'أسرة بدون اسم')+'</b><small>رقم هوية الأسرة: '+esc(x.familyId)+'</small></div><div class="wa-family-actions">'+(x.whatsappNumber?'<span class="wa-phone">'+esc(x.whatsappNumber)+'</span>':'')+action+'</div></article>';
  }).join(''):'<div class="empty">لا توجد أسر مطابقة لخيارات البحث.</div>';
 }
 async function load(){
  if(busy)return;
  if(!CAP.auth&&!CAP.device){status('بانتظار اتصال البرنامج الرئيسي بالخادم...',false);return;}
  busy=true;status('جارٍ تحميل أرقام واتساب الأسر...');
  try{
   var h={Accept:'application/json'};if(CAP.auth)h.Authorization=CAP.auth;if(CAP.device)h['X-Device-Id']=CAP.device;
   var r=await priorFetch.call(window,(CAP.base||DEFAULT_BASE)+'/support/whatsapp/admin',{method:'GET',headers:h,cache:'no-store'});
   var b=await r.json().catch(function(){return {}});
   if(!r.ok||!b.ok)throw new Error(b.error||'تعذر تحميل الأرقام. افتح البرنامج من الحساب الرئيسي وتأكد من تحديث Worker.');
   items=b.items||[];$('waTotal').textContent=b.summary.total;$('waHas').textContent=b.summary.withWhatsapp;$('waMissing').textContent=b.summary.missing;
   render();status('تم تحديث القائمة — '+items.length+' أسرة. الأرقام محفوظة في قاعدة بيانات البرنامج الرئيسي.');
  }catch(e){status(e.message||'تعذر الاتصال بالخادم.',true)}
  finally{busy=false;}
 }
 $('waRefresh').addEventListener('click',load);$('waSearch').addEventListener('input',render);$('waFilter').addEventListener('change',render);
 var sec=$('whatsapp'),timer=null;
 function watch(){if(!sec)return;if(sec.classList.contains('active'))load()}
 if(sec){new MutationObserver(watch).observe(sec,{attributes:true,attributeFilter:['class']});}
 document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-view="whatsapp"],[data-drawer-view="whatsapp"]');if(!b)return;setTimeout(function(){var target=$('whatsapp');if(target){document.querySelectorAll('.view.active').forEach(function(v){v.classList.remove('active')});document.querySelectorAll('.tab.active').forEach(function(t){t.classList.remove('active')});target.classList.add('active');var mainTab=document.querySelector('.tab[data-view="whatsapp"]');if(mainTab)mainTab.classList.add('active');var drawer=$('mobileDrawerBackdrop');if(drawer)drawer.classList.remove('open');window.scrollTo(0,0);watch();}},80);});
 window.addEventListener('online',watch);
})();
