
function initProgramLotties(){
  const a=document.getElementById('lottieFamilies'), b=document.getElementById('lottieCloud');
  if(a)a.innerHTML='<svg class="local-art-svg" viewBox="0 0 180 180" aria-hidden="true"><g class="local-house"><path d="M28 82 90 34l62 48" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><rect x="43" y="78" width="94" height="66" rx="12" fill="currentColor" opacity=".12" stroke="currentColor" stroke-width="7"/><rect x="79" y="105" width="22" height="39" rx="5" fill="currentColor"/><circle cx="67" cy="102" r="6" fill="currentColor" opacity=".85"/><circle cx="113" cy="102" r="6" fill="currentColor" opacity=".85"/></g></svg>';
  if(b)b.innerHTML='<svg class="local-art-svg" viewBox="0 0 180 180" aria-hidden="true"><g class="local-cloud" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M43 121h91c14 0 25-10 25-23s-10-23-23-23h-5C128 56 114 45 99 45c-17 0-31 12-34 29-2-1-5-1-8-1-15 0-27 11-27 25s10 23 23 23Z"/><path class="local-dot" d="M67 142v5"/><path class="local-dot d2" d="M90 142v5"/><path class="local-dot d3" d="M113 142v5"/></g></svg>';
}
document.addEventListener('DOMContentLoaded',()=>setTimeout(initProgramLotties,50));

/* V38: unified interactive search spinner for all search inputs. */
(function(){
  const SEARCH_WORDS=/بحث|ابحث|المستفيد|الاسم|رب الأسرة|العائلة|سجل|كلمة|هوية/i;
  const MIN_SPIN=420;
  const timers=new WeakMap();
  function shouldWatch(el){
    if(!el || el.disabled || el.type==='date' || el.type==='number' || el.type==='password') return false;
    const ph=(el.getAttribute('placeholder')||'');
    const aria=(el.getAttribute('aria-label')||'');
    const id=(el.id||'');
    const cls=(el.className||'').toString();
    return el.tagName==='INPUT' && (SEARCH_WORDS.test(ph+' '+aria+' '+id+' '+cls));
  }
  function setup(el){
    if(el.dataset.abuSearchSpinner==='1') return;
    if(!shouldWatch(el)) return;
    const wrap=document.createElement('span');
    wrap.className='search-loading-wrap';
    const spinner=document.createElement('span');
    spinner.className='search-loading-spinner';
    spinner.setAttribute('aria-hidden','true');
    el.parentNode.insertBefore(wrap,el);
    wrap.appendChild(el); wrap.appendChild(spinner);
    el.dataset.abuSearchSpinner='1';
    const begin=()=>{
      clearTimeout(timers.get(el));
      if(!el.value.trim()){wrap.classList.remove('is-searching');return;}
      const started=performance.now();
      wrap.classList.add('is-searching');
      timers.set(el,setTimeout(()=>{
        const left=Math.max(0,MIN_SPIN-(performance.now()-started));
        timers.set(el,setTimeout(()=>wrap.classList.remove('is-searching'),left));
      },20));
    };
    const finish=()=>{
      const t=setTimeout(()=>wrap.classList.remove('is-searching'),MIN_SPIN);
      clearTimeout(timers.get(el)); timers.set(el,t);
    };
    el.addEventListener('input',begin,{passive:true});
    el.addEventListener('search',begin,{passive:true});
    el.addEventListener('blur',()=>setTimeout(()=>wrap.classList.remove('is-searching'),160));
    el.addEventListener('abu-search-finished',finish);
    el.addEventListener('keydown',e=>{if(e.key==='Escape'){wrap.classList.remove('is-searching')}});
  }
  function scan(root=document){root.querySelectorAll('input').forEach(setup)}
  scan();
  new MutationObserver(muts=>muts.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1){if(n.matches?.('input'))setup(n);scan(n)}}))).observe(document.body,{childList:true,subtree:true});
  window.abuSearchDone=function(el){if(el) el.dispatchEvent(new Event('abu-search-finished'));else document.querySelectorAll('.search-loading-wrap').forEach(w=>w.classList.remove('is-searching'))};
})();


/* ===== Consolidated UI scripts ===== */


const COLUMNS = ["#", "اسم رب الأسرة", "رقم هوية الأسرة", "رقم الجوال", "رقم جوال بديل", "العنوان", "داخل/خارج المخيم", "حالة اكتمال بيانات الأسرة", "المحافظة الأصلية", "حالة المسكن الأصلي", "نوع السكن الحالي", "اسم الفرد", "صلة القرابة", "الجنس", "الحالة الاجتماعية", "تاريخ الميلاد", "العمر التقريبي", "رقم هوية الفرد", "مرض مزمن؟", "نوع المرض", "إصابة؟", "سبب الإصابة", "تفاصيل الإصابة", "إعاقة؟", "نوع الإعاقة", "يتيم/منفصل عن ذويه؟", "حامل؟", "مرضعة؟", "ملاحظات الفرد", "ملاحظات الأسرة"];
const STORAGE_KEY = "camp_manager_aboreiban_v4_excel";
let data = [];
let filtered = [];
let page = 1;

let bootUsingEmbeddedSeed=false;
function load(){
  try{
    const saved=localStorage.getItem(STORAGE_KEY);
    bootUsingEmbeddedSeed=false;
    data=saved?JSON.parse(saved):[];
  }catch(e){bootUsingEmbeddedSeed=false;data=[]}
  data = Array.isArray(data)?data:[];
  rebuildFilters(); renderAll();
}
function saveNow(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
  toast("تم حفظ البيانات على الهاتف/المتصفح");
}
function autoSave(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}catch(e){toast("تعذر الحفظ المحلي: مساحة التخزين ممتلئة")}}
function toast(msg){const t=document.getElementById("toast");let m=String(msg||"");const compact={"تم حفظ البيانات محلياً — جاري المزامنة":"تم الحفظ والمزامنة جاريًا","تم حفظ البيانات محلياً — بانتظار عودة الإنترنت":"تم الحفظ محلياً","السحابة متصلة والبيانات متاحة":"تمت المزامنة","تعذر الاتصال بالسحابة حالياً":"تعذر الاتصال بالسحابة","تمت المزامنة بنجاح":"تمت المزامنة","تم الحفظ بنجاح":"تم الحفظ"};m=compact[m]||m;if(m.length>34)m=m.slice(0,34)+"…";t.textContent=m;t.classList.add("show");clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.classList.remove("show"),1900)}
function showView(id){
 const current=document.querySelector(".view.active"); if(current?.id===id)return;
 requestAnimationFrame(()=>{document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.view===id));const target=document.getElementById(id);if(target)target.classList.add("active");
  if(id==="records")requestAnimationFrame(renderTable);
  else if(id==="families")requestAnimationFrame(renderFamiliesFast);
  else if(id==="classified")requestAnimationFrame(renderClassified);
  else if(id==="distributions")requestAnimationFrame(renderDistributions);
  else if(id==="familySearch")setTimeout(()=>document.getElementById("familySearchInput")?.focus(),50);
 });
}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>showView(b.dataset.view));

function familyNames(){return [...new Set(data.map(x=>x["اسم رب الأسرة"]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'))}
function familyMap(){
 const m=new Map();
 data.forEach(r=>{const h=r["اسم رب الأسرة"]||"غير محدد";if(!m.has(h))m.set(h,[]);m.get(h).push(r)});
 return m;
}
function rebuildFilters(){
 const rel=[...new Set(data.map(x=>x["صلة القرابة"]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
 const ins=[...new Set(data.map(x=>x["داخل/خارج المخيم"]).filter(Boolean))].sort();
 const r=document.getElementById("rel"), i=document.getElementById("inside");
 r.innerHTML='<option value="">الكل</option>'+rel.map(x=>`<option>${esc(x)}</option>`).join("");
 i.innerHTML='<option value="">الكل</option>'+ins.map(x=>`<option>${esc(x)}</option>`).join("");
 document.getElementById("headsList").innerHTML=familyNames().map(x=>`<option value="${esc(x)}">`).join("");
}
function applyFilters(){
 const q=(document.getElementById("q").value||"").trim().toLowerCase();
 const rel=document.getElementById("rel").value, ins=document.getElementById("inside").value, health=document.getElementById("health").value;
 filtered=data.filter(r=>{
   const blob=Object.values(r).join(" ").toLowerCase();
   if(q && !blob.includes(q))return false;
   if(rel && r["صلة القرابة"]!==rel)return false;
   if(ins && r["داخل/خارج المخيم"]!==ins)return false;
   if(health==="مرض مزمن" && r["مرض مزمن؟"]!=="نعم")return false;
   if(health==="إصابة" && r["إصابة?"]!=="نعم" && r["إصابة؟"]!=="نعم")return false;
   if(health==="إعاقة" && r["إعاقة؟"]!=="نعم")return false;
   if(health==="يتيم" && r["يتيم/منفصل عن ذويه؟"]!=="نعم")return false;
   return true;
 });
 page=1;renderTable();
}
function renderTable(){
 if(!document.getElementById("tbody"))return;
 if(!filtered.length && !document.getElementById("q").value && !document.getElementById("rel").value && !document.getElementById("inside").value && !document.getElementById("health").value)filtered=data;
 const ps=+document.getElementById("pageSize").value||25, start=(page-1)*ps, rows=filtered.slice(start,start+ps);
 document.getElementById("tbody").innerHTML=rows.map((r,i)=>{
  const idx=data.indexOf(r), health=healthBadge(r);
  return `<tr><td>${start+i+1}</td><td><b>${esc(r["اسم الفرد"]||"")}</b><br><span class="muted">${esc(r["اسم رب الأسرة"]||"")}</span></td><td>${esc(r["رقم هوية الفرد"]||r["رقم هوية الأسرة"]||"")}</td><td>${esc(r["رقم الجوال"]||"")}</td><td>${esc(r["صلة القرابة"]||"")}</td><td>${esc(r["الجنس"]||"")}</td><td>${esc(r["العمر التقريبي"]||"")}</td><td>${esc(r["داخل/خارج المخيم"]||"")}</td><td>${health}</td><td class="no-print"><button class="btn" onclick="editPerson(${idx})">تعديل</button> <button class="btn danger" onclick="deletePerson(${idx})">حذف</button></td></tr>`
 }).join("") || `<tr><td colspan="10" class="empty">لا توجد نتائج</td></tr>`;
 document.getElementById("countLabel").textContent=`عرض ${rows.length} من ${filtered.length} سجل`;
 renderPages(Math.ceil(filtered.length/ps));
 document.getElementById("printMeta").textContent=`تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')} — عدد السجلات: ${filtered.length}`;
}
function renderPages(total){
 const box=document.getElementById("pages"); if(total<=1){box.innerHTML="";return}
 let s=`<button class="pagebtn" ${page===1?"disabled":""} onclick="page--;renderTable()">‹</button>`;
 const a=Math.max(1,page-2),b=Math.min(total,page+2);
 for(let p=a;p<=b;p++)s+=`<button class="pagebtn ${p===page?"active":""}" onclick="page=${p};renderTable()">${p}</button>`;
 s+=`<button class="pagebtn" ${page===total?"disabled":""} onclick="page++;renderTable()">›</button>`;
 box.innerHTML=s;
}
function healthBadge(r){
 const arr=[];
 if(r["مرض مزمن؟"]==="نعم")arr.push("مرض مزمن");
 if((r["إصابة؟"]||r["إصابة?"])==="نعم")arr.push("إصابة");
 if(r["إعاقة؟"]==="نعم")arr.push("إعاقة");
 if(r["يتيم/منفصل عن ذويه؟"]==="نعم")arr.push("يتيم");
 return arr.length?`<span class="badge ${arr.includes("إصابة")?"danger":"warn"}">${esc(arr.join("، "))}</span>`:`<span class="badge ok">لا توجد</span>`;
}

function renderFamilies(){
 const q=(document.getElementById("fq").value||"").toLowerCase().trim(), fs=document.getElementById("fsize").value;
 const m=familyMap();let arr=[...m.entries()];
 arr=arr.filter(([h,rows])=>{
  const first=rows[0]||{},blob=[h,first["رقم هوية الأسرة"],first["رقم الجوال"],first["العنوان"]].join(" ").toLowerCase();
  if(q&&!blob.includes(q))return false;
  const n=rows.length;
  if(fs==="1"&&n!==1)return false;if(fs==="2-4"&&(n<2||n>4))return false;if(fs==="5-7"&&(n<5||n>7))return false;if(fs==="8"&&n<8)return false;
  return true;
 });
 document.getElementById("familyList").innerHTML=arr.map(([h,rows])=>{
  const r=rows[0]||{}, key=encodeURIComponent(h);
  return `<div class="familybox"><div class="familyrow"><div><div class="familytitle">${esc(h)}</div><div class="muted">هوية الأسرة: ${esc(r["رقم هوية الأسرة"]||"—")} · الجوال: ${esc(r["رقم الجوال"]||"—")} · عدد الأفراد: <b>${rows.length}</b></div></div><div class="actions no-print"><button class="btn" onclick="editFamily(decodeURIComponent('${key}'))">تعديل الأسرة</button><button class="btn primary" onclick="addMemberToFamily(decodeURIComponent('${key}'))">＋ فرد</button><button class="btn danger" onclick="deleteFamily(decodeURIComponent('${key}'))">حذف العائلة</button></div></div><div class="memberlist">${rows.map(x=>`<div class="member"><span>${esc(x["اسم الفرد"]||"")} — ${esc(x["صلة القرابة"]||"")} — ${esc(x["رقم هوية الفرد"]||"")}</span><span class="no-print"><button class="pagebtn" onclick="editPerson(${data.indexOf(x)})">تعديل</button></span></div>`).join("")}</div></div>`
 }).join("") || `<div class="empty">لا توجد عائلات مطابقة</div>`;
}
function openFamilyModal(name=null){
 document.getElementById("familyForm").reset();document.getElementById("f_original").value=name||"";
 document.getElementById("familyModalTitle").textContent=name?"تعديل عائلة":"إضافة عائلة";
 if(name){
  const r=familyMap().get(name)?.[0];if(r){
   setv("f_head",r["اسم رب الأسرة"]);setv("f_id",r["رقم هوية الأسرة"]);setv("f_phone",r["رقم الجوال"]);setv("f_alt",r["رقم جوال بديل"]);setv("f_inside",r["داخل/خارج المخيم"]);setv("f_complete",r["حالة اكتمال بيانات الأسرة"]);setv("f_gov",r["المحافظة الأصلية"]);setv("f_home",r["حالة المسكن الأصلي"]);setv("f_current",r["نوع السكن الحالي"]);setv("f_address",r["العنوان"]);setv("f_notes",r["ملاحظات الأسرة"]);
  }
 }
 document.getElementById("familyModal").classList.add("show");
}
function saveFamily(e){
 e.preventDefault();const old=document.getElementById("f_original").value, h=document.getElementById("f_head").value.trim();
 if(!h)return;
 const vals={"اسم رب الأسرة":h,"رقم هوية الأسرة":v("f_id"),"رقم الجوال":v("f_phone"),"رقم جوال بديل":v("f_alt"),"داخل/خارج المخيم":v("f_inside"),"حالة اكتمال بيانات الأسرة":v("f_complete"),"المحافظة الأصلية":v("f_gov"),"حالة المسكن الأصلي":v("f_home"),"نوع السكن الحالي":v("f_current"),"العنوان":v("f_address"),"ملاحظات الأسرة":v("f_notes")};
 if(old){
  data.forEach(r=>{if(r["اسم رب الأسرة"]===old)Object.assign(r,vals)});
 }else{
  const base=emptyRecord();Object.assign(base,vals,{"#":String(data.length+1),"اسم الفرد":h,"صلة القرابة":"رب الأسرة","رقم هوية الفرد":v("f_id")||""});data.push(base);
 }
 autoSave();closeModal("familyModal");rebuildFilters();renderAll();toast(old?"تم تعديل العائلة":"تمت إضافة العائلة");playSaveSound();
}
function editFamily(name){openFamilyModal(name)}
async function deleteFamily(name){
 const n=(familyMap().get(name)||[]).length;
 if(await confirmUI(`سيتم حذف عائلة «${name}» وجميع أفرادها (${n} سجل).

لن يتم تنفيذ الحذف إلا بعد تأكيدك.`,{title:"حذف العائلة",okText:"حذف العائلة",danger:true})){
  data=data.filter(r=>r["اسم رب الأسرة"]!==name);renumber();autoSave();rebuildFilters();renderAll();toast("تم حذف العائلة وجميع أفرادها");
 }
}
function openPersonModal(idx=null){
 document.getElementById("personForm").reset();document.getElementById("p_index").value=idx==null?"":idx;
 document.getElementById("personModalTitle").textContent=idx==null?"إضافة فرد":"تعديل فرد";
 if(idx!=null){fillPerson(data[idx])}
 document.getElementById("personModal").classList.add("show");
}
function addMemberToFamily(name){openPersonModal();setv("p_head",name)}
function editPerson(idx){openPersonModal(idx)}
function fillPerson(r){
 setv("p_name",r["اسم الفرد"]);setv("p_head",r["اسم رب الأسرة"]);setv("p_id",r["رقم هوية الفرد"]);setv("p_rel",r["صلة القرابة"]);setv("p_gender",r["الجنس"]);setv("p_marital",r["الحالة الاجتماعية"]);setv("p_birth",r["تاريخ الميلاد"]);setv("p_age",r["العمر التقريبي"]);setv("p_chronic",r["مرض مزمن؟"]);setv("p_disease",r["نوع المرض"]);setv("p_injury",r["إصابة؟"]||r["إصابة?"]);setv("p_injuryreason",r["سبب الإصابة"]);setv("p_injurydetails",r["تفاصيل الإصابة"]);setv("p_disability",r["إعاقة؟"]);setv("p_disabilitytype",r["نوع الإعاقة"]);setv("p_orphan",r["يتيم/منفصل عن ذويه؟"]);setv("p_preg",r["حامل؟"]);setv("p_lact",r["مرضعة؟"]);setv("p_notes",r["ملاحظات الفرد"]);
}
function savePerson(e){
 e.preventDefault();const idx=document.getElementById("p_index").value, r=idx===""?emptyRecord():data[+idx];
 const head=v("p_head").trim(), name=v("p_name").trim();if(!name||!head){alert("اسم الفرد واسم رب الأسرة مطلوبان");return}
 r["اسم الفرد"]=name;r["اسم رب الأسرة"]=head;r["رقم هوية الفرد"]=v("p_id");r["صلة القرابة"]=v("p_rel");r["الجنس"]=v("p_gender");r["الحالة الاجتماعية"]=v("p_marital");r["تاريخ الميلاد"]=v("p_birth");r["العمر التقريبي"]=v("p_age");r["مرض مزمن?"]=r["مرض مزمن؟"]=v("p_chronic");r["نوع المرض"]=v("p_disease");r["إصابة؟"]=v("p_injury");r["سبب الإصابة"]=v("p_injuryreason");r["تفاصيل الإصابة"]=v("p_injurydetails");r["إعاقة؟"]=v("p_disability");r["نوع الإعاقة"]=v("p_disabilitytype");r["يتيم/منفصل عن ذويه?"]=r["يتيم/منفصل عن ذويه؟"]=v("p_orphan");r["حامل؟"]=v("p_preg");r["مرضعة؟"]=v("p_lact");r["ملاحظات الفرد"]=v("p_notes");
 const fm=familyMap().get(head)?.[0];if(fm){["رقم هوية الأسرة","رقم الجوال","رقم جوال بديل","العنوان","داخل/خارج المخيم","حالة اكتمال بيانات الأسرة","المحافظة الأصلية","حالة المسكن الأصلي","نوع السكن الحالي","ملاحظات الأسرة"].forEach(k=>{if(filled(fm[k]))r[k]=fm[k]})}
 if(idx===""){r["#"]=String(data.length+1);data.push(r)}
 autoSave();closeModal("personModal");rebuildFilters();renderAll();toast(idx===""?"تمت إضافة الفرد":"تم تعديل الفرد");playSaveSound();
}
async function deletePerson(idx){
 const r=data[idx];if(await confirmUI(`هل تريد حذف الفرد «${r["اسم الفرد"]||""}»؟

سيتم حفظ العملية محليًا ثم مزامنتها مع السحابة.`,{title:"حذف الفرد",okText:"حذف الفرد",danger:true})){data.splice(idx,1);renumber();autoSave();rebuildFilters();renderAll();toast("تم حذف الفرد")}
}
function emptyRecord(){const r={};COLUMNS.forEach(k=>r[k]="");return r}
function renumber(){data.forEach((r,i)=>r["#"]=String(i+1))}
function closeModal(id){document.getElementById(id).classList.remove("show")}
document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)m.classList.remove("show")}));

function renderAll(){applyFilters();renderFamiliesFast();renderDashboard()}
let __familyCache={key:"",html:""};
function renderFamiliesFast(){
 const q=(document.getElementById("fq")?.value||"").toLowerCase().trim(),fs=document.getElementById("fsize")?.value||"",st=document.getElementById("fstatus")?.value||"";
 const key=q+"|"+fs+"|"+st+"|"+data.length+"|"+(data[0]?.__syncId||"")+"|"+(data[data.length-1]?.__syncId||"");
 if(__familyCache.key===key){document.getElementById("familyList").innerHTML=__familyCache.html;return;}
 renderFamiliesCore(); __familyCache={key,html:document.getElementById("familyList").innerHTML};
}

function renderDashboard(){
 const fm=familyMap(), inside=new Set(), complete=new Set();
 fm.forEach((rows,h)=>{const r=rows[0]||{};if(r["داخل/خارج المخيم"]==="داخل المخيم")inside.add(h);if(r["حالة اكتمال بيانات الأسرة"]==="مكتملة")complete.add(h)});
 document.getElementById("sPeople").textContent=data.length.toLocaleString('ar-EG');
 document.getElementById("sFamilies").textContent=fm.size.toLocaleString('ar-EG');
 document.getElementById("sInside").textContent=inside.size.toLocaleString('ar-EG');
 document.getElementById("sComplete").textContent=fm.size?Math.round(complete.size/fm.size*100)+"%":"0%";
 chart("genderChart",[["ذكر",data.filter(x=>x["الجنس"]==="ذكر").length],["أنثى",data.filter(x=>["انثى","أنثى"].includes(x["الجنس"])).length]]);
 chart("healthChart",[["مزمن",data.filter(x=>x["مرض مزمن؟"]==="نعم").length],["إصابة",data.filter(x=>(x["إصابة؟"]||x["إصابة?"])==="نعم").length],["إعاقة",data.filter(x=>x["إعاقة؟"]==="نعم").length],["يتيم",data.filter(x=>x["يتيم/منفصل عن ذويه؟"]==="نعم").length]]);
 const recent=data.slice(-6).reverse();
 document.getElementById("recent").innerHTML=recent.map(r=>`<div class="member"><span><b>${esc(r["اسم الفرد"]||"")}</b> — ${esc(r["اسم رب الأسرة"]||"")} — ${esc(r["صلة القرابة"]||"")}</span><span class="muted">${esc(r["رقم الجوال"]||"")}</span></div>`).join("")||'<div class="empty">لا توجد بيانات</div>';
}
function svgEsc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function renderGenderChart(arr){const el=document.getElementById("genderChart");if(!el)return;const total=Math.max(arr.reduce((a,x)=>a+x[1],0),1),a=arr[0][1],b=arr[1][1],p=a/total,deg=p*360;el.innerHTML=`<svg viewBox="0 0 520 225" role="img" aria-label="توزيع حسب الجنس"><defs><linearGradient id="gMale" x1="0" x2="1"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#60a5fa"/></linearGradient><linearGradient id="gFemale" x1="0" x2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#c084fc"/></linearGradient></defs><g transform="translate(110 112)"><circle r="72" fill="none" stroke="#eef2f7" stroke-width="26"/><path d="${donutArc(72,26,0,deg)}" fill="url(#gMale)"/><path d="${donutArc(72,26,deg,360)}" fill="url(#gFemale)"/></g><text x="110" y="105" text-anchor="middle" class="chart-label" font-size="24" font-weight="800" fill="#172033">${total.toLocaleString('ar-EG')}</text><text x="110" y="124" text-anchor="middle" class="chart-label" font-size="10" fill="#64748b">إجمالي الأفراد</text><g transform="translate(250 62)"><circle cx="0" cy="0" r="6" fill="#2563eb"/><text x="14" y="4" class="chart-label" font-size="12" fill="#334155">ذكر</text><text x="135" y="4" class="chart-label" font-size="13" font-weight="800" fill="#172033">${a.toLocaleString('ar-EG')}</text><circle cx="0" cy="48" r="6" fill="#7c3aed"/><text x="14" y="52" class="chart-label" font-size="12" fill="#334155">أنثى</text><text x="135" y="52" class="chart-label" font-size="13" font-weight="800" fill="#172033">${b.toLocaleString('ar-EG')}</text><text x="0" y="92" class="chart-label" font-size="10" fill="#64748b">نسبة الذكور ${Math.round(p*100)}% · الإناث ${Math.round((1-p)*100)}%</text></g></svg>`}
function donutArc(r,w,start,end){const c=(r*2);const rad=Math.PI/180;const x1=r*Math.cos((start-90)*rad),y1=r*Math.sin((start-90)*rad),x2=r*Math.cos((end-90)*rad),y2=r*Math.sin((end-90)*rad);const large=end-start>180?1:0;return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${x2*(1-w/r)} ${y2*(1-w/r)} A ${r-w} ${r-w} 0 ${large} 0 ${x1*(1-w/r)} ${y1*(1-w/r)} Z`}
function renderAgeChart(){const groups=[["0–5",0],["6–17",0],["18–35",0],["36–59",0],["60+",0]];data.forEach(r=>{const a=Number(ageOf(r));if(!Number.isFinite(a)||a<0)return;if(a<=5)groups[0][1]++;else if(a<=17)groups[1][1]++;else if(a<=35)groups[2][1]++;else if(a<=59)groups[3][1]++;else groups[4][1]++;});const el=document.getElementById("ageChart");if(!el)return;const max=Math.max(...groups.map(x=>x[1]),1);const bw=76,gap=18,base=190;let bars=groups.map((g,i)=>{const h=Math.max(4,g[1]/max*135),x=24+i*(bw+gap),y=base-h;return `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="10" fill="url(#ageGrad)"/><text x="${x+bw/2}" y="${y-7}" text-anchor="middle" class="chart-label" font-size="11" font-weight="800" fill="#172033">${g[1].toLocaleString('ar-EG')}</text><text x="${x+bw/2}" y="${base+20}" text-anchor="middle" class="chart-label" font-size="10" fill="#64748b">${g[0]}</text>`}).join("");el.innerHTML=`<svg viewBox="0 0 500 225"><defs><linearGradient id="ageGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06b6d4"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs><text x="20" y="22" class="chart-label" font-size="12" font-weight="800" fill="#334155">الفئات العمرية</text><line x1="20" y1="190" x2="480" y2="190" stroke="#e5e7eb"/>${bars}</svg>`}
function renderHealthBars(arr){const el=document.getElementById("healthChart");if(!el)return;const max=Math.max(...arr.map(x=>x[1]),1);el.innerHTML=arr.map(([k,n])=>`<div class="health-item"><div class="health-top"><span>${svgEsc(k)}</span><b>${n.toLocaleString('ar-EG')}</b></div><div class="health-track"><div class="health-fill" style="width:${Math.max(n/max*100,n?4:0)}%"></div></div></div>`).join("")}
function renderFamilyStatusChart(counts,total){const el=document.getElementById("familyStatusChart");if(!el)return;const a=counts["مكتملة"]||0,b=counts["جزئية"]||0,c=counts["غير مكتملة"]||0,t=Math.max(total,1),p1=a/t*100,p2=b/t*100;el.innerHTML=`<div class="donut" style="background:conic-gradient(#16a34a 0 ${p1}%,#f59e0b ${p1}% ${p1+p2}%,#ef4444 ${p1+p2}% 100%)"><div class="donut-center"><b>${total.toLocaleString('ar-EG')}</b><span>إجمالي العائلات</span></div></div><div class="legend"><div class="legend-row"><span class="legend-name"><i class="legend-dot" style="background:#16a34a"></i>مكتملة</span><b>${a.toLocaleString('ar-EG')}</b></div><div class="legend-row"><span class="legend-name"><i class="legend-dot" style="background:#f59e0b"></i>جزئية</span><b>${b.toLocaleString('ar-EG')}</b></div><div class="legend-row"><span class="legend-name"><i class="legend-dot" style="background:#ef4444"></i>غير مكتملة</span><b>${c.toLocaleString('ar-EG')}</b></div></div>`}
function chart(id,arr){
 const max=Math.max(...arr.map(x=>x[1]),1);
 document.getElementById(id).innerHTML='<div class="bars">'+arr.map(([k,n])=>`<div class="bar" style="height:${Math.max(4,n/max*145)}px"><span>${esc(k)} (${n})</span></div>`).join("")+'</div>';
}
function exportExcel(){
 const rows=filtered.length?filtered:data;
 const cols=COLUMNS;
 const matrix=[
   ["إدارة وكشف المخيمات — إدارة مخيم أبو عريبان"],
   [`كشف شامل — عدد السجلات: ${rows.length}`],
   [`تاريخ التصدير: ${new Date().toLocaleString('ar-EG')}`],
   [],
   cols,
   ...rows.map(r=>cols.map(c=>r[c]??""))
 ];
 downloadXLSX(matrix,`كشف-المخيم-الشامل-${dateStamp()}.xlsx`,{headerRow:5,title:"كشف المخيم الشامل"});
 toast("تم تصدير الكشف بصيغة Excel XLSX");
}

function xmlEsc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}
function colName(n){let s="";while(n>0){let r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26)}return s}
function crc32(bytes){
 let table=crc32.table;if(!table){table=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);table[n]=c>>>0}crc32.table=table}
 let c=0xFFFFFFFF;for(let i=0;i<bytes.length;i++)c=table[(c^bytes[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;
}
function u16(v){return new Uint8Array([v&255,(v>>>8)&255])}
function u32(v){return new Uint8Array([v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255])}
function concatBytes(parts){let len=parts.reduce((a,b)=>a+b.length,0),out=new Uint8Array(len),p=0;for(const b of parts){out.set(b,p);p+=b.length}return out}
function zipStore(files){
 const enc=new TextEncoder(), locals=[], centrals=[];let offset=0;
 const now=new Date(), dosTime=(now.getHours()<<11)|(now.getMinutes()<<5)|Math.floor(now.getSeconds()/2), dosDate=((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate();
 for(const f of files){const name=enc.encode(f.name),data=enc.encode(f.data),crc=crc32(data);const local=concatBytes([new Uint8Array([80,75,3,4]),u16(20),u16(0),u16(0),u16(dosTime),u16(dosDate),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);locals.push(local);const central=concatBytes([new Uint8Array([80,75,1,2]),u16(20),u16(20),u16(0),u16(0),u16(dosTime),u16(dosDate),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);centrals.push(central);offset+=local.length}
 const body=concatBytes(locals),cd=concatBytes(centrals),end=concatBytes([new Uint8Array([80,75,5,6]),u16(0),u16(0),u16(files.length),u16(files.length),u32(cd.length),u32(body.length),u16(0)]);
 return concatBytes([body,cd,end]);
}
function worksheetXML(matrix,headerRow,title){
 const maxCols=Math.max(1,...matrix.map(r=>r.length));
 const widths=Array.from({length:maxCols},(_,ci)=>{
   const max=Math.max(1,...matrix.map(r=>String(r[ci]??"").replace(/\r?\n/g," ").length));
   return Math.min(42,Math.max(10,max+3));
 });
 let rows=[];
 matrix.forEach((row,ri)=>{
   const rnum=ri+1;
   const height=ri===headerRow-1?34:(ri<4?24:26);
   let cells=[];
   if(!row.length){rows.push(`<row r="${rnum}" ht="${height}" customHeight="1"/>`);return}
   row.forEach((v,ci)=>{
     if(v===null||v===undefined||v==="")return;
     const ref=colName(ci+1)+rnum;
     const style=ri===0?1:(ri===headerRow-1?2:(ri===1||ri===2?3:0));
     cells.push(`<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`);
   });
   rows.push(`<row r="${rnum}" ht="${height}" customHeight="1">${cells.join("")}</row>`);
 });
 const last=colName(maxCols)+(matrix.length||1);
 const headerRef=headerRow?`A${headerRow}:${colName(maxCols)}${headerRow}`:"";
 const colsXml=widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("");
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0" rightToLeft="1"><pane ySplit="${headerRow||1}" topLeftCell="A${(headerRow||1)+1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols>${colsXml}</cols><sheetData>${rows.join("")}</sheetData>${headerRef?`<autoFilter ref="${headerRef}"/>`:''}<mergeCells count="3"><mergeCell ref="A1:${colName(maxCols)}1"/><mergeCell ref="A2:${colName(maxCols)}2"/><mergeCell ref="A3:${colName(maxCols)}3"/></mergeCells></worksheet>`;
}
function downloadXLSX(matrix,name,opts={}){
 const enc=new TextEncoder(), sheet=worksheetXML(matrix,opts.headerRow||0,opts.title||"");
 const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="16"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="E8EEF7"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="1" borderId="0"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="1" borderId="0"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs></styleSheet>`;
 const files=[
  {name:"[Content_Types].xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`},
  {name:"_rels/.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
  {name:"xl/workbook.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="كشف المخيم" sheetId="1" r:id="rId1"/></sheets></workbook>`},
  {name:"xl/_rels/workbook.xml.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
  {name:"xl/styles.xml",data:styles},
  {name:"xl/worksheets/sheet1.xml",data:sheet}
 ];
 const bytes=zipStore(files);const blob=new Blob([bytes],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});downloadBlob(blob,name);
}
function backup(){
 const payload={app:"إدارة وكشف المخيمات",version:1,createdAt:new Date().toISOString(),columns:COLUMNS,data};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json;charset=utf-8"});
 downloadBlob(blob,`نسخة-احتياطية-المخيم-${dateStamp()}.json`);toast("تم إنشاء النسخة الاحتياطية");
}
function restoreBackup(e){
 const f=e.target.files[0];if(!f)return;const reader=new FileReader();
 reader.onload=()=>{try{const p=JSON.parse(reader.result), rows=Array.isArray(p)?p:p.data;if(!Array.isArray(rows))throw Error();
 if(confirm(`سيتم استبدال البيانات الحالية بـ ${rows.length} سجل. هل تريد المتابعة؟`)){data=rows;renumber();autoSave();rebuildFilters();renderAll();toast("تمت استعادة النسخة الاحتياطية")}
 }catch(err){alert("ملف النسخة الاحتياطية غير صالح")}};
 reader.readAsText(f);e.target.value="";
}
function downloadBlob(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},100)}
function csvCell(x){x=String(x??"").replace(/\r?\n/g," ");return `"${x.replace(/"/g,'""')}"`}
function dateStamp(){return new Date().toISOString().slice(0,10)}
function v(id){return document.getElementById(id).value||""} function setv(id,val){document.getElementById(id).value=val??""}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}


