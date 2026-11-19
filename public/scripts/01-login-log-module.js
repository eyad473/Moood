
(function(){
 'use strict';
 var DEFAULT_BASE='https://moood.eyad2000515.workers.dev';
 var CAP={base:'',auth:'',device:''};
 var origFetch=window.fetch;
 function pick(h,name){try{if(!h)return '';if(typeof h.get==='function')return h.get(name)||'';if(Array.isArray(h)){var f=h.filter(function(x){return String(x[0]).toLowerCase()===name.toLowerCase()})[0];return f?f[1]:''}var k=Object.keys(h).filter(function(x){return x.toLowerCase()===name.toLowerCase()})[0];return k?h[k]:''}catch(e){return ''}}
 // نلتقط ترويسة الجهاز والمفتاح من طلبات المزامنة التي يرسلها التطبيق نفسه، فلا نحتاج لإعدادات إضافية
 window.fetch=function(input,init){
  try{
   var url=typeof input==='string'?input:((input&&input.url)||String(input));
   var u=new URL(url,location.href);
   if(/^\/(sync|support|announcements)\//.test(u.pathname)){
    var h=(init&&init.headers)||(input&&input.headers);
    var dev=pick(h,'X-Device-Id'),auth=pick(h,'Authorization');
    if(dev||auth){CAP.base=u.origin;if(dev)CAP.device=dev;if(auth)CAP.auth=auth}
   }
  }catch(e){}
  return origFetch.apply(this,arguments);
 };
 var $=function(id){return document.getElementById(id)};
 var sec=$('loginLog');if(!sec)return;
 var timer=null,busy=false,searchT=null;
 var LABEL={login:'دخول جديد',return:'عودة للجلسة',logout:'خروج',failed:'محاولة فاشلة'};
 var dFmt=new Intl.DateTimeFormat('ar-u-nu-latn',{timeZone:'Asia/Gaza',day:'2-digit',month:'2-digit',year:'numeric'});
 var tFmt=new Intl.DateTimeFormat('ar-u-nu-latn',{timeZone:'Asia/Gaza',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
 function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
 function ago(ms){var s=Math.max(0,Math.round((Date.now()-ms)/1000));if(s<45)return 'الآن';var m=Math.round(s/60);if(m<60)return 'قبل '+m+' دقيقة';var h=Math.round(m/60);if(h<24)return 'قبل '+h+' ساعة';var d=Math.round(h/24);return 'قبل '+d+' يوم'}
 function status(t,err){var el=$('llStatus');el.textContent=t;el.style.color=err?'#b91c1c':''}
 function render(data){
  var s=data.summary||{};
  $('llLogins').textContent=s.logins;$('llReturns').textContent=s.returns;$('llFamilies').textContent=s.families;$('llFailed').textContent=s.failed;
  $('llLast').textContent='آخر نشاط: '+(s.lastActivityAt?ago(s.lastActivityAt):'—');
  var list=$('llList'),items=data.items||[];
  if(!items.length){list.innerHTML='<div class="ll-empty">لا توجد عمليات دخول مسجّلة بعد.<br>ستظهر هنا فور دخول أي رب أسرة إلى بوابة الأهالي.</div>';return}
  list.innerHTML=items.map(function(r){
   var ev=LABEL[r.event]?r.event:'login';
   var name=r.familyName||'غير معروف';
   var meta='<div><span>رقم الهوية</span><b>'+esc(r.familyId)+'</b></div>';
   if(r.device)meta+='<div><span>الجهاز والمتصفح</span><b>'+esc(r.device)+'</b></div>';
   if(r.country)meta+='<div><span>الدولة (حسب الاتصال)</span><b>'+esc(r.country)+'</b></div>';
   return '<div class="ll-row ev-'+ev+'"><div class="ll-top"><span class="ll-badge">'+LABEL[ev]+'</span><div class="ll-time"><b>'+esc(tFmt.format(new Date(r.at)))+'</b><small>'+esc(dFmt.format(new Date(r.at)))+' · '+esc(ago(r.at))+'</small></div></div><div class="ll-name">'+esc(name)+'</div><div class="ll-meta">'+meta+'</div></div>';
  }).join('');
 }
 function load(){
  if(busy)return;
  if(!CAP.device&&!CAP.auth){status('بانتظار اتصال التطبيق بالسحابة...');clearTimeout(load.retry);load.retry=setTimeout(function(){if(sec.classList.contains('active'))load()},2500);return}
  busy=true;
  var d=new Date();d.setHours(0,0,0,0);
  var p=new URLSearchParams({limit:'150',since:String(d.getTime())});
  var ev=$('llEvent').value,q=$('llSearch').value.trim();if(ev)p.set('event',ev);if(q)p.set('q',q);
  var h={Accept:'application/json'};if(CAP.auth)h.Authorization=CAP.auth;if(CAP.device)h['X-Device-Id']=CAP.device;
  origFetch.call(window,(CAP.base||DEFAULT_BASE)+'/support/logins?'+p.toString(),{headers:h,cache:'no-store'})
   .then(function(r){return r.json().catch(function(){return {}}).then(function(b){return {r:r,b:b}})})
   .then(function(x){
    if(!x.r.ok||!x.b.ok){status(x.b.error||'تعذر تحميل السجل. تأكد من أنك على الجهاز الرئيسي وأن الـ Worker محدّث.',true);return}
    render(x.b);status('آخر تحديث: '+tFmt.format(new Date())+' · يتحدث تلقائيًا كل 20 ثانية')
   })
   .catch(function(){status('تعذر الاتصال بالخادم.',true)})
   .then(function(){busy=false});
 }
 function start(){load();clearInterval(timer);timer=setInterval(function(){if(!document.hidden)load()},20000)}
 function stop(){clearInterval(timer);timer=null}
 new MutationObserver(function(){sec.classList.contains('active')?start():stop()}).observe(sec,{attributes:true,attributeFilter:['class']});
 $('llRefresh').addEventListener('click',load);
 $('llEvent').addEventListener('change',load);
 $('llSearch').addEventListener('input',function(){clearTimeout(searchT);searchT=setTimeout(load,350)});
 // احتياط: إن لم يُفعّل التطبيق الصفحة الجديدة تلقائيًا نفعّلها هنا
 document.addEventListener('click',function(e){
  var b=e.target.closest&&e.target.closest('[data-view="loginLog"],[data-drawer-view="loginLog"]');if(!b)return;
  setTimeout(function(){
   if(!sec.classList.contains('active')){
    Array.prototype.forEach.call(document.querySelectorAll('.view.active'),function(v){v.classList.remove('active')});
    Array.prototype.forEach.call(document.querySelectorAll('.tab.active'),function(t){t.classList.remove('active')});
    sec.classList.add('active');var tab=document.querySelector('.tab[data-view="loginLog"]');if(tab)tab.classList.add('active');
    var dr=$('mobileDrawerBackdrop');if(dr)dr.classList.remove('open');window.scrollTo(0,0);
   }
  },80);
 });
})();