let classifiedRows = [];
let classifiedTitle = "كشف مصنف";
let selectedPeople = new Set();
let selectedReportColumns = [];
let reportColumnsInitialized = false;

const REPORT_COLUMNS = [
 ["اسم الفرد","اسم الفرد"],["اسم رب الأسرة","اسم رب الأسرة"],["رقم هوية الأسرة","رقم هوية الأسرة"],
 ["رقم الجوال","رقم الجوال"],["رقم جوال بديل","رقم جوال بديل"],["العنوان","العنوان"],
 ["داخل/خارج المخيم","داخل/خارج المخيم"],["حالة اكتمال بيانات الأسرة","اكتمال بيانات الأسرة"],
 ["المحافظة الأصلية","المحافظة الأصلية"],["حالة المسكن الأصلي","حالة المسكن الأصلي"],["نوع السكن الحالي","نوع السكن الحالي"],
 ["صلة القرابة","صلة القرابة"],["الجنس","الجنس"],["الحالة الاجتماعية","الحالة الاجتماعية"],["تاريخ الميلاد","تاريخ الميلاد"],
 ["العمر التقريبي","العمر"],["رقم هوية الفرد","رقم هوية الفرد"],["مرض مزمن؟","مرض مزمن؟"],["نوع المرض","نوع المرض"],
 ["إصابة؟","إصابة؟"],["سبب الإصابة","سبب الإصابة"],["تفاصيل الإصابة","تفاصيل الإصابة"],
 ["إعاقة؟","إعاقة؟"],["نوع الإعاقة","نوع الإعاقة"],["يتيم/منفصل عن ذويه؟","يتيم/منفصل عن ذويه؟"],
 ["حامل؟","حامل؟"],["مرضعة؟","مرضعة؟"],["ملاحظات الفرد","ملاحظات الفرد"],["ملاحظات الأسرة","ملاحظات الأسرة"],
 ["عدد أفراد الأسرة","عدد أفراد الأسرة"],
 ["رب الأسرة — رقم الهوية","رقم هوية رب الأسرة"],["رب الأسرة — رقم الجوال","رقم جوال رب الأسرة"],["رب الأسرة — رقم الجوال البديل","رقم الجوال البديل لرب الأسرة"],["رب الأسرة — العنوان","عنوان رب الأسرة"],["رب الأسرة — داخل/خارج المخيم","إقامة رب الأسرة (داخل/خارج المخيم)"],["رب الأسرة — المحافظة الأصلية","المحافظة الأصلية لرب الأسرة"],["رب الأسرة — حالة المسكن الأصلي","حالة المسكن الأصلي لرب الأسرة"],["رب الأسرة — نوع السكن الحالي","نوع السكن الحالي لرب الأسرة"],["رب الأسرة — الحالة الاجتماعية","الحالة الاجتماعية لرب الأسرة"],["رب الأسرة — تاريخ الميلاد","تاريخ ميلاد رب الأسرة"],["رب الأسرة — العمر","عمر رب الأسرة"],["رب الأسرة — الجنس","جنس رب الأسرة"],["رب الأسرة — مرض مزمن","مرض مزمن لرب الأسرة"],["رب الأسرة — نوع المرض","نوع مرض رب الأسرة"],["رب الأسرة — إصابة","إصابة رب الأسرة"],["رب الأسرة — سبب الإصابة","سبب إصابة رب الأسرة"],["رب الأسرة — تفاصيل الإصابة","تفاصيل إصابة رب الأسرة"],["رب الأسرة — إعاقة","إعاقة رب الأسرة"],["رب الأسرة — نوع الإعاقة","نوع إعاقة رب الأسرة"],["رب الأسرة — يتيم/منفصل","حالة اليتم/الانفصال لرب الأسرة"],["رب الأسرة — حامل","حمل رب الأسرة"],["رب الأسرة — مرضعة","رضاعة رب الأسرة"],["رب الأسرة — ملاحظات","ملاحظات رب الأسرة"],
 ["الزوجة — الاسم","اسم الزوجة"],["الزوجة — رقم الهوية","رقم هوية الزوجة"],["الزوجة — العمر","عمر الزوجة"],["الزوجة — تاريخ الميلاد","تاريخ ميلاد الزوجة"],["الزوجة — الجنس","جنس الزوجة"],["الزوجة — الحالة الاجتماعية","الحالة الاجتماعية للزوجة"],["الزوجة — مرض مزمن","مرض مزمن للزوجة"],["الزوجة — نوع المرض","نوع مرض الزوجة"],["الزوجة — إصابة","إصابة الزوجة"],["الزوجة — سبب الإصابة","سبب إصابة الزوجة"],["الزوجة — تفاصيل الإصابة","تفاصيل إصابة الزوجة"],["الزوجة — إعاقة","إعاقة الزوجة"],["الزوجة — نوع الإعاقة","نوع إعاقة الزوجة"],["الزوجة — يتيم/منفصل","حالة اليتم/الانفصال للزوجة"],["الزوجة — حامل","حمل الزوجة"],["الزوجة — مرضعة","رضاعة الزوجة"],["الزوجة — ملاحظات","ملاحظات الزوجة"]
];

function ageOf(r){
  let n = parseFloat(String(r["العمر التقريبي"]||"").replace(/[^\d.]/g,""));
  if(!Number.isNaN(n)) return n;
  const d = r["تاريخ الميلاد"];
  if(d){
    const dt = new Date(d);
    if(!Number.isNaN(dt.getTime())){
      const now = new Date();
      let age = now.getFullYear()-dt.getFullYear();
      const m = now.getMonth()-dt.getMonth();
      if(m<0 || (m===0 && now.getDate()<dt.getDate())) age--;
      return age;
    }
  }
  return null;
}
function hasSpecial(r,type){
  if(type==="injured") return (r["إصابة؟"]||r["إصابة?"])==="نعم";
  if(type==="pregnant") return r["حامل؟"]==="نعم";
  if(type==="lactating") return r["مرضعة؟"]==="نعم";
  if(type==="disabled") return r["إعاقة؟"]==="نعم";
  if(type==="orphan") return r["يتيم/منفصل عن ذويه؟"]==="نعم";
  if(type==="chronic") return r["مرض مزمن؟"]==="نعم";
  if(type==="widowed") return String(r["الحالة الاجتماعية"]||"").includes("أرمل");
  if(type==="divorced") return String(r["الحالة الاجتماعية"]||"").includes("مطلق");
  return true;
}
function normalizeGender(g){return ["انثى","أنثى"].includes(g)?"أنثى":g}
function familyHeadRecord(r){ return (familyMap().get(r["اسم رب الأسرة"])||[])[0] || r; }

function initReportColumns(){
  if(!reportColumnsInitialized){ selectedReportColumns = REPORT_COLUMNS.map(x=>x[0]); reportColumnsInitialized = true; }
  const box=document.getElementById("reportColumns"); if(!box)return;
  const groups=[
    {title:"بيانات الفرد", desc:"البيانات الخاصة بكل فرد في السجل", cls:"report-fields-section basic", key:"basic", keys:[
      "اسم الفرد","رقم هوية الفرد","صلة القرابة","الجنس","الحالة الاجتماعية","تاريخ الميلاد","العمر التقريبي",
      "مرض مزمن؟","نوع المرض","إصابة؟","سبب الإصابة","تفاصيل الإصابة","إعاقة؟","نوع الإعاقة",
      "يتيم/منفصل عن ذويه؟","حامل؟","مرضعة؟","ملاحظات الفرد"
    ]},
    {title:"بيانات رب الأسرة", desc:"كل الحقول التي تخص رب الأسرة فقط", cls:"report-fields-section head", key:"head", keys:[
      "اسم رب الأسرة","رب الأسرة — رقم الهوية","رب الأسرة — رقم الجوال","رب الأسرة — رقم الجوال البديل","رب الأسرة — العنوان",
      "رب الأسرة — داخل/خارج المخيم","رب الأسرة — المحافظة الأصلية","رب الأسرة — حالة المسكن الأصلي","رب الأسرة — نوع السكن الحالي",
      "رب الأسرة — الحالة الاجتماعية","رب الأسرة — تاريخ الميلاد","رب الأسرة — العمر","رب الأسرة — الجنس","رب الأسرة — مرض مزمن",
      "رب الأسرة — نوع المرض","رب الأسرة — إصابة","رب الأسرة — سبب الإصابة","رب الأسرة — تفاصيل الإصابة","رب الأسرة — إعاقة",
      "رب الأسرة — نوع الإعاقة","رب الأسرة — يتيم/منفصل","رب الأسرة — حامل","رب الأسرة — مرضعة","رب الأسرة — ملاحظات"
    ]},
    {title:"بيانات الزوجة", desc:"كل الحقول التي تخص الزوجة فقط — بدون رقم جوال", cls:"report-fields-section wife", key:"wife", keys:[
      "الزوجة — الاسم","الزوجة — رقم الهوية","الزوجة — تاريخ الميلاد","الزوجة — العمر","الزوجة — الجنس","الزوجة — الحالة الاجتماعية",
      "الزوجة — مرض مزمن","الزوجة — نوع المرض","الزوجة — إصابة","الزوجة — سبب الإصابة","الزوجة — تفاصيل الإصابة",
      "الزوجة — إعاقة","الزوجة — نوع الإعاقة","الزوجة — يتيم/منفصل","الزوجة — حامل","الزوجة — مرضعة","الزوجة — ملاحظات"
    ]},
    {title:"بيانات الأسرة", desc:"معلومات الأسرة العامة التي يمكن إضافتها إلى الكشف", cls:"report-fields-section family", key:"family", keys:[
      "رقم هوية الأسرة","عدد أفراد الأسرة","رقم الجوال","رقم جوال بديل","العنوان","داخل/خارج المخيم","حالة اكتمال بيانات الأسرة",
      "المحافظة الأصلية","حالة المسكن الأصلي","نوع السكن الحالي","ملاحظات الأسرة"
    ]}
  ];
  box.innerHTML=groups.map(g=>`<div class="${g.cls}">
    <div class="report-fields-title"><div><span>${esc(g.title)}</span><small class="report-fields-desc">${esc(g.desc)}</small></div>
      <div class="report-group-tools"><button type="button" class="btn btn-sm" onclick="toggleReportGroup('${g.key}',true)">تحديد الكل</button><button type="button" class="btn btn-sm" onclick="toggleReportGroup('${g.key}',false)">إلغاء الكل</button></div>
    </div>
    <div class="report-fields-grid">${g.keys.map(key=>{const meta=REPORT_COLUMNS.find(x=>x[0]===key)||[key,key];return `<label class="report-field-item"><input type="checkbox" class="report-col" value="${esc(key)}" ${selectedReportColumns.includes(key)?"checked":""} onchange="syncReportColumns();syncReportGroupOptions()"><span>${esc(meta[1])}</span></label>`}).join("")}</div>
  </div>`).join("");
  syncReportGroupOptions();
}
function syncReportColumns(){
  selectedReportColumns=[...document.querySelectorAll(".report-col:checked")].map(x=>x.value);
}
const REPORT_GROUPS={
 basic:["اسم الفرد","رقم هوية الفرد","صلة القرابة","الجنس","الحالة الاجتماعية","تاريخ الميلاد","العمر التقريبي","مرض مزمن؟","نوع المرض","إصابة؟","سبب الإصابة","تفاصيل الإصابة","إعاقة؟","نوع الإعاقة","يتيم/منفصل عن ذويه؟","حامل؟","مرضعة؟","ملاحظات الفرد"],
 head:["اسم رب الأسرة","رب الأسرة — رقم الهوية","رب الأسرة — رقم الجوال","رب الأسرة — رقم الجوال البديل","رب الأسرة — العنوان","رب الأسرة — داخل/خارج المخيم","رب الأسرة — المحافظة الأصلية","رب الأسرة — حالة المسكن الأصلي","رب الأسرة — نوع السكن الحالي","رب الأسرة — الحالة الاجتماعية","رب الأسرة — تاريخ الميلاد","رب الأسرة — العمر","رب الأسرة — الجنس","رب الأسرة — مرض مزمن","رب الأسرة — نوع المرض","رب الأسرة — إصابة","رب الأسرة — سبب الإصابة","رب الأسرة — تفاصيل الإصابة","رب الأسرة — إعاقة","رب الأسرة — نوع الإعاقة","رب الأسرة — يتيم/منفصل","رب الأسرة — حامل","رب الأسرة — مرضعة","رب الأسرة — ملاحظات"],
 wife:["الزوجة — الاسم","الزوجة — رقم الهوية","الزوجة — تاريخ الميلاد","الزوجة — العمر","الزوجة — الجنس","الزوجة — الحالة الاجتماعية","الزوجة — مرض مزمن","الزوجة — نوع المرض","الزوجة — إصابة","الزوجة — سبب الإصابة","الزوجة — تفاصيل الإصابة","الزوجة — إعاقة","الزوجة — نوع الإعاقة","الزوجة — يتيم/منفصل","الزوجة — حامل","الزوجة — مرضعة","الزوجة — ملاحظات"],
 family:["رقم هوية الأسرة","عدد أفراد الأسرة","رقم الجوال","رقم جوال بديل","العنوان","داخل/خارج المخيم","حالة اكتمال بيانات الأسرة","المحافظة الأصلية","حالة المسكن الأصلي","نوع السكن الحالي","ملاحظات الأسرة"]
};
function toggleReportGroup(group,checked){
  reportColumnsInitialized=true;
  const keys=REPORT_GROUPS[group]||[];
  const set=new Set(selectedReportColumns);
  keys.forEach(k=>checked?set.add(k):set.delete(k));
  selectedReportColumns=[...set];
  initReportColumns();
}
function syncReportGroupOptions(){
  document.querySelectorAll('.report-fields-section').forEach(section=>{
    const checks=[...section.querySelectorAll('.report-col')];
    const all=checks.length>0 && checks.every(x=>x.checked);
    section.classList.toggle('all-selected',all);
  });
}
function selectAllReportColumns(){
  reportColumnsInitialized=true;
  selectedReportColumns=REPORT_COLUMNS.map(x=>x[0]); initReportColumns();
}
function selectBasicReportColumns(){
  reportColumnsInitialized=true;
  selectedReportColumns=["اسم الفرد","اسم رب الأسرة","رقم هوية الأسرة","رقم الجوال","صلة القرابة","الجنس","الحالة الاجتماعية","تاريخ الميلاد","العمر التقريبي"];
  initReportColumns();
}
function clearReportColumns(){ reportColumnsInitialized=true; selectedReportColumns=[]; initReportColumns(); }
function selectFamilyHeadColumns(){
  selectedReportColumns=["اسم رب الأسرة","رب الأسرة — رقم الهوية","رب الأسرة — رقم الجوال","رب الأسرة — رقم الجوال البديل","رب الأسرة — العنوان","رب الأسرة — داخل/خارج المخيم","رب الأسرة — المحافظة الأصلية","رب الأسرة — حالة المسكن الأصلي","رب الأسرة — نوع السكن الحالي","رب الأسرة — الحالة الاجتماعية","رب الأسرة — تاريخ الميلاد","رب الأسرة — العمر","رب الأسرة — الجنس","رب الأسرة — مرض مزمن","رب الأسرة — نوع المرض","رب الأسرة — إصابة","رب الأسرة — سبب الإصابة","رب الأسرة — تفاصيل الإصابة","رب الأسرة — إعاقة","رب الأسرة — نوع الإعاقة","رب الأسرة — يتيم/منفصل","رب الأسرة — حامل","رب الأسرة — مرضعة","رب الأسرة — ملاحظات","عدد أفراد الأسرة"];
  initReportColumns();
}
function selectWifeColumns(){
  selectedReportColumns=["الزوجة — الاسم","الزوجة — رقم الهوية","الزوجة — العمر","الزوجة — تاريخ الميلاد","الزوجة — الجنس","الزوجة — الحالة الاجتماعية","الزوجة — مرض مزمن","الزوجة — نوع المرض","الزوجة — إصابة","الزوجة — سبب الإصابة","الزوجة — تفاصيل الإصابة","الزوجة — إعاقة","الزوجة — نوع الإعاقة","الزوجة — يتيم/منفصل","الزوجة — حامل","الزوجة — مرضعة","الزوجة — ملاحظات"];
  initReportColumns();
}
function selectFamilySummaryColumns(){
  selectedReportColumns=["اسم رب الأسرة","رب الأسرة — رقم الهوية","رب الأسرة — رقم الجوال","رب الأسرة — داخل/خارج المخيم","عدد أفراد الأسرة","الزوجة — الاسم","الزوجة — رقم الهوية","الزوجة — العمر"];
  initReportColumns();
}
function familyPeople(r){
  const fid=String(r["رقم هوية الأسرة"]||"").trim(), head=String(r["اسم رب الأسرة"]||"").trim();
  return data.filter(x=>{const xf=String(x["رقم هوية الأسرة"]||"").trim(),xh=String(x["اسم رب الأسرة"]||"").trim();return (fid&&xf===fid)||( !fid && xh===head);});
}
function familyCount(r){
  const fam=familyPeople(r), seen=new Set();
  fam.forEach(x=>{const id=String(x["رقم هوية الفرد"]||"").trim(), name=String(x["اسم الفرد"]||"").trim(), rel=String(x["صلة القرابة"]||"").trim(); const k=id||`${name}|${rel}`; if(k)seen.add(k);});
  return seen.size || fam.length;
}
function wifeRecord(r){ return familyPeople(r).find(x=>/زوجة|زوجته|زوج/.test(String(x["صلة القرابة"]||"").trim())) || null; }
function reportValue(r,c){
  if(c==="عدد أفراد الأسرة") return familyCount(r);
  if(c.startsWith("رب الأسرة — ")){ const h=familyHeadRecord(r); const m={"رب الأسرة — رقم الهوية":"رقم هوية الفرد","رب الأسرة — رقم الجوال":"رقم الجوال","رب الأسرة — رقم الجوال البديل":"رقم جوال بديل","رب الأسرة — العنوان":"العنوان","رب الأسرة — داخل/خارج المخيم":"داخل/خارج المخيم","رب الأسرة — المحافظة الأصلية":"المحافظة الأصلية","رب الأسرة — حالة المسكن الأصلي":"حالة المسكن الأصلي","رب الأسرة — نوع السكن الحالي":"نوع السكن الحالي","رب الأسرة — الحالة الاجتماعية":"الحالة الاجتماعية","رب الأسرة — تاريخ الميلاد":"تاريخ الميلاد","رب الأسرة — 年齢":"العمر التقريبي","رب الأسرة — العمر":"العمر التقريبي","رب الأسرة — الجنس":"الجنس","رب الأسرة — مرض مزمن":"مرض مزمن؟","رب الأسرة — نوع المرض":"نوع المرض","رب الأسرة — إصابة":"إصابة؟","رب الأسرة — سبب الإصابة":"سبب الإصابة","رب الأسرة — تفاصيل الإصابة":"تفاصيل الإصابة","رب الأسرة — إعاقة":"إعاقة؟","رب الأسرة — نوع الإعاقة":"نوع الإعاقة","رب الأسرة — يتيم/منفصل":"يتيم/منفصل عن ذويه؟","رب الأسرة — حامل":"حامل؟","رب الأسرة — مرضعة":"مرضعة؟","رب الأسرة — ملاحظات":"ملاحظات الفرد"}; const k=m[c]; return k==="العمر التقريبي"?(ageOf(h)??h[k]??""):(h?.[k]??""); }
  if(c.startsWith("الزوجة — ")){ const w=wifeRecord(r); if(!w)return ""; const m={"الزوجة — الاسم":"اسم الفرد","الزوجة — رقم الهوية":"رقم هوية الفرد","الزوجة — العمر":"العمر التقريبي","الزوجة — تاريخ الميلاد":"تاريخ الميلاد","الزوجة — الجنس":"الجنس","الزوجة — الحالة الاجتماعية":"الحالة الاجتماعية","الزوجة — مرض مزمن":"مرض مزمن؟","الزوجة — نوع المرض":"نوع المرض","الزوجة — إصابة":"إصابة؟","الزوجة — سبب الإصابة":"سبب الإصابة","الزوجة — تفاصيل الإصابة":"تفاصيل الإصابة","الزوجة — إعاقة":"إعاقة؟","الزوجة — نوع الإعاقة":"نوع الإعاقة","الزوجة — يتيم/منفصل":"يتيم/منفصل عن ذويه؟","الزوجة — حامل":"حامل؟","الزوجة — مرضعة":"مرضعة؟","الزوجة — ملاحظات":"ملاحظات الفرد"}; const k=m[c]; return k==="العمر التقريبي"?(ageOf(w)??w[k]??""):(w[k]??""); }
  return c==="العمر التقريبي"?(ageOf(r)??r[c]??""):(r[c]??"");
}

function renderPersonPicker(){
  const box=document.getElementById("personPicker"); if(!box)return;
  const q=(document.getElementById("cr_person_search").value||"").trim().toLowerCase();
  const rows=data.filter(r=>{
    if(!q)return true;
    return [r["اسم الفرد"],r["رقم هوية الفرد"],r["اسم رب الأسرة"],r["رقم هوية الأسرة"],r["رقم الجوال"]]
      .some(v=>String(v||"").toLowerCase().includes(q));
  }).slice(0,120);
  box.innerHTML=rows.map(r=>{
    const id=String(r["رقم هوية الفرد"]||"")+"|"+String(r["اسم الفرد"]||"")+"|"+String(r["اسم رب الأسرة"]||"");
    const checked=selectedPeople.has(id)?"checked":"";
    return `<label style="display:flex;align-items:center;gap:8px;padding:7px;border-bottom:1px solid #f0f0f0">
      <input type="checkbox" class="person-choice" data-person-id="${esc(id)}" ${checked} onchange="togglePersonSelection(this)">
      <span><b>${esc(r["اسم الفرد"]||"")}</b> — ${esc(r["اسم رب الأسرة"]||"")} — ${esc(r["رقم هوية الفرد"]||"")}</span>
    </label>`;
  }).join("") || '<div class="empty">لا توجد نتائج</div>';
  document.getElementById("selectedPeopleCount").textContent=selectedPeople.size?`تم اختيار ${selectedPeople.size} شخص`:"لم يتم اختيار أشخاص";
}
function togglePersonSelection(el){
  const id=el.dataset.personId;
  if(el.checked)selectedPeople.add(id); else selectedPeople.delete(id);
  document.getElementById("selectedPeopleCount").textContent=selectedPeople.size?`تم اختيار ${selectedPeople.size} شخص`:"لم يتم اختيار أشخاص";
}
function selectAllVisiblePeople(){
  document.querySelectorAll(".person-choice").forEach(el=>{el.checked=true;selectedPeople.add(el.dataset.personId)});
  renderPersonPicker();
}
function clearSelectedPeople(){selectedPeople.clear();renderPersonPicker();}
function personIdOf(r){return String(r["رقم هوية الفرد"]||"")+"|"+String(r["اسم الفرد"]||"")+"|"+String(r["اسم رب الأسرة"]||"");}

function extraColumnsForSpecial(){
  const s=document.getElementById("cr_special")?.value||"";
  if(s==="injured") return ["إصابة؟","سبب الإصابة","تفاصيل الإصابة"];
  if(s==="disabled") return ["إعاقة؟","نوع الإعاقة"];
  if(s==="pregnant") return ["حامل؟"];
  if(s==="lactating") return ["مرضعة؟"];
  return [];
}
function reportColumns(){
  syncReportColumns();
  let cols=[...selectedReportColumns];
  extraColumnsForSpecial().forEach(c=>{if(!cols.includes(c))cols.push(c)});
  return cols;
}
function reportRow(r){ return r; }

function setReportPreset(type){
  clearCustomReport(false);
  const configs={
   injured:["كشف المصابين","","","","","injured"],
   pregnant:["كشف الحوامل","","","","","pregnant"],
   lactating:["كشف المرضعات","","","","","lactating"],
   disabled:["كشف ذوي الإعاقة","","","","","disabled"],
   elderFemale:["كشف كبار السن - إناث","أنثى","60","","",""],
   elderMale:["كشف كبار السن - ذكور","ذكر","60","","",""],
   widowed:["كشف الأرامل","أنثى","","","","widowed"],
   divorced:["كشف المطلقات","أنثى","","","","divorced"],
   children:["كشف الأطفال","","0","17","",""]
  };
  const c=configs[type]; classifiedTitle=c[0];
  document.getElementById("cr_name").value=c[0];
  document.getElementById("cr_gender").value=c[1];
  document.getElementById("cr_minage").value=c[2];
  document.getElementById("cr_maxage").value=c[3];
  document.getElementById("cr_rel").value="";
  document.getElementById("cr_special").value=c[5]||"";
  selectedPeople.clear();
  if(type==="injured") selectedReportColumns=["اسم الفرد","اسم رب الأسرة","رقم هوية الفرد","رقم الجوال","صلة القرابة","الجنس","العمر التقريبي","إصابة؟","سبب الإصابة","تفاصيل الإصابة"];
  else if(type==="disabled") selectedReportColumns=["اسم الفرد","اسم رب الأسرة","رقم هوية الفرد","رقم الجوال","صلة القرابة","الجنس","العمر التقريبي","إعاقة؟","نوع الإعاقة"];
  else if(type==="pregnant") selectedReportColumns=["اسم الفرد","اسم رب الأسرة","رقم هوية الفرد","رقم الجوال","صلة القرابة","الجنس","العمر التقريبي","الحالة الاجتماعية","حامل؟"];
  else if(type==="lactating") selectedReportColumns=["اسم الفرد","اسم رب الأسرة","رقم هوية الفرد","رقم الجوال","صلة القرابة","الجنس","العمر التقريبي","الحالة الاجتماعية","مرضعة؟"];
  else if(type==="widowed" || type==="divorced") selectedReportColumns=["اسم الفرد","اسم رب الأسرة","رقم هوية الفرد","رقم الجوال","الجنس","العمر التقريبي","الحالة الاجتماعية","العنوان"];
  else selectedReportColumns=["اسم الفرد","اسم رب الأسرة","رقم هوية الفرد","رقم الجوال","صلة القرابة","الجنس","العمر التقريبي","الحالة الاجتماعية"];
  initReportColumns(); renderPersonPicker(); runCustomReport();
}
function clearCustomReport(clearName=true){
  if(clearName)document.getElementById("cr_name").value="";
  document.getElementById("cr_gender").value="";
  document.getElementById("cr_minage").value="";
  document.getElementById("cr_maxage").value="";
  document.getElementById("cr_rel").value="";
  document.getElementById("cr_special").value="";
  document.getElementById("cr_person_search").value="";
  document.getElementById("cr_only_selected").checked=false;
  selectedPeople.clear(); selectedReportColumns=[];
  classifiedRows=[]; classifiedTitle="كشف مصنف";
  initReportColumns(); renderPersonPicker();
  if(document.getElementById("classifiedBody"))renderClassified();
}
function reportUsesOnlyFamilyLevelColumns(cols){
  const familyLevel=new Set([...(REPORT_GROUPS.head||[]),...(REPORT_GROUPS.wife||[]),...(REPORT_GROUPS.family||[])]);
  return cols.length>0 && cols.every(c=>familyLevel.has(c));
}
function uniqueFamilyRows(rows){
  const out=[], seen=new Set();
  rows.forEach(r=>{
    const fid=String(r["رقم هوية الأسرة"]||"").trim();
    const head=String(r["اسم رب الأسرة"]||"").trim();
    const key=fid || head;
    if(!key || seen.has(key))return;
    seen.add(key);
    const fam=familyPeople(r);
    const h=fam.find(x=>String(x["صلة القرابة"]||"").trim()==="رب الأسرة") || familyHeadRecord(r) || r;
    out.push(h);
  });
  return out;
}

function runCustomReport(){
 const name=(document.getElementById("cr_name").value||"").trim()||"كشف مصنف";
 const gender=document.getElementById("cr_gender").value;
 const min=document.getElementById("cr_minage").value===""?null:+document.getElementById("cr_minage").value;
 const max=document.getElementById("cr_maxage").value===""?null:+document.getElementById("cr_maxage").value;
 const special=document.getElementById("cr_special").value;
 const rel=(document.getElementById("cr_rel").value||"").trim().toLowerCase();
 const onlySelected=document.getElementById("cr_only_selected").checked;
 syncReportColumns();
 classifiedTitle=name;
 classifiedRows=data.filter(r=>{
   if(onlySelected && !selectedPeople.has(personIdOf(r)))return false;
   if(gender && normalizeGender(r["الجنس"])!==normalizeGender(gender))return false;
   const age=ageOf(r);
   if(min!==null && (age===null || age<min))return false;
   if(max!==null && (age===null || age>max))return false;
   if(special && !hasSpecial(r,special))return false;
   if(rel && !(r["صلة القرابة"]||"").toLowerCase().includes(rel))return false;
   return true;
 });
 const sort=document.getElementById("cr_sort").value;
 classifiedRows.sort((a,b)=>{
   if(sort==="name")return (a["اسم الفرد"]||"").localeCompare(b["اسم الفرد"]||"","ar");
   if(sort==="age")return (ageOf(a)??999)-(ageOf(b)??999);
   return (a["اسم رب الأسرة"]||"").localeCompare(b["اسم رب الأسرة"]||"","ar");
 });
 renderClassified();
 toast(`تم إنشاء ${name} — ${classifiedRows.length} سجل`);
}
function renderClassified(){
 if(!document.getElementById("classifiedBody"))return;
 const cols=reportColumns();
 document.getElementById("classifiedHead").innerHTML="<tr><th>#</th>"+cols.map(c=>`<th>${esc((REPORT_COLUMNS.find(x=>x[0]===c)||["",c])[1])}</th>`).join("")+"</tr>";
 document.getElementById("classifiedBody").innerHTML=classifiedRows.map((r,i)=>{
   return "<tr><td>"+(i+1)+"</td>"+cols.map(c=>`<td>${esc(reportValue(r,c))}</td>`).join("")+"</tr>";
 }).join("") || `<tr><td colspan="${cols.length+1}" class="empty">لا توجد نتائج مطابقة للشروط</td></tr>`;
 document.getElementById("classifiedTitle").textContent=classifiedTitle;
 document.getElementById("classifiedMeta").textContent=`تاريخ الإنشاء: ${new Date().toLocaleString('ar-EG')} — عدد السجلات: ${classifiedRows.length}`;
 document.getElementById("classifiedCount").textContent=`عدد النتائج: ${classifiedRows.length}`;
}

function exportClassifiedExcel(){
 if(!classifiedRows.length){toast("أنشئ كشفاً مصنفاً أولاً");return}
 const cols=reportColumns();
 const labels=cols.map(c=>(REPORT_COLUMNS.find(x=>x[0]===c)||["",c])[1]);
 const matrix=[
  ["إدارة وكشف المخيمات — إدارة مخيم أبو عريبان"],
  [classifiedTitle],
  [`تاريخ التصدير: ${new Date().toLocaleString('ar-EG')} — عدد السجلات: ${classifiedRows.length}`],
  [],
  ["#",...labels]
 ];
 classifiedRows.forEach((r,i)=>{
   matrix.push([i+1,...cols.map(c=>reportValue(r,c))]);
 });
 downloadXLSX(matrix,`${classifiedTitle}-${dateStamp()}.xlsx`,{headerRow:5,title:classifiedTitle});
 toast("تم تصدير الكشف المصنف بصيغة Excel XLSX");
}

function printClassified(){
 if(!classifiedRows.length){toast("أنشئ كشفاً مصنفاً أولاً");return}
 showView("classified");
 setTimeout(()=>window.print(),50);
}


/* ================= طباعة كشف العائلات المتقدم ================= */

const FAMILY_PRINT_COLUMNS = [
 ["#","#"],
 ["اسم رب الأسرة","اسم رب الأسرة"],
 ["رقم هوية الأسرة","رقم هوية الأسرة"],
 ["تاريخ ميلاد رب الأسرة","تاريخ ميلاد رب الأسرة"],
 ["عمر رب الأسرة","عمر رب الأسرة"],
 ["رقم هوية رب الأسرة","رقم هوية رب الأسرة"],
 ["جنس رب الأسرة","جنس رب الأسرة"],
 ["الحالة الاجتماعية لرب الأسرة","الحالة الاجتماعية لرب الأسرة"],
 ["مرض مزمن لرب الأسرة","مرض مزمن؟ — رب الأسرة"],
 ["نوع مرض رب الأسرة","نوع المرض — رب الأسرة"],
 ["إصابة رب الأسرة","إصابة؟ — رب الأسرة"],
 ["سبب إصابة رب الأسرة","سبب الإصابة — رب الأسرة"],
 ["تفاصيل إصابة رب الأسرة","تفاصيل الإصابة — رب الأسرة"],
 ["إعاقة رب الأسرة","إعاقة؟ — رب الأسرة"],
 ["نوع إعاقة رب الأسرة","نوع الإعاقة — رب الأسرة"],
 ["يتيم/منفصل لرب الأسرة","يتيم/منفصل عن ذويه؟ — رب الأسرة"],
 ["حامل لرب الأسرة","حامل؟ — رب الأسرة"],
 ["مرضعة لرب الأسرة","مرضعة؟ — رب الأسرة"],
 ["ملاحظات رب الأسرة","ملاحظات الفرد — رب الأسرة"],

 ["اسم الزوجة","اسم الزوجة"],
 ["رقم هوية الزوجة","رقم هوية الزوجة"],
 ["تاريخ ميلاد الزوجة","تاريخ ميلاد الزوجة"],
 ["عمر الزوجة","عمر الزوجة"],
 ["جنس الزوجة","جنس الزوجة"],
 ["الحالة الاجتماعية للزوجة","الحالة الاجتماعية للزوجة"],
 ["مرض مزمن للزوجة","مرض مزمن؟ — الزوجة"],
 ["نوع مرض الزوجة","نوع المرض — الزوجة"],
 ["إصابة الزوجة","إصابة؟ — الزوجة"],
 ["سبب إصابة الزوجة","سبب الإصابة — الزوجة"],
 ["تفاصيل إصابة الزوجة","تفاصيل الإصابة — الزوجة"],
 ["إعاقة الزوجة","إعاقة؟ — الزوجة"],
 ["نوع إعاقة الزوجة","نوع الإعاقة — الزوجة"],
 ["يتيم/منفصل للزوجة","يتيم/منفصل عن ذويها؟ — الزوجة"],
 ["حامل للزوجة","حامل؟ — الزوجة"],
 ["مرضعة للزوجة","مرضعة؟ — الزوجة"],
 ["ملاحظات الزوجة","ملاحظات الفرد — الزوجة"],

 ["رقم الجوال","رقم الجوال"],
 ["رقم جوال بديل","رقم جوال بديل"],
 ["العنوان","العنوان"],
 ["داخل/خارج المخيم","داخل/خارج المخيم"],
 ["حالة اكتمال بيانات الأسرة","حالة اكتمال بيانات الأسرة"],
 ["المحافظة الأصلية","المحافظة الأصلية"],
 ["حالة المسكن الأصلي","حالة المسكن الأصلي"],
 ["نوع السكن الحالي","نوع السكن الحالي"],
 ["عدد الأفراد","عدد الأفراد"],
 ["ملاحظات الأسرة","ملاحظات الأسرة"],

 ["أسماء أفراد الأسرة","أسماء أفراد الأسرة — ملخص"],
 ["أرقام هويات أفراد الأسرة","أرقام هويات أفراد الأسرة — ملخص"],
 ["أعمار أفراد الأسرة","أعمار أفراد الأسرة — ملخص"],
 ["صلات القرابة","صلات القرابة — ملخص"],
 ["الحالات الصحية للأفراد","الحالات الصحية — ملخص"],
 ["الإعاقات للأفراد","الإعاقات وأنواعها — ملخص"],
 ["ملاحظات الأفراد","ملاحظات الأفراد — ملخص"]
];

let selectedFamilyPrintColumns = FAMILY_PRINT_COLUMNS.map(x=>x[0]);

function initFamilyPrintColumns(){
  const box=document.getElementById("familyPrintColumns");
  if(!box)return;
  box.innerHTML=FAMILY_PRINT_COLUMNS.map(([k,l])=>`
    <label class="family-print-check">
      <input type="checkbox" class="family-print-col" value="${esc(k)}" ${selectedFamilyPrintColumns.includes(k)?"checked":""}>
      <span>${esc(l)}</span>
    </label>`).join("");
}
function syncFamilyPrintColumns(){
  selectedFamilyPrintColumns=[...document.querySelectorAll(".family-print-col:checked")].map(x=>x.value);
}
function selectAllFamilyPrint(){
  selectedFamilyPrintColumns=FAMILY_PRINT_COLUMNS.map(x=>x[0]);
  initFamilyPrintColumns();
}
function clearAllFamilyPrint(){
  selectedFamilyPrintColumns=[];
  initFamilyPrintColumns();
}
function basicFamilyPrintColumns(){
  selectedFamilyPrintColumns=[
    "#","اسم رب الأسرة","رقم هوية الأسرة","رقم الجوال","رقم جوال بديل",
    "العنوان","داخل/خارج المخيم","حالة اكتمال بيانات الأسرة",
    "عدد الأفراد","اسم الزوجة","رقم هوية الزوجة","تاريخ ميلاد الزوجة","عمر الزوجة"
  ];
  initFamilyPrintColumns();
}
function toggleFamilyPrintColumns(){
  const mode=document.querySelector('input[name="familyPrintMode"]:checked')?.value;
  const box=document.getElementById("familyPrintColumnsBox");
  if(box) box.style.display=mode==="head"?"none":"block";
}
function familyPrintEntries(){
  const m=familyMap();
  let arr=[...m.entries()];
  const scope=document.getElementById("familyPrintScope")?.value||"all";
  if(scope==="filtered"){
    const q=(document.getElementById("fq")?.value||"").toLowerCase().trim();
    const fs=document.getElementById("fsize")?.value||"";
    const st=document.getElementById("fstatus")?.value||"";
    arr=arr.filter(([h,rows])=>{
      const r=rows[0]||{};
      const blob=[h,r["رقم هوية الأسرة"],r["رقم الجوال"],r["العنوان"]].join(" ").toLowerCase();
      if(q&&!blob.includes(q))return false;
      const n=rows.length;
      if(fs==="1"&&n!==1)return false;
      if(fs==="2-4"&&(n<2||n>4))return false;
      if(fs==="5-7"&&(n<5||n>7))return false;
      if(fs==="8"&&n<8)return false;
      if(st&&familyStatus(rows).status!==st)return false;
      return true;
    });
  }
  return arr;
}
function personRole(rows, roles){
  return rows.find(r=>roles.includes(norm(r["صلة القرابة"]))) || null;
}
function personValue(p,key){
  if(!p)return "";
  const map={
    birth:"تاريخ الميلاد", age:"العمر التقريبي", id:"رقم هوية الفرد",
    gender:"الجنس", marital:"الحالة الاجتماعية", chronic:"مرض مزمن؟",
    disease:"نوع المرض", injury:"إصابة؟", injuryReason:"سبب الإصابة",
    injuryDetails:"تفاصيل الإصابة", disability:"إعاقة؟", disabilityType:"نوع الإعاقة",
    orphan:"يتيم/منفصل عن ذويه؟", pregnant:"حامل؟", lactating:"مرضعة؟",
    notes:"ملاحظات الفرد"
  };
  return p[map[key]] ?? "";
}
function familyPrintValue(row,people,key){
  const head=personRole(people,["رب الأسرة"]) || people[0] || null;
  const wife=personRole(people,["زوجة","الزوجة","زوج"]) || null;
  const familyMapKeys={
    "اسم رب الأسرة":"اسم رب الأسرة","رقم هوية الأسرة":"رقم هوية الأسرة",
    "رقم الجوال":"رقم الجوال","رقم جوال بديل":"رقم جوال بديل","العنوان":"العنوان",
    "داخل/خارج المخيم":"داخل/خارج المخيم","حالة اكتمال بيانات الأسرة":"حالة اكتمال بيانات الأسرة",
    "المحافظة الأصلية":"المحافظة الأصلية","حالة المسكن الأصلي":"حالة المسكن الأصلي",
    "نوع السكن الحالي":"نوع السكن الحالي","ملاحظات الأسرة":"ملاحظات الأسرة"
  };
  if(key==="#") return "";
  if(key==="عدد الأفراد") return people.length;

  if(key==="اسم الزوجة") return wife?.["اسم الفرد"]||"";
  if(key==="رقم هوية الزوجة") return personValue(wife,"id");
  if(key==="تاريخ ميلاد الزوجة") return personValue(wife,"birth");
  if(key==="عمر الزوجة") return personValue(wife,"age");
  if(key==="جنس الزوجة") return personValue(wife,"gender");
  if(key==="الحالة الاجتماعية للزوجة") return personValue(wife,"marital");
  if(key==="مرض مزمن للزوجة") return personValue(wife,"chronic");
  if(key==="نوع مرض الزوجة") return personValue(wife,"disease");
  if(key==="إصابة الزوجة") return personValue(wife,"injury");
  if(key==="سبب إصابة الزوجة") return personValue(wife,"injuryReason");
  if(key==="تفاصيل إصابة الزوجة") return personValue(wife,"injuryDetails");
  if(key==="إعاقة الزوجة") return personValue(wife,"disability");
  if(key==="نوع إعاقة الزوجة") return personValue(wife,"disabilityType");
  if(key==="يتيم/منفصل للزوجة") return personValue(wife,"orphan");
  if(key==="حامل للزوجة") return personValue(wife,"pregnant");
  if(key==="مرضعة للزوجة") return personValue(wife,"lactating");
  if(key==="ملاحظات الزوجة") return personValue(wife,"notes");

  const headMap={
    "تاريخ ميلاد رب الأسرة":"birth","عمر رب الأسرة":"age","رقم هوية رب الأسرة":"id",
    "جنس رب الأسرة":"gender","الحالة الاجتماعية لرب الأسرة":"marital",
    "مرض مزمن لرب الأسرة":"chronic","نوع مرض رب الأسرة":"disease",
    "إصابة رب الأسرة":"injury","سبب إصابة رب الأسرة":"injuryReason",
    "تفاصيل إصابة رب الأسرة":"injuryDetails","إعاقة رب الأسرة":"disability",
    "نوع إعاقة رب الأسرة":"disabilityType","يتيم/منفصل لرب الأسرة":"orphan",
    "حامل لرب الأسرة":"pregnant","مرضعة لرب الأسرة":"lactating","ملاحظات رب الأسرة":"notes"
  };
  if(headMap[key]) return personValue(head,headMap[key]);

  if(familyMapKeys[key]) return row[familyMapKeys[key]] ?? "";

  if(key==="أسماء أفراد الأسرة")
    return people.map(p=>p["اسم الفرد"]).filter(Boolean).join(" | ");
  if(key==="أرقام هويات أفراد الأسرة")
    return people.map(p=>p["رقم هوية الفرد"]).filter(Boolean).join(" | ");
  if(key==="أعمار أفراد الأسرة")
    return people.map(p=>p["العمر التقريبي"]).filter(Boolean).join(" | ");
  if(key==="صلات القرابة")
    return people.map(p=>p["صلة القرابة"]).filter(Boolean).join(" | ");
  if(key==="الحالات الصحية للأفراد")
    return people.map(p=>{
      const x=[];
      if(p["مرض مزمن؟"]==="نعم")x.push("مزمن: "+(p["نوع المرض"]||"غير محدد"));
      if(p["إصابة؟"]==="نعم")x.push("إصابة: "+(p["سبب الإصابة"]||"غير محدد"));
      if(p["حامل؟"]==="نعم")x.push("حامل");
      if(p["مرضعة؟"]==="نعم")x.push("مرضعة");
      return p["اسم الفرد"]+": "+(x.join("، ")||"لا توجد");
    }).join(" || ");
  if(key==="الإعاقات للأفراد")
    return people.filter(p=>p["إعاقة؟"]==="نعم")
      .map(p=>p["اسم الفرد"]+": "+(p["نوع الإعاقة"]||"غير محدد")).join(" || ");
  if(key==="ملاحظات الأفراد")
    return people.map(p=>p["اسم الفرد"]+": "+(p["ملاحظات الفرد"]||"")).filter(x=>x.endsWith(": ")===false).join(" || ");
  return "";
}
function openFamilyPrintModal(){
  initFamilyPrintColumns();
  toggleFamilyPrintColumns();
  const scope=document.getElementById("familyPrintScope");
  if(scope)scope.value="all";
  document.getElementById("familyPrintModal").classList.add("show");
}
function familyPrintLabel(k){
  return (FAMILY_PRINT_COLUMNS.find(x=>x[0]===k)||["",k])[1];
}
function printFamilyReport(){
  const mode=document.querySelector('input[name="familyPrintMode"]:checked')?.value||"columns";
  const entries=familyPrintEntries();
  if(!entries.length){toast("لا توجد عائلات مطابقة للطباعة");return}
  syncFamilyPrintColumns();
  let columns=mode==="head"?["اسم رب الأسرة"]:[...selectedFamilyPrintColumns];
  if(mode!=="head" && !columns.length){toast("اختر عموداً واحداً على الأقل");return}

  const rows=entries.map(([h,people],i)=>{
    const r=people[0]||{};
    return {r,people,index:i+1};
  });

  const title=mode==="head"?"كشف أرباب الأسر":"كشف العائلات";
  document.getElementById("familyPrintTitle").textContent=title;
  document.getElementById("familyPrintMeta").textContent=`تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')} — عدد العائلات: ${rows.length}`;

  const tableHead=columns.map(c=>`<th>${esc(familyPrintLabel(c))}</th>`).join("");
  const body=rows.map(x=>`<tr><td>${x.index}</td>${columns.map(c=>`<td>${esc(String(familyPrintValue(x.r,x.people,c)||""))}</td>`).join("")}</tr>`).join("");
  document.getElementById("familyPrintTable").innerHTML=`
    <table>
      <thead><tr><th>#</th>${tableHead}</tr></thead>
      <tbody>${body}</tbody>
    </table>`;

  closeModal("familyPrintModal");
  document.body.classList.add("family-printing");
  setTimeout(()=>{
    window.print();
    setTimeout(()=>document.body.classList.remove("family-printing"),700);
  },100);
}


/* ================= V5: الإدارة المتقدمة وجودة البيانات ================= */

const FAMILY_REQUIRED = ["اسم رب الأسرة","رقم هوية الأسرة","رقم الجوال","داخل/خارج المخيم","المحافظة الأصلية","حالة المسكن الأصلي","نوع السكن الحالي","العنوان"];
const PERSON_REQUIRED = ["اسم الفرد","رقم هوية الفرد","صلة القرابة","الجنس","الحالة الاجتماعية"];
let reportConditions = [];
let qualityIssues = [];
let appLocked = false;

function norm(v){return String(v??"").trim()}
function filled(v){return norm(v)!==""}
function genderIsFemale(v){return ["أنثى","انثى"].includes(norm(v))}
function familyStatus(rows){
  if(!rows || !rows.length) return {status:"غير مكتملة",score:0,missing:["لا توجد سجلات لأفراد الأسرة"]};
  const first=rows[0]||{};
  const familyFilled=FAMILY_REQUIRED.filter(k=>filled(first[k])).length;
  let personTotal=0, personFilled=0, missing=[];
  rows.forEach((r,i)=>{
    PERSON_REQUIRED.forEach(k=>{
      personTotal++;
      if(filled(r[k])) personFilled++;
      else missing.push(`${r["اسم الفرد"]||"فرد رقم "+(i+1)}: ${k}`);
    });
    if(filled(r["تاريخ الميلاد"]) || filled(r["العمر التقريبي"])) personFilled++;
    else {personTotal++;missing.push(`${r["اسم الفرد"]||"الفرد"}: تاريخ الميلاد أو العمر`)}
  });
  const familyScore=familyFilled/FAMILY_REQUIRED.length;
  const personScore=personTotal?personFilled/personTotal:0;
  const score=Math.max(0,Math.min(100,Math.round((familyScore*.55+personScore*.45)*100)));
  let status=score>=100?"مكتملة":(score>=50?"جزئية":"غير مكتملة");
  return {status,score,missing,familyFilled,personFilled,personTotal};
}
function familyClass(status){return status==="مكتملة"?"family-complete":status==="جزئية"?"family-partial":"family-incomplete"}
function statusBadge(status){
 const c=status==="مكتملة"?"status-complete":status==="جزئية"?"status-partial":"status-incomplete";
 return `<span class="status-dot ${c}">${esc(status)}</span>`;
}
function syncComputedStatuses(save=false){
  familyMap().forEach((rows)=>{
    const a=familyStatus(rows);
    rows.forEach(r=>r["حالة اكتمال بيانات الأسرة"]=a.status);
  });
  if(save)autoSave();
}
function duplicateGroups(field, label){
  const m=new Map();
  data.forEach((r,i)=>{const v=norm(r[field]);if(v){if(!m.has(v))m.set(v,[]);m.get(v).push(i)}});
  return [...m.entries()].filter(([,idxs])=>idxs.length>1).map(([v,idxs])=>({type:"warning",kind:"duplicate",message:`تنبيه: تكرار ${label}: ${v} — موجود في ${idxs.length} سجلات، راجع التكرار ويمكنك تركه أو تعديله.`,indexes:idxs}));
}

function normalizeId(v){
  return norm(v).replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\s+/g,"");
}
function qualityScan(){
  const issues=[];
  const fm=familyMap();

  // Family-level duplicate identity: repeated on members of the SAME family is normal.
  const familyIdHeads=new Map();
  const personIdPeople=new Map();

  fm.forEach((rows,head)=>{
    const first=rows[0]||{};
    const fid=normalizeId(first["رقم هوية الأسرة"]);
    if(fid){
      if(!familyIdHeads.has(fid))familyIdHeads.set(fid,[]);
      familyIdHeads.get(fid).push(head);
    }

    // Family-level required fields: check the family once, not once per child.
    FAMILY_REQUIRED.forEach(k=>{
      if(!filled(first[k])){
        issues.push({
          type:"error",kind:"family",
          message:`بيانات الأسرة ناقصة — ${k} مفقود لعائلة ${head}`,
          indexes:[data.indexOf(first)],
          field:k
        });
      }
    });

    // Every actual person row is checked against its own fields.
    rows.forEach((r,i)=>{
      const idx=data.indexOf(r);
      const person=r["اسم الفرد"]||`فرد رقم ${i+1}`;
      const pid=normalizeId(r["رقم هوية الفرد"]);

      if(!filled(r["اسم الفرد"]))
        issues.push({type:"error",kind:"missing",message:`اسم الفرد مفقود — سجل رقم ${idx+1}`,indexes:[idx],field:"اسم الفرد"});

      if(!filled(r["رقم هوية الفرد"]))
        issues.push({
          type:"error",kind:"missing",
          message:`رقم هوية الفرد مفقود فعلياً: ${person} — السجل رقم ${idx+1}`,
          indexes:[idx],field:"رقم هوية الفرد"
        });
      else{
        if(!personIdPeople.has(pid))personIdPeople.set(pid,[]);
        personIdPeople.get(pid).push({idx,name:person,head});
      }

      ["صلة القرابة","الجنس","الحالة الاجتماعية"].forEach(k=>{
        if(!filled(r[k]))
          issues.push({type:"error",kind:"missing",message:`${k} مفقود: ${person}`,indexes:[idx],field:k});
      });

      const birth=filled(r["تاريخ الميلاد"]), age=filled(r["العمر التقريبي"]);
      if(!birth && !age)
        issues.push({type:"warning",kind:"missing",message:`تاريخ الميلاد والعمر كلاهما غير مدخلين: ${person}`,indexes:[idx],field:"تاريخ الميلاد"});

      if((r["إصابة؟"]||r["إصابة?"])==="نعم"){
        if(!filled(r["سبب الإصابة"]))
          issues.push({type:"error",kind:"inconsistent",message:`مصاب لكن سبب الإصابة مفقود: ${person}`,indexes:[idx],field:"سبب الإصابة"});
        if(!filled(r["تفاصيل الإصابة"]))
          issues.push({type:"error",kind:"inconsistent",message:`مصاب لكن تفاصيل الإصابة مفقودة: ${person}`,indexes:[idx],field:"تفاصيل الإصابة"});
      }
      if(r["إعاقة؟"]==="نعم" && !filled(r["نوع الإعاقة"]))
        issues.push({type:"error",kind:"inconsistent",message:`إعاقة = نعم لكن نوع الإعاقة مفقود: ${person}`,indexes:[idx],field:"نوع الإعاقة"});
      if(r["مرض مزمن؟"]==="نعم" && !filled(r["نوع المرض"]))
        issues.push({type:"error",kind:"inconsistent",message:`مرض مزمن = نعم لكن نوع المرض مفقود: ${person}`,indexes:[idx],field:"نوع المرض"});
      if(r["حامل؟"]==="نعم" && !genderIsFemale(r["الجنس"]))
        issues.push({type:"error",kind:"inconsistent",message:`حامل = نعم والجنس ليس أنثى: ${person}`,indexes:[idx],field:"الجنس"});
      if(r["مرضعة؟"]==="نعم" && !genderIsFemale(r["الجنس"]))
        issues.push({type:"error",kind:"inconsistent",message:`مرضعة = نعم والجنس ليس أنثى: ${person}`,indexes:[idx],field:"الجنس"});

      if(birth && age){
        const dt=new Date(r["تاريخ الميلاد"]);
        const a=parseInt(String(r["العمر التقريبي"]).replace(/[^\d]/g,""),10);
        if(!Number.isNaN(dt.getTime())&&!Number.isNaN(a)){
          const now=new Date();
          let calc=now.getFullYear()-dt.getFullYear();
          const md=now.getMonth()-dt.getMonth();
          if(md<0||(md===0&&now.getDate()<dt.getDate()))calc--;
          if(Math.abs(calc-a)>1)
            issues.push({type:"warning",kind:"mismatch",message:`العمر لا يطابق تاريخ الميلاد: ${person} — المدخل ${a}، المحسوب ${calc}`,indexes:[idx],field:"العمر التقريبي"});
        }
      }
    });
  });

  for(const [fid,heads] of familyIdHeads){
    const unique=[...new Set(heads)];
    if(unique.length>1)
      issues.push({type:"warning",kind:"duplicate",message:`تنبيه: رقم هوية الأسرة ${fid} مرتبط بأكثر من رب أسرة: ${unique.join("، ")}`,indexes:unique.map(h=>data.indexOf((fm.get(h)||[])[0])).filter(x=>x>=0)});
  }

  for(const [pid,people] of personIdPeople){
    const unique=[...new Set(people.map(x=>x.name))];
    if(unique.length>1)
      issues.push({type:"warning",kind:"duplicate",message:`تنبيه: رقم هوية الفرد ${pid} مستخدم لأكثر من شخص: ${unique.join("، ")}`,indexes:people.map(x=>x.idx)});
  }

  // IMPORTANT: phone duplication is intentionally ignored.
  return issues;
}

function openQualityModal(){
  qualityIssues=qualityScan();
  const errors=qualityIssues.filter(x=>x.type==="error").length, warnings=qualityIssues.filter(x=>x.type==="warning").length;
  document.getElementById("qualitySummary").innerHTML=`<b>نتيجة الفحص:</b> ${errors} خطأ و${warnings} تنبيه. التكرارات تظهر كتَنبيهات للمراجعة فقط ويمكن تركها كما هي أو تعديلها، ورقم الجوال يمكن أن يتكرر بين أكثر من عائلة ولا يعتبر مشكلة.`;
  const box=document.getElementById("qualityIssues");
  box.innerHTML=qualityIssues.map((x,i)=>{
    const first=x.indexes?.[0], r=data[first]||{};
    return `<div class="issue-row ${x.type==="warning"?"warn":""}">
      <div><b>${x.type==="error"?"خطأ":"تنبيه"} #${i+1}</b> — ${esc(x.message)}${x.field?`<div class="muted" style="margin-top:4px">الحقل الذي يحتاج المراجعة: <b>${esc(x.field)}</b></div>`:""}</div>
      <div class="actions" style="margin-top:7px">
        ${first!==undefined?`<button class="btn" onclick="editPerson(${first});closeModal('qualityModal')">فتح السجل</button>`:""}
        ${x.kind==="family" && r["اسم رب الأسرة"]?`<button class="btn" onclick="editFamily(${JSON.stringify(r["اسم رب الأسرة"])});closeModal('qualityModal')">فتح الأسرة</button>`:""}
      </div>
    </div>`;
  }).join("") || '<div class="empty">لا توجد أخطاء أو تنبيهات. البيانات سليمة حسب قواعد الفحص الحالية.</div>';
  document.getElementById("qualityModal").classList.add("show");
}
function exportQualityExcel(){
  const issues=qualityScan();
  const matrix=[["إدارة مخيم أبو عريبان"],["تقرير جودة البيانات"],[`تاريخ الفحص: ${new Date().toLocaleString('ar-EG')}`],[],["#","النوع","المشكلة","اسم الفرد","رب الأسرة","رقم هوية الفرد","رقم هوية الأسرة"]];
  issues.forEach((x,i)=>{const r=data[x.indexes?.[0]]||{};matrix.push([i+1,x.type==="error"?"خطأ":"تنبيه",x.message,r["اسم الفرد"]||"",r["اسم رب الأسرة"]||"",r["رقم هوية الفرد"]||"",r["رقم هوية الأسرة"]||""])});
  downloadXLSX(matrix,`تقرير-جودة-البيانات-${dateStamp()}.xlsx`,{headerRow:5,title:"تقرير جودة البيانات"});
  toast("تم تصدير تقرير الأخطاء والتنبيهات إلى Excel");
}

function filterFamiliesStatus(status){
  showView("families");
  const el=document.getElementById("fstatus"); if(el){el.value=status;renderFamiliesFast()}
}

function renderFamiliesCore(){
  const q=(document.getElementById("fq")?.value||"").toLowerCase().trim();
  const fs=document.getElementById("fsize")?.value||"";
  const st=document.getElementById("fstatus")?.value||"";
  const m=familyMap(); let arr=[...m.entries()];
  arr=arr.filter(([h,rows])=>{
    const first=rows[0]||{}, blob=[h,first["رقم هوية الأسرة"],first["رقم الجوال"],first["العنوان"]].join(" ").toLowerCase();
    if(q&&!blob.includes(q))return false;
    const n=rows.length;
    if(fs==="1"&&n!==1)return false;if(fs==="2-4"&&(n<2||n>4))return false;if(fs==="5-7"&&(n<5||n>7))return false;if(fs==="8"&&n<8)return false;
    const status=familyStatus(rows).status;
    if(st && status!==st)return false;
    return true;
  });
  document.getElementById("familyList").innerHTML=arr.map(([h,rows])=>{
    const r=rows[0]||{}, key=encodeURIComponent(h), a=familyStatus(rows), cls=familyClass(a.status);
    const missing=a.missing.slice(0,3).map(esc).join("، ");
    return `<div class="familybox ${cls}">
      <div class="familyrow">
       <div style="min-width:0">
        <div class="familytitle">${esc(h)} ${statusBadge(a.status)}</div>
        <div class="muted">هوية الأسرة: ${esc(r["رقم هوية الأسرة"]||"—")} · الجوال: ${esc(r["رقم الجوال"]||"—")} · عدد الأفراد: <b>${rows.length}</b> · اكتمال: <b>${a.score}%</b></div>
        ${a.status!=="مكتملة"?`<div style="margin-top:5px;color:#92400e;font-size:11px">أهم النواقص: ${missing||"راجع البيانات"}</div>`:""}
       </div>
       <div class="actions no-print"><button class="btn" onclick="editFamily(decodeURIComponent('${key}'))">تعديل الأسرة</button><button class="btn primary" onclick="addMemberToFamily(decodeURIComponent('${key}'))">＋ فرد</button><button class="btn danger" onclick="deleteFamily(decodeURIComponent('${key}'))">حذف العائلة</button></div>
      </div>
      <div class="memberlist">${rows.map(x=>`<div class="member"><span>${esc(x["اسم الفرد"]||"")} — ${esc(x["صلة القرابة"]||"")} — ${esc(x["رقم هوية الفرد"]||"")} ${((x["إصابة؟"]||x["إصابة?"])==="نعم")?" · إصابة":""}${x["إعاقة؟"]==="نعم"?" · إعاقة":""}</span><span class="no-print"><button class="pagebtn" onclick="editPerson(${data.indexOf(x)})">تعديل</button></span></div>`).join("")}</div>
    </div>`;
  }).join("") || `<div class="empty">لا توجد عائلات مطابقة</div>`;
}

function renderDashboard(){
  syncComputedStatuses(false);
  const fm=familyMap(), inside=new Set(), counts={مكتملة:0,جزئية:0,"غير مكتملة":0};
  fm.forEach((rows,h)=>{const r=rows[0]||{};if(r["داخل/خارج المخيم"]==="داخل المخيم")inside.add(h);counts[familyStatus(rows).status]++});
  const issues=qualityScan(), errors=issues.filter(x=>x.type==="error").length, warnings=issues.filter(x=>x.type==="warning").length;
  document.getElementById("sPeople").textContent=data.length.toLocaleString('ar-EG');
  document.getElementById("sFamilies").textContent=fm.size.toLocaleString('ar-EG');
  document.getElementById("sInside").textContent=inside.size.toLocaleString('ar-EG');
  document.getElementById("sComplete").textContent=fm.size?Math.round(counts["مكتملة"]/fm.size*100)+"%":"0%";
  document.getElementById("dashComplete").textContent=counts["مكتملة"].toLocaleString('ar-EG');
  document.getElementById("dashPartial").textContent=counts["جزئية"].toLocaleString('ar-EG');
  document.getElementById("dashIncomplete").textContent=counts["غير مكتملة"].toLocaleString('ar-EG');
  document.getElementById("dashErrors").textContent=(errors+warnings).toLocaleString('ar-EG');
  const banner=document.getElementById("qualityBanner");
  banner.classList.toggle("ok",(errors+warnings)===0);
  document.getElementById("qualityBannerText").textContent=(errors+warnings)===0?"فحص جودة البيانات: يتم التحقق من بيانات الأسرة وكل فرد والحالات المتعارضة والتكرارات غير الطبيعية. تكرار الجوال لا يُحسب خطأ.":`تنبيه: يوجد ${errors} خطأ و${warnings} تنبيه يحتاج مراجعة. اضغط "فحص التفاصيل" لمعرفة المشكلة ومكانها.`;
  const gender=[ ["ذكر",data.filter(x=>x["الجنس"]==="ذكر").length],["أنثى",data.filter(x=>genderIsFemale(x["الجنس"])).length] ];
  const health=[["مرض مزمن",data.filter(x=>x["مرض مزمن؟"]==="نعم").length],["إصابة",data.filter(x=>(x["إصابة؟"]||x["إصابة?"])==="نعم").length],["إعاقة",data.filter(x=>x["إعاقة؟"]==="نعم").length],["حامل",data.filter(x=>x["حامل؟"]==="نعم").length],["مرضعة",data.filter(x=>x["مرضعة؟"]==="نعم").length],["يتيم/منفصل",data.filter(x=>x["يتيم/منفصل عن ذويه؟"]==="نعم").length]];
  renderGenderChart(gender); renderAgeChart(); renderHealthBars(health); renderFamilyStatusChart(counts,fm.size);
  const recent=data.slice(-6).reverse();
  document.getElementById("recent").innerHTML=recent.map(r=>`<div class="member"><span><b>${esc(r["اسم الفرد"]||"")}</b> — ${esc(r["اسم رب الأسرة"]||"")} — ${esc(r["صلة القرابة"]||"")}</span><span>${statusBadge(familyStatus(familyMap().get(r["اسم رب الأسرة"])||[]).status)}</span></div>`).join("")||'<div class="empty">لا توجد بيانات</div>';
}

function conditionFieldOptions(){
 return [
  ["اسم رب الأسرة","اسم رب الأسرة"],["رقم هوية الأسرة","رقم هوية الأسرة"],["رقم الجوال","رقم الجوال"],
  ["العنوان","العنوان"],["داخل/خارج المخيم","داخل/خارج المخيم"],["حالة اكتمال بيانات الأسرة","حالة الأسرة"],
  ["المحافظة الأصلية","المحافظة الأصلية"],["نوع السكن الحالي","نوع السكن"],["اسم الفرد","اسم الفرد"],
  ["رقم هوية الفرد","رقم هوية الفرد"],["صلة القرابة","صلة القرابة"],["الجنس","الجنس"],["الحالة الاجتماعية","الحالة الاجتماعية"],
  ["العمر","العمر"],["مرض مزمن؟","مرض مزمن"],["نوع المرض","نوع المرض"],["إصابة؟","إصابة"],["سبب الإصابة","سبب الإصابة"],
  ["تفاصيل الإصابة","تفاصيل الإصابة"],["إعاقة؟","إعاقة"],["نوع الإعاقة","نوع الإعاقة"],["يتيم/منفصل عن ذويه؟","يتيم"],
  ["حامل؟","حامل"],["مرضعة؟","مرضعة"],["بيانات ناقصة","بيانات ناقصة"]
 ];
}
function addReportCondition(field="",op="contains",value=""){
 reportConditions.push({field,op,value});renderConditionRows();
}
function removeReportCondition(i){reportConditions.splice(i,1);renderConditionRows()}
function clearReportConditions(){reportConditions=[];renderConditionRows()}
function renderConditionRows(){
 const box=document.getElementById("conditionRows"); if(!box)return;
 const fields=conditionFieldOptions();
 const ops=`<option value="contains">يحتوي على</option><option value="eq">يساوي</option><option value="neq">لا يساوي</option><option value="min">أكبر أو يساوي</option><option value="max">أصغر أو يساوي</option><option value="filled">معبأ</option><option value="empty">فارغ</option>`;
 box.innerHTML=reportConditions.map((c,i)=>`<div class="condition-row">
   <div class="field"><label>الحقل</label><select onchange="reportConditions[${i}].field=this.value;renderConditionRows()">${fields.map(([v,l])=>`<option value="${esc(v)}" ${c.field===v?"selected":""}>${esc(l)}</option>`).join("")}</select></div>
   <div class="field"><label>العملية</label><select onchange="reportConditions[${i}].op=this.value;renderConditionRows()">${ops}</select></div>
   <div class="field condition-value"><label>القيمة</label><input value="${esc(c.value)}" oninput="reportConditions[${i}].value=this.value" ${["filled","empty"].includes(c.op)?"disabled":""}></div>
   <button class="btn danger" onclick="removeReportCondition(${i})">حذف</button>
 </div>`).join("") || '<div class="empty" style="padding:15px">لم تتم إضافة شروط متقدمة. يمكنك الاعتماد على الشروط الأساسية أعلاه.</div>';
}
function conditionPass(r,c){
 let v=c.field==="العمر"?ageOf(r):c.field==="عدد أفراد الأسرة"?familyCount(r):c.field==="إصابة؟"?(r["إصابة؟"]||r["إصابة?"]):c.field==="بيانات ناقصة"?familyStatus(familyMap().get(r["اسم رب الأسرة"])||[]).status!=="مكتملة":r[c.field];
 const target=c.value;
 if(c.field==="بيانات ناقصة")v=v?"نعم":"لا";
 if(c.op==="filled")return filled(v);
 if(c.op==="empty")return !filled(v);
 if(c.op==="min")return Number(v)>=Number(target);
 if(c.op==="max")return Number(v)<=Number(target);
 if(c.op==="eq")return norm(v)===norm(target);
 if(c.op==="neq")return norm(v)!==norm(target);
 return norm(v).toLowerCase().includes(norm(target).toLowerCase());
}
function applyAdvancedConditions(r){
 if(!reportConditions.length)return true;
 const mode=document.querySelector('input[name="conditionMode"]:checked')?.value||"and";
 const results=reportConditions.map(c=>conditionPass(r,c));
 return mode==="or"?results.some(Boolean):results.every(Boolean);
}
function runCustomReport(){
 const name=(document.getElementById("cr_name").value||"").trim()||"كشف مصنف";
 const gender=document.getElementById("cr_gender").value;
 const min=document.getElementById("cr_minage").value===""?null:+document.getElementById("cr_minage").value;
 const max=document.getElementById("cr_maxage").value===""?null:+document.getElementById("cr_maxage").value;
 const special=document.getElementById("cr_special").value;
 const rel=(document.getElementById("cr_rel").value||"").trim().toLowerCase();
 const onlySelected=document.getElementById("cr_only_selected").checked;
 syncReportColumns(); classifiedTitle=name;
 classifiedRows=data.filter(r=>{
   if(onlySelected && !selectedPeople.has(personIdOf(r)))return false;
   if(gender && normalizeGender(r["الجنس"])!==normalizeGender(gender))return false;
   const age=ageOf(r);
   if(min!==null && (age===null || age<min))return false;
   if(max!==null && (age===null || age>max))return false;
   if(special && !hasSpecial(r,special))return false;
   if(rel && !String(r["صلة القرابة"]||"").toLowerCase().includes(rel))return false;
   if(!applyAdvancedConditions(r))return false;
   return true;
 });
 const colsForScope=reportColumns();
 if(reportUsesOnlyFamilyLevelColumns(colsForScope)) classifiedRows=uniqueFamilyRows(classifiedRows);
 else if(reportConditions.length>0 && reportConditions.every(c=>["داخل/خارج المخيم","اسم رب الأسرة","رقم هوية الأسرة","رقم الجوال","العنوان","حالة اكتمال بيانات الأسرة","المحافظة الأصلية","حالة المسكن الأصلي","نوع السكن الحالي","عدد أفراد الأسرة"].includes(c.field))) classifiedRows=uniqueFamilyRows(classifiedRows);
 const sort=document.getElementById("cr_sort").value;
 classifiedRows.sort((a,b)=>sort==="name"?(a["اسم الفرد"]||"").localeCompare(b["اسم الفرد"]||"","ar"):sort==="age"?(ageOf(a)??999)-(ageOf(b)??999):(a["اسم رب الأسرة"]||"").localeCompare(b["اسم رب الأسرة"]||"","ar"));
 renderClassified(); toast(`تم إنشاء ${name} — ${classifiedRows.length} سجل`);
}

/* مجموعات الأشخاص المختارين */
function reportGroups(){
 try{return JSON.parse(localStorage.getItem("aboreiban_report_groups_v1")||"{}")}catch(e){return {}}
}
function refreshReportGroups(){
 const s=document.getElementById("savedGroupSelect");if(!s)return;
 const g=reportGroups();s.innerHTML='<option value="">المجموعات المحفوظة</option>'+Object.keys(g).sort((a,b)=>a.localeCompare(b,"ar")).map(n=>`<option>${esc(n)}</option>`).join("");
}
function saveSelectedGroup(){
 if(!selectedPeople.size){toast("حدد أشخاصاً أولاً");return}
 const name=prompt("اسم المجموعة:");
 if(!name)return;
 const g=reportGroups();g[name.trim()]=[...selectedPeople];localStorage.setItem("aboreiban_report_groups_v1",JSON.stringify(g));refreshReportGroups();toast("تم حفظ مجموعة الأشخاص");
}
function loadSelectedGroup(name){
 if(!name)return;
 const g=reportGroups();selectedPeople=new Set(g[name]||[]);renderPersonPicker();toast(`تم تحميل مجموعة: ${name}`);
}
function deleteSelectedGroup(){
 const s=document.getElementById("savedGroupSelect"),name=s?.value;if(!name){toast("اختر مجموعة أولاً");return}
 if(!confirm(`حذف مجموعة «${name}»؟`))return;
 const g=reportGroups();delete g[name];localStorage.setItem("aboreiban_report_groups_v1",JSON.stringify(g));refreshReportGroups();toast("تم حذف المجموعة");
}

/* حماية PIN محلية */
function simplePinHash(pin){
 let h=2166136261;
 for(let i=0;i<pin.length;i++){h^=pin.charCodeAt(i);h=Math.imul(h,16777619)}
 return (h>>>0).toString(16);
}
function setPinStatus(){
 const has=!!localStorage.getItem("aboreiban_pin_hash");
 const el=document.getElementById("pinStatus");if(el)el.textContent=has?"رمز PIN مفعّل":"رمز PIN غير مفعّل";
}
function setAppPin(){
 const a=prompt("أدخل رمز PIN جديداً (4 أرقام أو أكثر):");if(!a)return;
 if(a.length<4){alert("الرمز يجب أن يكون 4 أرقام أو أكثر");return}
 const b=prompt("أعد إدخال رمز PIN:");
 if(a!==b){alert("الرمزان غير متطابقين");return}
 localStorage.setItem("aboreiban_pin_hash",simplePinHash(a));setPinStatus();toast("تم تفعيل رمز PIN");
}
function lockApp(){
 if(!localStorage.getItem("aboreiban_pin_hash")){toast("عيّن رمز PIN أولاً");return}
 appLocked=true;document.getElementById("lockOverlay").classList.add("show");document.getElementById("unlockPin").value="";document.getElementById("unlockError").textContent="";
}
function unlockApp(){
 const p=document.getElementById("unlockPin").value;
 if(simplePinHash(p)===localStorage.getItem("aboreiban_pin_hash")){
   appLocked=false;document.getElementById("lockOverlay").classList.remove("show");toast("تم فتح التطبيق");
 }else document.getElementById("unlockError").textContent="رمز PIN غير صحيح";
}
function removeAppPin(){
 const p=prompt("أدخل PIN الحالي لإزالته:");if(!p)return;
 if(simplePinHash(p)!==localStorage.getItem("aboreiban_pin_hash")){alert("رمز PIN غير صحيح");return}
 localStorage.removeItem("aboreiban_pin_hash");setPinStatus();toast("تمت إزالة رمز PIN");
}

/* حماية ذكية من التكرار — لا تعتمد على الاسم وحده */
function smartNorm(v){
  return String(v??"").normalize("NFKC").replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,"").replace(/ـ/g,"").replace(/[أإآٱ]/g,"ا").replace(/\s+/g," ").trim();
}
function smartDigits(v){return String(v??"").replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g,"")}
function smartPersonDuplicate(candidate, ignoreIndex=-1){
  const id=smartDigits(candidate["رقم هوية الفرد"]);
  const name=smartNorm(candidate["اسم الفرد"]);
  const head=smartNorm(candidate["اسم رب الأسرة"]);
  const familyId=smartDigits(candidate["رقم هوية الأسرة"]);
  for(let i=0;i<data.length;i++){
    if(i===ignoreIndex) continue;
    const r=data[i];
    const rid=smartDigits(r["رقم هوية الفرد"]);
    if(id && rid && id===rid) return {kind:"id",index:i,row:r};
    if(name && head && smartNorm(r["اسم الفرد"])===name && smartNorm(r["اسم رب الأسرة"])===head) return {kind:"nameFamily",index:i,row:r};
    if(!id && name && familyId && smartDigits(r["رقم هوية الأسرة"])===familyId && smartNorm(r["اسم الفرد"])===name) return {kind:"nameFamilyId",index:i,row:r};
  }
  return null;
}
function smartFamilyDuplicate(head,id,ignoreName=""){
  const nh=smartNorm(head), ni=smartDigits(id);
  return data.find(r=>smartNorm(r["اسم رب الأسرة"])!==smartNorm(ignoreName) && ((ni && smartDigits(r["رقم هوية الأسرة"])===ni) || (nh && smartNorm(r["اسم رب الأسرة"])===nh)))||null;
}
/* إعادة الفحص بعد الحفظ/التعديل */
const _saveFamilyV5=saveFamily;
saveFamily=function(e){
  e.preventDefault();
  const old=document.getElementById("f_original").value;
  const newId=smartDigits(v("f_id"));
  const dup=smartFamilyDuplicate(v("f_head"),newId,old);
  if(dup){alert(`تم منع التكرار: هذه العائلة موجودة بالفعل باسم «${dup["اسم رب الأسرة"]||"—"}»${dup["رقم هوية الأسرة"]?` ورقم الهوية ${dup["رقم هوية الأسرة"]}`:""}. افتح العائلة الموجودة بدل إنشاء نسخة ثانية.`);return}
  _saveFamilyV5(e);syncComputedStatuses(true);renderDashboard();renderFamiliesFast();qualityIssues=qualityScan();
  if(qualityIssues.some(x=>x.type==="error"))toast("تم الحفظ، لكن يوجد خطأ يحتاج مراجعة — راجع فحص الجودة");
};
const _savePersonV5=savePerson;
savePerson=function(e){
  e.preventDefault();
  const idx=document.getElementById("p_index").value;
  const candidate={"رقم هوية الفرد":v("p_id"),"اسم الفرد":v("p_name"),"اسم رب الأسرة":v("p_head"),"رقم هوية الأسرة":(familyMap().get(v("p_head"))?.[0]?.["رقم هوية الأسرة"]||"")};
  const dup=smartPersonDuplicate(candidate,idx===""?-1:+idx);
  if(dup){
    const label=dup.kind==="id"?`رقم الهوية ${dup.row["رقم هوية الفرد"]}`:"الاسم داخل نفس الأسرة";
    alert(`تم منع التكرار الذكي: يوجد بالفعل سجل لهذا الشخص (${label}).\n\nالاسم: ${dup.row["اسم الفرد"]||"—"}\nرب الأسرة: ${dup.row["اسم رب الأسرة"]||"—"}\nرقم الهوية: ${dup.row["رقم هوية الفرد"]||"غير موجود"}\n\nلن يتم إنشاء سجل مكرر.`);
    return;
  }
  _savePersonV5(e);syncComputedStatuses(true);renderDashboard();renderFamiliesFast();qualityIssues=qualityScan();
  if(qualityIssues.some(x=>x.type==="error"))toast("تم الحفظ، لكن يوجد خطأ يحتاج مراجعة — راجع فحص الجودة");
};
const _deleteFamilyV5=deleteFamily;
deleteFamily=function(name){_deleteFamilyV5(name);syncComputedStatuses(true);renderDashboard();qualityIssues=qualityScan()};
const _deletePersonV5=deletePerson;
deletePerson=function(idx){_deletePersonV5(idx);syncComputedStatuses(true);renderDashboard();qualityIssues=qualityScan()};

const _setReportPresetV5=setReportPreset;
setReportPreset=function(type){reportConditions=[];renderConditionRows();_setReportPresetV5(type);refreshReportGroups()};
const _clearCustomReportV5=clearCustomReport;
clearCustomReport=function(clearName=true){reportConditions=[];renderConditionRows();_clearCustomReportV5(clearName);refreshReportGroups()};

function initV5(){
 initFamilyPrintColumns();
 syncComputedStatuses(false);
 initReportColumns();
 renderConditionRows();
 renderPersonPicker();
 refreshReportGroups();
 setPinStatus();
 qualityIssues=qualityScan();
 renderDashboard();
 const issueCount=qualityIssues.length;
 if(issueCount)setTimeout(()=>toast(`تنبيه: تم اكتشاف ${issueCount} مشكلة/تنبيه في البيانات — راجع فحص الجودة`),700);
 if(localStorage.getItem("aboreiban_pin_hash"))setTimeout(()=>lockApp(),350);
}


/* ================= كشف الاستحقاق والتوزيع التالي ================= */
function distCoverageTypes(){return [...new Set(distributions.map(x=>x.type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar"));}
function distCoverageKeyPerson(r){const fid=distNorm(r["رقم هوية الأسرة"]),pid=distNorm(r["رقم هوية الفرد"]);return pid?"p:"+fid+"|"+pid:"pn:"+fid+"|"+distNorm(r["اسم الفرد"]);}
function distCoverageKeyFamily(r){const fid=distNorm(r["رقم هوية الأسرة"]);return fid?"f:"+fid:"fn:"+distNorm(r["اسم رب الأسرة"]);}
function distCoverageTypeFill(){const sel=document.getElementById("distCoverageType");if(!sel)return;const old=sel.value;sel.innerHTML='<option value="">اختر المساعدة</option>'+distCoverageTypes().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");if(distCoverageTypes().includes(old))sel.value=old;}
function distCoverageUniverse(scope){
  if(scope==="families"){
    const m=new Map();data.forEach(r=>{const k=distCoverageKeyFamily(r);if(!m.has(k))m.set(k,{key:k,name:distNorm(r["اسم رب الأسرة"]),familyName:distNorm(r["اسم رب الأسرة"]),id:distNorm(r["رقم هوية الأسرة"]),age:""})});return [...m.values()];
  }
  const m=new Map();data.forEach(r=>{const age=Number(r["العمر التقريبي"]);if(scope==="children"&&(!Number.isFinite(age)||age>=18))return;const name=distNorm(r["اسم الفرد"]);if(!name)return;const k=distCoverageKeyPerson(r);if(!m.has(k))m.set(k,{key:k,name,familyName:distNorm(r["اسم رب الأسرة"]),id:distNorm(r["رقم هوية الفرد"]),age:Number.isFinite(age)?age:""})});return [...m.values()];
}
function distCoverageReceived(scope,type){
  const m=new Map();if(!type)return m;
  distributions.filter(x=>distNorm(x.type)===type).forEach(x=>{
    let k="";
    if(scope==="families") k=x.familyId?("f:"+distNorm(x.familyId)):(x.familyName?("fn:"+distNorm(x.familyName)):"");
    else k=x.personId?("p:"+distNorm(x.familyId)+"|"+distNorm(x.personId)):("pn:"+distNorm(x.familyId)+"|"+distNorm(x.beneficiaryName));
    if(!k)return;const old=m.get(k);if(!old||String(x.date)>String(old.date))m.set(k,{date:x.date,quantity:x.quantity,reference:x.reference});
  });return m;
}
function renderDistributionCoverage(){
  distCoverageTypeFill();const scope=document.getElementById("distCoverageScope")?.value||"children",type=document.getElementById("distCoverageType")?.value||"",status=document.getElementById("distCoverageStatus")?.value||"not_received";const tbody=document.getElementById("distCoverageTbody");if(!tbody)return;
  if(!type){tbody.innerHTML='<tr><td colspan="6"><div class="dist-empty">اختر نوع المساعدة لعرض المستلمين وغير المستلمين</div></td></tr>';["covTotal","covReceived","covMissing","covPercent"].forEach(id=>document.getElementById(id).textContent=id==="covPercent"?"0%":"0");return;}
  const universe=distCoverageUniverse(scope),received=distCoverageReceived(scope,type);let rows=universe.map(x=>({...x,received:received.has(x.key),last:received.get(x.key)?.date||""}));if(status==="not_received")rows=rows.filter(x=>!x.received);if(status==="received")rows=rows.filter(x=>x.received);const total=universe.length,got=universe.filter(x=>received.has(x.key)).length;
  document.getElementById("covTotal").textContent=total;document.getElementById("covReceived").textContent=got;document.getElementById("covMissing").textContent=Math.max(0,total-got);document.getElementById("covPercent").textContent=total?Math.round(got*100/total)+"%":"0%";
  tbody.innerHTML=rows.length?rows.map((x,i)=>`<tr><td>${i+1}</td><td><b>${esc(x.name)}</b>${x.age!==""?`<div class="muted">العمر ${esc(x.age)}</div>`:""}</td><td>${esc(x.familyName||"—")}</td><td>${esc(x.id||"—")}</td><td>${x.received?'<span class="badge success">استلم</span>':'<span class="badge">لم يستلم</span>'}</td><td>${esc(x.last||"—")}</td></tr>`).join(""):'<tr><td colspan="6"><div class="dist-empty">لا توجد نتائج</div></td></tr>';
}
function exportDistributionCoverageExcel(){
  const scope=document.getElementById("distCoverageScope")?.value||"children",type=document.getElementById("distCoverageType")?.value||"",status=document.getElementById("distCoverageStatus")?.value||"not_received";if(!type){toast("اختر نوع المساعدة أولاً");return}
  const universe=distCoverageUniverse(scope),received=distCoverageReceived(scope,type);let rows=universe.map(x=>({"نوع الكشف":scope==="families"?"عائلات":scope==="persons"?"أفراد":"أطفال","نوع المساعدة":type,"الاسم":x.name,"رب الأسرة":x.familyName,"رقم الهوية":x.id,"الحالة":received.has(x.key)?"استلم":"لم يستلم","تاريخ آخر استلام":received.get(x.key)?.date||"","المرجع":received.get(x.key)?.reference||""}));if(status==="not_received")rows=rows.filter(x=>x["الحالة"]==="لم يستلم");if(status==="received")rows=rows.filter(x=>x["الحالة"]==="استلم");exportStyledExcel(rows,`كشف_${scope==="families"?"العائلات":"الأطفال"}_غير_المستلمين_${type}`,"كشف الاستحقاق");}
function closeDistBulkModal(){const m=document.getElementById("distBulkModal");m?.classList.remove("show");m?.setAttribute("aria-hidden","true")}
function updateBulkSelected(){const n=document.querySelectorAll('#bulkTbody input[type="checkbox"]:checked').length;const el=document.getElementById("bulkSelectedCount");if(el)el.textContent=n+" محدد"}
function toggleAllDistBulk(v){document.querySelectorAll('#bulkTbody input[type="checkbox"]').forEach(x=>x.checked=v);updateBulkSelected()}
function startNextDistributionFromCoverage(){
 const type=document.getElementById("distCoverageType")?.value||"";if(!type){toast("اختر نوع المساعدة أولاً");return}
 const scope=document.getElementById("distCoverageScope")?.value||"children",received=distCoverageReceived(scope,type),universe=distCoverageUniverse(scope),missing=universe.filter(x=>!received.has(x.key));
 if(!missing.length){toast("لا يوجد مستفيدون غير مستلمين لهذه المساعدة");return}
 document.getElementById("bulkScopeLabel").value=scope==="families"?"عائلات":scope==="persons"?"أفراد":"أطفال";document.getElementById("bulkType").value=type;document.getElementById("bulkDate").value=distToday();document.getElementById("bulkQty").value=1;document.getElementById("bulkUnit").value=scope==="families"?"طرد":"حقيبة";document.getElementById("bulkBy").value="";
 document.getElementById("bulkTbody").innerHTML=missing.map((x,i)=>`<tr><td><input type="checkbox" data-key="${esc(x.key)}" onchange="updateBulkSelected()"></td><td>${i+1}</td><td><b>${esc(x.name)}</b></td><td>${esc(x.familyName||"—")}</td><td>${esc(x.id||"—")}</td></tr>`).join("");document.getElementById("bulkAll").checked=false;updateBulkSelected();const m=document.getElementById("distBulkModal");m.classList.add("show");m.setAttribute("aria-hidden","false");
}
function saveBulkDistribution(){
 const scope=document.getElementById("bulkScopeLabel").value==="عائلات"?"families":document.getElementById("bulkScopeLabel").value==="أفراد"?"persons":"children",type=distNorm(document.getElementById("bulkType").value),qty=Number(document.getElementById("bulkQty").value||1),unit=distNorm(document.getElementById("bulkUnit").value),date=document.getElementById("bulkDate").value||distToday(),by=distNorm(document.getElementById("bulkBy").value);const keys=[...document.querySelectorAll('#bulkTbody input[type="checkbox"]:checked')].map(x=>x.dataset.key);if(!keys.length){toast("حدد مستفيداً واحداً على الأقل");return}
 const universe=new Map(distCoverageUniverse(scope).map(x=>[x.key,x]));let added=0;keys.forEach(k=>{const x=universe.get(k);if(!x)return;const obj={id:distId(),beneficiaryType:scope==="families"?"عائلة":"فرد",beneficiaryName:x.name,personId:scope==="families"?"":x.id,familyId:data.find(r=>distCoverageKeyFamily(r)===distCoverageKeyFamily({"رقم هوية الأسرة":scope==="families"?x.id:data.find(q=>distCoverageKeyPerson(q)===x.key)?.["رقم هوية الأسرة"]||""}))?.["رقم هوية الأسرة"]||"",familyName:x.familyName,type,quantity:qty,unit,date,reference:"DST-"+Date.now().toString().slice(-8)+"-"+(added+1),distributedBy:by,notes:"توزيع جماعي من كشف غير المستلمين",updatedAt:Date.now()};if(scope==="families"){obj.familyId=x.id}else{const rr=data.find(r=>distCoverageKeyPerson(r)===x.key);obj.familyId=rr?.["رقم هوية الأسرة"]||""}distributions.push(obj);added++});distSave();closeDistBulkModal();renderDistributions();toast(`تم تسجيل ${added} توزيع`);distSyncSoon()}

/* ================= إدارة التوزيعات — Offline First + D1 Sync ================= */
const DIST_KEY="aboreiban_distributions_v1", DIST_SHADOW_KEY="aboreiban_dist_shadow_v1", DIST_PENDING_KEY="aboreiban_dist_pending_v1", DIST_CURSOR_KEY="aboreiban_dist_cursor_v1";
let distributions=[]; let distShadow=[]; let distCursor=Number(localStorage.getItem(DIST_CURSOR_KEY)||0); let distBusy=false;
function distId(){return "dist:"+(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(16).slice(2));}
function distLoad(){try{distributions=JSON.parse(localStorage.getItem(DIST_KEY)||"[]");if(!Array.isArray(distributions))distributions=[]}catch(e){distributions=[]}}
function distSave(){localStorage.setItem(DIST_KEY,JSON.stringify(distributions))}
function distNorm(x){return String(x??"").replace(/\s+/g," ").trim()}
function distToday(){return new Date().toISOString().slice(0,10)}
function openDistributionModal(id=""){const m=document.getElementById("distModal"); if(!m)return; const r=distributions.find(x=>x.id===id); document.getElementById("distId").value=r?.id||""; document.getElementById("distBeneficiaryForm").value=r?.beneficiaryType||"طفل"; document.getElementById("distName").value=r?.beneficiaryName||""; document.getElementById("distPersonId").value=r?.personId||""; document.getElementById("distFamilyId").value=r?.familyId||""; document.getElementById("distFamilyName").value=r?.familyName||""; document.getElementById("distTypeForm").value=r?.type||""; document.getElementById("distQty").value=r?.quantity||1; document.getElementById("distUnit").value=r?.unit||""; document.getElementById("distDate").value=r?.date||distToday(); document.getElementById("distRef").value=r?.reference||("DST-"+new Date().getTime().toString().slice(-8)); document.getElementById("distBy").value=r?.distributedBy||""; document.getElementById("distNotes").value=r?.notes||""; document.getElementById("distModalTitle").textContent=r?"تعديل التوزيع":"تسجيل توزيع"; distFillNames();m.classList.add("show");m.setAttribute("aria-hidden","false");}
function closeDistributionModal(){const m=document.getElementById("distModal");m?.classList.remove("show");m?.setAttribute("aria-hidden","true")}
function distFillNames(){const dl=document.getElementById("distNames");if(!dl)return; const people=[...new Set(data.map(r=>r["اسم الفرد"]).filter(Boolean))];const heads=[...new Set(data.map(r=>r["اسم رب الأسرة"]).filter(Boolean))];dl.innerHTML=[...people,...heads].slice(0,1200).map(x=>`<option value="${esc(x)}">`).join("")}
function distBeneficiaryChanged(){const t=document.getElementById("distBeneficiaryForm")?.value||"طفل"; if(t!=="عائلة"){const name=distNorm(document.getElementById("distName")?.value);const r=data.find(x=>distNorm(x["اسم الفرد"])===name);if(r){document.getElementById("distPersonId").value=r["رقم هوية الفرد"]||"";document.getElementById("distFamilyId").value=r["رقم هوية الأسرة"]||"";document.getElementById("distFamilyName").value=r["اسم رب الأسرة"]||""}}}
function saveDistribution(){const id=document.getElementById("distId").value||distId();const obj={id,beneficiaryType:distNorm(document.getElementById("distBeneficiaryForm").value),beneficiaryName:distNorm(document.getElementById("distName").value),personId:distNorm(document.getElementById("distPersonId").value),familyId:distNorm(document.getElementById("distFamilyId").value),familyName:distNorm(document.getElementById("distFamilyName").value),type:distNorm(document.getElementById("distTypeForm").value),quantity:Number(document.getElementById("distQty").value||1),unit:distNorm(document.getElementById("distUnit").value),date:document.getElementById("distDate").value||distToday(),reference:distNorm(document.getElementById("distRef").value),distributedBy:distNorm(document.getElementById("distBy").value),notes:distNorm(document.getElementById("distNotes").value),updatedAt:Date.now()};if(!obj.beneficiaryName||!obj.type){toast("أدخل اسم المستفيد ونوع التوزيع");return}const i=distributions.findIndex(x=>x.id===id);if(i<0)distributions.push(obj);else distributions[i]=obj;distSave();closeDistributionModal();renderDistributions();toast("تم حفظ التوزيع");distSyncSoon()}
function deleteDistribution(id){if(!confirm("حذف سجل التوزيع؟"))return;distributions=distributions.filter(x=>x.id!==id);distSave();renderDistributions();toast("تم حذف التوزيع");distSyncSoon()}
function renderDistributions(){const q=distNorm(document.getElementById("distQ")?.value).toLowerCase(),bt=document.getElementById("distBeneficiary")?.value||"",ty=document.getElementById("distType")?.value||"",from=document.getElementById("distFrom")?.value||"",to=document.getElementById("distTo")?.value||"";const types=[...new Set(distributions.map(x=>x.type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar"));const sel=document.getElementById("distType");if(sel){const old=sel.value;sel.innerHTML='<option value="">الكل</option>'+types.map(x=>`<option>${esc(x)}</option>`).join("");sel.value=types.includes(old)?old:""}const arr=distributions.filter(x=>{const blob=[x.beneficiaryName,x.familyName,x.type,x.reference,x.notes].join(" ").toLowerCase();return(!q||blob.includes(q))&&(!bt||x.beneficiaryType===bt)&&(!ty||x.type===ty)&&(!from||x.date>=from)&&(!to||x.date<=to)}).sort((a,b)=>String(b.date).localeCompare(String(a.date)));document.getElementById("distTbody").innerHTML=arr.length?arr.map(x=>`<tr><td>${esc(x.date)}</td><td><b>${esc(x.beneficiaryName)}</b><div class="muted">${esc(x.beneficiaryType)}</div></td><td>${esc(x.familyName||"—")}</td><td>${esc(x.type)}</td><td>${esc(x.quantity)} ${esc(x.unit)}</td><td>${esc(x.reference||"—")}</td><td>${esc(x.distributedBy||"—")}</td><td><div class="dist-actions"><button class="pagebtn" onclick="openDistributionModal('${x.id}')">تعديل</button><button class="pagebtn" onclick="deleteDistribution('${x.id}')">حذف</button></div></td></tr>`).join(""):'<tr><td colspan="8"><div class="dist-empty">لا توجد توزيعات مطابقة</div></td></tr>';document.getElementById("distTotal").textContent=distributions.length;const ym=distToday().slice(0,7);document.getElementById("distMonth").textContent=distributions.filter(x=>String(x.date).startsWith(ym)).length;document.getElementById("distChildren").textContent=distributions.filter(x=>x.beneficiaryType==="طفل").length;document.getElementById("distFamilies").textContent=distributions.filter(x=>x.beneficiaryType==="عائلة").length;document.getElementById("distSyncState").textContent=navigator.onLine?"متصل — بانتظار المزامنة":"دون اتصال";renderDistributionCoverage()}
function exportDistributionsCSV(){const rows=[["التاريخ","نوع المستفيد","اسم المستفيد","رقم هوية الفرد","رقم هوية الأسرة","رب الأسرة","نوع التوزيع","الكمية","الوحدة","المرجع","بواسطة","ملاحظات"],...distributions.map(x=>[x.date,x.beneficiaryType,x.beneficiaryName,x.personId,x.familyId,x.familyName,x.type,x.quantity,x.unit,x.reference,x.distributedBy,x.notes])];const csv="\uFEFF"+rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="توزيعات_مخيم_أبو_عريبان.csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function distBuildChanges(){const old=new Map(distShadow.map(x=>[x.id,x])),now=new Map(distributions.map(x=>[x.id,x])),out=[];for(const r of distributions){const o=old.get(r.id);if(!o||JSON.stringify(o)!==JSON.stringify(r))out.push({opId:crypto.randomUUID(),recordId:r.id,operation:"upsert",updatedAt:r.updatedAt||Date.now(),data:r})}for(const o of distShadow)if(!now.has(o.id))out.push({opId:crypto.randomUUID(),recordId:o.id,operation:"delete",updatedAt:Date.now()});return out}
function distSavePending(c){localStorage.setItem(DIST_PENDING_KEY,JSON.stringify(c||[]))}function distLoadPending(){try{return JSON.parse(localStorage.getItem(DIST_PENDING_KEY)||"[]")}catch(e){return[]}}
async function distSync(){if(distBusy||!navigator.onLine)return;distBusy=true;try{
  // Display devices are read-only: they must never upload local distribution changes.
  if(!appReadOnly){
    let pending=distLoadPending();
    if(!pending.length){pending=distBuildChanges();distSavePending(pending)}
    if(pending.length){
      const r=await syncFetch("/sync/push",{method:"POST",body:JSON.stringify({deviceId:syncDeviceId(),changes:pending})});
      const accepted=new Set([...(r.accepted||[]).map(x=>typeof x==="string"?x:x.opId)]);
      if(accepted.size>=pending.length){distShadow=structuredClone(distributions);localStorage.setItem(DIST_SHADOW_KEY,JSON.stringify(distShadow));distSavePending([])}
    }
  }
  const pr=await syncFetch(`/sync/pull?scope=distributions&since=${distCursor}&limit=500`,{method:"GET"});
  for(const c of pr.changes||[]){if(c.recordId?.startsWith("dist:")){if(c.operation==="delete")distributions=distributions.filter(x=>x.id!==c.recordId);else if(c.data){const i=distributions.findIndex(x=>x.id===c.recordId);if(i<0)distributions.push(c.data);else distributions[i]=c.data}}}
  distCursor=Number(pr.nextSince||distCursor);localStorage.setItem(DIST_CURSOR_KEY,String(distCursor));distSave();renderDistributions();
  const st=document.getElementById("distSyncState");if(st)st.textContent="تمت المزامنة"
}catch(e){const st=document.getElementById("distSyncState");if(st)st.textContent="بانتظار الاتصال"}finally{distBusy=false}}
function distSyncSoon(){distSavePending(distBuildChanges());if(navigator.onLine)setTimeout(distSync,250);}
function distInit(){try{distLoad();distShadow=JSON.parse(localStorage.getItem(DIST_SHADOW_KEY)||"[]");if(!Array.isArray(distShadow))distShadow=[]}catch(e){distShadow=[]}renderDistributions();window.addEventListener("online",()=>setTimeout(distSync,400));setTimeout(()=>{if(navigator.onLine)distSync()},1200)}

/* ================= مزامنة سحابية D1 — Worker moood — V24 offline-first ================= */
const SYNC_API_URL = "https://moood.eyad2000515.workers.dev";
const SYNC_DEVICE_KEY = "aboreiban_sync_device_v1";
const SYNC_CURSOR_KEY = "aboreiban_sync_cursor_v1";
const SYNC_SHADOW_KEY = "aboreiban_sync_shadow_v1";
const SYNC_PENDING_KEY = "aboreiban_sync_pending_v2";
const APP_RELEASE_VERSION = "53.5";
const APP_RELEASE_KEY = "aboreiban_app_release_seen";
let syncBusy=false, syncTimer=null, syncShadow=[], syncCursor=Number(localStorage.getItem(SYNC_CURSOR_KEY)||0), syncInitialized=false;
let syncRole={configured:false,isPrimary:false,deviceId:"",primaryDeviceId:""};
let syncRoleCheckedAt=0;
const SYNC_ROLE_CACHE_MS=30000;
const DISPLAY_PERMS_CACHE_KEY="aboreiban_display_permissions_v53_5";
const PRIMARY_RECONCILE_KEY="aboreiban_primary_reconcile_v52";
const AUTH_GEN_KEY="aboreiban_authoritative_generation_v52_2";
const AUTH_NOTICE_GEN_KEY="aboreiban_authoritative_notice_generation_v52_2";
const AUTH_SNAPSHOT_CACHE_KEY="aboreiban_authoritative_snapshot_cache_v52_2";
const SYNC_ROLE_CACHE_KEY="aboreiban_sync_role_cache_v52_2";
let appReadOnly=true;

function displayAuthLock(){document.body.classList.add("display-auth-locked");}
function displayAuthUnlock(){document.body.classList.remove("display-auth-locked");}

/* V52 SECURE DISPLAY AUTHENTICATION */
const DISPLAY_SESSION_KEY="aboreiban_display_session_v52";
let displaySessionInfo=null;
let displayPermissions={dashboard:true,families:true,people:true,search:true,reports:true,distributions:true,ids:false,phones:false,health:false,notes:false};
function displaySessionLoad(){try{displaySessionInfo=JSON.parse(localStorage.getItem(DISPLAY_SESSION_KEY)||"null")}catch(e){displaySessionInfo=null}return displaySessionInfo}
function displaySessionSave(x){displaySessionInfo=x||null;if(x)localStorage.setItem(DISPLAY_SESSION_KEY,JSON.stringify(x));else localStorage.removeItem(DISPLAY_SESSION_KEY)}
function displayAuthHeader(){const s=displaySessionLoad();return s?.token?{"Authorization":"Bearer "+s.token}:{} }
async function displayAuthValidate(){
  const s=displaySessionLoad();
  if(!s?.token)return {ok:false};
  if(Number(s.expiresAt||0) && Number(s.expiresAt)<=Date.now()){displaySessionSave(null);return {ok:false,expired:true};}
  try{
    const r=await fetch(SYNC_API_URL+"/auth/display-validate",{headers:{...displayAuthHeader(),"X-Device-Id":syncDeviceId()},cache:"no-store"});
    const b=await r.json();
    if(!r.ok||!b.ok){if(r.status===403)displaySessionSave(null);return {ok:false,disabled:r.status===403,emergency:b?.code==="DISPLAY_EMERGENCY_LOCK",error:b?.error||"انتهت جلسة الدخول"};}
    displaySessionInfo={...s,displayName:b.displayName,username:b.username,permissions:b.permissions||displayPermissions,expiresAt:b.expiresAt||s.expiresAt};
    displayPermissions=displaySessionInfo.permissions||displayPermissions;displaySessionSave(displaySessionInfo);applyDisplayPermissions();
    return {ok:true,displayName:b.displayName,username:b.username,permissions:displayPermissions};
  }catch(e){
    if(Number(s.expiresAt||0) && Number(s.expiresAt)<=Date.now()){displaySessionSave(null);return {ok:false,expired:true};}
    return {ok:true,offline:true,displayName:s.displayName,username:s.username,permissions:s.permissions||displayPermissions};
  }
}
let displayLoginUserInteracted=false;
function displayShowLogin(message=""){
  displayAuthLock();
  const ov=document.getElementById("displayLoginOverlay");
  if(!ov)return;
  ov.hidden=false;
  const er=document.getElementById("displayLoginError");
  if(er)er.textContent=message;
  // Do not steal focus from either login field. The old delayed focus could
  // fire after the user tapped the password field on slower mobile devices.
  displayLoginUserInteracted=false;
}
function initDisplayLoginFocusGuard(){
  const form=document.getElementById("displayLoginForm");
  const user=document.getElementById("displayLoginUsername");
  const pass=document.getElementById("displayLoginPassword");
  if(!form||!user||!pass||form.dataset.focusGuardReady==="1")return;
  form.dataset.focusGuardReady="1";
  const mark=()=>{displayLoginUserInteracted=true;};
  [user,pass].forEach(input=>{
    input.addEventListener("pointerdown",mark,{passive:true});
    input.addEventListener("touchstart",mark,{passive:true});
    input.addEventListener("focus",mark);
  });
  user.addEventListener("keydown",e=>{
    if(e.key==="Enter"){
      e.preventDefault();
      pass.focus();
    }
  });
}
function displayHideLogin(){const ov=document.getElementById("displayLoginOverlay");if(ov)ov.hidden=true;displayAuthUnlock()}
function displayWelcome(name){const old=document.getElementById("displayWelcomeBox");if(old)old.remove();const box=document.createElement("div");box.id="displayWelcomeBox";box.className="display-welcome";box.innerHTML=`<div>مرحباً</div><b>${esc(name||"مستخدم جهاز العرض")}</b><small>تم تسجيل الدخول إلى جهاز العرض بنجاح</small>`;document.body.appendChild(box);setTimeout(()=>box.remove(),2600)}
function applyDisplayPermissions(){if(appReadOnly!==true)return;const p=displayPermissions||{};const map={families:['families','familySearch'],people:['people','records'],search:['search','familySearch'],reports:['reports','classified'],distributions:['distributions','distributions']};const tabs=[...document.querySelectorAll('.tab[data-view]')];for(const t of tabs){const v=t.dataset.view;let allowed=true;if(v==='dashboard')allowed=p.dashboard!==false;else if(v==='families')allowed=p.families!==false;else if(v==='familySearch')allowed=p.search!==false&&p.families!==false;else if(v==='records')allowed=p.people!==false;else if(v==='classified')allowed=p.reports!==false;else if(v==='distributions')allowed=p.distributions!==false;else if(v==='syncCenter'||v==='settings')allowed=false;t.style.display=allowed?'':'none'}for(const [perm,views] of Object.entries(map)){if(p[perm]===false){for(const v of views){document.querySelectorAll(`[data-view="${v}"]`).forEach(el=>el.style.display='none')}}}if(p.dashboard===false){try{showView('familySearch')}catch(e){}}} 
async function displayLoginSubmit(e){
  e.preventDefault();
  const u=document.getElementById("displayLoginUsername")?.value.trim()||"";
  const p=document.getElementById("displayLoginPassword")?.value||"";
  if(!u||!p){loginUiError("أدخل اسم المستخدم وكلمة المرور للمتابعة.");return}
  loginUiError(""); loginUiLoading(true);
  try{
    const r=await fetch(SYNC_API_URL+"/auth/display-login",{method:"POST",headers:{"Content-Type":"application/json","X-Device-Id":syncDeviceId()},body:JSON.stringify({username:u,password:p,deviceId:syncDeviceId()}),cache:"no-store"});
    let b=null; try{b=await r.json()}catch(_){}
    if(!r.ok||!b?.ok){const er=new Error(b?.error||"تعذر تسجيل الدخول");er.status=r.status;throw er}
    displaySessionSave({token:b.token,expiresAt:b.expiresAt,displayName:b.displayName,username:b.username,permissions:b.permissions||displayPermissions});
    displayPermissions=b.permissions||displayPermissions;
    document.getElementById("displayLoginPassword").value="";
    await fetchSyncRole(true);
    displayHideLogin();
    startProtectedApp();
    applyDisplayPermissions();
    displayWelcome(b.displayName);
    try{await syncOnlineReconcile("manual")}catch(syncErr){toast("تم تسجيل الدخول، وتعذر تحديث البيانات الآن — سيتم استخدام آخر بيانات محفوظة")}
  }catch(e){
    document.getElementById("displayLoginPassword").value="";
    loginUiError(translateLoginError(e));
    document.getElementById("displayLoginPassword")?.focus();
  }finally{loginUiLoading(false)}
}
function displayAuthLogout(){displaySessionSave(null);displayShowLogin("تم تسجيل الخروج")}
async function authFetch(path,options={}){const headers={"Content-Type":"application/json","X-Device-Id":syncDeviceId(),...displayAuthHeader(),...(options.headers||{})};const r=await fetch(SYNC_API_URL+path,{...options,headers,cache:"no-store"});let b=null;try{b=await r.json()}catch(e){throw Error("استجابة غير صالحة من الخادم")};if(!r.ok||b?.ok===false)throw Error(b?.error||("HTTP "+r.status));return b}
window.openDisplayAccountsManager=async function(){if(appReadOnly){toast("إدارة أجهزة العرض متاحة من الجهاز الرئيسي فقط");return}document.getElementById("displayAccountsModal")?.classList.add("show");await renderDisplayAccounts()};
window.closeDisplayAccountsManager=function(){document.getElementById("displayAccountsModal")?.classList.remove("show")};
async function renderDisplayAccounts(){const box=document.getElementById("displayAccountsList");if(!box)return;box.innerHTML='<div class="empty">جاري تحميل الحسابات...</div>';try{const r=await authFetch("/auth/display-accounts",{method:"GET"});const now=Date.now();const fmt=t=>t?new Date(t).toLocaleString("ar-EG",{dateStyle:"short",timeStyle:"short"}):"لم يتصل بعد";const online=t=>!!t&&(now-Number(t)<45000);box.innerHTML=r.accounts.length?r.accounts.map(a=>{const isOn=online(a.lastSeenAt);return `<div class="display-account-row ${a.enabled?"":"disabled"}"><div class="display-account-main"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b>${esc(a.fullName)}</b><span class="device-live-dot ${isOn?"on":"off"}">${isOn?"متصل الآن":"غير متصل"}</span></div><small>اسم المستخدم: <strong dir="ltr">${esc(a.username)}</strong> · ${a.enabled?"مفعّل":"موقوف"}</small><small>آخر اتصال: ${esc(fmt(a.lastSeenAt))} · آخر دخول: ${esc(fmt(a.lastLoginAt))} · الجلسة: ${a.sessionExpiresAt?esc(fmt(a.sessionExpiresAt)):"غير مسجلة"}</small></div><div class="display-account-actions"><button class="btn" onclick="toggleDisplayAccount(${a.id},${a.enabled})">${a.enabled?"إيقاف":"تفعيل"}</button><button class="btn" onclick="toggleDisplayEmergency(${a.id},'${esc(a.fullName)}',${a.emergencyLocked})">${a.emergencyLocked?"إلغاء قفل الطوارئ":"قفل طوارئ"}</button><button class="btn" onclick="editDisplayPermissions(${a.id},'${esc(a.fullName)}')">الصلاحيات</button><button class="btn" onclick="showDisplayActivity(${a.id},'${esc(a.fullName)}')">النشاط</button><button class="btn" onclick="revokeDisplaySession(${a.id})">إنهاء الجلسة</button><button class="btn" onclick="resetDisplayPassword(${a.id},'${esc(a.username)}')">تغيير كلمة المرور</button></div></div>`}).join(""):'<div class="empty">لا توجد أجهزة عرض مضافة.</div>'}catch(e){box.innerHTML=`<div class="notice">${esc(e.message||"تعذر تحميل الحسابات")}</div>`}}
window.createDisplayAccount=async function(){const fullName=document.getElementById("daFullName").value.trim(),username=document.getElementById("daUsername").value.trim().toLowerCase(),p=document.getElementById("daPassword").value,p2=document.getElementById("daPassword2").value,res=document.getElementById("daCreateResult");if(!fullName||!username||!p){toast("أكمل بيانات جهاز العرض");return}if(p!==p2){toast("كلمتا المرور غير متطابقتين");return}try{await authFetch("/auth/display-accounts",{method:"POST",body:JSON.stringify({fullName,username,password:p})});res.hidden=false;res.innerHTML=`تم إنشاء حساب <b>${esc(fullName)}</b> — اسم المستخدم: <b dir="ltr">${esc(username)}</b> — كلمة المرور: <b dir="ltr">${esc(p)}</b><br><small>احفظ كلمة المرور الآن؛ لا يتم عرضها لاحقاً.</small>`;for(const id of ["daFullName","daUsername","daPassword","daPassword2"])document.getElementById(id).value="";await renderDisplayAccounts()}catch(e){toast(e.message||"تعذر إنشاء الحساب")}};
window.toggleDisplayAccount=async function(id,enabled){try{await authFetch("/auth/display-account",{method:"POST",body:JSON.stringify({id,enabled:!enabled})});toast(enabled?"تم إيقاف حساب جهاز العرض":"تم تفعيل حساب جهاز العرض");await renderDisplayAccounts()}catch(e){toast(e.message||"تعذر تحديث الحساب")}};
window.revokeDisplaySession=async function(id){if(!confirm("هل تريد تسجيل خروج جهاز العرض عن بُعد؟"))return;try{await authFetch("/auth/display-revoke-session",{method:"POST",body:JSON.stringify({id})});toast("تم إنهاء جلسة جهاز العرض");await renderDisplayAccounts()}catch(e){toast(e.message||"تعذر إنهاء الجلسة")}};
window.resetDisplayPassword=async function(id,username){const p=prompt(`أدخل كلمة المرور الجديدة للحساب ${username} (6 أحرف على الأقل):`);if(!p)return;try{await authFetch("/auth/display-account",{method:"POST",body:JSON.stringify({id,enabled:true,password:p})});toast("تم تغيير كلمة المرور وتفعيل الحساب");await renderDisplayAccounts()}catch(e){toast(e.message||"تعذر تغيير كلمة المرور")}};
window.editDisplayPermissions=async function(id,name){try{const r=await authFetch('/auth/display-accounts',{method:'GET'});const a=(r.accounts||[]).find(x=>x.id===id);if(!a)return;const labels={dashboard:'لوحة القيادة',families:'العائلات',people:'الأفراد والسجلات',search:'البحث',reports:'الكشوفات المصنفة',distributions:'التوزيعات',ids:'أرقام الهوية',phones:'أرقام الجوال',health:'الحالات الصحية',notes:'الملاحظات'};const keys=Object.keys(labels);const selected={...(a.permissions||{})};const html=keys.map(k=>`<label style="display:flex;align-items:center;gap:8px;padding:8px 0"><input type="checkbox" data-perm="${k}" ${selected[k]?'checked':''}> <span>${labels[k]}</span></label>`).join('');const wrap=document.createElement('div');wrap.className='modal show';wrap.id='permTempModal';wrap.innerHTML=`<div class="modalbox" style="max-width:520px"><div class="modalhead"><b>صلاحيات جهاز العرض — ${esc(name)}</b><button class="btn" onclick="document.getElementById('permTempModal')?.remove()">إغلاق</button></div><div class="modalbody"><div class="familybox"><div class="muted" style="line-height:1.8">حدد المعلومات والوظائف التي يستطيع هذا الحساب الوصول إليها. أرقام الهوية والجوال والحالات الصحية والملاحظات محجوبة افتراضياً.</div><div style="margin-top:12px">${html}</div></div><div class="actions"><button class="btn primary" onclick="saveDisplayPermissions(${id})">حفظ الصلاحيات</button></div></div></div>`;document.body.appendChild(wrap)}catch(e){toast(e.message||'تعذر تحميل الصلاحيات')}};
window.saveDisplayPermissions=async function(id){const m=document.getElementById('permTempModal');const permissions={};m?.querySelectorAll('[data-perm]').forEach(x=>permissions[x.dataset.perm]=x.checked);try{await authFetch('/auth/display-permissions',{method:'POST',body:JSON.stringify({id,permissions})});toast('تم حفظ صلاحيات جهاز العرض');m?.remove();await renderDisplayAccounts()}catch(e){toast(e.message||'تعذر حفظ الصلاحيات')}};
window.toggleDisplayEmergency=async function(id,name,locked){const action=locked?'إلغاء قفل الطوارئ':'قفل الجهاز فوراً';if(!confirm(`هل تريد ${action} لـ ${name}؟`))return;try{await authFetch('/auth/display-emergency-lock',{method:'POST',body:JSON.stringify({id,locked:!locked})});toast(locked?'تم إلغاء قفل الجهاز':'تم قفل جهاز العرض فوراً');await renderDisplayAccounts()}catch(e){toast(e.message||'تعذر تنفيذ الأمر')}};
window.showDisplayActivity=async function(id,name){try{const r=await authFetch(`/auth/display-activity?accountId=${id}&limit=40`,{method:'GET'});const fmt=t=>new Date(t).toLocaleString('ar-EG',{dateStyle:'short',timeStyle:'short'});const rows=(r.items||[]).map(x=>`<div style="padding:9px 0;border-bottom:1px solid #eee"><b>${esc(x.action)}</b><small style="display:block;color:#667085">${esc(fmt(x.createdAt))} · ${esc(x.details||'')}</small></div>`).join('');const wrap=document.createElement('div');wrap.className='modal show';wrap.id='activityTempModal';wrap.innerHTML=`<div class="modalbox" style="max-width:620px"><div class="modalhead"><b>سجل نشاط — ${esc(name)}</b><button class="btn" onclick="document.getElementById('activityTempModal')?.remove()">إغلاق</button></div><div class="modalbody"><div class="familybox">${rows||'<div class="empty">لا يوجد نشاط مسجل.</div>'}</div></div></div>`;document.body.appendChild(wrap)}catch(e){toast(e.message||'تعذر تحميل سجل النشاط')}};

function initDisplayLoginUI(){
  const form=document.getElementById("displayLoginForm");
  if(!form||form.dataset.uiReady==="1")return;
  form.dataset.uiReady="1";
  form.addEventListener("submit",displayLoginSubmit);
  initDisplayLoginFocusGuard();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initDisplayLoginUI,{once:true});
else initDisplayLoginUI();
function syncDeviceId(){let id=localStorage.getItem(SYNC_DEVICE_KEY);if(!id){id=(crypto.randomUUID?crypto.randomUUID():"dev-"+Date.now()+"-"+Math.random().toString(16).slice(2));localStorage.setItem(SYNC_DEVICE_KEY,id)}return id}


/* V26 SMART DATA DEDUPLICATION
   Keeps the modern interface unchanged. Removes only records that are strongly
   identifiable as the same person, while merging non-empty fields so useful
   offline-added information is not lost. */
const SMART_DEDUP_VERSION="v26";
const SMART_DEDUP_LOG_KEY="aboreiban_smart_dedup_v26";
function smartKeyText(v){return String(v??"").replace(/[\u0640]/g,"").replace(/[\s\u200c\u200d]+/g," ").trim().toLowerCase();}
function smartKeyDigits(v){return smartKeyText(v).replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[^0-9]/g,"");}
function smartPersonKey(r){
  const pid=smartKeyDigits(r?.["رقم هوية الفرد"]);
  if(pid) return "ID:"+pid;
  const fid=smartKeyDigits(r?.["رقم هوية الأسرة"]);
  const name=smartKeyText(r?.["اسم الفرد"]);
  const head=smartKeyText(r?.["اسم رب الأسرة"]);
  const dob=smartKeyText(r?.["تاريخ الميلاد"]);
  // Same full name inside the same family is a strong duplicate signal.
  if(name && fid && dob) return "FAMID:"+fid+"|NAME:"+name+"|DOB:"+dob;
  if(name && head && dob) return "HEAD:"+head+"|NAME:"+name+"|DOB:"+dob;
  // Never delete on name alone: people can legitimately share a name.
  return null;
}
function smartMergeRows(a,b){
  // Start from the later row, then fill every empty field from the other copy.
  const out=structuredClone(b||a||{});
  for(const k of COLUMNS){
    if(k==="#") continue;
    const av=a?.[k], bv=b?.[k];
    const aFilled=av!==undefined&&av!==null&&String(av).trim()!=="";
    const bFilled=bv!==undefined&&bv!==null&&String(bv).trim()!=="";
    if(!bFilled && aFilled) out[k]=av;
  }
  if(a?.__syncId && !out.__syncId) out.__syncId=a.__syncId;
  return out;
}
function smartDeduplicateData(reason="auto"){
  if(!Array.isArray(data)||data.length<2) return {removed:0,groups:0,kept:data?.length||0};
  const groups=new Map();
  data.forEach((r,i)=>{const key=smartPersonKey(r);if(!key)return;if(!groups.has(key))groups.set(key,[]);groups.get(key).push({r,i});});
  const remove=new Set(), merged=new Map();
  for(const [key,items] of groups){
    if(items.length<2) continue;
    // Keep the last occurrence as the base (usually the latest local copy),
    // then merge non-empty fields from every earlier copy into it.
    let base=items[items.length-1].r;
    for(let j=items.length-2;j>=0;j--) base=smartMergeRows(items[j].r,base);
    const keepIndex=items[items.length-1].i;
    merged.set(keepIndex,base);
    items.slice(0,-1).forEach(x=>remove.add(x.i));
  }
  if(!remove.size) return {removed:0,groups:0,kept:data.length};
  const before=data.length;
  const next=[];
  data.forEach((r,i)=>{if(merged.has(i)) next.push(merged.get(i)); else if(!remove.has(i)) next.push(r);});
  data=next;
  renumber();
  localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
  const log={version:SMART_DEDUP_VERSION,at:new Date().toISOString(),reason,before,after:data.length,removed:before-data.length,groups:[...groups.values()].filter(x=>x.length>1).length};
  localStorage.setItem(SMART_DEDUP_LOG_KEY,JSON.stringify(log));
  return {removed:before-data.length,groups:log.groups,kept:data.length};
}
function runSmartDedup(reason="auto"){
  try{
    const result=smartDeduplicateData(reason);
    if(result.removed){
      rebuildFilters();renderAll();
      toast(`تم دمج ${result.removed} سجل مكرر — البيانات الأصلية محفوظة`);
    }
    return result;
  }catch(e){console.warn("Smart dedup failed",e);return {removed:0,groups:0,kept:data.length,error:true};}
}

function syncRecordId(r,fallbackIndex){if(!r.__syncId){const base=[r["رقم هوية الأسرة"]||"",r["رقم هوية الفرد"]||"",r["اسم الفرد"]||"",fallbackIndex].join("|");let h=2166136261;for(let i=0;i<base.length;i++){h^=base.charCodeAt(i);h=Math.imul(h,16777619)}r.__syncId="r-"+(h>>>0).toString(16)+"-"+fallbackIndex}return r.__syncId}
function syncNormalizeRows(rows){return (Array.isArray(rows)?rows:[]).map((r,i)=>{if(r&&typeof r==="object")syncRecordId(r,i);return r}).filter(Boolean)}
function syncComparable(r){const x={};for(const k of COLUMNS)if(k!=="#")x[k]=r?.[k]??"";return JSON.stringify(x)}
function syncLoadShadow(){try{syncShadow=syncNormalizeRows(JSON.parse(localStorage.getItem(SYNC_SHADOW_KEY)||"[]"))}catch(e){syncShadow=[]}}
function syncSaveShadow(rows){syncShadow=syncNormalizeRows(structuredClone(rows));localStorage.setItem(SYNC_SHADOW_KEY,JSON.stringify(syncShadow))}
function syncLoadPending(){try{return JSON.parse(localStorage.getItem(SYNC_PENDING_KEY)||"[]")}catch(e){return []}}
function syncSavePending(changes){localStorage.setItem(SYNC_PENDING_KEY,JSON.stringify(changes||[]))}
function syncLocalSave(silent=true){
  data=syncNormalizeRows(data); localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
  if(!silent){if(navigator.onLine)toast("تم حفظ البيانات محلياً — جاري المزامنة");else toast("تم حفظ البيانات محلياً — بانتظار عودة الإنترنت")}
}
function syncBuildChanges(){
  data=syncNormalizeRows(data);
  const oldMap=new Map(syncShadow.map(r=>[r.__syncId,r]));
  const newMap=new Map(data.map(r=>[r.__syncId,r]));
  const previous=syncLoadPending();
  const prevMap=new Map(previous.map(c=>[c.recordId+"|"+c.operation,c]));
  const changes=[];
  for(const r of data){
    const old=oldMap.get(r.__syncId);
    if(!old||syncComparable(old)!==syncComparable(r)){
      const key=r.__syncId+"|upsert", prev=prevMap.get(key);
      const samePending=prev && prev.data && syncComparable(prev.data)===syncComparable(r);
      changes.push({opId:samePending?prev.opId:crypto.randomUUID(),recordId:r.__syncId,operation:"upsert",updatedAt:(samePending?Number(prev.updatedAt||Date.now()):Date.now()),baseVersion:Number(old?.__syncVersion||0),data:structuredClone(r)});
    }
  }
  for(const old of syncShadow){
    if(!newMap.has(old.__syncId)){
      const key=old.__syncId+"|delete",prev=prevMap.get(key);
      changes.push({opId:prev?.opId||crypto.randomUUID(),recordId:old.__syncId,operation:"delete",updatedAt:Number(prev?.updatedAt||Date.now()),baseVersion:Number(old?.__syncVersion||0)});
    }
  }
  return changes;
}
function syncRebuildPending(){const c=syncBuildChanges();syncSavePending(c);return c}

async function fetchSyncRole(force=false){
  const nowTs=Date.now();
  if(!force && syncRoleCheckedAt && (nowTs-syncRoleCheckedAt)<SYNC_ROLE_CACHE_MS) return syncRole;
  try{
    const r=await fetch(SYNC_API_URL+"/sync/role",{headers:{"X-Device-Id":syncDeviceId(),...displayAuthHeader()},cache:"no-store"});
    const body=await r.json();
    if(!r.ok||body?.ok===false)throw Error(body?.error||"تعذر معرفة صلاحية الجهاز");
    if(!body.isPrimary && body.displayAuthRequired && !body.displayAuthenticated){displayShowLogin("تسجيل الدخول مطلوب للوصول إلى بيانات جهاز العرض.");throw Error("تسجيل الدخول مطلوب");}
    syncRole={configured:!!body.configured,isPrimary:!!body.isPrimary,deviceId:body.deviceId||syncDeviceId(),primaryDeviceId:body.primaryDeviceId||"",authoritativeReady:!!body.authoritativeReady,authoritativeGeneration:Number(body.authoritativeGeneration||0),displayPermissions:body.displayPermissions||null,displaySessionExpiresAt:Number(body.displaySessionExpiresAt||0)};
    if(body.displayPermissions){displayPermissions=body.displayPermissions;try{localStorage.setItem(DISPLAY_PERMS_CACHE_KEY,JSON.stringify(displayPermissions))}catch(e){}}
    try{localStorage.setItem(SYNC_ROLE_CACHE_KEY,JSON.stringify(syncRole))}catch(e){}
    syncRoleCheckedAt=nowTs;
    appReadOnly=!syncRole.isPrimary;
    document.body.classList.toggle("app-read-only",appReadOnly);
    const t=document.getElementById("syncRoleText"),b=document.getElementById("claimPrimaryBtn");
    if(t)t.textContent=syncRole.isPrimary?"هذا هو الجهاز الرئيسي — التعديل والإضافة والحذف والمزامنة مسموحة.":syncRole.configured?"هذا الجهاز للعرض فقط — يستقبل تحديثات الجهاز الرئيسي ولا يسمح بتعديل بيانات المخيم.":"لم يتم تعيين جهاز رئيسي بعد. لا تقم بتعيين هذا الجهاز إلا إذا كان هو الجهاز الرئيسي الفعلي.";
    if(b){b.hidden=syncRole.isPrimary||syncRole.configured;b.textContent=syncRole.configured?"الجهاز الرئيسي محدد":"تعيين هذا الجهاز كجهاز رئيسي";}
    return syncRole;
  }catch(e){
    syncRoleCheckedAt=0;
    try{
      const cached=JSON.parse(localStorage.getItem(SYNC_ROLE_CACHE_KEY)||"null");
      if(cached&&cached.configured){
        syncRole=cached;
        appReadOnly=!cached.isPrimary;
        document.body.classList.toggle("app-read-only",appReadOnly);
        return syncRole;
      }
    }catch(_e){}
    appReadOnly=true;
    document.body.classList.add("app-read-only");
    const t=document.getElementById("syncRoleText");
    if(t)t.textContent="تعذر الاتصال بخادم صلاحية الجهاز — الجهاز مقفول للعرض حتى يتم التحقق.";
    const b=document.getElementById("claimPrimaryBtn");
    if(b)b.hidden=true;
    return syncRole;
  }
}

window.claimPrimaryDevice=async function(){
  try{
    const r=await syncFetch("/sync/claim-primary",{method:"POST",body:JSON.stringify({})});
    syncRole={configured:true,isPrimary:true,deviceId:r.deviceId||syncDeviceId(),primaryDeviceId:r.primaryDeviceId||r.deviceId||syncDeviceId(),authoritativeReady:!!r.authoritativeReady};
    appReadOnly=false;document.body.classList.remove("app-read-only");
    toast("تم تعيين هذا الجهاز كالجهاز الرئيسي — التعديلات مسموحة من هنا فقط");
    await fetchSyncRole();
  }catch(e){toast(e?.message||"تعذر تعيين الجهاز الرئيسي");await fetchSyncRole();}
};
function requirePrimaryForEdit(){if(!appReadOnly)return true;toast("هذا الجهاز للعرض فقط — التعديل مسموح من الجهاز الرئيسي فقط");return false}

async function syncFetch(path,options={}){const headers={"Content-Type":"application/json","X-Device-Id":syncDeviceId(),...displayAuthHeader(),...(options.headers||{})};const res=await fetch(SYNC_API_URL+path,{...options,headers,cache:"no-store"});let body=null;try{body=await res.json()}catch(e){const er=Error("استجابة غير صالحة من الخادم");er.status=res.status;throw er}if(!res.ok||body?.ok===false){const er=Error(body?.error||("HTTP "+res.status));er.status=res.status;er.code=body?.code||"";throw er}return body}
function applyChangeToMap(map,c){if(c.operation==="delete")map.delete(c.recordId);else if(c.operation==="upsert"&&c.data){const x=structuredClone(c.data);x.__syncId=c.recordId;x.__syncVersion=Number(c.version||0);map.set(c.recordId,x)}}
function syncApplyChanges(changes,{protectIds=null}={}){let changed=false;const byId=new Map(data.map((r,i)=>[r.__syncId,i]));for(const c of changes||[]){if(protectIds?.has(c.recordId))continue;if(c.operation==="delete"){const idx=byId.get(c.recordId);if(idx!==undefined){data.splice(idx,1);changed=true;byId.clear();data.forEach((r,i)=>byId.set(r.__syncId,i))}}else if(c.operation==="upsert"&&c.data){const incoming=structuredClone(c.data);incoming.__syncId=c.recordId;incoming.__syncVersion=Number(c.version||0);const idx=byId.get(c.recordId);if(idx===undefined){data.push(incoming);byId.set(c.recordId,data.length-1);changed=true}else if(syncComparable(data[idx])!==syncComparable(incoming)){data[idx]=incoming;changed=true}}}return changed}
async function syncPullApply(){let cursor=syncCursor,loops=0,all=[];while(loops++<30){const r=await syncFetch(`/sync/pull?since=${encodeURIComponent(cursor)}&limit=500`,{method:"GET"});all=all.concat(r.changes||[]);cursor=Number(r.nextSince||cursor);syncCursor=cursor;localStorage.setItem(SYNC_CURSOR_KEY,String(cursor));if(!r.hasMore)break}return all}
async function syncInitialMerge(){
  // Legacy compatibility only. V51 uses the authoritative snapshot for secondary devices.
  return await syncAdoptAuthoritativeSnapshot(true);
}
async function syncPush(){
  let pending=syncLoadPending();
  if(!pending.length)pending=syncRebuildPending();
  const originalTotal=pending.length;
  if(!pending.length)return {accepted:0,total:0,remaining:0,conflicts:[]};
  let accepted=0, conflicts=[];
  for(let attempt=0;attempt<3 && pending.length;attempt++){
    conflicts=[];
    for(let i=0;i<pending.length;i+=100){
      const batch=pending.slice(i,i+100);
      const r=await syncFetch("/sync/push",{method:"POST",body:JSON.stringify({deviceId:syncDeviceId(),changes:batch})});
      const okIds=new Set((r.accepted||[]).map(x=>typeof x==="string"?x:x.opId));
      accepted+=okIds.size;
      conflicts.push(...(r.conflicts||[]));
      if(okIds.size){
        pending=pending.filter(c=>!okIds.has(c.opId));
        syncSavePending(pending);
      }
    }
    if(!conflicts.length)break;
    const byOp=new Map(conflicts.map(c=>[c.opId,c]));
    pending=pending.map(c=>{
      const conflict=byOp.get(c.opId);
      if(conflict&&Number.isFinite(Number(conflict.serverVersion))){
        return {...c,baseVersion:Number(conflict.serverVersion)};
      }
      return c;
    });
    syncSavePending(pending);
  }
  // Never rebuild the queue from an old shadow after accepted operations: that used to
  // recreate already-accepted changes and leave the main device showing false pending edits.
  if(!pending.length){
    syncSaveShadow(data);
    syncSavePending([]);
  }
  return {accepted,total:originalTotal,remaining:pending.length,conflicts};
}
async function syncFetchAuthoritativeSnapshot(){
  let after="", all=[], generation=0, loops=0;
  while(loops++<20){
    const q=`/sync/authoritative?after=${encodeURIComponent(after)}&limit=300`;
    const r=await syncFetch(q,{method:"GET"});
    generation=Number(r.generation||generation);
    all=all.concat(r.records||[]);
    after=r.nextAfter||after;
    if(!r.hasMore)break;
  }
  return {generation,records:all};
}
async function syncAdoptAuthoritativeSnapshot(force=false){
  const currentGen=Number(localStorage.getItem(AUTH_GEN_KEY)||0);
  const snap=await syncFetchAuthoritativeSnapshot();
  if(!force && snap.generation<=currentGen)return {changed:false,generation:snap.generation,count:data.length};
  const next=snap.records.map((x,i)=>{const r=structuredClone(x.data||{});r.__syncId=x.recordId;r.__syncVersion=Number(x.version||0);r["#"]=String(i+1);return r;});
  // Persist the complete authoritative snapshot BEFORE replacing the live UI data.
  // This is the offline source of truth for display devices.
  const cache={generation:Number(snap.generation||0),records:structuredClone(next),savedAt:Date.now()};
  localStorage.setItem(AUTH_SNAPSHOT_CACHE_KEY,JSON.stringify(cache));
  data=next;
  renumber();
  localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
  syncSaveShadow(data);
  syncSavePending([]);
  localStorage.setItem(AUTH_GEN_KEY,String(snap.generation));
  localStorage.setItem(SYNC_CURSOR_KEY,String(Number(__syncHealthCache?.latestSeq||0)));
  syncCursor=Number(__syncHealthCache?.latestSeq||0);
  rebuildFilters();renderAll();
  return {changed:true,generation:snap.generation,count:data.length};
}
function syncLoadOfflineAuthoritativeCache(){
  try{
    const raw=localStorage.getItem(AUTH_SNAPSHOT_CACHE_KEY); if(!raw)return false;
    const cache=JSON.parse(raw); if(!cache||!Array.isArray(cache.records)||!cache.records.length)return false;
    data=syncNormalizeRows(structuredClone(cache.records));
    renumber();
    localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
    localStorage.setItem(AUTH_GEN_KEY,String(Number(cache.generation||0)));
    rebuildFilters();renderAll();
    return true;
  }catch(e){return false}
}
async function syncAdoptCloudState(){return await syncAdoptAuthoritativeSnapshot(true)}
async function syncPrimaryReconcileOnce(){
  if(!syncRole.isPrimary)return {ok:false,skipped:true};
  if(localStorage.getItem(PRIMARY_RECONCILE_KEY)==="done")return {ok:true,skipped:true};
  data=syncNormalizeRows(data);
  const records=data.map((r,i)=>({recordId:syncRecordId(r,i),data:r}));
  const r=await syncFetch("/sync/primary-reconcile",{method:"POST",body:JSON.stringify({deviceId:syncDeviceId(),records})});
  if(!r?.ok)throw Error(r?.error||"تعذر اعتماد بيانات الجهاز الرئيسي");
  localStorage.setItem(PRIMARY_RECONCILE_KEY,"done");
  syncCursor=Number(r.latestSeq||0);localStorage.setItem(SYNC_CURSOR_KEY,String(syncCursor));
  syncSaveShadow(data);syncSavePending([]);
  localStorage.setItem(AUTH_GEN_KEY,String(Number(r.authoritativeGeneration||0)));
  syncInitialized=true;
  return r;
}
async function syncOnlineReconcile(reason="auto"){
  if(syncBusy||!navigator.onLine)return;syncBusy=true;
  try{
    await fetchSyncRole(true);
    if(!syncRole.configured){
      if(syncRole.isPrimary){} else {syncSavePending([]);return;}
    }
    if(syncRole.isPrimary){
      const rec=await syncPrimaryReconcileOnce();
      if(rec?.ok && !rec?.skipped){
        toast("تم اعتماد بيانات الجهاز الرئيسي — أصبحت هذه النسخة المرجع الرسمي");
      }
      syncLoadShadow();syncRebuildPending();
      const pushed=await syncPush();
      if(pushed.total>0 && pushed.remaining===0){
        const h=await syncFetch("/health",{method:"GET"});__syncHealthCache=h;__syncHealthAt=Date.now();
        syncSaveShadow(data);syncSavePending([]);localStorage.setItem(AUTH_GEN_KEY,String(Number(h.authoritativeGeneration||localStorage.getItem(AUTH_GEN_KEY)||0)));
      }
      syncInitialized=true;
      return;
    }
    // Secondary/display: never push. A lightweight pulse checks the authoritative generation
    // every cycle so display devices can follow the primary device without repeatedly reading
    // the full role payload. Full data is downloaded only when the generation changes.
    let pulse;
    try{
      pulse=await syncFetch("/sync/pulse",{method:"GET"});
    }catch(e){
      if(e?.code?.startsWith("DISPLAY_")||e?.status===401||e?.status===403||/تسجيل الدخول|قفل جهاز العرض|غير مفعل|جلسة/.test(String(e?.message||""))){
        displaySessionSave(null);
        displayShowLogin(String(e.message||"تسجيل الدخول مطلوب"));
        return;
      }
      throw e;
    }
    syncRole.authoritativeReady=!!pulse.authoritativeReady;
    syncRole.authoritativeGeneration=Number(pulse.authoritativeGeneration||0);
    const incomingPerms=pulse.displayPermissions||displayPermissions;
    let permissionsChanged=false;
    try{permissionsChanged=JSON.stringify(incomingPerms)!==localStorage.getItem(DISPLAY_PERMS_CACHE_KEY)}catch(e){}
    syncRole.displayPermissions=incomingPerms;
    displayPermissions=incomingPerms;
    try{localStorage.setItem(DISPLAY_PERMS_CACHE_KEY,JSON.stringify(displayPermissions))}catch(e){}
    applyDisplayPermissions();
    const seen=Number(localStorage.getItem(AUTH_GEN_KEY)||0);
    const serverGen=Number(pulse.authoritativeGeneration||0);
    if(!pulse.authoritativeReady){syncSavePending([]);return;}
    if(!syncInitialized || serverGen!==seen || permissionsChanged){
      const snap=await syncAdoptAuthoritativeSnapshot(true);
      if(snap.changed){
        const lastNotice=Number(localStorage.getItem(AUTH_NOTICE_GEN_KEY)||0);
        if(snap.generation!==lastNotice){
          localStorage.setItem(AUTH_NOTICE_GEN_KEY,String(snap.generation));
          toast(`تم تحديث جهاز العرض تلقائياً — ${snap.count} سجل`);
        }
      }
    }
    syncSavePending([]);
    syncInitialized=true;
  }catch(e){
    console.warn("Cloud sync V51.4:",e);
    if(reason!=="timer")toast(`تعذر تحديث السحابة الآن — ${e?.message||"البيانات المحلية محفوظة"}`);
    if(reason==="manual") throw e;
  }finally{syncBusy=false}
}
function showProgramUpdateNotice(){
  const seen=localStorage.getItem(APP_RELEASE_KEY);
  if(seen===APP_RELEASE_VERSION)return;
  localStorage.setItem(APP_RELEASE_KEY,APP_RELEASE_VERSION);
  const old=document.getElementById("programUpdateNotice"); if(old)old.remove();
  const box=document.createElement("div"); box.id="programUpdateNotice"; box.innerHTML=`<div class="program-update-icon">✓</div><div><strong>تم تحديث البرنامج</strong><p>تم تحديث البرنامج بنجاح، ويجري الآن بدء معالجة ومزامنة البيانات مع السحابة.</p></div>`;
  const st=document.createElement("style"); st.textContent=`#programUpdateNotice{position:fixed;z-index:99999;left:50%;top:50%;transform:translate(-50%,-50%) scale(.96);width:min(440px,calc(100vw - 32px));display:flex;gap:14px;align-items:flex-start;padding:20px;border-radius:18px;background:#111827;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,.28);font-family:inherit;animation:programNoticeIn .35s ease forwards}#programUpdateNotice .program-update-icon{width:38px;height:38px;flex:0 0 38px;border-radius:50%;display:grid;place-items:center;background:#16a34a;font-weight:800;font-size:20px}#programUpdateNotice strong{display:block;font-size:17px;margin:1px 0 6px}#programUpdateNotice p{margin:0;color:#d1d5db;font-size:13px;line-height:1.8}@keyframes programNoticeIn{to{transform:translate(-50%,-50%) scale(1)}}@media(max-width:520px){#programUpdateNotice{padding:17px}.program-update-icon{width:34px!important;height:34px!important;flex-basis:34px!important}}`;
  document.head.appendChild(st);document.body.appendChild(box);
  setTimeout(()=>{box.style.transition="opacity .35s, transform .35s";box.style.opacity="0";box.style.transform="translate(-50%,-50%) scale(.98)";setTimeout(()=>box.remove(),380)},3200);
}

function installCloudSync(){
  data=syncNormalizeRows(data);syncLoadShadow();syncLoadPending();
  if(!navigator.onLine){ syncLoadOfflineAuthoritativeCache(); }

  window.saveNow=function(){try{syncLocalSave(false);syncRebuildPending();syncOnlineReconcile("manual")}catch(e){toast("تعذر حفظ البيانات محلياً")}};
  window.autoSave=function(){try{syncLocalSave(true);syncRebuildPending();clearTimeout(window.__syncSaveTimer);window.__syncSaveTimer=setTimeout(()=>syncOnlineReconcile("auto"),350)}catch(e){toast("تعذر الحفظ المحلي: مساحة التخزين ممتلئة")}};
  window.addEventListener("online",()=>syncOnlineReconcile("online"));
  window.addEventListener("offline",()=>{const n=syncLoadPending().length;if(n)toast(`⚠️ ${n} تعديل محفوظ محلياً — بانتظار عودة الإنترنت`)});
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")syncOnlineReconcile("visible")});
  clearInterval(syncTimer);let syncTick=0;syncTimer=setInterval(()=>{syncTick++;if(appReadOnly){syncOnlineReconcile("timer");}else if(syncTick%6===0){syncOnlineReconcile("timer");}},2500);
  showProgramUpdateNotice();
  setTimeout(()=>syncOnlineReconcile("startup"),700);
}

async function initDisplayAuth(){
  displayAuthLock();
  updateDisplayLoginConnection();
  try{
    const role=await fetchSyncRole(true);
    if(role?.isPrimary){
      appReadOnly=false;
      document.body.classList.remove("app-read-only");
      displayHideLogin();
      startProtectedApp();
      return true;
    }
    const valid=await displayAuthValidate();
    if(valid.ok){
      displayHideLogin();
      startProtectedApp();
      applyDisplayPermissions();
      return true;
    }
    displayShowLogin(valid.disabled?(valid.emergency?"تم قفل جهاز العرض مؤقتاً من الجهاز الرئيسي.":"هذا الحساب غير مفعل، يرجى التواصل مع إدارة النظام."):(valid.offline?"لا يوجد اتصال بالإنترنت. سيتم استخدام آخر جلسة محلية آمنة فقط إذا كانت ما زالت صالحة.":""));
    return false;
  }catch(e){
    const valid=await displayAuthValidate();
    if(valid.ok){displayHideLogin();startProtectedApp();applyDisplayPermissions();return true}
    displayShowLogin(navigator.onLine?"تعذر التحقق من جلسة جهاز العرض. سجّل الدخول مرة أخرى.":"لا يوجد اتصال بالإنترنت. سيتم استخدام آخر جلسة محلية آمنة فقط إذا كانت ما زالت صالحة.");
    return false;
  }
}

setTimeout(()=>initDisplayAuth(),120);

function styleExcelWorksheet(ws, options={}){
  if(!ws || !ws["!ref"]) return ws;
  const range=XLSX.utils.decode_range(ws["!ref"]);
  const headerRows=options.headerRows||1;
  const minWidth=options.minWidth||10, maxWidth=options.maxWidth||48;
  const widths=[];
  for(let c=range.s.c;c<=range.e.c;c++){
    let maxLen=0;
    for(let r=range.s.r;r<=range.e.r;r++){
      const cell=ws[XLSX.utils.encode_cell({r,c})];
      const v=cell?.v==null?"":String(cell.v);
      maxLen=Math.max(maxLen,...v.split(/\r?\n/).map(s=>s.length));
    }
    widths.push({wch:Math.min(maxWidth,Math.max(minWidth,Math.ceil(maxLen*1.08)+2))});
  }
  ws["!cols"]=widths;
  ws["!rows"]=[];
  for(let r=range.s.r;r<=range.e.r;r++){
    let lines=1;
    for(let c=range.s.c;c<=range.e.c;c++){
      const cell=ws[XLSX.utils.encode_cell({r,c})];
      const v=cell?.v==null?"":String(cell.v);
      lines=Math.max(lines,v.split(/\r?\n/).length);
      if(cell) cell.s={
        alignment:{horizontal:"center",vertical:"center",wrapText:true,readingOrder:2},
        border:{
          top:{style:"thin",color:{rgb:"B7B7B7"}},
          bottom:{style:"thin",color:{rgb:"B7B7B7"}},
          left:{style:"thin",color:{rgb:"B7B7B7"}},
          right:{style:"thin",color:{rgb:"B7B7B7"}}
        },
        font:{name:"Arial",sz:r<headerRows?12:10,bold:r<headerRows},
        fill:r<headerRows?{patternType:"solid",fgColor:{rgb:"D9E2F3"}}:undefined
      };
    }
    ws["!rows"][r]={hpt:r<headerRows?34:Math.min(60,Math.max(22,18+(lines-1)*12))};
  }
  ws["!freeze"]={xSplit:0,ySplit:headerRows};
  ws["!autofilter"]={ref:ws["!ref"]};
  ws["!pageSetup"]={paperSize:9,orientation:"landscape",fitToWidth:1,fitToHeight:0,scale:100,horizontalDpi:300,verticalDpi:300};
  ws["!pageMargins"]={left:.25,right:.25,top:.45,bottom:.45,header:.15,footer:.15};
  ws["!printOptions"]={horizontalCentered:true,verticalCentered:false,gridLines:false};
  return ws;
}


function exportStyledExcel(rows,filename="كشف_أبو_عريبان",sheetName="الكشف"){
  if(!Array.isArray(rows)||!rows.length){toast("لا توجد بيانات لتصديرها");return;}
  const clean=rows.map(r=>{const o={};Object.keys(r||{}).forEach(k=>o[k]=r[k]??"");return o;});
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.json_to_sheet(clean,{skipHeader:false});
  styleExcelWorksheet(ws);
  XLSX.utils.book_append_sheet(wb,ws,sheetName.slice(0,31));
  XLSX.writeFile(wb,filename.endsWith(".xlsx")?filename:filename+".xlsx",{bookType:"xlsx",cellStyles:true});
}



/* ===== Consolidated UI scripts ===== */


(function(){
  function rows(){
    return Array.isArray(data) ? data : [];
  }

  function families(){
    const map = new Map();
    rows().forEach(r=>{
      const name = String(r["اسم رب الأسرة"] || "").trim();
      if(!name) return;
      if(!map.has(name)) map.set(name, []);
      map.get(name).push(r);
    });
    return [...map.values()].map(list=>list[0]);
  }

  function peopleOf(f){
    const id = String(f["رقم هوية الأسرة"] || "");
    const name = String(f["اسم رب الأسرة"] || "");
    return rows().filter(p=>{
      return String(p["رقم هوية الأسرة"] || "") === id &&
             String(p["اسم رب الأسرة"] || "") === name;
    });
  }

  function esc(v){
    return String(v ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  }

  function statusClass(s){
    s=String(s||"");
    if(s.includes("مكتملة")) return "status-good";
    if(s.includes("جزئية")) return "status-warn";
    return "status-bad";
  }

  function familyStatus(f){
    return f["حالة اكتمال بيانات الأسرة"] || "غير محددة";
  }

  function count(f){ return peopleOf(f).length; }

  window.runFamilySearch=function(){
    const input=document.getElementById("familySearchInput");
    const q=String(input?.value||"").trim().toLowerCase();
    const results=document.getElementById("familySearchResults");
    const empty=document.getElementById("familySearchEmpty");
    const card=document.getElementById("familyCardArea");

    if(!q){
      results.innerHTML="";
      empty.style.display="none";
      card.style.display="none";
      return;
    }

    const matches=families().filter(f=>{
      const name=String(f["اسم رب الأسرة"]||"").toLowerCase();
      const id=String(f["رقم هوية الأسرة"]||"").toLowerCase();
      const phone=String(f["رقم الجوال"]||"").toLowerCase();
      const alt=String(f["رقم جوال بديل"]||"").toLowerCase();
      return name.includes(q) || id.includes(q) || phone.includes(q) || alt.includes(q);
    });

    card.style.display="none";

    if(!matches.length){
      results.innerHTML="";
      empty.style.display="";
      return;
    }

    empty.style.display="none";
    results.innerHTML=matches.slice(0,50).map(f=>{
      const id=f["رقم هوية الأسرة"]||"";
      return `
      <div class="family-result-card">
        <div class="family-result-head">
          <div>
            <div class="family-result-name">عائلة ${esc(f["اسم رب الأسرة"]||"غير محدد")}</div>
            <div class="family-result-meta">رقم هوية الأسرة: ${esc(id||"غير متوفر")}</div>
          </div>
          <span class="family-status ${statusClass(familyStatus(f))}">${esc(familyStatus(f))}</span>
        </div>

        <div class="family-result-grid">
          <div class="family-mini-field">
            <div class="family-mini-label">عدد الأفراد</div>
            <div class="family-mini-value">${count(f)}</div>
          </div>
          <div class="family-mini-field">
            <div class="family-mini-label">داخل/خارج المخيم</div>
            <div class="family-mini-value">${esc(f["داخل/خارج المخيم"]||"غير محدد")}</div>
          </div>
          <div class="family-mini-field">
            <div class="family-mini-label">رقم الجوال</div>
            <div class="family-mini-value">${esc(f["رقم الجوال"]||"غير متوفر")}</div>
          </div>
          <div class="family-mini-field">
            <div class="family-mini-label">العنوان</div>
            <div class="family-mini-value">${esc(f["العنوان"]||"غير متوفر")}</div>
          </div>
        </div>

        <div class="family-card-actions">
          <button class="btn primary" onclick='showFamilyCard(${JSON.stringify(String(id))})'>عرض بطاقة العائلة</button>
        </div>
      </div>`;
    }).join("");
  };

  window.clearFamilySearch=function(){
    const input=document.getElementById("familySearchInput");
    if(input) input.value="";
    runFamilySearch();
    input?.focus();
  };

  window.showFamilyCard=function(id){
    const f=families().find(x=>String(x["رقم هوية الأسرة"]||"")===String(id));
    if(!f) return;

    const people=peopleOf(f);
    const status=familyStatus(f);
    const area=document.getElementById("familyCardArea");

    const personRows=people.length ? people.map((p,i)=>{
      const flags=[];
      if(p["مرض مزمن؟"]==="نعم") flags.push("مرض مزمن");
      if((p["إصابة؟"]||p["إصابة?"])==="نعم") flags.push("مصاب");
      if(p["إعاقة؟"]==="نعم") flags.push("ذو إعاقة");
      if(p["يتيم/منفصل عن ذويه؟"]==="نعم") flags.push("يتيم/منفصل");
      if(p["حامل؟"]==="نعم") flags.push("حامل");
      if(p["مرضعة؟"]==="نعم") flags.push("مرضعة");

      return `<tr>
        <td>${i+1}</td>
        <td><b>${esc(p["اسم الفرد"]||"")}</b></td>
        <td>${esc(p["صلة القرابة"]||"")}</td>
        <td>${esc(p["الجنس"]||"")}</td>
        <td>${esc(p["العمر التقريبي"]||"")}</td>
        <td>
          <div class="family-health-badges">
            ${flags.length ? flags.map(x=>`<span class="family-health-badge">${esc(x)}</span>`).join("") : "—"}
          </div>
        </td>
      </tr>`;
    }).join("") : `<tr><td colspan="6" style="text-align:center">لا يوجد أفراد مسجلون لهذه العائلة.</td></tr>`;

    area.innerHTML=`
      <div class="family-card">
        <div class="family-card-top">
          <div class="family-card-title">
            <div class="family-title-wrap">
              <div class="family-avatar">ع</div>
              <div>
                <div class="family-title">عائلة ${esc(f["اسم رب الأسرة"]||"غير محدد")}</div>
                <div class="family-subtitle">بطاقة بيانات العائلة — مخيم أبو عريبان</div>
              </div>
            </div>
            <span class="family-status ${statusClass(status)}">${esc(status)}</span>
          </div>
        </div>

        <div class="family-card-body">
          <div class="family-info-grid">
            <div class="family-info-item"><div class="family-info-label">اسم رب الأسرة</div><div class="family-info-value">${esc(f["اسم رب الأسرة"]||"غير متوفر")}</div></div>
            <div class="family-info-item"><div class="family-info-label">رقم هوية الأسرة</div><div class="family-info-value">${esc(f["رقم هوية الأسرة"]||"غير متوفر")}</div></div>
            <div class="family-info-item"><div class="family-info-label">رقم الجوال</div><div class="family-info-value">${esc(f["رقم الجوال"]||"غير متوفر")}</div></div>
            <div class="family-info-item"><div class="family-info-label">رقم جوال بديل</div><div class="family-info-value">${esc(f["رقم جوال بديل"]||"غير متوفر")}</div></div>
            <div class="family-info-item"><div class="family-info-label">داخل/خارج المخيم</div><div class="family-info-value">${esc(f["داخل/خارج المخيم"]||"غير محدد")}</div></div>
            <div class="family-info-item"><div class="family-info-label">عدد الأفراد</div><div class="family-info-value">${people.length}</div></div>
            <div class="family-info-item"><div class="family-info-label">حالة اكتمال البيانات</div><div class="family-info-value">${esc(f["حالة اكتمال بيانات الأسرة"]||"غير محددة")}</div></div>
            <div class="family-info-item"><div class="family-info-label">المحافظة الأصلية</div><div class="family-info-value">${esc(f["المحافظة الأصلية"]||"غير متوفر")}</div></div>
            <div class="family-info-item"><div class="family-info-label">حالة المسكن الأصلي</div><div class="family-info-value">${esc(f["حالة المسكن الأصلي"]||"غير متوفر")}</div></div>
            <div class="family-info-item"><div class="family-info-label">نوع السكن الحالي</div><div class="family-info-value">${esc(f["نوع السكن الحالي"]||"غير متوفر")}</div></div>
            <div class="family-info-item" style="grid-column:1/-1"><div class="family-info-label">العنوان</div><div class="family-info-value">${esc(f["العنوان"]||"غير متوفر")}</div></div>
            <div class="family-info-item" style="grid-column:1/-1"><div class="family-info-label">ملاحظات الأسرة</div><div class="family-info-value">${esc(f["ملاحظات الأسرة"]||"لا توجد ملاحظات")}</div></div>
          </div>

          <div class="family-members">
            <h3>أفراد العائلة (${people.length})</h3>
            <div style="overflow:auto">
              <table class="family-member-table">
                <thead>
                  <tr><th>#</th><th>اسم الفرد</th><th>صلة القرابة</th><th>الجنس</th><th>العمر</th><th>الحالات الخاصة</th></tr>
                </thead>
                <tbody>${personRows}</tbody>
              </table>
            </div>
          </div>

          <div class="family-card-actions">
            <button class="btn secondary" onclick="document.getElementById('familyCardArea').style.display='none'">إغلاق البطاقة</button>
          </div>
        </div>
      </div>`;

    area.style.display="";
    area.scrollIntoView({behavior:"smooth",block:"start"});
  };
})();


/* ===== Consolidated UI scripts ===== */


/* ================= V15 — تجربة استخدام + أمان الاستعادة + مزامنة ================= */
(function(){
  const REL_OPTIONS=["","رب الأسرة","زوج","زوجة","ابن","ابنة","أب","أم","أخ","أخت","جد","جدة","حفيد","حفيدة","حما","حماة","قريب","أخرى"];
  const MARITAL_OPTIONS=["","أعزب/عزباء","متزوج/متزوجة","مطلق/مطلقة","أرمل/أرملة","منفصل/منفصلة"];

  function ageParts(dateStr){
    if(!dateStr)return null;
    const d=new Date(dateStr+"T00:00:00");
    if(Number.isNaN(d.getTime()))return null;
    const now=new Date();
    if(d>now)return null;
    let y=now.getFullYear()-d.getFullYear();
    let m=now.getMonth()-d.getMonth();
    let day=now.getDate()-d.getDate();
    if(day<0){m--; const prev=new Date(now.getFullYear(),now.getMonth(),0); day+=prev.getDate();}
    if(m<0){y--;m+=12;}
    return {years:y,months:m,days:day};
  }
  function ageLabel(dateStr){const a=ageParts(dateStr);if(!a)return "";return `${a.years} سنة${a.months?` و ${a.months} شهر`:""}${a.days?` و ${a.days} يوم`:""}`;}
  function ageYears(dateStr){const a=ageParts(dateStr);return a?a.years:null;}
  function updatePersonAge(){
    const birth=document.getElementById("p_birth"), age=document.getElementById("p_age"), hint=document.getElementById("p_age_hint");
    if(!birth||!age)return;
    if(birth.value){
      const a=ageParts(birth.value);
      if(a){age.value=String(a.years);if(hint)hint.textContent=`العمر الحالي: ${ageLabel(birth.value)} — يُحدّث تلقائياً.`;return;}
    }
    if(hint)hint.textContent="أدخل تاريخ الميلاد ليتم حساب العمر تلقائياً.";
  }
  function ensureSelectValue(id,value,options){
    const el=document.getElementById(id);if(!el)return;
    const v=String(value??"");
    if(v && ![...el.options].some(o=>o.value===v)){
      const o=document.createElement("option");o.value=v;o.textContent=v+" (قديم)";el.appendChild(o);
    }
    el.value=v;
  }
  function patchPersonForm(){
    const rel=document.getElementById("p_rel"),mar=document.getElementById("p_marital");
    if(rel){rel.innerHTML=REL_OPTIONS.map(v=>`<option value="${esc(v)}">${esc(v||"اختر صلة القرابة")}</option>`).join("");}
    if(mar){mar.innerHTML=MARITAL_OPTIONS.map(v=>`<option value="${esc(v)}">${esc(v||"اختر الحالة الاجتماعية")}</option>`).join("");}
    const birth=document.getElementById("p_birth");
    if(birth){birth.addEventListener("change",updatePersonAge);birth.addEventListener("input",updatePersonAge);}
  }

  // Override person editor without changing the existing data model.
  window.openPersonModal=function(idx=null){
    document.getElementById("personForm").reset();document.getElementById("p_index").value=idx==null?"":idx;
    document.getElementById("personModalTitle").textContent=idx==null?"إضافة فرد":"تعديل فرد";
    if(idx!=null && data[idx]){
      const r=data[idx];
      setv("p_name",r["اسم الفرد"]);setv("p_head",r["اسم رب الأسرة"]);setv("p_id",r["رقم هوية الفرد"]);
      ensureSelectValue("p_rel",r["صلة القرابة"],REL_OPTIONS);ensureSelectValue("p_marital",r["الحالة الاجتماعية"],MARITAL_OPTIONS);
      setv("p_gender",r["الجنس"]);setv("p_birth",r["تاريخ الميلاد"]);setv("p_age",r["العمر التقريبي"]);
      setv("p_chronic",r["مرض مزمن؟"]||r["مرض مزمن?"]);setv("p_disease",r["نوع المرض"]);setv("p_injury",r["إصابة؟"]||r["إصابة?"]);setv("p_injuryreason",r["سبب الإصابة"]);setv("p_injurydetails",r["تفاصيل الإصابة"]);setv("p_disability",r["إعاقة؟"]);setv("p_disabilitytype",r["نوع الإعاقة"]);setv("p_orphan",r["يتيم/منفصل عن ذويه؟"]||r["يتيم/منفصل عن ذويه?"]);setv("p_preg",r["حامل؟"]);setv("p_lact",r["مرضعة؟"]);setv("p_notes",r["ملاحظات الفرد"]);
    }
    patchPersonForm();updatePersonAge();document.getElementById("personModal").classList.add("show");
  };
  window.fillPerson=function(r){
    setv("p_name",r["اسم الفرد"]);setv("p_head",r["اسم رب الأسرة"]);setv("p_id",r["رقم هوية الفرد"]);ensureSelectValue("p_rel",r["صلة القرابة"],REL_OPTIONS);setv("p_gender",r["الجنس"]);ensureSelectValue("p_marital",r["الحالة الاجتماعية"],MARITAL_OPTIONS);setv("p_birth",r["تاريخ الميلاد"]);setv("p_age",r["العمر التقريبي"]);setv("p_chronic",r["مرض مزمن؟"]||r["مرض مزمن?"]);setv("p_disease",r["نوع المرض"]);setv("p_injury",r["إصابة؟"]||r["إصابة?"]);setv("p_injuryreason",r["سبب الإصابة"]);setv("p_injurydetails",r["تفاصيل الإصابة"]);setv("p_disability",r["إعاقة؟"]);setv("p_disabilitytype",r["نوع الإعاقة"]);setv("p_orphan",r["يتيم/منفصل عن ذويه؟"]||r["يتيم/منفصل عن ذويه?"]);setv("p_preg",r["حامل؟"]);setv("p_lact",r["مرضعة؟"]);setv("p_notes",r["ملاحظات الفرد"]);updatePersonAge();
  };
  window.savePerson=function(e){
    e.preventDefault();const idx=document.getElementById("p_index").value,r=idx===""?emptyRecord():data[+idx];
    const head=v("p_head").trim(),name=v("p_name").trim();if(!name||!head){alert("اسم الفرد واسم رب الأسرة مطلوبان");return;}
    r["اسم الفرد"]=name;r["اسم رب الأسرة"]=head;r["رقم هوية الفرد"]=v("p_id");r["صلة القرابة"]=v("p_rel");r["الجنس"]=v("p_gender");r["الحالة الاجتماعية"]=v("p_marital");r["تاريخ الميلاد"]=v("p_birth");
    const calculated=ageYears(v("p_birth"));if(calculated!==null)r["العمر التقريبي"]=String(calculated); // لا نكتب العمر يدوياً؛ نحسبه من تاريخ الميلاد
    else if(!filled(r["العمر التقريبي"]))r["العمر التقريبي"]="";
    r["مرض مزمن?"]=r["مرض مزمن؟"]=v("p_chronic");r["نوع المرض"]=v("p_disease");r["إصابة؟"]=v("p_injury");r["سبب الإصابة"]=v("p_injuryreason");r["تفاصيل الإصابة"]=v("p_injurydetails");r["إعاقة؟"]=v("p_disability");r["نوع الإعاقة"]=v("p_disabilitytype");r["يتيم/منفصل عن ذويه?"]=r["يتيم/منفصل عن ذويه؟"]=v("p_orphan");r["حامل؟"]=v("p_preg");r["مرضعة؟"]=v("p_lact");r["ملاحظات الفرد"]=v("p_notes");
    const fm=familyMap().get(head)?.[0];if(fm){["رقم هوية الأسرة","رقم الجوال","رقم جوال بديل","العنوان","داخل/خارج المخيم","حالة اكتمال بيانات الأسرة","المحافظة الأصلية","حالة المسكن الأصلي","نوع السكن الحالي","ملاحظات الأسرة"].forEach(k=>r[k]=fm[k]||"");}
    if(idx===""){r["#"]=String(data.length+1);syncRecordId(r,data.length);data.push(r);}else{syncRecordId(r,+idx);}
    autoSave();closeModal("personModal");rebuildFilters();renderAll();toast(idx===""?"تمت إضافة الفرد وحساب العمر تلقائياً":"تم تعديل الفرد");
  };

  // Better restore: validates, shows metadata, creates a safety backup, and accepts old v1 backups.
  window.backup=function(){
    data=syncNormalizeRows(data);
    const payload={app:"إدارة وكشف المخيمات",schemaVersion:2,version:2,createdAt:new Date().toISOString(),columns:COLUMNS,data,meta:{recordCount:data.length,familyCount:familyMap().size,syncCursor:Number(syncCursor||0),deviceId:syncDeviceId()}};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json;charset=utf-8"});downloadBlob(blob,`نسخة-احتياطية-المخيم-${dateStamp()}-${data.length}-سجل.json`);toast(`تم إنشاء نسخة احتياطية كاملة — ${data.length} سجل`);
  };
  function normalizeRestoredRows(rows){
    return rows.map((r,i)=>{const x=Object.assign(emptyRecord(),r||{});x["#"]=String(i+1);syncRecordId(x,i);if(!x["العمر التقريبي"]&&x["تاريخ الميلاد"]){const a=ageYears(x["تاريخ الميلاد"]);if(a!==null)x["العمر التقريبي"]=String(a);}return x;});
  }
  window.restoreBackup=function(e){
    const f=e.target.files?.[0];if(!f)return;
    const reader=new FileReader();reader.onload=()=>{
      try{
        const p=JSON.parse(reader.result),rows=Array.isArray(p)?p:p?.data;
        if(!Array.isArray(rows)||!rows.length)throw Error("لا توجد سجلات صالحة");
        const normalized=normalizeRestoredRows(rows), familyCount=new Set(normalized.map(r=>r["اسم رب الأسرة"]).filter(Boolean)).size;
        const oldLabel=p?.schemaVersion?`نسخة النظام ${p.schemaVersion}`:"نسخة قديمة متوافقة";
        if(!confirm(`تم التحقق من النسخة بنجاح.\n\n${oldLabel}\nالأفراد: ${normalized.length}\nالعائلات: ${familyCount}\n\nسيتم حفظ نسخة أمان من البيانات الحالية أولاً، ثم استعادة هذه النسخة على الجهاز.\n\nهل تريد المتابعة؟`))return;
        // Safety copy of the current state before replacing anything.
        try{const safety={app:"إدارة وكشف المخيمات",schemaVersion:2,createdAt:new Date().toISOString(),columns:COLUMNS,data:syncNormalizeRows(structuredClone(data)),meta:{type:"pre-restore-safety",recordCount:data.length}};downloadBlob(new Blob([JSON.stringify(safety,null,2)],{type:"application/json;charset=utf-8"}),`نسخة-أمان-قبل-الاستعادة-${dateStamp()}.json`);}catch(_e){}
        data=normalized;syncSaveShadow(data);syncLocalSave(true);rebuildFilters();renderAll();
        // Do not automatically overwrite the cloud. The cloud remains recoverable.
        syncInitialized=true;toast(`تمت الاستعادة بنجاح — ${data.length} سجل / ${familyCount} عائلة`);
      }catch(err){alert("ملف النسخة الاحتياطية غير صالح أو لا يحتوي على بيانات قابلة للاستعادة.");}
    };reader.readAsText(f);e.target.value="";
  };

  // Saved custom report templates — filters + advanced conditions + columns.
  const REPORT_TEMPLATES_KEY="aboreiban_report_templates_v1";
  function getTemplates(){try{return JSON.parse(localStorage.getItem(REPORT_TEMPLATES_KEY)||"{}")}catch(e){return {}}}
  function refreshReportTemplates(){const s=document.getElementById("savedReportTemplate");if(!s)return;const g=getTemplates();s.innerHTML='<option value="">الكشوف المحفوظة</option>'+Object.keys(g).sort((a,b)=>a.localeCompare(b,"ar")).map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("");}
  window.saveCurrentReportTemplate=function(){
    const name=(document.getElementById("cr_name")?.value||"").trim();if(!name){alert("اكتب اسم الكشف أولاً");return;}
    syncReportColumns();const t=getTemplates();t[name]={name,gender:document.getElementById("cr_gender").value,min:document.getElementById("cr_minage").value,max:document.getElementById("cr_maxage").value,special:document.getElementById("cr_special").value,rel:document.getElementById("cr_rel").value,sort:document.getElementById("cr_sort").value,onlySelected:document.getElementById("cr_only_selected")?.checked||false,columns:[...selectedReportColumns],conditions:JSON.parse(JSON.stringify(reportConditions||[])),conditionMode:document.querySelector('input[name="conditionMode"]:checked')?.value||"and"};localStorage.setItem(REPORT_TEMPLATES_KEY,JSON.stringify(t));refreshReportTemplates();document.getElementById("savedReportTemplate").value=name;toast("تم حفظ إعداد الكشف");
  };
  window.loadReportTemplate=function(name){if(!name)return;const t=getTemplates()[name];if(!t)return;document.getElementById("cr_name").value=t.name||name;document.getElementById("cr_gender").value=t.gender||"";document.getElementById("cr_minage").value=t.min||"";document.getElementById("cr_maxage").value=t.max||"";document.getElementById("cr_special").value=t.special||"";document.getElementById("cr_rel").value=t.rel||"";document.getElementById("cr_sort").value=t.sort||"family";if(document.getElementById("cr_only_selected"))document.getElementById("cr_only_selected").checked=!!t.onlySelected;selectedReportColumns=[...(t.columns||[])];reportConditions=JSON.parse(JSON.stringify(t.conditions||[]));const radio=document.querySelector(`input[name="conditionMode"][value="${t.conditionMode||"and"}"]`);if(radio)radio.checked=true;initReportColumns();renderConditionRows();runCustomReport();toast("تم تحميل إعداد الكشف");};
  window.deleteCurrentReportTemplate=function(){const s=document.getElementById("savedReportTemplate"),name=s?.value;if(!name){toast("اختر كشفاً محفوظاً أولاً");return;}if(confirm(`حذف إعداد الكشف «${name}»؟`)){const t=getTemplates();delete t[name];localStorage.setItem(REPORT_TEMPLATES_KEY,JSON.stringify(t));refreshReportTemplates();toast("تم حذف إعداد الكشف");}};

  // Smart dashboard.
  function dashboardCounts(){
    const children=data.filter(r=>{const a=ageOf(r);return a!==null&&a>=0&&a<=17}).length;
    const chronic=data.filter(r=>r["مرض مزمن؟"]==="نعم"||r["مرض مزمن?"]==="نعم").length;
    const injury=data.filter(r=>(r["إصابة؟"]||r["إصابة?"])==="نعم").length;
    const disability=data.filter(r=>r["إعاقة؟"]==="نعم").length;
    const missing=data.filter(r=>!filled(r["اسم الفرد"])||!filled(r["رقم هوية الفرد"])||!filled(r["تاريخ الميلاد"])).length;
    return {children,chronic,injury,disability,missing,health:chronic+injury+disability};
  }
  const oldRenderDashboard=window.renderDashboard;
  window.renderDashboard=function(){if(typeof oldRenderDashboard==="function")oldRenderDashboard();const c=dashboardCounts();for(const [id,vv] of Object.entries({dashChildren:c.children,dashHealthTotal:c.health,dashMissingPeople:c.missing})){const el=document.getElementById(id);if(el)el.textContent=Number(vv).toLocaleString('ar-EG');}refreshSyncCenter(false);};
  window.openSmartReport=function(type){showView("classified");setTimeout(()=>{if(type==="children")setReportPreset("children");else if(type==="missing"){document.getElementById("cr_name").value="كشف البيانات الناقصة";document.getElementById("cr_gender").value="";document.getElementById("cr_minage").value="";document.getElementById("cr_maxage").value="";document.getElementById("cr_special").value="";document.getElementById("cr_rel").value="";selectedReportColumns=["اسم الفرد","اسم رب الأسرة","رقم هوية الفرد","رقم الجوال","تاريخ الميلاد","العمر التقريبي","الجنس","الحالة الاجتماعية"];reportConditions=[{field:"اسم الفرد",op:"empty",value:""},{field:"رقم هوية الفرد",op:"empty",value:""},{field:"تاريخ الميلاد",op:"empty",value:""}];const rm=document.querySelector('input[name="conditionMode"][value="or"]');if(rm)rm.checked=true;initReportColumns();renderConditionRows();runCustomReport();}else{document.getElementById("cr_name").value="كشف الحالات الصحية";document.getElementById("cr_special").value="";selectedReportColumns=["اسم الفرد","اسم رب الأسرة","رقم هوية الفرد","رقم الجوال","الجنس","العمر التقريبي","مرض مزمن؟","إصابة؟","إعاقة؟"];reportConditions=[{field:"مرض مزمن؟",op:"eq",value:"نعم"},{field:"إصابة؟",op:"eq",value:"نعم"},{field:"إعاقة؟",op:"eq",value:"نعم"}];const rh=document.querySelector('input[name="conditionMode"][value="or"]');if(rh)rh.checked=true;initReportColumns();renderConditionRows();runCustomReport();}},50);};

  // Sync center. Health is intentionally throttled so opening/rendering views cannot consume D1 reads.
  let __syncHealthCache=null,__syncHealthAt=0;
  window.refreshSyncCenter=async function(showToast=true){
    await fetchSyncRole();
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    try{
      let h=__syncHealthCache;
      if(!h || (Date.now()-__syncHealthAt)>30000 || showToast){h=await syncFetch("/health",{method:"GET"});__syncHealthCache=h;__syncHealthAt=Date.now();}
      set("syncStatusValue","متصل ✓");set("syncStatusSub",new Date(h.time||Date.now()).toLocaleString('ar-EG'));set("syncCloudRecords",Number(h.records||0).toLocaleString('ar-EG'));set("syncCloudFamilies",familyMap().size.toLocaleString('ar-EG'));set("syncLatestSeq",Number(h.latestSeq||0).toLocaleString('ar-EG'));
      const changes=syncBuildChanges().length;set("syncPending",String(changes));set("syncLastText",`آخر فحص: ${new Date().toLocaleTimeString('ar-EG')}`);set("dashCloudStatus","متصل ✓");set("dashCloudMeta",`${Number(h.records||0).toLocaleString('ar-EG')} سجل على السحابة`);
      if(showToast)toast("السحابة متصلة والبيانات متاحة");return h;
    }catch(e){set("syncStatusValue","غير متصل");set("syncStatusSub","سيتم الاحتفاظ بالبيانات محلياً");set("syncCloudRecords","—");set("syncCloudFamilies",familyMap().size.toLocaleString('ar-EG'));set("syncLatestSeq","—");set("syncPending",String(syncBuildChanges().length));set("dashCloudStatus","غير متصل");set("dashCloudMeta","البيانات المحلية محفوظة");if(showToast)toast("تعذر الاتصال بالسحابة حالياً");return null;}
  };
  window.syncCenterNow=async function(){try{await fetchSyncRole(true);await syncOnlineReconcile("manual");await refreshSyncCenter(false);toast(syncRole.isPrimary?"تمت المزامنة وفحص السحابة":"تم تحديث الجهاز من السحابة — هذا الجهاز للعرض فقط");}catch(e){await refreshSyncCenter(false);toast(`تعذر إتمام المزامنة: ${e?.message||"خطأ غير معروف"}`);}};

  // Extend view behavior for sync center.
  const baseShowView=window.showView;
  window.showView=function(id){if(typeof baseShowView==="function")baseShowView(id);if(id==="syncCenter")setTimeout(()=>refreshSyncCenter(false),50);if(id==="classified")setTimeout(refreshReportTemplates,50);};

  // Styles and final init.
  const style=document.createElement("style");style.textContent=`
    .dashboard-live-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:14px 0}
    .live-card{display:flex;align-items:center;gap:11px;padding:14px;border:1px solid var(--border,#e5e7eb);border-radius:15px;background:var(--card,#fff);box-shadow:0 3px 12px rgba(0,0,0,.04)}
    .live-card>div:nth-child(2){flex:1;min-width:0}.live-card span{display:block;font-size:12px;color:var(--muted,#6b7280)}.live-card b{display:block;font-size:20px;margin:2px 0}.live-card small{display:block;color:var(--muted,#6b7280);font-size:11px}.live-icon{font-size:27px}.live-card .btn{white-space:nowrap}
    .app-read-only .btn.primary:not([onclick*="showView"]):not([onclick*="refresh"]),.app-read-only .btn.danger,.app-read-only form button[type="submit"]{opacity:.45;cursor:not-allowed}.sync-role-panel{border-color:#cbd5e1;background:linear-gradient(135deg,#f8fafc,#eef2ff)}.sync-panel{margin-top:14px;padding:15px;border:1px solid var(--border,#e5e7eb);border-radius:15px;background:var(--bg,#f8fafc);display:flex;justify-content:space-between;gap:15px;align-items:center}.sync-panel .actions{display:flex;flex-wrap:wrap;gap:8px}
    #p_age{background:#f3f4f6;font-weight:700}.modal .field small{margin-top:4px;display:block}
    @media(max-width:900px){.dashboard-live-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sync-cards{grid-template-columns:repeat(2,minmax(0,1fr))!important}.sync-panel{flex-direction:column;align-items:stretch}}
    @media(max-width:600px){.dashboard-live-grid{grid-template-columns:1fr}.live-card{padding:12px}.sync-cards{grid-template-columns:1fr!important}.sync-panel .actions{display:grid;grid-template-columns:1fr}.sync-panel .btn{width:100%}}
  `;document.head.appendChild(style);

  function init(){
    patchPersonForm();refreshReportTemplates();setTimeout(()=>{try{renderDashboard()}catch(e){}},80);setTimeout(()=>refreshSyncCenter(false),300);
    const birth=document.getElementById("p_birth");if(birth)birth.addEventListener("change",updatePersonAge);
  }
  init();
  try{distInit()}catch(e){}
})();


/* ===== Consolidated UI scripts ===== */


if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', {scope: './'}).catch(() => {});
  });
}


/* ===== Consolidated UI scripts ===== */


(function(){
  const buttons=[...document.querySelectorAll('[data-mobile-view]')];
  function syncActive(){
    const active=document.querySelector('.tab.active[data-view]');
    const id=active?active.getAttribute('data-view'):'';
    buttons.forEach(b=>b.classList.toggle('active',b.getAttribute('data-mobile-view')===id));
  }
  buttons.forEach(b=>b.addEventListener('click',()=>{
    const id=b.getAttribute('data-mobile-view');
    if(typeof window.showView==='function') window.showView(id);
    else { const t=document.querySelector('.tab[data-view="'+id+'"]'); if(t) t.click(); }
    setTimeout(syncActive,30);
  }));
  const original=window.showView;
  if(typeof original==='function'){
    window.showView=function(id){ original(id); setTimeout(syncActive,10); };
  }
  document.addEventListener('click',e=>{if(e.target.closest('.tab')) setTimeout(syncActive,20)});
  setTimeout(syncActive,100);
})();


/* ===== Consolidated UI scripts ===== */


(function(){
  const backdrop=document.getElementById('abConfirmBackdrop'), textEl=document.getElementById('abConfirmText'), titleEl=document.getElementById('abConfirmTitle'), iconEl=document.getElementById('abConfirmIcon'), ok=document.getElementById('abConfirmOk'), cancel=document.getElementById('abConfirmCancel');
  let resolver=null;
  window.confirmUI=function(message,opts={}){return new Promise(resolve=>{resolver=resolve;titleEl.textContent=opts.title||'تأكيد العملية';textEl.textContent=message||'هل تريد المتابعة؟';iconEl.textContent=opts.danger?'!':'?';iconEl.style.background=opts.danger?'#fff1f0':'#eef7f1';ok.textContent=opts.okText||'متابعة';cancel.textContent=opts.cancelText||'إلغاء';ok.className=opts.danger?'ab-danger':'ab-ok';backdrop.classList.add('show');backdrop.setAttribute('aria-hidden','false');setTimeout(()=>ok.focus(),30)})};
  function finish(v){if(!resolver)return;const r=resolver;resolver=null;backdrop.classList.remove('show');backdrop.setAttribute('aria-hidden','true');r(v)}
  ok.onclick=()=>finish(true);cancel.onclick=()=>finish(false);backdrop.addEventListener('click',e=>{if(e.target===backdrop)finish(false)});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&backdrop.classList.contains('show'))finish(false)});
  window.playSaveSound=function(){try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const a=window.__abAudio||(window.__abAudio=new AC());if(a.state==='suspended')a.resume();const t=a.currentTime;const o=a.createOscillator(),g=a.createGain();o.type='sine';o.frequency.setValueAtTime(880,t);o.frequency.exponentialRampToValueAtTime(1320,t+.09);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.055,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+.22);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+.23)}catch(e){}}
  window.playErrorSound=function(){try{const AC=window.AudioContext||window.webkitAudioContext;const a=window.__abAudio||(window.__abAudio=new AC());if(a.state==='suspended')a.resume();[420,300].forEach((f,i)=>{const t=a.currentTime+i*.1,o=a.createOscillator(),g=a.createGain();o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.035,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.09);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+.1)})}catch(e){}}
  const oldToast=window.toast;window.toast=function(msg){oldToast(msg);if(/^تم|^نجح|^اكتمل|^تمت|^✓/.test(String(msg||'')))setTimeout(()=>playSaveSound(),20)};
  const nativeAlert=window.alert;window.alert=function(msg){const s=String(msg||'');window.confirmUI(s,{title:'تنبيه',okText:'حسنًا'});};
})();


/* ===== Consolidated UI scripts ===== */


/* V35 — smart beneficiary lookup + general bulk distribution + XLSX export */
(function(){
  const norm=s=>String(s??'').replace(/\s+/g,' ').trim().toLowerCase();
  const escv=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let smartTimer=0;
  function currentMatches(q,type){
    const nq=norm(q); if(!nq)return [];
    const out=[];
    if(type==='عائلة'){
      const seen=new Set();
      for(const r of data){const name=String(r['اسم رب الأسرة']||'').trim(), id=String(r['رقم هوية الأسرة']||'').trim();if(!name||seen.has(id+'|'+name))continue;const hay=norm(name+' '+id);if(hay.includes(nq)){seen.add(id+'|'+name);out.push({kind:'family',name,id,phone:r['رقم الجوال']||'',address:r['العنوان']||''})}}
    }else{
      const seen=new Set();
      for(const r of data){const name=String(r['اسم الفرد']||'').trim(), id=String(r['رقم هوية الفرد']||'').trim(), fid=String(r['رقم هوية الأسرة']||'').trim();if(!name)continue;const key=id+'|'+fid+'|'+name;if(seen.has(key))continue;const hay=norm(name+' '+id+' '+(r['اسم رب الأسرة']||'')+' '+fid);if(hay.includes(nq)){seen.add(key);out.push({kind:'person',name,id,fid,fname:r['اسم رب الأسرة']||'',relation:r['صلة القرابة']||'',gender:r['الجنس']||'',age:r['العمر التقريبي']||'',phone:r['رقم الجوال']||''})}}
    }
    return out.slice(0,12);
  }
  function fillSmart(x){
    document.getElementById('distName').value=x.name||'';
    document.getElementById('distPersonId').value=x.kind==='person'?(x.id||''):'';
    document.getElementById('distFamilyId').value=x.kind==='family'?(x.id||''):(x.fid||'');
    document.getElementById('distFamilyName').value=x.kind==='family'?x.name:(x.fname||'');
    if(x.kind==='family')document.getElementById('distBeneficiaryForm').value='عائلة';
    else if(document.getElementById('distBeneficiaryForm').value==='عائلة')document.getElementById('distBeneficiaryForm').value='فرد';
    const box=document.getElementById('distSmartResults'); if(box){box.hidden=true;box.innerHTML=''}
  }
  function renderSmart(){
    const input=document.getElementById('distName'), box=document.getElementById('distSmartResults'), spin=document.getElementById('distSearchSpinner'); if(!input||!box)return;
    const q=input.value, type=document.getElementById('distBeneficiaryForm')?.value||'طفل'; clearTimeout(smartTimer);
    if(q.trim().length<2){box.hidden=true;box.innerHTML='';if(spin)spin.classList.remove('show');return}
    if(spin)spin.classList.add('show');
    const started=Date.now();smartTimer=setTimeout(()=>{const arr=currentMatches(q,type);const wait=Math.max(0,420-(Date.now()-started));setTimeout(()=>{if(spin)spin.classList.remove('show');box.innerHTML=arr.length?arr.map((x,i)=>`<button type="button" class="dist-smart-item" data-i="${i}"><span class="dist-smart-name">${escv(x.name)}</span><span class="dist-smart-meta">${x.kind==='family'?'عائلة • هوية الأسرة: '+escv(x.id||'غير متوفرة'):'فرد • رب الأسرة: '+escv(x.fname||'—')+' • هوية الفرد: '+escv(x.id||'غير متوفرة')}</span></button>`).join(''):'<div class="dist-smart-empty">لا توجد مطابقة — جرّب كتابة جزء آخر من الاسم</div>';box.hidden=false;box.querySelectorAll('.dist-smart-item').forEach((b,i)=>b.addEventListener('click',()=>fillSmart(arr[i])));},wait);},180);
  }
  window.openDistributionModal=function(id=''){
    const old=distributions.find(x=>x.id===id); const m=document.getElementById('distModal'); if(!m)return;
    document.getElementById('distId').value=old?.id||'';document.getElementById('distBeneficiaryForm').value=old?.beneficiaryType||'فرد';document.getElementById('distName').value=old?.beneficiaryName||'';document.getElementById('distPersonId').value=old?.personId||'';document.getElementById('distFamilyId').value=old?.familyId||'';document.getElementById('distFamilyName').value=old?.familyName||'';document.getElementById('distTypeForm').value=old?.type||'';document.getElementById('distQty').value=old?.quantity||1;document.getElementById('distUnit').value=old?.unit||'';document.getElementById('distDate').value=old?.date||distToday();document.getElementById('distRef').value=old?.reference||('DST-'+Date.now().toString().slice(-8));document.getElementById('distBy').value=old?.distributedBy||'';document.getElementById('distNotes').value=old?.notes||'';document.getElementById('distModalTitle').textContent=old?'تعديل التوزيع':'تسجيل توزيع';distFillNames();m.classList.add('show');m.setAttribute('aria-hidden','false');setTimeout(()=>document.getElementById('distName')?.focus(),80);
  };
  window.distBeneficiaryChanged=function(){const t=document.getElementById('distBeneficiaryForm')?.value||'فرد';document.getElementById('distName').value='';document.getElementById('distPersonId').value='';document.getElementById('distFamilyId').value='';document.getElementById('distFamilyName').value='';const box=document.getElementById('distSmartResults');if(box){box.hidden=true;box.innerHTML=''}};
  window.exportDistributionsExcel=function(){
    const q=norm(document.getElementById('distQ')?.value).toLowerCase();
    const bt=document.getElementById('distBeneficiary')?.value||'',ty=document.getElementById('distType')?.value||'';
    const from=document.getElementById('distFrom')?.value||'',to=document.getElementById('distTo')?.value||'';
    const filtered=distributions.filter(x=>{
      const blob=norm([x.beneficiaryName,x.familyName,x.type,x.reference,x.notes,x.personId,x.familyId].join(' ')).toLowerCase();
      return (!q||blob.includes(q))&&(!bt||x.beneficiaryType===bt)&&(!ty||x.type===ty)&&(!from||x.date>=from)&&(!to||x.date<=to);
    }).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    if(!filtered.length){toast('لا توجد توزيعات مطابقة للتصدير');return}
    try{
      const headers=['#','التاريخ','نوع المستفيد','اسم المستفيد','رقم هوية الفرد','رقم هوية الأسرة','رب الأسرة','نوع التوزيع','الكمية','الوحدة','رقم المرجع','تم بواسطة','ملاحظات'];
      const matrix=[
        ['سجل توزيعات مخيم أبو عريبان'],
        ['كشف التوزيعات والمساعدات المسجلة'],
        ['تاريخ التصدير: '+new Date().toLocaleString('ar-EG')],
        [],
        headers
      ];
      filtered.forEach((x,i)=>matrix.push([i+1,x.date||'',x.beneficiaryType||'',x.beneficiaryName||'',x.personId||'',x.familyId||'',x.familyName||'',x.type||'',x.quantity??'',x.unit||'',x.reference||'',x.distributedBy||'',x.notes||'']));
      downloadXLSX(matrix,'توزيعات_مخيم_أبو_عريبان_'+dateStamp()+'.xlsx',{headerRow:5,title:'سجل توزيعات مخيم أبو عريبان'});
      toast('تم تصدير التوزيعات بصيغة Excel احترافية');
    }catch(e){console.error('Distribution Excel export',e);toast('تعذر تصدير Excel: '+(e?.message||'خطأ غير معروف'));}
  };
  window.openDistBulkRegisterModal=function(){bulkRegSelected=new Set();document.getElementById('bulkRegDate').value=distToday();document.getElementById('bulkRegType').value='';document.getElementById('bulkRegQty').value=1;document.getElementById('bulkRegUnit').value='';document.getElementById('bulkRegBy').value='';document.getElementById('bulkRegSearch').value='';['bulkRegInside','bulkRegMinMembers','bulkRegMaxMembers','bulkRegMinAge','bulkRegMaxAge','bulkRegGender','bulkRegMarital','bulkRegSpecial'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});document.getElementById('bulkRegAll').checked=false;renderBulkRegisterPeople();const m=document.getElementById('distBulkRegisterModal');m.classList.add('show');m.setAttribute('aria-hidden','false')};
  window.closeDistBulkRegisterModal=function(){const m=document.getElementById('distBulkRegisterModal');m?.classList.remove('show');m?.setAttribute('aria-hidden','true')};
  function bulkUniverse(scope,q){
    const nq=distSearchNorm(q||'');
    const inside=document.getElementById('bulkRegInside')?.value||'';
    const minM=Number(document.getElementById('bulkRegMinMembers')?.value||0), maxM=Number(document.getElementById('bulkRegMaxMembers')?.value||0);
    const minA=document.getElementById('bulkRegMinAge')?.value===''?null:Number(document.getElementById('bulkRegMinAge')?.value);
    const maxA=document.getElementById('bulkRegMaxAge')?.value===''?null:Number(document.getElementById('bulkRegMaxAge')?.value);
    const gender=document.getElementById('bulkRegGender')?.value||'', marital=document.getElementById('bulkRegMarital')?.value||'', special=document.getElementById('bulkRegSpecial')?.value||'';
    const groups=new Map();
    for(const r of data){const fid=String(r['رقم هوية الأسرة']||'').trim(),head=String(r['اسم رب الأسرة']||'').trim(),key=fid||head;if(!key)continue;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)}
    const qualifiesFamily=(arr)=>{const h=arr.find(r=>String(r['صلة القرابة']||'').trim()==='رب الأسرة')||arr[0];if(inside&&String(h['داخل/خارج المخيم']||'')!==inside)return false;const n=arr.length;if(minM&&n<minM)return false;if(maxM&&n>maxM)return false;const a=ageOf(h);if(minA!==null&&(a===null||a<minA))return false;if(maxA!==null&&(a===null||a>maxA))return false;if(gender&&normalizeGender(h['الجنس'])!==normalizeGender(gender))return false;if(marital&&norm(h['الحالة الاجتماعية'])!==norm(marital))return false;if(special&&!hasSpecial(h,special))return false;return true};
    if(scope==='families'){const a=[];for(const [key,arr] of groups){if(!qualifiesFamily(arr))continue;const h=arr.find(r=>String(r['صلة القرابة']||'').trim()==='رب الأسرة')||arr[0],n=String(h['اسم رب الأسرة']||'').trim(),id=String(h['رقم هوية الأسرة']||'').trim();if(!n||nq&&!distSearchNorm(n+' '+id).includes(nq))continue;a.push({key:'f|'+key,name:n,family:n,id,memberCount:arr.length})}return a}
    const seen=new Set(),a=[];for(const r of data){const n=String(r['اسم الفرد']||'').trim(),id=String(r['رقم هوية الفرد']||'').trim(),family=String(r['اسم رب الأسرة']||'').trim(),fid=String(r['رقم هوية الأسرة']||'').trim(),k=id+'|'+fid+'|'+n;if(!n||seen.has(k))continue;const arr=groups.get(fid||family)||[];if(!qualifiesFamily(arr))continue;const age=ageOf(r);if(scope==='children'&&(!Number.isFinite(age)||age>=18))continue;if(minA!==null&&(age===null||age<minA)||maxA!==null&&(age===null||age>maxA))continue;if(gender&&normalizeGender(r['الجنس'])!==normalizeGender(gender))continue;if(marital&&norm(r['الحالة الاجتماعية'])!==norm(marital))continue;if(special&&!hasSpecial(r,special))continue;if(nq&&!distSearchNorm(n+' '+id+' '+family+' '+fid).includes(nq))continue;seen.add(k);a.push({key:k,name:n,family,id,fid,memberCount:arr.length})}return a;
  }
  function bulkRegUpdateCount(){const el=document.getElementById('bulkRegCount');if(el)el.textContent=bulkRegSelected.size+' محدد';}
  window.renderBulkRegisterPeople=function(){const scope=document.getElementById('bulkRegScope').value,q=document.getElementById('bulkRegSearch').value,arr=bulkUniverse(scope,q),tb=document.getElementById('bulkRegTbody');tb.innerHTML=arr.map((x,i)=>`<tr><td><input type="checkbox" class="bulk-reg-check" data-key="${escv(x.key)}" ${bulkRegSelected.has(x.key)?'checked':''}></td><td>${i+1}</td><td><b>${escv(x.name)}</b></td><td>${escv(x.family||'—')}</td><td>${escv(x.id||'—')}</td></tr>`).join('')||'<tr><td colspan="5"><div class="dist-empty">لا توجد نتائج</div></td></tr>';tb.querySelectorAll('.bulk-reg-check').forEach(c=>c.addEventListener('change',()=>{if(c.checked)bulkRegSelected.add(c.dataset.key);else bulkRegSelected.delete(c.dataset.key);bulkRegUpdateCount();}));document.getElementById('bulkRegAll').checked=arr.length>0&&arr.every(x=>bulkRegSelected.has(x.key));bulkRegUpdateCount()};
  window.toggleAllBulkRegister=function(v){const scope=document.getElementById('bulkRegScope').value,q=document.getElementById('bulkRegSearch').value,arr=bulkUniverse(scope,q);arr.forEach(x=>v?bulkRegSelected.add(x.key):bulkRegSelected.delete(x.key));renderBulkRegisterPeople()};
  window.saveBulkRegisterDistribution=function(){
    const scope=document.getElementById('bulkRegScope').value,type=distNorm(document.getElementById('bulkRegType').value),qty=Number(document.getElementById('bulkRegQty').value||1),unit=distNorm(document.getElementById('bulkRegUnit').value),date=document.getElementById('bulkRegDate').value||distToday(),by=document.getElementById('bulkRegBy').value;if(!type){toast('اكتب نوع التوزيع أولاً');return}if(!bulkRegSelected.size){toast('حدد مستفيداً واحداً على الأقل');return}if(!by){toast('اختر تم بواسطة');return}
    const all=bulkUniverse(scope,''),map=new Map(all.map(x=>[x.key,x]));let n=0;for(const key of bulkRegSelected){const x=map.get(key);if(!x)continue;const bt=scope==='families'?'عائلة':scope==='children'?'طفل':'فرد';const duplicate=distributions.some(d=>d.beneficiaryType===bt&&norm(d.beneficiaryName)===norm(x.name)&&norm(d.type)===norm(type)&&String(d.familyId||'')===String(scope==='families'?x.id:x.fid||''));if(duplicate)continue;distributions.push({id:distId(),beneficiaryType:bt,beneficiaryName:x.name,personId:scope==='families'?'':x.id,familyId:scope==='families'?x.id:x.fid,familyName:x.family,type,quantity:qty,unit,date,reference:'DST-'+Date.now().toString().slice(-8)+'-'+(n+1),distributedBy:by,notes:'تسجيل توزيع جماعي',updatedAt:Date.now()});n++}
    distSave();closeDistBulkRegisterModal();renderDistributions();toast(n?'تم تسجيل '+n+' توزيع':'لم تتم إضافة توزيعات جديدة — توجد سجلات مكررة');distSyncSoon();
  };
  function distSearchNorm(v){return String(v??'').toLowerCase().replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[ًٌٍَُِّْـ]/g,'').replace(/\s+/g,' ').trim()}
  function renderBeneficiarySearch(){
    const panel=document.getElementById('distBeneficiarySearchPanel'); if(!panel)return;
    const q=distSearchNorm(document.getElementById('distQ')?.value), selectedType=document.getElementById('distType')?.value||'', beneficiaryFilter=document.getElementById('distBeneficiary')?.value||'';
    if(q.length<2){panel.hidden=true;panel.innerHTML='';return}
    const candidates=new Map();
    for(const r of data){
      const name=String(r['اسم الفرد']||'').trim(), head=String(r['اسم رب الأسرة']||'').trim(), pid=String(r['رقم هوية الفرد']||'').trim(), fid=String(r['رقم هوية الأسرة']||'').trim();
      if(beneficiaryFilter==='عائلة'){
        if(!head)continue;
        const hay=distSearchNorm(head+' '+fid); if(!hay.includes(q))continue;
        const key='f|'+fid+'|'+head;
        if(!candidates.has(key))candidates.set(key,{kind:'عائلة',name:head,head,pid:'',fid});
      }else{
        const hay=distSearchNorm(name+' '+head+' '+pid+' '+fid); if(!hay.includes(q))continue;
        const key=pid?('p|'+pid):('f|'+fid+'|'+head);
        if(!candidates.has(key))candidates.set(key,{kind:pid?'فرد':'عائلة',name:pid?name:head,head,pid,fid});
      }
    }
    const types=[...new Set(distributions.map(x=>x.type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
    const arr=[...candidates.values()].slice(0,20).map(c=>{
      const got=distributions.filter(d=>{
        if(c.pid) return distSearchNorm(d.personId)===distSearchNorm(c.pid) || (!d.personId&&distSearchNorm(d.beneficiaryName)===distSearchNorm(c.name));
        return distSearchNorm(d.familyId)===distSearchNorm(c.fid) || (!d.familyId&&distSearchNorm(d.familyName)===distSearchNorm(c.name));
      });
      const gotTypes=new Set(got.map(x=>x.type).filter(Boolean));
      const shownTypes=selectedType?[selectedType]:types.slice(0,8);
      return {...c,got,gotTypes,shownTypes};
    });
    panel.innerHTML=arr.length?`<div class="dist-beneficiary-head"><div><b>نتائج دقيقة للبحث: ${escv(document.getElementById('distQ')?.value||'')}</b><span>الحالة توضح فوراً شو استلم المستفيد وشو لسه ما استلم.</span></div><span class="badge">${arr.length} نتيجة</span></div><div class="dist-beneficiary-grid">${arr.map(c=>`<div class="dist-beneficiary-card"><div class="dist-beneficiary-title"><div><b>${escv(c.name)}</b><small>${escv(c.kind)} • رب الأسرة: ${escv(c.head||c.name)}${c.pid?' • هوية: '+escv(c.pid):''}</small></div><span class="dist-main-status ${c.got.length?'received':'missing'}">${c.got.length?'استفاد':'لم يستفد'}</span></div><div class="dist-help-chips">${c.shownTypes.length?c.shownTypes.map(t=>`<span class="dist-help-chip ${c.gotTypes.has(t)?'yes':'no'}"><i></i>${escv(t)} — ${c.gotTypes.has(t)?'استلم':'لم يستلم'}</span>`).join(''):'<span class="dist-beneficiary-empty">لا توجد أنواع مساعدات مسجلة بعد</span>'}</div>${c.got.length?`<div class="dist-beneficiary-history">${c.got.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,4).map(d=>`<span>${escv(d.date)} • ${escv(d.type)} • ${escv(d.quantity)} ${escv(d.unit||'')}</span>`).join('')}</div>`:''}</div>`).join('')}</div>`:'<div class="dist-beneficiary-empty">لا توجد مطابقة دقيقة لهذا البحث.</div>';
    panel.hidden=false;
  }
  const originalRenderDistributions=window.renderDistributions;
  window.renderDistributions=function(){originalRenderDistributions();renderBeneficiarySearch();};
  const originalDistTypeChanged=window.renderDistributions;
  document.addEventListener('DOMContentLoaded',()=>{const input=document.getElementById('distName');if(input){input.addEventListener('input',renderSmart);input.addEventListener('focus',renderSmart)}document.addEventListener('click',e=>{const b=document.getElementById('distSmartResults');if(b&&!b.contains(e.target)&&e.target!==input)b.hidden=true})});
  window.addEventListener('load',()=>{const input=document.getElementById('distName');if(input){input.addEventListener('input',renderSmart);input.addEventListener('focus',renderSmart)}});

  function applyTheme(theme){
    theme=theme==='dark'?'dark':'light';
    document.documentElement.setAttribute('data-theme',theme);
    document.body.classList.toggle('theme-dark',theme==='dark');
    try{localStorage.setItem('abu_oreiban_theme',theme)}catch(e){}
    const icon=document.getElementById('themeToggleIcon');
    const text=document.getElementById('themeToggleText');
    if(icon)icon.textContent=theme==='dark'?'☀':'☾';
    if(text)text.textContent=theme==='dark'?'الوضع الفاتح':'الوضع الداكن';
  }
  function toggleTheme(){
    const current=document.documentElement.getAttribute('data-theme')||'light';
    applyTheme(current==='dark'?'light':'dark');
  }
  window.applyTheme=applyTheme; window.toggleTheme=toggleTheme;
  (function(){let saved='light';try{saved=localStorage.getItem('abu_oreiban_theme')||'light'}catch(e){} applyTheme(saved);
    window.addEventListener('DOMContentLoaded',()=>applyTheme(document.documentElement.getAttribute('data-theme')||saved));
  })();

  function updateDailyHeader(){
    const now=new Date();
    const hour=now.getHours();
    const greeting=document.getElementById('dailyGreeting');
    const dateEl=document.getElementById('dailyDate');
    const clockEl=document.getElementById('dailyClock');
    const online=document.getElementById('dailyOnline');
    const onlineText=document.getElementById('dailyOnlineText');
    if(greeting)greeting.textContent=(hour>=5&&hour<12)?'صباح الخير':'مساء الخير';
    if(dateEl)dateEl.textContent=new Intl.DateTimeFormat('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'}).format(now);
    if(clockEl)clockEl.textContent=new Intl.DateTimeFormat('ar-EG',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true}).format(now);
    const isOnline=navigator.onLine;
    if(online){online.dataset.state=isOnline?'online':'offline';}
    if(onlineText)onlineText.textContent=isOnline?'متصل بالإنترنت':'غير متصل بالإنترنت';
  }

  // Secondary devices are strictly read-only. The Worker enforces this server-side too.
  const __guardNames=["saveFamily","savePerson","deleteFamily","deletePerson","saveDistribution","deleteDistribution","saveBulkDistribution","restoreBackup","saveNow"];
  __guardNames.forEach(name=>{
    const original=window[name]||globalThis[name];
    if(typeof original!=="function")return;
    const guarded=function(...args){if(!requirePrimaryForEdit())return;return original.apply(this,args)};
    window[name]=guarded;
    try{globalThis[name]=guarded}catch(e){}
  });
  document.addEventListener("click",e=>{
    if(!appReadOnly)return;
    const el=e.target?.closest?.("button,[onclick],label");if(!el)return;
    const code=el.getAttribute("onclick")||"";
    const mut=/saveFamily|savePerson|deleteFamily|deletePerson|saveDistribution|deleteDistribution|saveBulkDistribution|restoreBackup|saveNow|openFamilyModal|openPersonModal|editFamily|editPerson|addMemberToFamily|openDistributionModal|openDistBulkRegisterModal/.test(code);
    if(mut){e.preventDefault();e.stopImmediatePropagation();requirePrimaryForEdit();}
  },true);

  updateDailyHeader();
  setInterval(updateDailyHeader,1000);
  window.addEventListener('online',updateDailyHeader);
  window.addEventListener('offline',updateDailyHeader);
})();

/* V53.3.1.1_LOGIN_UX_START */
let protectedAppStarted=false;
function startProtectedApp(){
  if(protectedAppStarted)return;
  protectedAppStarted=true;
  load();
  runSmartDedup("startup");
  initReportColumns();
  renderPersonPicker();
  initV5();
  installCloudSync();
}
function loginUiError(message){
  const er=document.getElementById("displayLoginError"); if(!er)return;
  er.textContent=message||""; er.classList.toggle("show",!!message);
}
function loginUiLoading(on){
  const b=document.getElementById("displayLoginSubmit"),t=b?.querySelector(".display-login-submit-text"); if(!b)return;
  b.disabled=!!on; b.classList.toggle("loading",!!on); if(t)t.textContent=on?"جارٍ التحقق...":"تسجيل الدخول";
}
function updateDisplayLoginConnection(){
  const box=document.getElementById("displayLoginStatus"); if(!box)return;
  const online=navigator.onLine; box.classList.toggle("online",online); box.classList.toggle("offline",!online);
  const t=box.querySelector(".display-login-status-text"); if(t)t.textContent=online?"متصل بالإنترنت":"غير متصل بالإنترنت";
}
function translateLoginError(e){
  const raw=String(e?.message||"").toLowerCase();
  if(!navigator.onLine||raw.includes("failed to fetch")||raw.includes("network"))return "لا يوجد اتصال بالإنترنت.";
  if(raw.includes("disabled")||raw.includes("موقوف")||raw.includes("غير مفعل"))return "هذا الحساب غير مفعل، يرجى التواصل مع إدارة النظام.";
  if(raw.includes("too many")||raw.includes("محاولات"))return "تم إيقاف محاولات الدخول مؤقتًا. حاول مرة أخرى لاحقًا.";
  if(e?.status===401||raw.includes("401")||raw.includes("invalid")||raw.includes("incorrect"))return "اسم المستخدم أو كلمة المرور غير صحيحة";
  return "تعذر تسجيل الدخول الآن. حاول مرة أخرى.";
}
function setLoginPasswordVisibility(){
  const input=document.getElementById("displayLoginPassword"),btn=document.getElementById("displayLoginPasswordToggle"); if(!input||!btn)return;
  const show=input.type==="password"; input.type=show?"text":"password";
  btn.setAttribute("aria-label",show?"إخفاء كلمة المرور":"إظهار كلمة المرور"); btn.setAttribute("aria-pressed",String(show));
}
window.addEventListener("online",updateDisplayLoginConnection);
window.addEventListener("offline",updateDisplayLoginConnection);
document.addEventListener("DOMContentLoaded",()=>{
  updateDisplayLoginConnection();
  document.getElementById("displayLoginPasswordToggle")?.addEventListener("click",setLoginPasswordVisibility);
});
/* V53.3.1.1_LOGIN_UX_END */
