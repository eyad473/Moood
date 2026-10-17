
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
  ensureFamilyHeadRecords(true);
  syncAutomaticOrphans(true);
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
  else if(id==="sectors")requestAnimationFrame(renderCampSectors);
  else if(id==="campMap")requestAnimationFrame(renderOfflineCampMap);
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

/* إصلاح تلقائي لملف رب الأسرة: إذا كانت الأسرة موجودة ببياناتها لكن سجل رب الأسرة الفردي مفقود،
   ننشئ له سجلاً من البيانات المعروفة فقط، ونُبقي الحقول الشخصية غير المعروفة فارغة بدل اختراع بيانات. */
function smartStatusNorm(value){return String(value??"").trim().toLowerCase().replace(/[أإآٱ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").replace(/[ًٌٍَُِّْـ]/g,"").replace(/\s+/g," ");}
function isWidowStatus(value){const x=smartStatusNorm(value);return x.includes("ارمل")||x.includes("ارمله");}
function isDivorceStatus(value){const x=smartStatusNorm(value);return x.includes("مطلق")||x.includes("مطلقه");}
function isChildRelation(value){const x=smartStatusNorm(value);return x.includes("ابن")||x.includes("ابنه")||x.includes("بنت")||x.includes("ولد");}
function getFamilyHeadRecord(r){const rows=familyMap().get(r?.["اسم رب الأسرة"]||"")||[];return rows.find(x=>norm(x["صلة القرابة"])==="رب الاسرة")||rows[0]||r||{};}
function syncAutomaticOrphans(persist=true){let changed=0;familyMap().forEach(rows=>{const head=rows.find(x=>norm(x["صلة القرابة"])==="رب الاسرة")||rows[0];const widow=isWidowStatus(head?.["الحالة الاجتماعية"]);rows.forEach(r=>{if(!isChildRelation(r["صلة القرابة"]))return;if(widow){if(r["يتيم/منفصل عن ذويه?"]!=="نعم")r["يتيم/منفصل عن ذويه?"]="نعم";if(r["يتيم/منفصل عن ذويه؟"]!=="نعم")r["يتيم/منفصل عن ذويه؟"]="نعم";if(r.__autoOrphanByWidow!==true){r.__autoOrphanByWidow=true;changed++;}}else if(r.__autoOrphanByWidow===true){delete r.__autoOrphanByWidow;if(r["يتيم/منفصل عن ذويه?"]==="نعم")delete r["يتيم/منفصل عن ذويه?"];if(r["يتيم/منفصل عن ذويه؟"]==="نعم")delete r["يتيم/منفصل عن ذويه؟"];changed++;}})});if(changed&&persist)autoSave();return changed;}

function ensureFamilyHeadRecords(persist=true){
 const fm=familyMap();
 let added=0,updated=0;
 const familyKeys=["رقم هوية الأسرة","رقم الجوال","رقم جوال بديل","العنوان","داخل/خارج المخيم","حالة اكتمال بيانات الأسرة","المحافظة الأصلية","حالة المسكن الأصلي","نوع السكن الحالي","ملاحظات الأسرة"];
 fm.forEach((rows,head)=>{
   if(!filled(head) || head==="غير محدد") return;
   const headRow=rows.find(r=>norm(r["صلة القرابة"])==="رب الأسرة");
   const base=rows.find(r=>filled(r["اسم رب الأسرة"])) || rows[0];
   if(!base) return;
   if(headRow){
     let changed=false;
     familyKeys.forEach(k=>{
       if(!filled(headRow[k]) && filled(base[k])){ headRow[k]=base[k]; changed=true; }
     });
     if(!filled(headRow["اسم الفرد"])) { headRow["اسم الفرد"]=head; changed=true; }
     if(!filled(headRow["رقم هوية الفرد"]) && filled(base["رقم هوية الأسرة"])) { headRow["رقم هوية الفرد"]=base["رقم هوية الأسرة"]; changed=true; }
     if(changed) updated++;
     return;
   }
   const rec=emptyRecord();
   familyKeys.forEach(k=>{ if(filled(base[k])) rec[k]=base[k]; });
   rec["#"]=String(data.length+1);
   rec["اسم رب الأسرة"]=head;
   rec["اسم الفرد"]=head;
   rec["صلة القرابة"]="رب الأسرة";
   // في بنية التطبيق الحالية رقم هوية الأسرة هو هوية رب الأسرة عند إنشاء سجل الأسرة.
   if(!filled(rec["رقم هوية الفرد"]) && filled(rec["رقم هوية الأسرة"])) rec["رقم هوية الفرد"]=rec["رقم هوية الأسرة"];
   data.push(rec);
   added++;
 });
 if((added||updated) && persist){
   renumber();
   autoSave();
 }
 return {added,updated};
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
  const n=familyDisplayCount(rows);
  if(fs==="1"&&n!==1)return false;if(fs==="2-4"&&(n<2||n>4))return false;if(fs==="5-7"&&(n<5||n>7))return false;if(fs==="8"&&n<8)return false;
  return true;
 });
 document.getElementById("familyList").innerHTML=arr.map(([h,rows])=>{
  const r=rows[0]||{}, key=encodeURIComponent(h);
  return `<div class="familybox"><div class="familyrow"><div><div class="familytitle">${esc(h)}</div><div class="muted">هوية الأسرة: ${esc(r["رقم هوية الأسرة"]||"—")} · الجوال: ${esc(r["رقم الجوال"]||"—")} · عدد الأفراد: <b>${familyDisplayCount(rows)}</b></div></div><div class="actions no-print"><button class="btn" onclick="editFamily(decodeURIComponent('${key}'))">تعديل الأسرة</button><button class="btn primary" onclick="addMemberToFamily(decodeURIComponent('${key}'))">＋ فرد</button><button class="btn danger" onclick="deleteFamily(decodeURIComponent('${key}'))">حذف العائلة</button></div></div><div class="memberlist">${rows.map(x=>`<div class="member"><span>${esc(x["اسم الفرد"]||"")} — ${esc(x["صلة القرابة"]||"")} — ${esc(x["رقم هوية الفرد"]||"")}</span><span class="no-print"><button class="pagebtn" onclick="editPerson(${data.indexOf(x)})">تعديل</button></span></div>`).join("")}</div></div>`
 }).join("") || `<div class="empty">لا توجد عائلات مطابقة</div>`;
}
function openFamilyModal(name=null){
 document.getElementById("familyForm").reset();document.getElementById("f_original").value=name||"";
 document.getElementById("familyModalTitle").textContent=name?"تعديل عائلة":"إضافة عائلة";
 if(name){
  const r=familyMap().get(name)?.[0];if(r){
   setv("f_head",r["اسم رب الأسرة"]);setv("f_id",r["رقم هوية الأسرة"]);setv("f_phone",r["رقم الجوال"]);setv("f_alt",r["رقم جوال بديل"]);setv("f_inside",r["داخل/خارج المخيم"]);setv("f_complete",r["حالة اكتمال بيانات الأسرة"]);setv("f_gov",canonicalGovernorate(r["المحافظة الأصلية"]));setv("f_home",r["حالة المسكن الأصلي"]);setv("f_current",r["نوع السكن الحالي"]);setv("f_address",r["العنوان"]);setv("f_notes",r["ملاحظات الأسرة"]);
  }
 }
 document.getElementById("familyModal").classList.add("show");
}
function saveFamily(e){
 e.preventDefault();const old=document.getElementById("f_original").value, h=document.getElementById("f_head").value.trim();
 if(!h)return;
 const vals={"اسم رب الأسرة":h,"رقم هوية الأسرة":v("f_id"),"رقم الجوال":v("f_phone"),"رقم جوال بديل":v("f_alt"),"داخل/خارج المخيم":v("f_inside"),"حالة اكتمال بيانات الأسرة":v("f_complete"),"المحافظة الأصلية":canonicalGovernorate(v("f_gov")),"حالة المسكن الأصلي":v("f_home"),"نوع السكن الحالي":v("f_current"),"العنوان":v("f_address"),"ملاحظات الأسرة":v("f_notes")};
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
 const r=data[idx];
 const head=norm(r?.["صلة القرابة"]) === "رب الأسرة";
 const familyRows=familyMap().get(norm(r?.["اسم رب الأسرة"]))||[];
 if(head && familyRows.length>1){
   const ok=await confirmUI(`هذا هو سجل رب الأسرة، وحذفُه سيترك الأسرة بدون ملف فردي لرب الأسرة.\n\nسيبقى ملف الأسرة وبيانات بقية الأفراد محفوظاً، وسيظهر تنبيه جودة حتى يتم إصلاح السجل.\n\nهل تريد المتابعة؟`,{title:"حذف سجل رب الأسرة",okText:"حذف مع التنبيه",danger:true});
   if(!ok)return;
 }else if(head && familyRows.length<=1){
   const ok=await confirmUI(`هذا هو السجل الوحيد للعائلة. حذفُه سيزيل آخر سجل مرتبط بهذه العائلة من قاعدة البيانات.\n\nهل تريد المتابعة؟`,{title:"حذف سجل العائلة",okText:"حذف",danger:true});
   if(!ok)return;
 }else{
   const ok=await confirmUI(`هل تريد حذف الفرد «${r?.["اسم الفرد"]||""}»؟\n\nسيتم حفظ العملية محليًا ثم مزامنتها مع السحابة.`,{title:"حذف الفرد",okText:"حذف الفرد",danger:true});
   if(!ok)return;
 }
 data.splice(idx,1);renumber();autoSave();rebuildFilters();renderAll();toast("تم حذف الفرد");
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
function bindChartHints(root){if(!root)return;let tip=root.querySelector(".chart-tooltip");if(!tip){tip=document.createElement("div");tip.className="chart-tooltip";tip.setAttribute("aria-live","polite");root.appendChild(tip)}if(root.dataset.chartHintsBound)return;root.dataset.chartHintsBound="1";const show=target=>{if(!target)return;const label=target.getAttribute("aria-label")||target.getAttribute("title");if(!label)return;tip.textContent=label;tip.classList.add("is-visible")};root.addEventListener("pointerover",e=>{const target=e.target.closest?.(".chart-segment,.chart-bar");if(target)show(target)});root.addEventListener("focusin",e=>show(e.target.closest?.(".chart-segment,.chart-bar")));root.addEventListener("click",e=>{const target=e.target.closest?.(".chart-segment,.chart-bar");if(target){show(target);e.stopPropagation()}else tip.classList.remove("is-visible")});root.addEventListener("pointerleave",e=>{if(e.pointerType==="mouse")tip.classList.remove("is-visible")});} 
function bindDashboardChartTouch(){document.querySelectorAll(".housing-chart-item,.health-item").forEach(item=>{if(item.dataset.chartTouchBound)return;item.dataset.chartTouchBound="1";const activate=()=>{const group=item.parentElement;group?.querySelectorAll(":scope > .housing-chart-item.is-chart-active,:scope > .health-item.is-chart-active").forEach(x=>{if(x!==item)x.classList.remove("is-chart-active")});item.classList.toggle("is-chart-active");const label=item.getAttribute("title")||item.querySelector(".housing-chart-label,.health-top")?.textContent?.trim();if(label){let tip=item.querySelector(".chart-touch-detail");if(!tip){tip=document.createElement("div");tip.className="chart-touch-detail";tip.setAttribute("aria-live","polite");item.appendChild(tip)}tip.textContent=label;tip.hidden=!item.classList.contains("is-chart-active")}};item.addEventListener("click",activate);item.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();activate()}})})}
function showBuildVersionNotice(){const version="V70.4";try{const key="abuOreibanLastShownBuild",previous=localStorage.getItem(key);if(previous!==version){localStorage.setItem(key,version);setTimeout(()=>toast("تم التحديث — إصدار "+version),700)}}catch(e){setTimeout(()=>toast("تم التحديث — إصدار "+version),700)}}
document.addEventListener("DOMContentLoaded",()=>{bindDashboardChartTouch();showBuildVersionNotice();});
function renderGenderChart(arr){const el=document.getElementById("genderChart");if(!el)return;const total=Math.max(arr.reduce((a,x)=>a+x[1],0),1),a=arr[0][1],b=arr[1][1],p=a/total,deg=p*360;el.innerHTML=`<svg viewBox="0 0 520 225" role="img" aria-label="توزيع حسب الجنس"><defs><linearGradient id="gMale" x1="0" x2="1"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#60a5fa"/></linearGradient><linearGradient id="gFemale" x1="0" x2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#c084fc"/></linearGradient></defs><g transform="translate(110 112)"><circle r="72" fill="none" stroke="#eef2f7" stroke-width="26"/><path class="chart-segment" tabindex="0" role="img" aria-label="ذكر: ${a} فرد، ${Math.round(p*100)} بالمئة" title="ذكر: ${a.toLocaleString('ar-EG')} فرد (${Math.round(p*100)}%)" d="${donutArc(72,26,0,deg)}" fill="url(#gMale)"/><path class="chart-segment" tabindex="0" role="img" aria-label="أنثى: ${b} فرد، ${Math.round((1-p)*100)} بالمئة" title="أنثى: ${b.toLocaleString('ar-EG')} فرد (${Math.round((1-p)*100)}%)" d="${donutArc(72,26,deg,360)}" fill="url(#gFemale)"/></g><text x="110" y="105" text-anchor="middle" class="chart-label" font-size="24" font-weight="800" fill="#172033">${total.toLocaleString('ar-EG')}</text><text x="110" y="124" text-anchor="middle" class="chart-label" font-size="10" fill="#64748b">إجمالي الأفراد</text><g transform="translate(250 62)"><circle cx="0" cy="0" r="6" fill="#2563eb"/><text x="14" y="4" class="chart-label" font-size="12" fill="#334155">ذكر</text><text x="135" y="4" class="chart-label" font-size="13" font-weight="800" fill="#172033">${a.toLocaleString('ar-EG')}</text><circle cx="0" cy="48" r="6" fill="#7c3aed"/><text x="14" y="52" class="chart-label" font-size="12" fill="#334155">أنثى</text><text x="135" y="52" class="chart-label" font-size="13" font-weight="800" fill="#172033">${b.toLocaleString('ar-EG')}</text><text x="0" y="92" class="chart-label" font-size="10" fill="#64748b">نسبة الذكور ${Math.round(p*100)}% · الإناث ${Math.round((1-p)*100)}%</text></g></svg>`;bindChartHints(el)}
function donutArc(r,w,start,end){const c=(r*2);const rad=Math.PI/180;const x1=r*Math.cos((start-90)*rad),y1=r*Math.sin((start-90)*rad),x2=r*Math.cos((end-90)*rad),y2=r*Math.sin((end-90)*rad);const large=end-start>180?1:0;return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${x2*(1-w/r)} ${y2*(1-w/r)} A ${r-w} ${r-w} 0 ${large} 0 ${x1*(1-w/r)} ${y1*(1-w/r)} Z`}
function renderAgeChart(){const groups=[["0–5",0],["6–17",0],["18–35",0],["36–59",0],["60+",0]];data.forEach(r=>{const a=Number(ageOf(r));if(!Number.isFinite(a)||a<0)return;if(a<=5)groups[0][1]++;else if(a<=17)groups[1][1]++;else if(a<=35)groups[2][1]++;else if(a<=59)groups[3][1]++;else groups[4][1]++;});const el=document.getElementById("ageChart");if(!el)return;const max=Math.max(...groups.map(x=>x[1]),1);const bw=76,gap=18,base=190;let bars=groups.map((g,i)=>{const h=Math.max(4,g[1]/max*135),x=24+i*(bw+gap),y=base-h;return `<rect class="chart-bar" tabindex="0" role="img" aria-label="الفئة العمرية ${g[0]}: ${g[1]} فرد" title="الفئة ${g[0]}: ${g[1].toLocaleString('ar-EG')} فرد" style="animation-delay:${i*75}ms" x="${x}" y="${y}" width="${bw}" height="${h}" rx="10" fill="url(#ageGrad)"/><text class="chart-label chart-bar-label" x="${x+bw/2}" y="${y-7}" text-anchor="middle" font-size="11" font-weight="800" fill="#172033">${g[1].toLocaleString('ar-EG')}</text><text x="${x+bw/2}" y="${base+20}" text-anchor="middle" class="chart-label" font-size="10" fill="#64748b">${g[0]}</text>`}).join("");el.innerHTML=`<svg viewBox="0 0 500 225" role="img" aria-label="توزيع الأفراد حسب الفئات العمرية"><defs><linearGradient id="ageGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06b6d4"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs><text x="20" y="22" class="chart-label" font-size="12" font-weight="800" fill="#334155">الفئات العمرية</text><line x1="20" y1="190" x2="480" y2="190" stroke="#e5e7eb"/>${bars}</svg>`;bindChartHints(el)}
function renderHealthBars(arr){const el=document.getElementById("healthChart");if(!el)return;const max=Math.max(...arr.map(x=>x[1]),1);el.innerHTML=arr.map(([k,n],i)=>`<div class="health-item" tabindex="0" style="--chart-i:${i}" title="${svgEsc(k)}: ${n.toLocaleString('ar-EG')} حالة"><div class="health-top"><span>${svgEsc(k)}</span><b>${n.toLocaleString('ar-EG')}</b></div><div class="health-track" role="img" aria-label="${svgEsc(k)}: ${n} حالة"><div class="health-fill" style="width:${Math.max(n/max*100,n?4:0)}%"></div></div></div>`).join("")}
function renderFamilyStatusChart(counts,total){const el=document.getElementById("familyStatusChart");if(!el)return;const a=counts["مكتملة"]||0,b=counts["جزئية"]||0,c=counts["غير مكتملة"]||0,t=Math.max(total,1),p1=a/t*100,p2=b/t*100;el.innerHTML=`<div class="donut" style="background:conic-gradient(#16a34a 0 ${p1}%,#f59e0b ${p1}% ${p1+p2}%,#ef4444 ${p1+p2}% 100%)"><div class="donut-center"><b>${total.toLocaleString('ar-EG')}</b><span>إجمالي العائلات</span></div></div><div class="legend"><div class="legend-row"><span class="legend-name"><i class="legend-dot" style="background:#16a34a"></i>مكتملة</span><b>${a.toLocaleString('ar-EG')}</b></div><div class="legend-row"><span class="legend-name"><i class="legend-dot" style="background:#f59e0b"></i>جزئية</span><b>${b.toLocaleString('ar-EG')}</b></div><div class="legend-row"><span class="legend-name"><i class="legend-dot" style="background:#ef4444"></i>غير مكتملة</span><b>${c.toLocaleString('ar-EG')}</b></div></div>`}
function chart(id,arr){
 const el=document.getElementById(id); if(!el)return;
 const max=Math.max(...arr.map(x=>Number(x[1])||0),1);
 const palette=[['#60a5fa','#2563eb'],['#c4b5fd','#7c3aed'],['#5eead4','#0d9488'],['#fcd34d','#d97706']];
 el.innerHTML='<div class="bars">'+arr.map(([k,n],i)=>{const value=Number(n)||0, pct=Math.round(value/Math.max(arr.reduce((t,x)=>t+(Number(x[1])||0),0),1)*100),colors=palette[i%palette.length];return `<div class="bar chart-bar" tabindex="0" role="img" aria-label="${esc(k)}: ${value.toLocaleString('ar-EG')} (${pct} بالمئة)" title="${esc(k)}: ${value.toLocaleString('ar-EG')} — ${pct}%" style="height:${Math.max(4,value/max*145)}px;--bar-delay:${i*90}ms;--bar-start:${colors[0]};--bar-end:${colors[1]}"><span>${esc(k)} (${value.toLocaleString('ar-EG')})</span><i class="bar-glint" aria-hidden="true"></i></div>`}).join("")+'</div>';
 bindChartHints(el);
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
 for(const f of files){const name=enc.encode(f.name),data=(f.data instanceof Uint8Array?f.data:enc.encode(f.data)),crc=crc32(data);const local=concatBytes([new Uint8Array([80,75,3,4]),u16(20),u16(0),u16(0),u16(dosTime),u16(dosDate),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);locals.push(local);const central=concatBytes([new Uint8Array([80,75,1,2]),u16(20),u16(20),u16(0),u16(0),u16(dosTime),u16(dosDate),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);centrals.push(central);offset+=local.length}
 const body=concatBytes(locals),cd=concatBytes(centrals),end=concatBytes([new Uint8Array([80,75,5,6]),u16(0),u16(0),u16(files.length),u16(files.length),u32(cd.length),u32(body.length),u16(0)]);
 return concatBytes([body,cd,end]);
}
const ABU_OREIBAN_LOGO_B64="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umnTpplz58495O/vXx52s94A9Ujtdnv5fT9//lxcv379hGHDhm19/PhxOxImqaGyigulYonc3IscF5TPLgpkQ9o5bxGZZ0aomdCFAABCv379/vX29k5xAPaLZ8+ebQAVdSj567DYpwQVa19Zp4feW1lSUhL89ttvnd56661t77777ufwSvBAy+UHzACQ2bFjx12zZs36gYw1Dho0aCcA3CZ72ULWgJVCWKdOnXqjb9++B77//vu3792751JYWAi5ubnU1rB4neTh4aGn68tms4HRaKSiF6DX622sYAOLAVosFjQajWYH8FRVUMCrDHMNOWLsBlRaLBaNHC9PFEXQarVWZmErrFarRBcr+RnKLAxbUVGRlRIhb9y4Yfj000/nT5069UsAqMXRVuiDvQgJCXmo1WqhZcuWJwEgJS0tjVI+6ClhAQDn1atXzxw7duzmX375pV1KSgrFI03wqqCfDX2q0uJDqKzAIQKAU0JCQpeCggKBB+l1Oh3UrVv3MAC85GAGNqy1OeAhYhVEXKwBxoRyNKZly5aVh76PHz/uPGzYsJ/WrVs3NTExscraV2pgmjRpUrZ06dI5c+fOXQQAOWRulFwGjtbdOtI3FMmasMtgWMhVxWgAIGnZsmXvLV26dFFMTExpVWrh7KugoAAOHDjQbMyYMT9v3759JqH12GTuRZTZJALI6wpWyiTKVPH8F2Fb9vrx0dHRd+TwroKCAnjy5Ekjkumuig8ocGvN0RoSdDqdUaVSASLCs2fPFD/88MPYvn37bvv333/bUh4heTY6RuoePXoc9/X1zff09LQ1b978X+bgYsdP/e23386eOXPm90eOHKldXFxcvoZKS0tZypWavjUajUihDqvVCna73ZliyDqdzkgNoAxGKhI+cVX7RW6foCAIdla+XaqGL1a+AKxWq8IRGE2MXHlSWBRFHf2ZUqk0s6RFtkO73W5Hat1FUYTMzEzYs2fPwNGjR2+2WCwN4DXbm9aBFkiSlOHi4gIhISHpACD5+/trAECblpamJZie36xZs5avWLFi5t27d9UUKwIAUCgUOcRb5L0km4NMuCQDqNoBQHz69GlDKg3EGkEfHx9s27btPww2wuKeCo6nVl1ChBp3C1RUh5EceH58FYgNAHDZsmVKAPDdtm3bjHHjxm3ft29fi9zcXEeLq3y8JEmC9u3bZ65bt27WhAkT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";
function base64Bytes(b64){const raw=atob(b64),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
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
 const enc=new TextEncoder();
 // Reserve four header rows so the camp logo is visible without covering report titles.
 const originalHeaderRow=opts.headerRow||0;
 const exportMatrix=[[],[],[],[],...matrix];
 const sheet=worksheetXML(exportMatrix,originalHeaderRow?originalHeaderRow+4:0,opts.title||"").replace('</worksheet>','<drawing r:id="rId1"/></worksheet>');
 const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="16"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="E8EEF7"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="1" borderId="0"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="1" borderId="0"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs></styleSheet>`;
 const files=[
  {name:"[Content_Types].xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`},
  {name:"_rels/.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
  {name:"xl/workbook.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="كشف المخيم" sheetId="1" r:id="rId1"/></sheets></workbook>`},
  {name:"xl/_rels/workbook.xml.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="drawings/drawing1.xml"/></Relationships>`},
  {name:"xl/styles.xml",data:styles},
  {name:"xl/worksheets/sheet1.xml",data:sheet},
  {name:"xl/worksheets/_rels/sheet1.xml.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`},
  {name:"xl/drawings/drawing1.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>50000</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>50000</xdr:rowOff></xdr:from><xdr:to><xdr:col>2</xdr:col><xdr:colOff>100000</xdr:colOff><xdr:row>3</xdr:row><xdr:rowOff>100000</xdr:rowOff></xdr:to><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="شعار مخيم أبو عريبان"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`},
  {name:"xl/drawings/_rels/drawing1.xml.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/abu-oreiban-logo.png"/></Relationships>`},
  {name:"xl/media/abu-oreiban-logo.png",data:base64Bytes(ABU_OREIBAN_LOGO_B64)}
 ];
 const bytes=zipStore(files);const blob=new Blob([bytes],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});downloadBlob(blob,name);
}
function backup(){
 const payload={app:"إدارة وكشف المخيمات",version:2,createdAt:new Date().toISOString(),columns:COLUMNS,data,sectors:loadCampSectors()};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json;charset=utf-8"});
 downloadBlob(blob,`نسخة-احتياطية-المخيم-${dateStamp()}.json`);toast("تم إنشاء النسخة الاحتياطية");
}
function restoreBackup(e){
 const f=e.target.files[0];if(!f)return;const reader=new FileReader();
 reader.onload=()=>{try{const p=JSON.parse(reader.result), rows=Array.isArray(p)?p:p.data;if(!Array.isArray(rows))throw Error();
 if(confirm(`سيتم استبدال البيانات الحالية بـ ${rows.length} سجل. هل تريد المتابعة؟`)){data=rows;renumber();autoSave();if(p&&p.sectors&&typeof p.sectors==="object")saveCampSectors(p.sectors);rebuildFilters();renderAll();renderCampSectors();toast("تمت استعادة النسخة الاحتياطية")}
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
 ["عدد أفراد الأسرة","عدد أفراد الأسرة (اختياري)"],
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
  if(type==="widowed") return isWidowStatus(r["الحالة الاجتماعية"]);
  if(type==="divorced") return isDivorceStatus(r["الحالة الاجتماعية"]);
  return true;
}
function normalizeGender(g){return ["انثى","أنثى"].includes(g)?"أنثى":g}
function familyHeadRecord(r){ return (familyMap().get(r["اسم رب الأسرة"])||[])[0] || r; }

function initReportColumns(){
  if(!reportColumnsInitialized){ selectedReportColumns = REPORT_COLUMNS.map(x=>x[0]).filter(k=>k!=="عدد أفراد الأسرة"); reportColumnsInitialized = true; }
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
  // رب الأسرة يُحسب ضمن عدد أفراد الأسرة حتى لو تم حذف/فقد سجل الفرد الخاص به.
  const hasHead=fam.some(x=>norm(x["صلة القرابة"]) === "رب الأسرة");
  const actual=seen.size || fam.length;
  return actual + (hasHead ? 0 : 1);
}
function familyDisplayCount(rows){
  const list=Array.isArray(rows)?rows:[];
  const hasHead=list.some(x=>norm(x["صلة القرابة"]) === "رب الأسرة");
  return list.length + (hasHead ? 0 : 1);
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
  syncAutomaticOrphans(true);
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
   orphan:["كشف الأيتام","","0","17","","orphan"],
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
  else if(type==="orphan") selectedReportColumns=["اسم الفرد","اسم رب الأسرة","رقم هوية الفرد","رقم الجوال","صلة القرابة","الجنس","العمر التقريبي","الحالة الاجتماعية","يتيم/منفصل عن ذويه؟"];
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
 syncAutomaticOrphans(true);
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
  if(key==="عدد الأفراد") return familyDisplayCount(people);

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
  const first=rows.find(r=>norm(r["صلة القرابة"]) === "رب الأسرة") || rows[0] || {};
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
    const first=rows.find(r=>norm(r["صلة القرابة"]) === "رب الأسرة") || rows[0] || {};
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

    if(!rows.some(r=>norm(r["صلة القرابة"]) === "رب الأسرة"))
      issues.push({type:"error",kind:"family",message:`ملف رب الأسرة مفقود: لا يوجد سجل فرد محدد بصفة «رب الأسرة» لعائلة ${head}. سيتم احتساب رب الأسرة ضمن العدد حتى يتم إصلاح السجل.`,indexes:[data.indexOf(first)],field:"صلة القرابة"});

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
      if(birth){
        const dt=new Date(r["تاريخ الميلاد"]);
        if(Number.isNaN(dt.getTime()))
          issues.push({type:"error",kind:"inconsistent",message:`تاريخ الميلاد غير صالح: ${person}`,indexes:[idx],field:"تاريخ الميلاد"});
        else if(dt > new Date())
          issues.push({type:"error",kind:"inconsistent",message:`تاريخ الميلاد في المستقبل: ${person}`,indexes:[idx],field:"تاريخ الميلاد"});
      }
      const gender=norm(r["الجنس"]);
      if(gender && !["ذكر","أنثى","انثى"].includes(gender))
        issues.push({type:"warning",kind:"inconsistent",message:`قيمة الجنس تحتاج مراجعة: ${person} — ${gender}`,indexes:[idx],field:"الجنس"});
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

function openQualityPerson(idx){
  closeModal("qualityModal");
  showView("records");
  setTimeout(()=>editPerson(idx),80);
}
function openQualityFamily(name){
  if(!name)return;
  closeModal("qualityModal");
  showView("families");
  setTimeout(()=>openFamilyModal(name),140);
}
function openQualityFamilyByIndex(idx){
  const r=data[Number(idx)];
  if(!r){toast("تعذر تحديد الأسرة المرتبطة بهذا التنبيه");return;}
  const name=norm(r["اسم رب الأسرة"]);
  if(name){openQualityFamily(name);return;}
  const fid=normalizeId(r["رقم هوية الأسرة"]);
  const candidate=data.find(x=>normalizeId(x["رقم هوية الأسرة"])===fid && norm(x["اسم رب الأسرة"]));
  if(candidate)openQualityFamily(candidate["اسم رب الأسرة"]);
  else toast("لا يمكن فتح الأسرة لأن اسم رب الأسرة غير موجود في السجل");
}
function openQualityModal(){
  ensureFamilyHeadRecords(true);
  rebuildFilters();
  renderAll();
  qualityIssues=qualityScan();
  const errors=qualityIssues.filter(x=>x.type==="error").length, warnings=qualityIssues.filter(x=>x.type==="warning").length;
  document.getElementById("qualitySummary").innerHTML=`<b>نتيجة الفحص:</b> ${errors} خطأ و${warnings} تنبيه. تم فحص بيانات الأسرة وكل فرد والتعارضات والتكرارات غير الطبيعية. <b>تكرار رقم الجوال مسموح</b> ولا يُحسب خطأ.`;
  const box=document.getElementById("qualityIssues");
  box.innerHTML=qualityIssues.map((x,i)=>{
    const first=Number.isInteger(x.indexes?.[0]) ? x.indexes[0] : undefined, r=data[first]||{}, head=String(r["اسم رب الأسرة"]||"").trim();
    const familyAction=first!==undefined && (head || filled(r["رقم هوية الأسرة"])) ? `<button class="btn primary" onclick="openQualityFamilyByIndex(${first})">فتح الأسرة</button>` : "";
    return `<div class="issue-row ${x.type==="warning"?"warn":""}">
      <div><b>${x.type==="error"?"خطأ":"تنبيه"} #${i+1}</b> — ${esc(x.message)}${x.field?`<div class="muted" style="margin-top:4px">الحقل الذي يحتاج المراجعة: <b>${esc(x.field)}</b></div>`:""}</div>
      <div class="actions" style="margin-top:7px;flex-wrap:wrap">
        ${first!==undefined?`<button class="btn" onclick="openQualityPerson(${first})">فتح السجل</button>`:""}
        ${familyAction}
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
    const n=familyDisplayCount(rows);
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
        <div class="muted">هوية الأسرة: ${esc(r["رقم هوية الأسرة"]||"—")} · الجوال: ${esc(r["رقم الجوال"]||"—")} · عدد الأفراد: <b>${familyDisplayCount(rows)}</b> · اكتمال: <b>${a.score}%</b></div>
        ${a.status!=="مكتملة"?`<div style="margin-top:5px;color:#92400e;font-size:11px">أهم النواقص: ${missing||"راجع البيانات"}</div>`:""}
       </div>
       <div class="actions no-print"><button class="btn" onclick="editFamily(decodeURIComponent('${key}'))">تعديل الأسرة</button><button class="btn primary" onclick="addMemberToFamily(decodeURIComponent('${key}'))">＋ فرد</button><button class="btn danger" onclick="deleteFamily(decodeURIComponent('${key}'))">حذف العائلة</button></div>
      </div>
      <div class="memberlist">${rows.map(x=>`<div class="member"><span>${esc(x["اسم الفرد"]||"")} — ${esc(x["صلة القرابة"]||"")} — ${esc(x["رقم هوية الفرد"]||"")} ${((x["إصابة؟"]||x["إصابة?"])==="نعم")?" · إصابة":""}${x["إعاقة؟"]==="نعم"?" · إعاقة":""}</span><span class="no-print"><button class="pagebtn" onclick="editPerson(${data.indexOf(x)})">تعديل</button></span></div>`).join("")}</div>
    </div>`;
  }).join("") || `<div class="empty">لا توجد عائلات مطابقة</div>`;
}

function renderDashboard(){
  syncAutomaticOrphans(true);
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
  const health=[
    ["مرض مزمن",data.filter(x=>x["مرض مزمن؟"]==="نعم").length],
    ["إصابة",data.filter(x=>(x["إصابة؟"]||x["إصابة?"])==="نعم").length],
    ["إعاقة",data.filter(x=>x["إعاقة؟"]==="نعم").length],
    ["حامل",data.filter(x=>x["حامل؟"]==="نعم").length],
    ["مرضعة",data.filter(x=>x["مرضعة؟"]==="نعم").length],
    ["أيتام",data.filter(x=>hasSpecial(x,"orphan")).length],
    ["أرامل",data.filter(x=>isWidowStatus(x["الحالة الاجتماعية"])).length],
    ["مطلقات",data.filter(x=>isDivorceStatus(x["الحالة الاجتماعية"])).length]
  ];
  renderGenderChart(gender); renderAgeChart(); renderHealthBars(health); renderFamilyStatusChart(counts,fm.size); renderHousingChart(fm); renderOriginalGovernorateChart(fm); bindDashboardChartTouch();
  const recent=data.slice(-6).reverse();
  document.getElementById("recent").innerHTML=recent.map(r=>`<div class="member"><span><b>${esc(r["اسم الفرد"]||"")}</b> — ${esc(r["اسم رب الأسرة"]||"")} — ${esc(r["صلة القرابة"]||"")}</span><span>${statusBadge(familyStatus(familyMap().get(r["اسم رب الأسرة"])||[]).status)}</span></div>`).join("")||'<div class="empty">لا توجد بيانات</div>';
}

function housingTypeKey(value){return String(value??"").normalize("NFKC").trim().replace(/[\u064B-\u065F\u0670\u0640]/g,"").replace(/[أإآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/\s+/g," ").toLowerCase()}
function renderHousingChart(families){
 const el=document.getElementById("housingTypeChart");if(!el)return;
 const groups=new Map();let total=0;
 families.forEach((rows,head)=>{
  const ordered=[...(rows||[])].sort((a,b)=>Number(housingTypeKey(b["صلة القرابة"])==="رب الاسره")-Number(housingTypeKey(a["صلة القرابة"])==="رب الاسره"));
  let value="";
  for(const r of ordered){const candidate=String(r?.["نوع السكن الحالي"]??"").trim();if(candidate){value=candidate;break}}
  const label=value||"غير محدد";const key=housingTypeKey(label)||"غير محدد";
  if(!groups.has(key))groups.set(key,{label,count:0});groups.get(key).count++;total++;
 });
 const items=[...groups.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,"ar"));
 const max=Math.max(1,...items.map(x=>x.count));
 const palette=["#2563eb","#0d9488","#7c3aed","#d97706","#db2777","#0891b2","#65a30d","#64748b"];
 el.innerHTML=`<div class="housing-chart-summary"><b>${total.toLocaleString('ar-EG')}</b><span>إجمالي العائلات المصنفة حسب نوع السكن</span></div>`+(items.length?`<div class="housing-chart-list">${items.map((item,i)=>{const pct=total?item.count/total*100:0;return `<div class="housing-chart-item" tabindex="0" style="--chart-i:${i}" title="${svgEsc(item.label)}: ${item.count.toLocaleString('ar-EG')} عائلة (${pct.toFixed(1)}%)"><div class="housing-chart-label"><span class="housing-chart-name"><i style="background:${palette[i%palette.length]}"></i>${svgEsc(item.label)}</span><strong>${item.count.toLocaleString('ar-EG')} <small>عائلة</small></strong></div><div class="housing-chart-track"><div class="housing-chart-fill" style="width:${Math.max(item.count?1:0,pct)}%;background:${palette[i%palette.length]}"></div></div><div class="housing-chart-percent">${pct.toLocaleString('ar-EG',{maximumFractionDigits:1})}% من العائلات</div></div>`}).join("")}</div>`:`<div class="empty">لا توجد بيانات عائلات لعرضها</div>`)+`<p class="housing-chart-note">الإحصاء يحتسب كل رب أسرة مرة واحدة، ويُحدّث تلقائياً عند إضافة أو تعديل بيانات «نوع السكن الحالي». العائلات التي لا تحتوي على نوع سكن تظهر ضمن «غير محدد».</p>`;
}

function originalGovernorateKey(value){return String(value??"").normalize("NFKC").trim().replace(/[\u064B-\u065F\u0670\u0640]/g,"").replace(/[أإآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/\s+/g," ").toLowerCase()}
const OFFICIAL_GOVERNORATES=["محافظة شمال غزة","محافظة غزة","محافظة الوسطى","محافظة خانيونس","محافظة رفح"];
function canonicalGovernorate(value){const key=originalGovernorateKey(value);if(!key)return "";if(key.includes("شمال")||key==="شمال غزه"||key==="محافظه شمال غزه")return OFFICIAL_GOVERNORATES[0];if(key==="غزه"||key==="محافظه غزه")return OFFICIAL_GOVERNORATES[1];if(key.includes("وسط")||key==="الوسطي")return OFFICIAL_GOVERNORATES[2];if(key.includes("خان يونس")||key.includes("خانيونس"))return OFFICIAL_GOVERNORATES[3];if(key.includes("رفح"))return OFFICIAL_GOVERNORATES[4];return OFFICIAL_GOVERNORATES.find(x=>originalGovernorateKey(x)===key)||"";}
function renderOriginalGovernorateChart(families){
 const el=document.getElementById("originalGovernorateChart");if(!el)return;
 const groups=new Map();let total=0,missing=0;
 families.forEach((rows)=>{
  const ordered=[...(rows||[])].sort((a,b)=>Number(originalGovernorateKey(b["صلة القرابة"])==="رب الاسره")-Number(originalGovernorateKey(a["صلة القرابة"])==="رب الاسره"));
  let value="";for(const r of ordered){const candidate=String(r?.["المحافظة الأصلية"]??"").trim();if(candidate){value=candidate;break}}
  const normalized=canonicalGovernorate(value);const label=normalized||"غير محددة";const key=originalGovernorateKey(label)||"غير محددة";
  if(!value)missing++;if(!groups.has(key))groups.set(key,{label,count:0});groups.get(key).count++;total++;
 });
 for(const label of OFFICIAL_GOVERNORATES){const key=originalGovernorateKey(label);if(!groups.has(key))groups.set(key,{label,count:0});}
 const items=[...groups.values()].sort((a,b)=>{const ai=OFFICIAL_GOVERNORATES.indexOf(a.label),bi=OFFICIAL_GOVERNORATES.indexOf(b.label);if(ai>=0&&bi>=0)return ai-bi;if(ai>=0)return -1;if(bi>=0)return 1;return b.count-a.count||a.label.localeCompare(b.label,"ar")});
 const palette=["#3979d6","#168f83","#8b6bd6","#c58a35","#c95c79","#0891b2","#65a30d","#64748b","#be123c","#4f46e5"];
 el.innerHTML=`<div class="housing-chart-summary"><b>${total.toLocaleString('ar-EG')}</b><span>إجمالي العائلات التي جرى احتسابها مرة واحدة</span></div>`+(items.length?`<div class="housing-chart-list">${items.map((item,i)=>{const pct=total?item.count/total*100:0;const color=palette[i%palette.length];return `<div class="housing-chart-item" tabindex="0" role="button" aria-label="${svgEsc(item.label)}: ${item.count.toLocaleString('ar-EG')} عائلة، ${pct.toFixed(1)} بالمئة" style="--chart-i:${i}" title="${svgEsc(item.label)}: ${item.count.toLocaleString('ar-EG')} عائلة (${pct.toFixed(1)}%)"><div class="housing-chart-label"><span class="housing-chart-name"><i style="background:${color}"></i>${svgEsc(item.label)}</span><strong>${item.count.toLocaleString('ar-EG')} <small>عائلة</small></strong></div><div class="housing-chart-track" role="img" aria-label="${svgEsc(item.label)} ${item.count} عائلة"><div class="housing-chart-fill" style="width:${Math.max(item.count?1:0,pct)}%;background:${color}"></div></div><div class="housing-chart-percent">${pct.toLocaleString('ar-EG',{maximumFractionDigits:1})}% من العائلات</div></div>`}).join('')}</div>`:`<div class="empty">لا توجد بيانات عائلات لعرضها</div>`)+`<p class="housing-chart-note">هذا الرسم يحتسب كل عائلة مرة واحدة، ويوحّد القيم القديمة مثل «الوسطى» و«محافظة الوسطى» ضمن «محافظة الوسطى». المحافظات الخمس الرسمية تظهر بأسمائها الموحدة، والقيم الفارغة ضمن «غير محددة».</p>`;
 bindDashboardChartTouch();
}

function conditionFieldOptions(){
 return [
  ["اسم رب الأسرة","اسم رب الأسرة"],["رقم هوية الأسرة","رقم هوية الأسرة"],["رقم الجوال","رقم الجوال"],
  ["العنوان","العنوان"],["داخل/خارج المخيم","داخل/خارج المخيم"],["حالة اكتمال بيانات الأسرة","حالة الأسرة"],
  ["المحافظة الأصلية","المحافظة الأصلية"],["نوع السكن الحالي","نوع السكن"],["اسم الفرد","اسم الفرد"],
  ["رقم هوية الفرد","رقم هوية الفرد"],["صلة القرابة","صلة القرابة"],["الجنس","الجنس"],["الحالة الاجتماعية","الحالة الاجتماعية"],
  ["العمر","العمر"],["عدد أفراد الأسرة","عدد أفراد الأسرة"],["مرض مزمن؟","مرض مزمن"],["نوع المرض","نوع المرض"],["إصابة؟","إصابة"],["سبب الإصابة","سبب الإصابة"],
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
 ensureFamilyHeadRecords(true);
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
function distCoverageTypes(){const base=["سلة غذائية","طرد صحي","حقيبة مدرسية","مساعدة نقدية","مياه","ملابس","مستلزمات أطفال","مستلزمات طبية"];return [...new Set([...base,...distributions.map(x=>String(x.type||"").trim()).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,"ar"));}
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
 if(appReadOnly===true){toast("جهاز العرض للقراءة فقط؛ التسجيل من الجهاز الرئيسي");return;}
 const scope=document.getElementById("bulkScopeLabel").value==="عائلات"?"families":document.getElementById("bulkScopeLabel").value==="أفراد"?"persons":"children",type=distNorm(document.getElementById("bulkType").value),qty=Number(document.getElementById("bulkQty").value||1),unit=distNorm(document.getElementById("bulkUnit").value),date=document.getElementById("bulkDate").value||distToday(),by=distNorm(document.getElementById("bulkBy").value);const keys=[...document.querySelectorAll('#bulkTbody input[type="checkbox"]:checked')].map(x=>x.dataset.key);
 if(!type){toast("اختر نوع المساعدة");return}if(!keys.length){toast("حدد مستفيداً واحداً على الأقل");return}if(!Number.isFinite(qty)||qty<=0){toast("الكمية يجب أن تكون أكبر من صفر");return}if(!distValidDate(date)){toast("تحقق من تاريخ التوزيع");return}if(!by){toast("أدخل اسم الجهة أو المسؤول الذي سلّم المساعدة");return}
 const universe=new Map(distCoverageUniverse(scope).map(x=>[x.key,x])),before=distributions.slice();let added=0,skipped=0;const stamp=Date.now();
 for(const k of keys){const x=universe.get(k);if(!x)continue;const row=scope==="families"?null:data.find(r=>distCoverageKeyPerson(r)===x.key);const obj={id:distId(),beneficiaryType:scope==="families"?"عائلة":"فرد",beneficiaryName:x.name,personId:scope==="families"?"":x.id,familyId:scope==="families"?x.id:(row?.["رقم هوية الأسرة"]||x.familyId||""),familyName:x.familyName,type,quantity:qty,unit,date,reference:"DST-"+stamp.toString().slice(-8)+"-"+(added+1),distributedBy:by,notes:"توزيع جماعي من كشف غير المستلمين",updatedAt:stamp};
  if(distCampaignFindDuplicate(obj,"")){skipped++;continue}Object.assign(obj,{workflowStatus:"تم التسليم",registeredAt:stamp,approvedAt:stamp,deliveredAt:stamp});distributions.push(obj);added++;
 }
 try{distSave()}catch(e){distributions=before;toast("تعذر الحفظ على الهاتف؛ أُلغيت العملية الجماعية");return}
 closeDistBulkModal();renderDistributions();toast(`تم تسليم ${added} سجل${skipped?`، وتجاوز ${skipped} مكرر حسب العائلة ونوع المساعدة`:""}`);distSyncSoon();
}

/* ================= إدارة التوزيعات — Offline First + D1 Sync ================= */
const DIST_KEY="aboreiban_distributions_v1", DIST_SHADOW_KEY="aboreiban_dist_shadow_v1", DIST_PENDING_KEY="aboreiban_dist_pending_v1", DIST_CURSOR_KEY="aboreiban_dist_cursor_v1";
let distributions=[]; let distShadow=[]; let distCursor=Number(localStorage.getItem(DIST_CURSOR_KEY)||0); let distBusy=false;
function distId(){return "dist:"+(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(16).slice(2));}
function distLoad(){try{distributions=JSON.parse(localStorage.getItem(DIST_KEY)||"[]");if(!Array.isArray(distributions))distributions=[]}catch(e){distributions=[]}}
function distSave(){localStorage.setItem(DIST_KEY,JSON.stringify(distributions))}
function distNorm(x){return String(x??"").replace(/\s+/g," ").trim()}
function distToday(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function distValidDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return false;const [y,m,d]=String(value).split('-').map(Number);const x=new Date(y,m-1,d);return x.getFullYear()===y&&x.getMonth()===m-1&&x.getDate()===d}
function openDistributionModal(id=""){const m=document.getElementById("distModal"); if(!m)return; const r=distributions.find(x=>x.id===id); document.getElementById("distId").value=r?.id||""; document.getElementById("distBeneficiaryForm").value=r?.beneficiaryType||"طفل"; document.getElementById("distName").value=r?.beneficiaryName||""; document.getElementById("distPersonId").value=r?.personId||""; document.getElementById("distFamilyId").value=r?.familyId||""; document.getElementById("distFamilyName").value=r?.familyName||""; document.getElementById("distTypeForm").value=r?.type||""; document.getElementById("distQty").value=r?.quantity||1; document.getElementById("distUnit").value=r?.unit||""; document.getElementById("distDate").value=r?.date||distToday(); document.getElementById("distRef").value=r?.reference||("DST-"+new Date().getTime().toString().slice(-8)); document.getElementById("distBy").value=r?.distributedBy||""; document.getElementById("distNotes").value=r?.notes||""; document.getElementById("distModalTitle").textContent=r?"تعديل التوزيع":"تسجيل توزيع"; distFillNames();m.classList.add("show");m.setAttribute("aria-hidden","false");}
function closeDistributionModal(){const m=document.getElementById("distModal");m?.classList.remove("show");m?.setAttribute("aria-hidden","true")}
function distFillNames(){const dl=document.getElementById("distNames");if(!dl)return; const people=[...new Set(data.map(r=>r["اسم الفرد"]).filter(Boolean))];const heads=[...new Set(data.map(r=>r["اسم رب الأسرة"]).filter(Boolean))];dl.innerHTML=[...people,...heads].slice(0,1200).map(x=>`<option value="${esc(x)}">`).join("")}
function distBeneficiaryChanged(){const t=document.getElementById("distBeneficiaryForm")?.value||"طفل"; if(t!=="عائلة"){const name=distNorm(document.getElementById("distName")?.value);const r=data.find(x=>distNorm(x["اسم الفرد"])===name);if(r){document.getElementById("distPersonId").value=r["رقم هوية الفرد"]||"";document.getElementById("distFamilyId").value=r["رقم هوية الأسرة"]||"";document.getElementById("distFamilyName").value=r["اسم رب الأسرة"]||""}}}
function saveDistribution(){const id=document.getElementById("distId").value||distId();const obj={id,beneficiaryType:distNorm(document.getElementById("distBeneficiaryForm").value),beneficiaryName:distNorm(document.getElementById("distName").value),personId:distNorm(document.getElementById("distPersonId").value),familyId:distNorm(document.getElementById("distFamilyId").value),familyName:distNorm(document.getElementById("distFamilyName").value),type:distNorm(document.getElementById("distTypeForm").value),quantity:Number(document.getElementById("distQty").value||1),unit:distNorm(document.getElementById("distUnit").value),date:document.getElementById("distDate").value||distToday(),reference:distNorm(document.getElementById("distRef").value),distributedBy:distNorm(document.getElementById("distBy").value),notes:distNorm(document.getElementById("distNotes").value),updatedAt:Date.now()};if(!obj.beneficiaryName||!obj.type){toast("أدخل اسم المستفيد ونوع التوزيع");return}const i=distributions.findIndex(x=>x.id===id);if(i<0)distributions.push(obj);else distributions[i]=obj;distSave();closeDistributionModal();renderDistributions();toast("تم حفظ التوزيع");distSyncSoon()}
function deleteDistribution(id){if(!confirm("حذف سجل التوزيع؟"))return;distributions=distributions.filter(x=>x.id!==id);distSave();renderDistributions();toast("تم حذف التوزيع");distSyncSoon()}
function renderDistributions(){const q=distNorm(document.getElementById("distQ")?.value).toLowerCase(),bt=document.getElementById("distBeneficiary")?.value||"",ty=document.getElementById("distType")?.value||"",from=document.getElementById("distFrom")?.value||"",to=document.getElementById("distTo")?.value||"";const types=[...new Set(distributions.map(x=>x.type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar"));const sel=document.getElementById("distType");if(sel){const old=sel.value;sel.innerHTML='<option value="">الكل</option>'+types.map(x=>`<option>${esc(x)}</option>`).join("");sel.value=types.includes(old)?old:""}const arr=distributions.filter(x=>{const blob=[x.beneficiaryName,x.familyName,x.type,x.reference,x.notes].join(" ").toLowerCase();return(!q||blob.includes(q))&&(!bt||x.beneficiaryType===bt)&&(!ty||x.type===ty)&&(!from||x.date>=from)&&(!to||x.date<=to)}).sort((a,b)=>String(b.date).localeCompare(String(a.date)));document.getElementById("distTbody").innerHTML=arr.length?arr.map(x=>`<tr><td>${esc(x.date)}</td><td><b>${esc(x.beneficiaryName)}</b><div class="muted">${esc(x.beneficiaryType)}</div></td><td>${esc(x.familyName||"—")}</td><td>${esc(x.type)}</td><td>${esc(x.quantity)} ${esc(x.unit)}</td><td>${esc(x.reference||"—")}</td><td>${esc(x.distributedBy||"—")}</td><td><div class="dist-actions"><button class="pagebtn" onclick="openDistributionModal('${x.id}')">تعديل</button><button class="pagebtn" onclick="deleteDistribution('${x.id}')">حذف</button></div></td></tr>`).join(""):'<tr><td colspan="8"><div class="dist-empty">لا توجد توزيعات مطابقة</div></td></tr>';document.getElementById("distTotal").textContent=distributions.length;const ym=distToday().slice(0,7);document.getElementById("distMonth").textContent=distributions.filter(x=>String(x.date).startsWith(ym)).length;document.getElementById("distChildren").textContent=distributions.filter(x=>x.beneficiaryType==="طفل").length;document.getElementById("distFamilies").textContent=distributions.filter(x=>x.beneficiaryType==="عائلة").length;document.getElementById("distSyncState").textContent=navigator.onLine?"متصل — بانتظار المزامنة":"دون اتصال";renderDistributionCoverage()}
function exportDistributionsCSV(){const rows=[["التاريخ","نوع المستفيد","اسم المستفيد","رقم هوية الفرد","رقم هوية الأسرة","رب الأسرة","نوع التوزيع","الكمية","الوحدة","المرجع","بواسطة","ملاحظات"],...distributions.map(x=>[x.date,x.beneficiaryType,x.beneficiaryName,x.personId,x.familyId,x.familyName,x.type,x.quantity,x.unit,x.reference,x.distributedBy,x.notes])];const csv="\uFEFF"+rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="توزيعات_مخيم_أبو_عريبان.csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function distBuildChanges(){
  const old=new Map((Array.isArray(distShadow)?distShadow:[]).map(x=>[x.id,x]));
  const now=new Map((Array.isArray(distributions)?distributions:[]).map(x=>[x.id,x]));
  const prior=Array.isArray(distLoadPending())?distLoadPending():[];
  const priorByKey=new Map(prior.map(c=>[String(c.operation)+'|'+String(c.recordId),c]));
  const out=[];
  for(const r of distributions){
    const o=old.get(r.id);
    if(!o||JSON.stringify(o)!==JSON.stringify(r)){
      const key='upsert|'+r.id,prev=priorByKey.get(key);
      out.push({opId:prev?.opId||('distop:'+((crypto.randomUUID&&crypto.randomUUID())||Date.now()+'-'+Math.random().toString(16).slice(2))),recordId:r.id,operation:'upsert',updatedAt:Number(r.updatedAt||prev?.updatedAt||Date.now()),data:structuredClone(r)});
    }
  }
  for(const o of distShadow){
    if(!now.has(o.id)){
      const key='delete|'+o.id,prev=priorByKey.get(key);
      out.push({opId:prev?.opId||('distop:'+((crypto.randomUUID&&crypto.randomUUID())||Date.now()+'-'+Math.random().toString(16).slice(2))),recordId:o.id,operation:'delete',updatedAt:Number(prev?.updatedAt||Date.now())});
    }
  }
  return out;
}
function distSavePending(c){try{localStorage.setItem(DIST_PENDING_KEY,JSON.stringify(Array.isArray(c)?c:[]))}catch(e){console.error('تعذر حفظ طابور التوزيعات',e);throw e}distRenderPendingCenter?.()}
function distLoadPending(){try{const x=JSON.parse(localStorage.getItem(DIST_PENDING_KEY)||'[]');return Array.isArray(x)?x:[]}catch(e){return[]}}
function distRenderPendingCenter(){
  const box=document.getElementById('distPendingCenter'),badge=document.getElementById('distPendingBadge');
  if(!box)return;
  const pending=distLoadPending();if(badge)badge.textContent=String(pending.length);
  const online=navigator.onLine;
  const state=document.getElementById('distSyncState');
  if(state){state.textContent=pending.length?(!online?'دون اتصال · '+pending.length+' معلّق': 'بانتظار المزامنة · '+pending.length):(!online?'دون اتصال · محفوظ محلياً':'متصل · تمت المزامنة');state.dataset.state=pending.length?'pending':online?'online':'offline'}
  const body=document.getElementById('distPendingRows');if(!body)return;
  if(!pending.length){body.innerHTML='<div class="dist-empty">لا توجد عمليات توزيع معلّقة. التغييرات المحلية متطابقة مع آخر نسخة مؤكدة.</div>';return}
  const byId=new Map(distributions.map(x=>[x.id,x]));
  body.innerHTML=pending.map((c,i)=>{const d=byId.get(c.recordId)||c.data||{},op=c.operation==='delete'?'حذف سجل': 'حفظ / تحديث';return `<div class="dist-pending-row"><div><b>${String(d.familyName||d.beneficiaryName||c.recordId||'سجل توزيع').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}</b><small>${String(d.type||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))} · ${op} · ${String(d.date||'').replace(/[&<>"']/g,'')}</small></div><span class="dist-pending-index">${i+1}</span></div>`}).join('');
}
window.toggleDistPendingCenter=function(){const box=document.getElementById('distPendingPanel');if(!box)return;box.hidden=!box.hidden;if(!box.hidden)distRenderPendingCenter()};
window.retryDistPendingSync=async function(){if(!navigator.onLine){toast('لا يوجد اتصال بالإنترنت. العمليات محفوظة على هذا الجهاز وستُرفع عند عودة الاتصال.');distRenderPendingCenter();return}try{distSavePending(distBuildChanges());await distSync();distRenderPendingCenter();const n=distLoadPending().length;toast(n?'بقيت '+n+' عملية بانتظار تأكيد الخادم':'تمت مزامنة عمليات التوزيع المعلّقة')}catch(e){distRenderPendingCenter();toast('تعذرت المزامنة؛ بقيت العمليات محفوظة محلياً')}};
async function distSync(){
  if(distBusy||!navigator.onLine)return;distBusy=true;
  try{
    if(!appReadOnly){
      let pending=distBuildChanges();distSavePending(pending);
      if(pending.length){
        const remaining=[];
        for(let i=0;i<pending.length;i+=100){
          const batch=pending.slice(i,i+100);
          try{
            const r=await syncFetch('/sync/push',{method:'POST',body:JSON.stringify({deviceId:syncDeviceId(),changes:batch,scope:'distributions'})});
            const accepted=new Set([...(r.accepted||[]).map(x=>typeof x==='string'?x:x.opId)]);
            for(const c of batch)if(!accepted.has(c.opId))remaining.push(c);
            // Only acknowledge operations the server explicitly accepted.
            for(const c of batch){if(!accepted.has(c.opId))continue;const i=distShadow.findIndex(x=>x.id===c.recordId);if(c.operation==='delete'){if(i>=0)distShadow.splice(i,1)}else if(c.data){if(i>=0)distShadow[i]=structuredClone(c.data);else distShadow.push(structuredClone(c.data))}}
          }catch(e){remaining.push(...batch,...pending.slice(i+batch.length));break}
        }
        distSavePending(remaining);localStorage.setItem(DIST_SHADOW_KEY,JSON.stringify(distShadow));
      }
    }
    const protectedIds=new Set(distLoadPending().map(c=>c.recordId));
    let cursor=distCursor,loops=0,all=[];
    while(loops++<20){
      const pr=await syncFetch(`/sync/pull?scope=distributions&since=${encodeURIComponent(cursor)}&limit=500`,{method:'GET'});
      all.push(...(pr.changes||[]));cursor=Number(pr.nextSince||cursor);if(!pr.hasMore)break;
    }
    for(const c of all){
      if(!c.recordId?.startsWith('dist:'))continue;
      // Do not let a remote copy overwrite a local record that still has an unconfirmed operation.
      if(protectedIds.has(c.recordId))continue;
      const i=distributions.findIndex(x=>x.id===c.recordId),si=distShadow.findIndex(x=>x.id===c.recordId);
      if(c.operation==='delete'){if(i>=0)distributions.splice(i,1);if(si>=0)distShadow.splice(si,1)}
      else if(c.data){if(i>=0)distributions[i]=structuredClone(c.data);else distributions.push(structuredClone(c.data));if(si>=0)distShadow[si]=structuredClone(c.data);else distShadow.push(structuredClone(c.data))}
    }
    distCursor=cursor;localStorage.setItem(DIST_CURSOR_KEY,String(distCursor));distSave();localStorage.setItem(DIST_SHADOW_KEY,JSON.stringify(distShadow));renderDistributions();distRenderPendingCenter();
  }catch(e){console.warn('Distribution sync retained local queue:',e);const st=document.getElementById('distSyncState');if(st)st.textContent='فشل الاتصال · محفوظ محلياً';distRenderPendingCenter()}
  finally{distBusy=false;distRenderPendingCenter()}
}
function distSyncSoon(){try{distSavePending(distBuildChanges());distRenderPendingCenter()}catch(e){toast('تم حفظ السجل محلياً لكن تعذر تحديث قائمة المزامنة')}if(navigator.onLine)setTimeout(distSync,250)}
function distInit(){try{distLoad();distShadow=JSON.parse(localStorage.getItem(DIST_SHADOW_KEY)||'[]');if(!Array.isArray(distShadow))distShadow=[]}catch(e){distShadow=[]}renderDistributions();distRenderPendingCenter();window.addEventListener('online',()=>setTimeout(distSync,400));window.addEventListener('offline',distRenderPendingCenter);setTimeout(()=>{if(navigator.onLine)distSync()},1200)}

/* ================= مزامنة سحابية D1 — Worker moood — V24 offline-first ================= */
const SYNC_API_URL = "https://moood.eyad2000515.workers.dev";
const SYNC_DEVICE_KEY = "aboreiban_sync_device_v1";
const SYNC_CURSOR_KEY = "aboreiban_sync_cursor_v1";
const SYNC_SHADOW_KEY = "aboreiban_sync_shadow_v1";
const SYNC_PENDING_KEY = "aboreiban_sync_pending_v2";
const APP_RELEASE_VERSION = "68.0"
const APP_RELEASE_KEY = "aboreiban_app_release_seen";
let syncBusy=false, syncTimer=null, syncShadow=[], syncCursor=Number(localStorage.getItem(SYNC_CURSOR_KEY)||0), syncInitialized=false;
let syncRole={configured:false,isPrimary:false,deviceId:"",primaryDeviceId:""};
let syncRoleCheckedAt=0;
const SYNC_ROLE_CACHE_MS=30000;
const DISPLAY_PERMS_CACHE_KEY="aboreiban_display_permissions_v54_0";
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
function applyDisplayPermissions(){if(appReadOnly!==true)return;const p=displayPermissions||{};const map={families:['families','familySearch'],people:['people','records'],search:['search','familySearch'],reports:['reports','classified'],distributions:['distributions','distributions']};const tabs=[...document.querySelectorAll('.tab[data-view]')];for(const t of tabs){const v=t.dataset.view;let allowed=true;if(v==='dashboard')allowed=p.dashboard!==false;else if(v==='families')allowed=p.families!==false;else if(v==='sectors')allowed=p.families!==false;else if(v==='familySearch')allowed=p.search!==false&&p.families!==false;else if(v==='records')allowed=p.people!==false;else if(v==='classified')allowed=p.reports!==false;else if(v==='distributions')allowed=p.distributions!==false;else if(v==='syncCenter'||v==='settings')allowed=false;t.style.display=allowed?'':'none'}for(const [perm,views] of Object.entries(map)){if(p[perm]===false){for(const v of views){document.querySelectorAll(`[data-view="${v}"]`).forEach(el=>el.style.display='none')}}}document.querySelectorAll('[data-mobile-view="sectors"]').forEach(el=>el.style.display=p.families===false?'none':'');if(p.dashboard===false){try{showView('familySearch')}catch(e){}}} 
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
async function authFetch(path,options={}){const headers={"Content-Type":"application/json","X-Device-Id":syncDeviceId(),...displayAuthHeader(),...(options.headers||{})};const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);try{const r=await fetch(SYNC_API_URL+path,{...options,headers,cache:"no-store",signal:options.signal||controller.signal});let b=null;try{b=await r.json()}catch(e){throw Error("الخادم أعاد استجابة غير صالحة")};if(!r.ok||b?.ok===false){const err=new Error(b?.error||(`تعذر تنفيذ العملية (HTTP ${r.status})`));err.status=r.status;err.code=b?.code||"HTTP_ERROR";err.requestId=b?.requestId||r.headers.get("X-Request-Id")||"";throw err}return b}catch(e){if(e?.name==="AbortError"){const err=new Error("الخادم لم يرد خلال 20 ثانية. لم يتم اعتبار الحساب منشأً؛ افحص اتصال السحابة ثم حدّث قائمة الحسابات.");err.code="REQUEST_TIMEOUT";throw err}throw e}finally{clearTimeout(timer)}}
window.openDisplayAccountsManager=async function(){try{await fetchSyncRole(true)}catch(e){} if(appReadOnly){toast("إدارة أجهزة العرض متاحة من الجهاز الرئيسي فقط — تحقق من اتصال السحابة والجهاز الرئيسي");return}const modal=document.getElementById("displayAccountsModal");if(!modal){toast("واجهة إدارة أجهزة العرض غير موجودة في هذه النسخة");return}modal.classList.add("show");await renderDisplayAccounts()};
window.closeDisplayAccountsManager=function(){document.getElementById("displayAccountsModal")?.classList.remove("show")};
async function renderDisplayAccounts(){const box=document.getElementById("displayAccountsList");if(!box)return;box.innerHTML='<div class="empty">جاري تحميل الحسابات...</div>';try{const r=await authFetch("/auth/display-accounts",{method:"GET"});const now=Date.now();const fmt=t=>t?new Date(t).toLocaleString("ar-EG",{dateStyle:"short",timeStyle:"short"}):"لم يتصل بعد";const online=t=>!!t&&(now-Number(t)<45000);box.innerHTML=r.accounts.length?r.accounts.map(a=>{const isOn=online(a.lastSeenAt);return `<div class="display-account-row ${a.enabled?"":"disabled"}"><div class="display-account-main"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b>${esc(a.fullName)}</b><span class="device-live-dot ${isOn?"on":"off"}">${isOn?"متصل الآن":"غير متصل"}</span></div><small>اسم المستخدم: <strong dir="ltr">${esc(a.username)}</strong> · ${a.enabled?"مفعّل":"موقوف"}</small><small>آخر اتصال: ${esc(fmt(a.lastSeenAt))} · آخر دخول: ${esc(fmt(a.lastLoginAt))} · الجلسة: ${a.sessionExpiresAt?esc(fmt(a.sessionExpiresAt)):"غير مسجلة"}</small></div><div class="display-account-actions"><button class="btn" onclick="toggleDisplayAccount(${a.id},${a.enabled})">${a.enabled?"إيقاف":"تفعيل"}</button><button class="btn" onclick="toggleDisplayEmergency(${a.id},'${esc(a.fullName)}',${a.emergencyLocked})">${a.emergencyLocked?"إلغاء قفل الطوارئ":"قفل طوارئ"}</button><button class="btn" onclick="editDisplayPermissions(${a.id},'${esc(a.fullName)}')">الصلاحيات</button><button class="btn" onclick="showDisplayActivity(${a.id},'${esc(a.fullName)}')">النشاط</button><button class="btn" onclick="revokeDisplaySession(${a.id})">إنهاء الجلسة</button><button class="btn" onclick="resetDisplayPassword(${a.id},'${esc(a.username)}')">تغيير كلمة المرور</button></div></div>`}).join(""):'<div class="empty">لا توجد أجهزة عرض مضافة.</div>'}catch(e){box.innerHTML=`<div class="notice">${esc(e.message||"تعذر تحميل الحسابات")}<br><small>تأكد أن هذه النسخة من Worker منشورة على نفس رابط السحابة وأن الجهاز الحالي هو الجهاز الرئيسي.</small></div>`}}
window.createDisplayAccount=async function(){const btn=document.querySelector("#displayAccountsModal button[onclick=\"createDisplayAccount()\"]"),res=document.getElementById("daCreateResult");const fullName=document.getElementById("daFullName")?.value.trim()||"",username=(document.getElementById("daUsername")?.value.trim()||"").toLowerCase(),p=document.getElementById("daPassword")?.value||"",p2=document.getElementById("daPassword2")?.value||"";if(!fullName||!username||!p){toast("أكمل بيانات جهاز العرض");return}if(p!==p2){toast("كلمتا المرور غير متطابقتين");return}let requestId="";try{await fetchSyncRole(true);if(appReadOnly)throw new Error("هذا الجهاز ليس الجهاز الرئيسي؛ إنشاء حسابات العرض مسموح من الجهاز الرئيسي فقط");if(btn){btn.disabled=true;btn.textContent="جاري الاتصال بالسحابة..."}requestId=(crypto.randomUUID?crypto.randomUUID():String(Date.now()));const payload={fullName,username,password:p};if(btn)btn.textContent="جاري إنشاء الحساب...";let created;try{created=await authFetch("/auth/display-accounts",{method:"POST",headers:{"X-Request-Id":requestId},body:JSON.stringify(payload)})}catch(e){if(e.code==="REQUEST_TIMEOUT"){if(btn)btn.textContent="جاري التحقق من النتيجة...";try{const list=await authFetch("/auth/display-accounts",{method:"GET"});const found=(list.accounts||[]).find(a=>String(a.username||"").toLowerCase()===username);if(found){created={ok:true,id:found.id,fullName:found.fullName,username:found.username,recoveredAfterTimeout:true}}else throw e}catch(checkErr){throw e}}else throw e}res.hidden=false;res.innerHTML=`تم إنشاء حساب جهاز العرض بنجاح.<br>الاسم: <b>${esc(created.fullName||fullName)}</b> — اسم المستخدم: <b dir="ltr">${esc(created.username||username)}</b><br><small>احفظ كلمة المرور الآن؛ لا يتم عرضها لاحقاً.</small>`;toast("تم إنشاء حساب جهاز العرض بنجاح");for(const id of ["daFullName","daUsername","daPassword","daPassword2"]){const el=document.getElementById(id);if(el)el.value=""}await renderDisplayAccounts()}catch(e){const rid=e.requestId||requestId;toast(`${e.message||"تعذر إنشاء الحساب"}${rid?" · رقم الطلب: "+rid.slice(0,8):""}`);if(res){res.hidden=false;res.innerHTML=`<span style="color:#b42318">لم يتم تأكيد إنشاء الحساب.</span><br><small>${esc(e.message||"تعذر إنشاء الحساب")}</small>`}}finally{if(btn){btn.disabled=false;btn.textContent="إنشاء الحساب"}}};
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
  // Use the application's built-in XLSX writer. This works offline and does not depend on a missing XLSX global/library.
  if(!Array.isArray(rows)||!rows.length){toast("لا توجد بيانات لتصديرها");return;}
  const clean=rows.map(r=>{const o={};Object.keys(r||{}).forEach(k=>o[k]=r[k]??"");return o;});
  const cols=[...new Set(clean.flatMap(r=>Object.keys(r)))];
  const matrix=[["إدارة وكشف المخيمات — إدارة مخيم أبو عريبان"],[sheetName],[`تاريخ التصدير: ${new Date().toLocaleString('ar-EG')}`],[`عدد السجلات: ${clean.length}`],[],cols,...clean.map(r=>cols.map(k=>r[k]??""))];
  downloadXLSX(matrix,filename.endsWith(".xlsx")?filename:filename+".xlsx",{headerRow:6,title:sheetName});
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
            <div class="family-info-item"><div class="family-info-label">عدد الأفراد</div><div class="family-info-value">${familyDisplayCount(people)}${people.some(x=>norm(x["صلة القرابة"]) === "رب الأسرة")?'':' <span class="muted">(سجل رب الأسرة مفقود)</span>'}</div></div>
            <div class="family-info-item"><div class="family-info-label">حالة اكتمال البيانات</div><div class="family-info-value">${esc(f["حالة اكتمال بيانات الأسرة"]||"غير محددة")}</div></div>
            <div class="family-info-item"><div class="family-info-label">المحافظة الأصلية</div><div class="family-info-value">${esc(f["المحافظة الأصلية"]||"غير متوفر")}</div></div>
            <div class="family-info-item"><div class="family-info-label">حالة المسكن الأصلي</div><div class="family-info-value">${esc(f["حالة المسكن الأصلي"]||"غير متوفر")}</div></div>
            <div class="family-info-item"><div class="family-info-label">نوع السكن الحالي</div><div class="family-info-value">${esc(f["نوع السكن الحالي"]||"غير متوفر")}</div></div>
            <div class="family-info-item" style="grid-column:1/-1"><div class="family-info-label">العنوان</div><div class="family-info-value">${esc(f["العنوان"]||"غير متوفر")}</div></div>
            <div class="family-info-item" style="grid-column:1/-1"><div class="family-info-label">ملاحظات الأسرة</div><div class="family-info-value">${esc(f["ملاحظات الأسرة"]||"لا توجد ملاحظات")}</div></div>
          </div>

          <div class="family-members">
            <h3>الأفراد المسجلون (${people.length})${people.some(x=>norm(x["صلة القرابة"]) === "رب الأسرة")?"":" — رب الأسرة غير مسجل ضمن الأفراد"}</h3>
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

  // حفظ واستعادة نموذج الفرد بالكامل: نبني خيارات القوائم أولاً ثم نعيد القيم المخزنة،
  // حتى لا يؤدي reset() أو إعادة بناء <select> إلى فقدان الحالة الاجتماعية أو صلة القرابة.
  function restorePersonFormValues(r){
    if(!r)return;
    setv("p_name",r["اسم الفرد"]||"");
    setv("p_head",r["اسم رب الأسرة"]||"");
    setv("p_id",r["رقم هوية الفرد"]||"");
    ensureSelectValue("p_rel",r["صلة القرابة"]||"",REL_OPTIONS);
    setv("p_gender",r["الجنس"]||"");
    ensureSelectValue("p_marital",r["الحالة الاجتماعية"]||"",MARITAL_OPTIONS);
    setv("p_birth",r["تاريخ الميلاد"]||"");
    setv("p_age",r["العمر التقريبي"]||"");
    setv("p_chronic",r["مرض مزمن؟"]||r["مرض مزمن?"]||"");
    setv("p_disease",r["نوع المرض"]||"");
    setv("p_injury",r["إصابة؟"]||r["إصابة?"]||"");
    setv("p_injuryreason",r["سبب الإصابة"]||"");
    setv("p_injurydetails",r["تفاصيل الإصابة"]||"");
    setv("p_disability",r["إعاقة؟"]||"");
    setv("p_disabilitytype",r["نوع الإعاقة"]||"");
    setv("p_orphan",r["يتيم/منفصل عن ذويه؟"]||r["يتيم/منفصل عن ذويه?"]||"");
    setv("p_preg",r["حامل؟"]||"");
    setv("p_lact",r["مرضعة؟"]||"");
    setv("p_notes",r["ملاحظات الفرد"]||"");
    updatePersonAge();
  }
  window.openPersonModal=function(idx=null){
    const form=document.getElementById("personForm");
    form.reset();
    // مهم: إعادة بناء خيارات القوائم قبل استعادة القيم القديمة.
    patchPersonForm();
    document.getElementById("p_index").value=idx==null?"":idx;
    document.getElementById("personModalTitle").textContent=idx==null?"إضافة فرد":"تعديل فرد";
    if(idx!=null && data[idx]) restorePersonFormValues(data[idx]);
    else updatePersonAge();
    document.getElementById("personModal").classList.add("show");
  };
  window.fillPerson=function(r){
    patchPersonForm();
    restorePersonFormValues(r);
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
    const missing=data.filter(r=>!filled(r["اسم الفرد"])||!filled(r["رقم هوية الفرد"])||!filled(r["صلة القرابة"])||!filled(r["الجنس"])||!filled(r["الحالة الاجتماعية"])||(!filled(r["تاريخ الميلاد"])&&!filled(r["العمر التقريبي"]))).length;
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
    if(appReadOnly===true){toast('جهاز العرض للقراءة فقط؛ التسجيل من الجهاز الرئيسي');return;}
    const scope=document.getElementById('bulkRegScope').value,type=distNorm(document.getElementById('bulkRegType').value),qty=Number(document.getElementById('bulkRegQty').value||1),unit=distNorm(document.getElementById('bulkRegUnit').value),date=document.getElementById('bulkRegDate').value||distToday(),by=document.getElementById('bulkRegBy').value;
    if(!type){toast('اكتب نوع المساعدة أولاً');return}if(!bulkRegSelected.size){toast('حدد مستفيداً واحداً على الأقل');return}if(!Number.isFinite(qty)||qty<=0){toast('الكمية يجب أن تكون أكبر من صفر');return}if(!distValidDate(date)){toast('تحقق من تاريخ التوزيع');return}if(!by){toast('اختر الجهة أو المسؤول الذي سلّم المساعدة');return}
    const all=bulkUniverse(scope,''),map=new Map(all.map(x=>[x.key,x])),before=distributions.slice();let n=0,skipped=0;const stamp=Date.now();
    for(const key of bulkRegSelected){const x=map.get(key);if(!x)continue;const bt=scope==='families'?'عائلة':scope==='children'?'طفل':'فرد';const draft={beneficiaryType:bt,beneficiaryName:x.name,personId:scope==='families'?'':x.id,familyId:scope==='families'?x.id:x.fid,familyName:x.family,type};if(distCampaignFindDuplicate(draft,'')){skipped++;continue}distributions.push({id:distId(),...draft,quantity:qty,unit,date,reference:'DST-'+stamp.toString().slice(-8)+'-'+(n+1),distributedBy:by,notes:'تسجيل جماعي',workflowStatus:'تم التسليم',registeredAt:stamp,approvedAt:stamp,deliveredAt:stamp,updatedAt:stamp});n++}
    try{distSave()}catch(e){distributions=before;toast('تعذر الحفظ على الهاتف؛ أُلغيت العملية الجماعية');return}closeDistBulkRegisterModal();renderDistributions();toast('تم تسليم '+n+' سجل'+(skipped?'، وتجاوز '+skipped+' مكرر حسب العائلة ونوع المساعدة':''));distSyncSoon();
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
        if(!distSearchNorm(head+' '+fid).includes(q))continue;
        const key='f|'+(fid||distSearchNorm(head));
        if(!candidates.has(key))candidates.set(key,{kind:'عائلة',name:head,head,pid:'',fid});
      }else{
        if(!distSearchNorm(name+' '+head+' '+pid+' '+fid).includes(q))continue;
        const key=pid?('p|'+distSearchNorm(pid)):('f|'+(fid||distSearchNorm(head)));
        if(!candidates.has(key))candidates.set(key,{kind:pid?'فرد':'عائلة',name:pid?name:head,head,pid,fid});
      }
    }
    const isReceived=d=>typeof window.distCampaignIsReceived==='function'?window.distCampaignIsReceived(d):(!d?.workflowStatus||['تم التسليم','تم التسجيل والاعتماد والتسليم','تم الاستلام','مستلم','received','delivered'].includes(distSearchNorm(d.workflowStatus)));
    const sameFamily=(c,d)=>{
      const cf=String(c.fid||'').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase(),df=String(d.familyId||'').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
      if(cf&&df)return cf===df;
      const cn=distSearchNorm(c.head||c.name),dn=distSearchNorm(d.familyName||(d.beneficiaryType==='عائلة'?d.beneficiaryName:''));
      return !!cn&&cn===dn;
    };
    const arr=[...candidates.values()].slice(0,100).map(c=>{
      const got=distributions.filter(d=>sameFamily(c,d)&&isReceived(d)&&(!selectedType||distSearchNorm(d.type)===distSearchNorm(selectedType)))
        .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
      const receivedTypes=[...new Set(got.map(x=>String(x.type||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
      return {...c,got,receivedTypes};
    }).filter(c=>c.got.length>0).slice(0,20);
    panel.innerHTML=arr.length?`<div class="dist-beneficiary-head"><div><b>سجلات الاستلام المؤكدة</b><span>تظهر هنا المساعدات التي تم تسليمها فقط.</span></div><span class="badge">${arr.length} نتيجة</span></div><div class="dist-beneficiary-grid">${arr.map(c=>`<div class="dist-beneficiary-card"><div class="dist-beneficiary-title"><div><b>${escv(c.name)}</b><small>${escv(c.kind)} • رب الأسرة: ${escv(c.head||c.name)}${c.pid?' • هوية: '+escv(c.pid):''}</small></div><span class="dist-main-status received">تم الاستلام</span></div><div class="dist-help-chips">${c.receivedTypes.map(t=>`<span class="dist-help-chip yes"><i></i>${escv(t)} — تم الاستلام</span>`).join('')}</div><div class="dist-beneficiary-history">${c.got.slice(0,4).map(d=>`<span>${escv(d.date||'')} • ${escv(d.type)} • ${escv(d.quantity)} ${escv(d.unit||'')}</span>`).join('')}</div></div>`).join('')}</div>`:'<div class="dist-beneficiary-empty">لا توجد سجلات استلام مؤكدة لهذا البحث.</div>';
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


/* V58 — Campaign-level assistance deduplication + direct register/approve/deliver workflow.
   Only distribution records are changed. Existing family records and sync protocol remain untouched. */
(function(){
  // Canonical comparison for Arabic family names, national IDs and aid labels.
  // Keep this limited to campaign matching; stored values are never rewritten.
  const campaignNorm = value => String(value ?? '').normalize('NFKC').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[ًٌٍَُِّْـٰ]/g,'')
    .replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
    .replace(/[ـ\u200e\u200f\u202a-\u202e]/g,'')
    .replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim().toLowerCase();
  const campaignIdNorm = value => String(value ?? '').normalize('NFKC')
    .replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
  function familyIdentity(record){
    const fid=campaignIdNorm(record?.familyId);
    if(fid) return 'id:'+fid;
    const head=campaignNorm(record?.familyName || (record?.beneficiaryType==='عائلة'?record?.beneficiaryName:''));
    return head ? 'name:'+head : '';
  }
  function isCampaignCancelled(record){
    const status=campaignNorm(record?.workflowStatus || record?.statusLabel || '');
    return status==='ملغي' || status==='ملغى' || status==='ملغاه' || status==='الغاء' || status==='cancelled' || status==='canceled';
  }
  function resolveFamily(record){
    const out={...record};
    if(campaignNorm(out.familyId)) return out;
    const pid=campaignIdNorm(out.personId), name=campaignNorm(out.beneficiaryName), head=campaignNorm(out.familyName);
    const rows=Array.isArray(data)?data:[];
    let match=null;
    if(head && pid) match=rows.find(r=>campaignNorm(r['اسم رب الأسرة'])===head && campaignIdNorm(r['رقم هوية الفرد'])===pid);
    if(!match && head) match=rows.find(r=>campaignNorm(r['اسم رب الأسرة'])===head);
    if(!match && pid) match=rows.find(r=>campaignIdNorm(r['رقم هوية الفرد'])===pid);
    if(!match && name && out.beneficiaryType!=='عائلة') match=rows.find(r=>campaignNorm(r['اسم الفرد'])===name && (!head || campaignNorm(r['اسم رب الأسرة'])===head));
    if(!match && name && out.beneficiaryType==='عائلة') match=rows.find(r=>campaignNorm(r['اسم رب الأسرة'])===name);
    if(match){out.familyId=String(match['رقم هوية الأسرة']||out.familyId||'').trim();out.familyName=String(match['اسم رب الأسرة']||out.familyName||'').trim();}
    return out;
  }
  function findDuplicate(record, excludeId){
    const candidate=resolveFamily(record), familyKey=familyIdentity(candidate), typeKey=campaignNorm(candidate.type);
    if(!familyKey || !typeKey) return null;
    return (Array.isArray(distributions)?distributions:[]).find(d=>d.id!==excludeId && campaignNorm(d.type)===typeKey && familyIdentity(resolveFamily(d))===familyKey && !isCampaignCancelled(d)) || null;
  }
  window.distCampaignFindDuplicate=findDuplicate;
  // Coverage is family-based for every beneficiary scope, matching the campaign's one-aid-type-per-family rule.
  window.distCoverageUniverse=function(scope){
    const familyKeyOfRow=r=>{const id=campaignIdNorm(r?.['رقم هوية الأسرة']);if(id)return 'id:'+id;const head=campaignNorm(r?.['اسم رب الأسرة']);return head?'name:'+head:''};
    if(scope==='families'){
      const groups=new Map();(data||[]).forEach(r=>{const fk=familyKeyOfRow(r);if(!fk||groups.has(fk))return;groups.set(fk,{key:fk,familyKey:fk,name:distNorm(r['اسم رب الأسرة']),familyName:distNorm(r['اسم رب الأسرة']),id:distNorm(r['رقم هوية الأسرة']),familyId:distNorm(r['رقم هوية الأسرة']),age:''})});return [...groups.values()];
    }
    const people=new Map();(data||[]).forEach(r=>{const age=Number(r['العمر التقريبي']);if(scope==='children'&&(!Number.isFinite(age)||age>=18))return;const name=distNorm(r['اسم الفرد']);if(!name)return;const pk=distCoverageKeyPerson(r);if(people.has(pk))return;const fk=familyKeyOfRow(r);people.set(pk,{key:pk,familyKey:fk,name,familyName:distNorm(r['اسم رب الأسرة']),familyId:distNorm(r['رقم هوية الأسرة']),id:distNorm(r['رقم هوية الفرد']),age:Number.isFinite(age)?age:''})});return [...people.values()];
  };
  window.distCoverageReceived=function(scope,type){
    const result=new Map();if(!type)return result;
    const eligible=(distributions||[]).filter(x=>campaignNorm(x.type)===campaignNorm(type)).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    const byFamily=new Map();for(const d of eligible){const resolved=resolveFamily(d),fk=familyIdentity(resolved);if(fk&&!byFamily.has(fk))byFamily.set(fk,d)}
    for(const person of window.distCoverageUniverse(scope)){const fk=person.familyKey||familyIdentity({familyId:person.familyId,familyName:person.familyName});const rec=byFamily.get(fk);if(rec)result.set(person.key,{date:rec.date||'',quantity:rec.quantity,reference:rec.reference});}
    return result;
  };
  window.saveDistribution=function(){
    if(appReadOnly===true){toast('جهاز العرض للقراءة فقط؛ التسجيل من الجهاز الرئيسي');return;}
    const id=document.getElementById('distId')?.value||distId();
    let obj=resolveFamily({id,beneficiaryType:distNorm(document.getElementById('distBeneficiaryForm')?.value),beneficiaryName:distNorm(document.getElementById('distName')?.value),personId:distNorm(document.getElementById('distPersonId')?.value),familyId:distNorm(document.getElementById('distFamilyId')?.value),familyName:distNorm(document.getElementById('distFamilyName')?.value),type:distNorm(document.getElementById('distTypeForm')?.value),quantity:Number(document.getElementById('distQty')?.value||1),unit:distNorm(document.getElementById('distUnit')?.value),date:document.getElementById('distDate')?.value||distToday(),reference:distNorm(document.getElementById('distRef')?.value),distributedBy:distNorm(document.getElementById('distBy')?.value),notes:distNorm(document.getElementById('distNotes')?.value)});
    if(!obj.beneficiaryName||!obj.type){toast('أدخل اسم المستفيد ونوع المساعدة');return;}
    if(!obj.familyId && !obj.familyName){toast('تعذر تحديد العائلة. اختر المستفيد من نتائج البحث أو أدخل رب الأسرة');return;}
    if(!Number.isFinite(obj.quantity)||obj.quantity<=0){toast('الكمية يجب أن تكون أكبر من صفر');return;}
    if(!distValidDate(obj.date)){toast('أدخل تاريخ تسليم صحيحاً');return;}
    if(!obj.distributedBy){toast('حدّد المسؤول أو الجهة التي سلّمت المساعدة لتوثيق العملية');return;}
    const duplicate=findDuplicate(obj,id);
    if(duplicate){toast('ممنوع التكرار: هذه العائلة مسجل لها نوع المساعدة نفسه ('+obj.type+') بالمرجع '+(duplicate.reference||'—'));return;}
    const old=distributions.find(x=>x.id===id), stamp=Date.now(), before=distributions.slice();
    obj={...obj,workflowStatus:'تم التسليم',registeredAt:old?.registeredAt||stamp,approvedAt:old?.approvedAt||stamp,deliveredAt:old?.deliveredAt||stamp,updatedAt:stamp};
    const i=distributions.findIndex(x=>x.id===id);if(i<0)distributions.push(obj);else distributions[i]=obj;
    try{distSave();}catch(e){distributions=before;toast('تعذر الحفظ على الهاتف؛ أُلغيت العملية ولم تُعتمد');return;}
    closeDistributionModal();renderDistributions();toast('تم التسجيل والاعتماد والتسليم بنجاح');distSyncSoon();
  };
  const priorRender=window.renderDistributions;
  window.renderDistributions=function(){
    priorRender();
    const table=document.querySelector('#distributions .dist-table');
    const head=table?.querySelector('thead tr');
    if(head&&!head.querySelector('[data-campaign-status-head]')){const th=document.createElement('th');th.dataset.campaignStatusHead='1';th.textContent='حالة العملية';const actions=head.lastElementChild;if(actions)head.insertBefore(th,actions);else head.appendChild(th);}
    document.querySelectorAll('#distTbody tr').forEach(tr=>{
      if(tr.querySelector('[data-campaign-status-cell]'))return;
      const edit=tr.querySelector('button[onclick^="openDistributionModal("]');
      const match=edit?.getAttribute('onclick')?.match(/openDistributionModal\('([^']+)'\)/);
      const rec=match?(distributions||[]).find(x=>x.id===match[1]):null;
      const td=document.createElement('td');td.dataset.campaignStatusCell='1';
      if(rec?.workflowStatus==='تم التسليم') td.innerHTML='<span class="dist-workflow-pill done">تم التسجيل والاعتماد والتسليم</span><small class="dist-workflow-date">'+String(rec.deliveredAt?new Date(rec.deliveredAt).toLocaleDateString('ar-EG'):rec.date||'')+'</small>';
      else td.innerHTML='<span class="dist-workflow-pill legacy">سجل سابق</span>';
      const actions=tr.lastElementChild;if(actions)tr.insertBefore(td,actions);else tr.appendChild(td);
    });
  };
  const priorExport=window.exportDistributionsExcel;
  window.exportDistributionsExcel=function(){
    const q=campaignNorm(document.getElementById('distQ')?.value),bt=document.getElementById('distBeneficiary')?.value||'',ty=document.getElementById('distType')?.value||'',from=document.getElementById('distFrom')?.value||'',to=document.getElementById('distTo')?.value||'';
    const rows=(distributions||[]).filter(x=>{const blob=campaignNorm([x.beneficiaryName,x.familyName,x.type,x.reference,x.notes,x.personId,x.familyId].join(' '));return(!q||blob.includes(q))&&(!bt||x.beneficiaryType===bt)&&(!ty||x.type===ty)&&(!from||x.date>=from)&&(!to||x.date<=to)}).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    if(!rows.length){toast('لا توجد توزيعات مطابقة للتصدير');return;}
    const headers=['#','التاريخ','نوع المستفيد','اسم المستفيد','رقم هوية الفرد','رقم هوية الأسرة','رب الأسرة','نوع المساعدة','الكمية','الوحدة','رقم المرجع','تم بواسطة','حالة العملية','وقت التسجيل','وقت الاعتماد','وقت التسليم','ملاحظات'];
    const stamp=v=>v?new Date(Number(v)).toLocaleString('ar-EG'):'';
    const matrix=[['سجل توزيعات مخيم أبو عريبان'],['التسجيل والاعتماد والتسليم المباشر — منع التكرار حسب العائلة ونوع المساعدة'],['تاريخ التصدير: '+new Date().toLocaleString('ar-EG')],[],headers];
    rows.forEach((x,i)=>matrix.push([i+1,x.date||'',x.beneficiaryType||'',x.beneficiaryName||'',x.personId||'',x.familyId||'',x.familyName||'',x.type||'',x.quantity??'',x.unit||'',x.reference||'',x.distributedBy||'',x.workflowStatus||'سجل سابق',stamp(x.registeredAt),stamp(x.approvedAt),stamp(x.deliveredAt),x.notes||'']));
    try{downloadXLSX(matrix,'توزيعات_مخيم_أبو_عريبان_'+dateStamp()+'.xlsx',{headerRow:5,title:'سجل توزيعات مخيم أبو عريبان'});toast('تم تصدير سجل التوزيعات مع حالة الاعتماد والتسليم');}catch(e){console.error(e);toast('تعذر تصدير Excel: '+(e?.message||'خطأ غير معروف'));}
  };
})();


/* V59 — Cross-application operations center, global search and live local/sync health.
   Additive UI layer only: preserves existing storage keys, API routes, D1 schema and project layout. */
(function(){
  'use strict';
  const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[ًٌٍَُِّْـ]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ـ/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  const txt = value => String(value ?? '').trim();
  const escText = value => typeof window.esc === 'function' ? window.esc(String(value ?? '')) : String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let palette, input, resultBox, statusNode, statusTimer, activeResults=[], selectedIndex=0;
  function ready(fn){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',fn,{once:true}); else fn(); }
  function installStyles(){
    const s=document.createElement('style'); s.id='v59-global-ops-style'; s.textContent=`
      .v59-header-tools{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
      .v59-search-open{display:inline-flex;align-items:center;gap:8px;white-space:nowrap}
      .v59-shortcut{font-size:10px;opacity:.72;border:1px solid currentColor;border-radius:5px;padding:1px 5px;direction:ltr}
      .v59-system-chip{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border-radius:999px;background:var(--bg,#f5f7fb);border:1px solid var(--line,#e5e7eb);font-size:11px;font-weight:800;color:var(--text,#172033)}
      .v59-system-dot{width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 0 3px #10b98120}.v59-system-chip[data-state="offline"] .v59-system-dot{background:#f59e0b;box-shadow:0 0 0 3px #f59e0b22}.v59-system-chip[data-state="pending"] .v59-system-dot{background:#f97316;box-shadow:0 0 0 3px #f9731622}
      .v59-ops-panel{margin:16px 0 4px;padding:16px;border:1px solid var(--line,#e5e7eb);border-radius:18px;background:var(--card,#fff);box-shadow:var(--shadow,0 8px 30px #0f172a0a)}
      .v59-ops-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}.v59-ops-head h2{margin:0;font-size:16px}.v59-ops-head p{margin:4px 0 0;color:var(--muted,#64748b);font-size:11px}
      .v59-ops-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px}.v59-op{display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;gap:12px;min-height:90px;padding:12px;border:1px solid var(--line,#e5e7eb);border-radius:13px;background:var(--bg,#f8fafc);color:var(--text,#172033);text-align:right;cursor:pointer;transition:transform .16s,border-color .16s}.v59-op:hover{transform:translateY(-2px);border-color:var(--primary,#2563eb)}.v59-op-icon{font-size:22px}.v59-op strong{font-size:12px}.v59-op small{font-size:10px;color:var(--muted,#64748b);line-height:1.4}
      .v59-ops-status{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.v59-health{padding:10px 12px;border-radius:12px;background:var(--bg,#f8fafc);border:1px solid var(--line,#e5e7eb);display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11px}.v59-health b{font-size:12px}
      .v59-palette{position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.58);backdrop-filter:blur(5px);display:none;align-items:flex-start;justify-content:center;padding: min(12vh,90px) 14px 20px}.v59-palette.open{display:flex}.v59-palette-box{width:min(720px,100%);max-height:78vh;overflow:hidden;background:var(--card,#fff);color:var(--text,#172033);border:1px solid var(--line,#e5e7eb);border-radius:20px;box-shadow:0 30px 100px #0004;display:flex;flex-direction:column}.v59-palette-top{padding:14px;border-bottom:1px solid var(--line,#e5e7eb)}.v59-palette-input{width:100%;border:0;outline:0;background:transparent;color:inherit;font:inherit;font-size:17px;padding:6px}.v59-palette-hint{font-size:11px;color:var(--muted,#64748b);padding:0 6px 4px}.v59-palette-results{overflow:auto;padding:8px;min-height:90px}.v59-result{width:100%;display:flex;align-items:center;gap:12px;text-align:right;border:1px solid transparent;border-radius:12px;padding:11px;background:transparent;color:inherit;cursor:pointer}.v59-result:hover,.v59-result.active{background:var(--bg,#f8fafc);border-color:var(--primary,#2563eb)}.v59-result-icon{width:38px;height:38px;flex:0 0 38px;border-radius:11px;display:grid;place-items:center;background:var(--bg,#eef2ff);font-size:18px}.v59-result-main{flex:1;min-width:0}.v59-result-main b{display:block;font-size:13px;overflow-wrap:anywhere}.v59-result-main small{display:block;color:var(--muted,#64748b);font-size:11px;margin-top:3px;overflow-wrap:anywhere}.v59-result-type{font-size:10px;color:var(--muted,#64748b);white-space:nowrap}.v59-palette-empty{text-align:center;padding:26px 12px;color:var(--muted,#64748b);font-size:12px}.v59-palette-foot{padding:9px 14px;border-top:1px solid var(--line,#e5e7eb);font-size:10px;color:var(--muted,#64748b);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
      @media(max-width:1050px){.v59-ops-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.v59-system-chip{display:none}}
      @media(max-width:640px){.v59-ops-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.v59-ops-panel{padding:12px}.v59-ops-status{grid-template-columns:1fr}.v59-palette{padding-top:5vh}.v59-palette-box{max-height:88vh}.v59-palette-input{font-size:16px}.v59-result-type{display:none}.v59-shortcut{display:none}}
      @media(prefers-reduced-motion:reduce){.v59-op{transition:none}.v59-op:hover{transform:none}}
    `; document.head.appendChild(s);
  }
  function installPalette(){
    palette=document.createElement('div'); palette.className='v59-palette'; palette.id='v59Palette'; palette.setAttribute('aria-hidden','true');
    palette.innerHTML=`<section class="v59-palette-box" role="dialog" aria-modal="true" aria-label="البحث الشامل والتنقل السريع"><div class="v59-palette-top"><input class="v59-palette-input" id="v59PaletteInput" type="search" autocomplete="off" placeholder="ابحث عن عائلة أو فرد أو رقم هوية أو توزيع…" aria-label="البحث الشامل"/><div class="v59-palette-hint">اكتب حرفين على الأقل للبحث في سجلات المخيم والتوزيعات.</div></div><div class="v59-palette-results" id="v59PaletteResults"><div class="v59-palette-empty">ابحث بالاسم أو رقم الهوية أو الجوال أو رقم مرجع التوزيع.</div></div><div class="v59-palette-foot"><span>↑ ↓ للتنقل · Enter للفتح · Esc للإغلاق</span><span>Ctrl / ⌘ + K لفتح البحث</span></div></section>`;
    document.body.appendChild(palette); input=palette.querySelector('#v59PaletteInput'); resultBox=palette.querySelector('#v59PaletteResults');
    palette.addEventListener('click',e=>{if(e.target===palette)closePalette()});
    input.addEventListener('input',renderSearchResults);
    input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();selectResult(Math.min(activeResults.length-1,selectedIndex+1))}else if(e.key==='ArrowUp'){e.preventDefault();selectResult(Math.max(0,selectedIndex-1))}else if(e.key==='Enter'){e.preventDefault();activateResult(activeResults[selectedIndex])}else if(e.key==='Escape'){e.preventDefault();closePalette()}});
  }
  function openPalette(){if(!palette)return;palette.classList.add('open');palette.setAttribute('aria-hidden','false');input.value='';activeResults=[];selectedIndex=0;resultBox.innerHTML='<div class="v59-palette-empty">ابحث بالاسم أو رقم الهوية أو الجوال أو رقم مرجع التوزيع.</div>';setTimeout(()=>input.focus(),20)}
  function closePalette(){if(!palette)return;palette.classList.remove('open');palette.setAttribute('aria-hidden','true')}
  function pushResult(arr,item){if(arr.length<35)arr.push(item)}
  function renderSearchResults(){
    const q=norm(input.value); activeResults=[];selectedIndex=0;
    if(q.length<2){resultBox.innerHTML='<div class="v59-palette-empty">اكتب حرفين على الأقل لبدء البحث.</div>';return}
    const arr=[];
    try{
      const fm=typeof familyMap==='function'?familyMap():new Map();
      for(const [head,rows] of fm){const r=rows[0]||{}, blob=norm([head,r['رقم هوية الأسرة'],r['رقم الجوال'],r['رقم جوال بديل'],r['العنوان']].join(' '));if(blob.includes(q)){pushResult(arr,{kind:'family',icon:'👨‍👩‍👧',title:'عائلة '+head,sub:'هوية الأسرة: '+(r['رقم هوية الأسرة']||'—')+' · الجوال: '+(r['رقم الجوال']||'—')+' · '+rows.length+' سجل',familyId:String(r['رقم هوية الأسرة']||''),head,score:blob.startsWith(q)?0:1})}}
      const seenPeople=new Set();
      (Array.isArray(data)?data:[]).forEach((r,index)=>{const name=txt(r['اسم الفرد']),head=txt(r['اسم رب الأسرة']);if(!name)return;const key=norm([name,head,r['رقم هوية الفرد']].join('|'));if(seenPeople.has(key))return;seenPeople.add(key);const blob=norm([name,head,r['رقم هوية الفرد'],r['رقم الجوال'],r['العنوان'],r['صلة القرابة']].join(' '));if(blob.includes(q))pushResult(arr,{kind:'person',icon:'👤',title:name,sub:(r['صلة القرابة']||'فرد')+' · رب الأسرة: '+(head||'—')+' · الهوية: '+(r['رقم هوية الفرد']||'—'),familyId:String(r['رقم هوية الأسرة']||''),head,index,score:blob.startsWith(q)?0:2})});
      (Array.isArray(distributions)?distributions:[]).forEach(d=>{const blob=norm([d.beneficiaryName,d.familyName,d.familyId,d.personId,d.type,d.reference,d.distributedBy,d.notes].join(' '));if(blob.includes(q))pushResult(arr,{kind:'distribution',icon:'📦',title:(d.type||'توزيع')+' — '+(d.beneficiaryName||d.familyName||'مستفيد'),sub:'التاريخ: '+(d.date||'—')+' · رب الأسرة: '+(d.familyName||'—')+' · المرجع: '+(d.reference||'—'),query:txt(d.reference||d.beneficiaryName||d.type),score:blob.startsWith(q)?0:3})});
    }catch(e){console.warn('V59 global search:',e)}
    arr.sort((a,b)=>a.score-b.score||a.title.localeCompare(b.title,'ar'));activeResults=arr.slice(0,35);
    if(!activeResults.length){resultBox.innerHTML='<div class="v59-palette-empty">ما لقينا نتائج مطابقة. جرّب الاسم بدون همزات أو رقم الهوية.</div>';return}
    resultBox.innerHTML=activeResults.map((r,i)=>`<button type="button" class="v59-result${i===0?' active':''}" data-v59-result="${i}"><span class="v59-result-icon">${r.icon}</span><span class="v59-result-main"><b>${escText(r.title)}</b><small>${escText(r.sub)}</small></span><span class="v59-result-type">${r.kind==='family'?'عائلة':r.kind==='person'?'فرد':'توزيع'}</span></button>`).join('');
    resultBox.querySelectorAll('[data-v59-result]').forEach(b=>b.addEventListener('mouseenter',()=>selectResult(Number(b.dataset.v59Result))));
    resultBox.querySelectorAll('[data-v59-result]').forEach(b=>b.addEventListener('click',()=>activateResult(activeResults[Number(b.dataset.v59Result)])));
  }
  function selectResult(i){if(!activeResults.length)return;selectedIndex=Math.max(0,Math.min(activeResults.length-1,i));resultBox.querySelectorAll('[data-v59-result]').forEach((b,n)=>{b.classList.toggle('active',n===selectedIndex);if(n===selectedIndex)b.scrollIntoView({block:'nearest'})})}
  function activateResult(r){if(!r)return;closePalette();if(r.kind==='family'||r.kind==='person'){
      showView('familySearch');const search=document.getElementById('familySearchInput');if(search){search.value=r.familyId||r.head||r.title;if(typeof runFamilySearch==='function')runFamilySearch();}
      if(r.familyId&&typeof showFamilyCard==='function')setTimeout(()=>showFamilyCard(r.familyId),80);
      else if(r.kind==='person'&&typeof editPerson==='function'&&appReadOnly!==true)setTimeout(()=>editPerson(r.index),80);
    }else{showView('distributions');const q=document.getElementById('distQ');if(q){q.value=r.query||r.title;if(typeof renderDistributions==='function')renderDistributions()}}
  }
  function installHeaderTools(){
    const actions=document.querySelector('.top .actions');if(!actions)return;
    const box=document.createElement('div');box.className='v59-header-tools no-print';
    const btn=document.createElement('button');btn.type='button';btn.className='btn v59-search-open';btn.innerHTML='⌕ بحث شامل <span class="v59-shortcut">Ctrl K</span>';btn.addEventListener('click',openPalette);
    statusNode=document.createElement('button');statusNode.type='button';statusNode.className='v59-system-chip';statusNode.title='فتح مركز المزامنة وحالة النظام';statusNode.innerHTML='<span class="v59-system-dot"></span><span id="v59SystemLabel">فحص النظام…</span>';statusNode.addEventListener('click',()=>showView('syncCenter'));
    box.append(btn,statusNode);actions.prepend(box);
  }
  function installOperationsPanel(){
    const stats=document.querySelector('#dashboard .grid.stats');if(!stats||document.getElementById('v59OpsPanel'))return;
    const panel=document.createElement('section');panel.className='v59-ops-panel no-print';panel.id='v59OpsPanel';panel.setAttribute('aria-label','مركز العمليات السريع');
    panel.innerHTML=`<div class="v59-ops-head"><div><h2>مركز العمليات السريع</h2><p>أهم مهام إدارة المخيم في مكان واحد — وصول مباشر بدون التنقل بين الصفحات.</p></div><span class="badge">اختصارات الإدارة</span></div><div class="v59-ops-grid">
      <button type="button" class="v59-op" data-v59-action="add-family"><span class="v59-op-icon">＋</span><strong>إضافة عائلة</strong><small>تسجيل أسرة جديدة</small></button>
      <button type="button" class="v59-op" data-v59-action="search"><span class="v59-op-icon">⌕</span><strong>بحث شامل</strong><small>عائلات وأفراد وتوزيعات</small></button>
      <button type="button" class="v59-op" data-v59-action="distribution"><span class="v59-op-icon">📦</span><strong>إدارة التوزيعات</strong><small>تسجيل ومتابعة الاستفادة</small></button>
      <button type="button" class="v59-op" data-v59-action="reports"><span class="v59-op-icon">▤</span><strong>الكشوفات</strong><small>تقارير وتصدير البيانات</small></button>
      <button type="button" class="v59-op" data-v59-action="quality"><span class="v59-op-icon">✓</span><strong>جودة البيانات</strong><small>فحص النواقص والتكرار</small></button>
      <button type="button" class="v59-op" data-v59-action="backup"><span class="v59-op-icon">⤓</span><strong>نسخة احتياطية</strong><small>حفظ نسخة من البيانات</small></button>
      </div><div class="v59-ops-status"><div class="v59-health"><span>حالة الاتصال</span><b id="v59OpsNetwork">—</b></div><div class="v59-health"><span>تعديلات بانتظار المزامنة</span><b id="v59OpsPending">—</b></div><div class="v59-health"><span>سجلات العائلات والأفراد</span><b id="v59OpsRecords">—</b></div></div>`;
    stats.insertAdjacentElement('afterend',panel);
    panel.querySelectorAll('[data-v59-action]').forEach(b=>b.addEventListener('click',()=>{
      const a=b.dataset.v59Action;
      if(a==='add-family'){if(appReadOnly===true){if(typeof toast==='function')toast('جهاز العرض للقراءة فقط');return}openFamilyModal()}
      else if(a==='search')openPalette();else if(a==='distribution')showView('distributions');else if(a==='reports')showView('classified');else if(a==='quality')openQualityModal();else if(a==='backup')backup();
    }));
  }
  function refreshHealth(){
    const online=navigator.onLine, pending=(()=>{let n=0;try{if(typeof syncLoadPending==='function')n+=syncLoadPending().length}catch(e){}try{if(typeof distLoadPending==='function')n+=distLoadPending().length}catch(e){}return n})();
    if(statusNode){statusNode.dataset.state=!online?'offline':pending?'pending':'online';const label=statusNode.querySelector('#v59SystemLabel');if(label)label.textContent=!online?'دون اتصال':pending?`مزامنة معلقة: ${pending}`:'متصل · لا توجد تعديلات معلقة';}
    const n=document.getElementById('v59OpsNetwork');if(n)n.textContent=online?'متصل بالإنترنت':'دون اتصال';
    const p=document.getElementById('v59OpsPending');if(p)p.textContent=String(pending).replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[+d]);
    const r=document.getElementById('v59OpsRecords');if(r){let fam=0;try{fam=typeof familyMap==='function'?familyMap().size:0}catch(e){}r.textContent=`${fam.toLocaleString('ar-EG')} عائلة · ${(Array.isArray(data)?data.length:0).toLocaleString('ar-EG')} فرد/سجل`}
  }
  ready(()=>{
    try{installStyles();installPalette();installHeaderTools();installOperationsPanel();refreshHealth();window.addEventListener('online',refreshHealth);window.addEventListener('offline',refreshHealth);window.addEventListener('storage',refreshHealth);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshHealth()});statusTimer=setInterval(refreshHealth,8000);
      document.addEventListener('keydown',e=>{const key=String(e.key||'').toLowerCase(),mod=e.ctrlKey||e.metaKey;const target=e.target;const editing=target&&(target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));if(mod&&key==='k'){e.preventDefault();openPalette();return}if(key==='escape'&&palette?.classList.contains('open')){e.preventDefault();closePalette();return}if(!editing&&!mod&&!e.altKey&&key==='/'){e.preventDefault();openPalette();return}if(!editing&&e.altKey&&/^[1-8]$/.test(key)){const ids=['dashboard','familySearch','families','distributions','records','classified','syncCenter','settings'];showView(ids[Number(key)-1]);}});
      document.addEventListener('click',e=>{if(e.target.closest('.tab,.mobile-bottom-nav'))setTimeout(refreshHealth,100)});
      
    }catch(e){console.error('V59 global operations layer:',e)}
  });
  function panelButton(action){return document.querySelector(`[data-v59-action="${action}"]`)}
})();



/* V61 — Hardened campaign eligibility, identity normalization and audit warnings.
   Additive to the existing local-first distribution store and existing sync endpoints. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const norm=v=>String(v??'').normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[ًٌٍَُِّْـٰ]/g,'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[ـ\u200e\u200f\u202a-\u202e]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim().toLowerCase();
 const idNorm=v=>String(v??'').normalize('NFKC').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
 let chosenFamily=null;
 function familyRows(){const m=new Map();for(const r of (data||[])){const id=String(r['رقم هوية الأسرة']||'').trim(),name=String(r['اسم رب الأسرة']||'').trim(),key=id?'id:'+idNorm(id):(name?'name:'+norm(name):'');if(!key)continue;if(!m.has(key))m.set(key,{key,id,name,rows:[]});m.get(key).rows.push(r)}return [...m.values()].map(f=>{const head=f.rows.find(r=>norm(r['صلة القرابة'])===norm('رب الأسرة'))||f.rows[0];return {...f,name:f.name||String(head['اسم رب الأسرة']||'').trim(),id:f.id||String(head['رقم هوية الأسرة']||'').trim(),members:f.rows.length}}).filter(f=>f.name)}
 function familyForDistribution(f,type){return {id:'',familyId:f.id,familyName:f.name,beneficiaryType:'عائلة',beneficiaryName:f.name,type:String(type??'').trim()}}
 function sameFamilyRecord(f,d){const a=idNorm(f.id),b=idNorm(d.familyId),an=norm(f.name),bn=norm(d.familyName||(d.beneficiaryType==='عائلة'?d.beneficiaryName:''));if(a&&b&&a===b)return true;return (!a||!b)&&!!an&&an===bn}
 function duplicateFor(f,type){if(!f||!type)return null;const active=(distributions||[]).filter(d=>norm(d.type)===norm(type)&&!['ملغي','ملغى','ملغاه','الغاء','canceled','cancelled'].includes(norm(d.workflowStatus||d.statusLabel)));return window.distCampaignFindDuplicate(familyForDistribution(f,type),'')||active.find(d=>sameFamilyRecord(f,d))||null}
 function summary(type){const el=$('distCampaignTypeSummary');if(!el)return;if(!type){el.innerHTML='';return}const fam=familyRows(),received=new Set(),byFamily=new Map();for(const f of fam){const rec=duplicateFor(f,type);if(rec)received.add(f.key)}for(const d of (distributions||[])){if(norm(d.type)!==norm(type)||['ملغي','ملغى','ملغاه','الغاء','canceled','cancelled'].includes(norm(d.workflowStatus||d.statusLabel)))continue;const key=idNorm(d.familyId)?'id:'+idNorm(d.familyId):'name:'+norm(d.familyName||(d.beneficiaryType==='عائلة'?d.beneficiaryName:''));if(key&&key!=='name:')byFamily.set(key,(byFamily.get(key)||0)+1)}const legacyDuplicates=[...byFamily.values()].reduce((n,count)=>n+Math.max(0,count-1),0),total=fam.length,got=received.size;const cards=[['إجمالي العائلات',total],['استفادت من هذا النوع',got],['ما زالت مستحقة',Math.max(0,total-got)],['تكرارات قديمة للمراجعة',legacyDuplicates]];el.innerHTML=cards.map(([label,n],i)=>`<div class="dist-campaign-summary-item${i===3&&n?' warning':''}"><span>${label}</span><b>${Number(n).toLocaleString('ar')}</b></div>`).join('')+(legacyDuplicates?'<p class="dist-campaign-legacy-warning">تم رصد سجلات مكررة سابقة لهذا النوع. لن نحذفها تلقائياً؛ منع التكرار يطبّق على التسجيلات الجديدة.</p>':'')}
 function setResult(kind,title,detail,button){const el=$('distCampaignCheckResult');if(!el)return;el.className='dist-campaign-result'+(kind?' '+kind:'');el.innerHTML=`<span class="dist-campaign-result-icon">${kind==='is-blocked'?'!':kind==='is-eligible'?'✓':'i'}</span><div><b>${title}</b><p>${detail}</p>${button||''}</div>`}
 function check(f){const type=String($('distCampaignAidType')?.value||'').trim();chosenFamily=f||null;summary(type);if(!f){setResult('', 'اختَر العائلة أولاً','اكتب اسم رب الأسرة أو رقم هوية الأسرة ثم اختر النتيجة الصحيحة.');return}if(!type){setResult('', 'حدّد نوع المساعدة','اختَر نوع المساعدة الذي تريد التحقق منه لهذه العائلة.');return}const dup=duplicateFor(f,type);if(dup){setResult('is-blocked','غير مستحقة لهذا النوع حالياً',`سبق تسجيل «${dup.type}» لهذه العائلة. المرجع: ${dup.reference||'غير مسجل'} • التاريخ: ${dup.date||'غير محدد'}. لا يمكن تكرار نوع المساعدة نفسه للعائلة. `);return}setResult('is-eligible','العائلة مستحقة لهذا النوع',`لم يُعثر على تسجيل سابق لنوع «${type}» لهذه العائلة. عند المتابعة سيتم تسجيل العملية واعتمادها وتسليمها مباشرة.`,`<button type="button" class="btn primary" id="distCampaignProceedBtn">تسجيل المساعدة لهذه العائلة</button>`);$('distCampaignProceedBtn')?.addEventListener('click',()=>{if(appReadOnly===true){toast('جهاز العرض للقراءة فقط؛ التسجيل من الجهاز الرئيسي');return}openDistributionModal();$('distBeneficiaryForm').value='عائلة';$('distName').value=f.name;$('distPersonId').value='';$('distFamilyId').value=f.id;$('distFamilyName').value=f.name;$('distTypeForm').value=type;$('distQty').value='1';$('distRef').value='DST-'+Date.now().toString().slice(-8);$('distName').dispatchEvent(new Event('change',{bubbles:true}));});}
 function matches(){const box=$('distCampaignFamilyMatches'),input=$('distCampaignFamilySearch');if(!box||!input)return;const q=norm(input.value),qi=idNorm(input.value);chosenFamily=null;if(q.length<2){box.innerHTML='';return}const arr=familyRows().map(f=>({...f,score:norm(f.name)===q||idNorm(f.id)===qi?0:(norm(f.name).startsWith(q)||idNorm(f.id).startsWith(qi)?1:2)})).filter(f=>norm(f.name).includes(q)||idNorm(f.id).includes(qi)).sort((a,b)=>a.score-b.score||a.name.localeCompare(b.name,'ar')).slice(0,8);box.innerHTML=arr.map((f,i)=>`<button type="button" class="dist-campaign-match" data-family-index="${i}"><span><b>${String(f.name).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</b><small>هوية الأسرة: ${String(f.id||'غير مسجلة')} • ${f.members} فرد</small></span><span aria-hidden="true">›</span></button>`).join('');const refs=arr;box.querySelectorAll('[data-family-index]').forEach(btn=>btn.addEventListener('click',()=>{const f=refs[Number(btn.dataset.familyIndex)];if(!f)return;chosenFamily=f;input.value=f.name;box.innerHTML='';check(f)}));}
 function init(){if(!$('distCampaignQuickCheck'))return;const input=$('distCampaignFamilySearch'),type=$('distCampaignAidType');input?.addEventListener('input',matches);type?.addEventListener('input',()=>{summary(type.value);if(chosenFamily)check(chosenFamily)});type?.addEventListener('change',()=>{summary(type.value);if(chosenFamily)check(chosenFamily)});$('distCampaignCheckBtn')?.addEventListener('click',()=>{const q=norm(input?.value),qi=idNorm(input?.value),fam=chosenFamily||familyRows().find(f=>norm(f.name)===q||idNorm(f.id)===qi);check(fam||null)});const original=window.renderDistributions;window.renderDistributions=function(){original();const types=[...new Set((distributions||[]).map(x=>String(x.type||'').trim()).filter(Boolean))];const dl=$('distCampaignAidType');if(dl){const current=dl.value;dl.innerHTML='<option value="">اختر نوع المساعدة من السجلات المسجلة</option>';types.sort((a,b)=>a.localeCompare(b,'ar')).forEach(t=>{const o=document.createElement('option');o.value=t;o.textContent=t;dl.appendChild(o)});if(types.includes(current))dl.value=current}summary(type?.value||'')};summary(type?.value||'');}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();


/* V63 — Received-only visibility + stronger campaign integrity.
   Existing local storage keys, D1 schema, sync routes, and project layout are preserved. */
(function(){
 'use strict';
 const norm=v=>String(v??'').normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[ًٌٍَُِّْـٰ]/g,'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[ـ\u200e\u200f\u202a-\u202e]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim().toLowerCase();
 const cancelled=r=>['ملغي','ملغى','ملغاه','الغاء','canceled','cancelled'].includes(norm(r?.workflowStatus||r?.statusLabel||''));
 const received=r=>{if(!r||cancelled(r))return false;const s=norm(r.workflowStatus||r.statusLabel||'');if(!s)return true;return ['تم التسليم','تم التسجيل والاعتماد والتسليم','تم الاستلام','مستلم','received','delivered'].includes(s)};
 window.distCampaignIsReceived=received;
 // Coverage counts and exports are based only on confirmed receipts, never pending or cancelled entries.
 window.distCoverageReceived=function(scope,type){
   const result=new Map();if(!type)return result;
   const idNorm=v=>String(v??'').normalize('NFKC').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
   const familyKey=r=>{const id=idNorm(r?.familyId);if(id)return 'id:'+id;const head=norm(r?.familyName||(r?.beneficiaryType==='عائلة'?r?.beneficiaryName:''));const pid=idNorm(r?.personId);let row=null;if(head&&pid)row=(data||[]).find(x=>norm(x['اسم رب الأسرة'])===head&&idNorm(x['رقم هوية الفرد'])===pid);if(!row&&head)row=(data||[]).find(x=>norm(x['اسم رب الأسرة'])===head);if(!row&&pid)row=(data||[]).find(x=>idNorm(x['رقم هوية الفرد'])===pid);if(!row&&r?.beneficiaryType==='عائلة')row=(data||[]).find(x=>norm(x['اسم رب الأسرة'])===norm(r?.beneficiaryName));const resolvedId=idNorm(row?.['رقم هوية الأسرة']);if(resolvedId)return 'id:'+resolvedId;const name=norm(row?.['اسم رب الأسرة']||head||(r?.beneficiaryType==='عائلة'?r?.beneficiaryName:''));return name?'name:'+name:''};
   const byFamily=new Map();
   (Array.isArray(distributions)?distributions:[]).filter(d=>norm(d.type)===norm(type)&&received(d)).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).forEach(d=>{const key=familyKey(d);if(key&&!byFamily.has(key))byFamily.set(key,d)});
   for(const person of (window.distCoverageUniverse(scope)||[])){const id=idNorm(person.familyId),key=id?'id:'+id:(person.familyKey||familyKey({familyName:person.familyName}));const rec=byFamily.get(key);if(rec)result.set(person.key,{date:rec.date||'',quantity:rec.quantity,reference:rec.reference,recordId:rec.id});}
   return result;
 };
 const previousRender=window.renderDistributions;
 window.renderDistributions=function(){
   previousRender();
   const tbody=document.getElementById('distTbody'), table=document.querySelector('#distributions .dist-table');
   const statusHead=table?.querySelector('thead [data-campaign-status-head]');if(statusHead)statusHead.textContent='حالة الاستلام';
   if(!tbody)return;let shown=0;
   [...tbody.querySelectorAll('tr')].forEach(tr=>{
     const button=tr.querySelector('button[onclick^="openDistributionModal("]');
     const match=button?.getAttribute('onclick')?.match(/openDistributionModal\('([^']+)'\)/);
     if(!match)return;
     const rec=(window.distributions||[]).find(x=>x.id===match[1]);
     if(!received(rec)){tr.remove();return;}
     shown++;
     const cell=tr.querySelector('[data-campaign-status-cell]');
     if(cell){const d=rec.deliveredAt?new Date(rec.deliveredAt).toLocaleDateString('ar-EG'):(rec.date||'');cell.innerHTML='<span class="dist-workflow-pill done">تم الاستلام</span>'+(d?'<small class="dist-workflow-date">'+String(d).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</small>':'');}
   });
   if(!shown&&!tbody.querySelector('tr'))tbody.innerHTML='<tr><td colspan="9"><div class="dist-empty">لا توجد سجلات استلام مؤكدة لعرضها</div></td></tr>';
 };
 window.renderDistributionCoverage=function(){
   if(typeof window.distCoverageTypeFill==='function')window.distCoverageTypeFill();
   const scope=document.getElementById('distCoverageScope')?.value||'children',type=document.getElementById('distCoverageType')?.value||'',status=document.getElementById('distCoverageStatus')?.value||'all',q=norm(document.getElementById('distCoverageSearch')?.value||''),tbody=document.getElementById('distCoverageTbody');if(!tbody)return;
   const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=String(v)};
   const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   if(!type){tbody.innerHTML='<tr><td colspan="6"><div class="dist-empty">اختر نوع المساعدة لعرض المستلمين وغير المستلمين</div></td></tr>';['covTotal','covReceived','covMissing','covPercent'].forEach(id=>set(id,id==='covPercent'?'0%':'0'));return;}
   const universe=window.distCoverageUniverse(scope)||[],gotMap=window.distCoverageReceived(scope,type)||new Map();
   const allRows=universe.map(x=>({...x,receipt:gotMap.get(x.key)||null,got:gotMap.has(x.key)}));
   const total=allRows.length,got=allRows.filter(x=>x.got).length,missing=total-got;
   set('covTotal',total);set('covReceived',got);set('covMissing',missing);set('covPercent',total?Math.round(got*100/total)+'%':'0%');
   let rows=allRows;if(status==='received')rows=rows.filter(x=>x.got);else if(status==='not_received')rows=rows.filter(x=>!x.got);
   if(q)rows=rows.filter(x=>norm([x.name,x.familyName,x.id,x.familyId].join(' ')).includes(q));
   tbody.innerHTML=rows.length?rows.map((x,i)=>`<tr><td>${i+1}</td><td><b>${e(x.name)}</b>${x.age!==''?`<div class="muted">العمر ${e(x.age)}</div>`:''}</td><td>${e(x.familyName||'—')}</td><td>${e(x.id||'—')}</td><td>${x.got?'<span class="dist-workflow-pill done">تم الاستلام</span>':'<span class="dist-workflow-pill legacy">لم يستلم</span>'}</td><td>${e(x.receipt?.date||'—')}</td></tr>`).join(''):'<tr><td colspan="6"><div class="dist-empty">لا توجد نتائج مطابقة للبحث والحالة المحددة</div></td></tr>';
 };
 window.exportDistributionCoverageExcel=function(){
   const scope=document.getElementById('distCoverageScope')?.value||'children',type=document.getElementById('distCoverageType')?.value||'',status=document.getElementById('distCoverageStatus')?.value||'all',q=norm(document.getElementById('distCoverageSearch')?.value||'');
   if(!type){toast('اختر نوع المساعدة أولاً');return;}
   const universe=window.distCoverageUniverse(scope)||[],gotMap=window.distCoverageReceived(scope,type)||new Map();
   let rows=universe.map(x=>{const receipt=gotMap.get(x.key)||null;return {'نوع الكشف':scope==='families'?'عائلات':scope==='persons'?'أفراد':'أطفال','نوع المساعدة':type,'الاسم':x.name,'رب الأسرة':x.familyName,'رقم الهوية':x.id,'رقم هوية الأسرة':x.familyId||'','حالة الاستلام':receipt?'استلم':'لم يستلم','تاريخ الاستلام':receipt?.date||'','الكمية':receipt?.quantity??'','رقم المرجع':receipt?.reference||''}});
   if(status==='received')rows=rows.filter(x=>x['حالة الاستلام']==='استلم');else if(status==='not_received')rows=rows.filter(x=>x['حالة الاستلام']==='لم يستلم');
   if(q)rows=rows.filter(x=>norm([x['الاسم'],x['رب الأسرة'],x['رقم الهوية'],x['رقم هوية الأسرة']].join(' ')).includes(q));
   if(!rows.length){toast('لا توجد نتائج مطابقة للتصدير');return;}
   try{exportStyledExcel(rows,`كشف_${scope==='families'?'العائلات':scope==='persons'?'الأفراد':'الأطفال'}_${status==='received'?'المستلمين':status==='not_received'?'غير_المستلمين':'الكل'}_${type}`,'كشف الاستحقاق');toast('تم تصدير كشف Excel ('+rows.length+' سجل)');}catch(err){console.error(err);toast('تعذر تصدير Excel: '+(err?.message||'خطأ غير معروف'));}
 };
 const oldExport=window.exportDistributionsExcel;
 window.exportDistributionsExcel=function(){const original=window.distributions;try{window.distributions=original.filter(received);oldExport();}finally{window.distributions=original;}};
 // Expose the existing lexical collection to this additive UI layer without changing its storage.
 try{Object.defineProperty(window,'distributions',{configurable:true,get(){return distributions},set(v){distributions=v}})}catch(e){}
 const refresh=()=>{try{window.renderDistributions?.();window.renderDistributionCoverage?.()}catch(e){console.warn('V63 distribution refresh',e)}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else setTimeout(refresh,0);
})();


/* V66 — Campaign integrity hardening.
   Distribution-only patch: safer family matching when legacy rows lack an ID,
   duplicate guard at the final save boundary, and protection against double taps. */
(function(){
 'use strict';
 const norm=v=>String(v??'').normalize('NFKC').normalize('NFD')
   .replace(/[\u0300-\u036f]/g,'').replace(/[ًٌٍَُِّْـٰ]/g,'')
   .replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
   .replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
   .replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
   .replace(/[ـ\u200e\u200f\u202a-\u202e]/g,'')
   .replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim().toLowerCase();
 const idNorm=v=>String(v??'').normalize('NFKC')
   .replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
   .replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
   .replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
 const cancelled=r=>['ملغي','ملغى','ملغاه','الغاء','canceled','cancelled'].includes(norm(r?.workflowStatus||r?.statusLabel||''));
 function familyBits(record){
   const r={...(record||{})};
   let fid=idNorm(r.familyId), name=norm(r.familyName||(r.beneficiaryType==='عائلة'?r.beneficiaryName:''));
   if(!fid || !name){
     const pid=idNorm(r.personId), beneficiary=norm(r.beneficiaryName);
     const rows=Array.isArray(data)?data:[]; let row=null;
     if(name&&pid)row=rows.find(x=>norm(x['اسم رب الأسرة'])===name&&idNorm(x['رقم هوية الفرد'])===pid);
     if(!row&&fid)row=rows.find(x=>idNorm(x['رقم هوية الأسرة'])===fid);
     if(!row&&name)row=rows.find(x=>norm(x['اسم رب الأسرة'])===name);
     if(!row&&pid)row=rows.find(x=>idNorm(x['رقم هوية الفرد'])===pid);
     if(!row&&r.beneficiaryType==='عائلة'&&beneficiary)row=rows.find(x=>norm(x['اسم رب الأسرة'])===beneficiary);
     if(row){fid=fid||idNorm(row['رقم هوية الأسرة']);name=name||norm(row['اسم رب الأسرة']);}
   }
   return {fid,name};
 }
 function sameFamily(a,b){
   const x=familyBits(a),y=familyBits(b);
   if(x.fid&&y.fid)return x.fid===y.fid;
   return !!x.name&&!!y.name&&x.name===y.name;
 }
 function findCampaignDuplicate(candidate,excludeId=''){
   const type=norm(candidate?.type); if(!type)return null;
   const f=familyBits(candidate); if(!f.fid&&!f.name)return null;
   return (Array.isArray(distributions)?distributions:[]).find(d=>d.id!==excludeId&&!cancelled(d)&&norm(d.type)===type&&sameFamily(candidate,d))||null;
 }
 window.distCampaignFindDuplicate=findCampaignDuplicate;
 // Final-boundary check also protects the single-registration form, including legacy rows.
 const originalSave=window.saveDistribution;
 let singleBusy=false;
 if(typeof originalSave==='function')window.saveDistribution=function(){
   if(singleBusy)return;
   const button=document.querySelector('#distModal .modalfoot button.primary');
   const id=document.getElementById('distId')?.value||'';
   const candidate={id,beneficiaryType:document.getElementById('distBeneficiaryForm')?.value||'',beneficiaryName:document.getElementById('distName')?.value||'',personId:document.getElementById('distPersonId')?.value||'',familyId:document.getElementById('distFamilyId')?.value||'',familyName:document.getElementById('distFamilyName')?.value||'',type:document.getElementById('distTypeForm')?.value||''};
   const dup=findCampaignDuplicate(candidate,id);
   if(dup){const type=String(candidate.type||'').trim();toast('تم إيقاف العملية لمنع تكرار «'+type+'» لهذه العائلة. المرجع السابق: '+(dup.reference||'غير مسجل'));return;}
   singleBusy=true;const oldText=button?.textContent;if(button){button.disabled=true;button.textContent='جارٍ حفظ التسليم…';}
   try{return originalSave.apply(this,arguments)}finally{singleBusy=false;if(button){button.disabled=false;button.textContent=oldText||'تسجيل واعتماد وتسليم';}}
 };
 // Prevent repeated taps from submitting a bulk campaign twice.
 const originalBulk=window.saveBulkRegisterDistribution;
 let bulkBusy=false;
 if(typeof originalBulk==='function')window.saveBulkRegisterDistribution=function(){
   if(bulkBusy)return;
   bulkBusy=true;const button=document.querySelector('#distBulkRegisterModal .modalfoot button.primary');const oldText=button?.textContent;
   if(button){button.disabled=true;button.textContent='جارٍ التحقق والحفظ…';}
   try{return originalBulk.apply(this,arguments)}finally{bulkBusy=false;if(button){button.disabled=false;button.textContent=oldText||'حفظ التوزيعات المحددة';}}
 };
})();

/* V67 — Campaign integrity hardening.
   Distribution-only patch: safer family matching when legacy rows lack an ID,
   duplicate guard at the final save boundary, and protection against double taps. */
(function(){
 'use strict';
 const norm=v=>String(v??'').normalize('NFKC').normalize('NFD')
   .replace(/[\u0300-\u036f]/g,'').replace(/[ًٌٍَُِّْـٰ]/g,'')
   .replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
   .replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
   .replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
   .replace(/[ـ\u200e\u200f\u202a-\u202e]/g,'')
   .replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim().toLowerCase();
 const idNorm=v=>String(v??'').normalize('NFKC')
   .replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
   .replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
   .replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
 const cancelled=r=>['ملغي','ملغى','ملغاه','الغاء','canceled','cancelled'].includes(norm(r?.workflowStatus||r?.statusLabel||''));
 function familyBits(record){
   const r={...(record||{})};
   let fid=idNorm(r.familyId), name=norm(r.familyName||(r.beneficiaryType==='عائلة'?r.beneficiaryName:''));
   if(!fid || !name){
     const pid=idNorm(r.personId), beneficiary=norm(r.beneficiaryName);
     const rows=Array.isArray(data)?data:[]; let row=null;
     if(name&&pid)row=rows.find(x=>norm(x['اسم رب الأسرة'])===name&&idNorm(x['رقم هوية الفرد'])===pid);
     if(!row&&fid)row=rows.find(x=>idNorm(x['رقم هوية الأسرة'])===fid);
     if(!row&&name)row=rows.find(x=>norm(x['اسم رب الأسرة'])===name);
     if(!row&&pid)row=rows.find(x=>idNorm(x['رقم هوية الفرد'])===pid);
     if(!row&&r.beneficiaryType==='عائلة'&&beneficiary)row=rows.find(x=>norm(x['اسم رب الأسرة'])===beneficiary);
     if(row){fid=fid||idNorm(row['رقم هوية الأسرة']);name=name||norm(row['اسم رب الأسرة']);}
   }
   return {fid,name};
 }
 function sameFamily(a,b){
   const x=familyBits(a),y=familyBits(b);
   if(x.fid&&y.fid)return x.fid===y.fid;
   return !!x.name&&!!y.name&&x.name===y.name;
 }
 function findCampaignDuplicate(candidate,excludeId=''){
   const type=norm(candidate?.type); if(!type)return null;
   const f=familyBits(candidate); if(!f.fid&&!f.name)return null;
   return (Array.isArray(distributions)?distributions:[]).find(d=>d.id!==excludeId&&!cancelled(d)&&norm(d.type)===type&&sameFamily(candidate,d))||null;
 }
 window.distCampaignFindDuplicate=findCampaignDuplicate;
 // Final-boundary check also protects the single-registration form, including legacy rows.
 const originalSave=window.saveDistribution;
 let singleBusy=false;
 if(typeof originalSave==='function')window.saveDistribution=function(){
   if(singleBusy)return;
   const button=document.querySelector('#distModal .modalfoot button.primary');
   const id=document.getElementById('distId')?.value||'';
   const candidate={id,beneficiaryType:document.getElementById('distBeneficiaryForm')?.value||'',beneficiaryName:document.getElementById('distName')?.value||'',personId:document.getElementById('distPersonId')?.value||'',familyId:document.getElementById('distFamilyId')?.value||'',familyName:document.getElementById('distFamilyName')?.value||'',type:document.getElementById('distTypeForm')?.value||''};
   const dup=findCampaignDuplicate(candidate,id);
   if(dup){const type=String(candidate.type||'').trim();toast('تم إيقاف العملية لمنع تكرار «'+type+'» لهذه العائلة. المرجع السابق: '+(dup.reference||'غير مسجل'));return;}
   singleBusy=true;const oldText=button?.textContent;if(button){button.disabled=true;button.textContent='جارٍ حفظ التسليم…';}
   try{return originalSave.apply(this,arguments)}finally{singleBusy=false;if(button){button.disabled=false;button.textContent=oldText||'تسجيل واعتماد وتسليم';}}
 };
 // Prevent repeated taps from submitting a bulk campaign twice.
 const originalBulk=window.saveBulkRegisterDistribution;
 let bulkBusy=false;
 if(typeof originalBulk==='function')window.saveBulkRegisterDistribution=function(){
   if(bulkBusy)return;
   bulkBusy=true;const button=document.querySelector('#distBulkRegisterModal .modalfoot button.primary');const oldText=button?.textContent;
   if(button){button.disabled=true;button.textContent='جارٍ التحقق والحفظ…';}
   try{return originalBulk.apply(this,arguments)}finally{bulkBusy=false;if(button){button.disabled=false;button.textContent=oldText||'حفظ التوزيعات المحددة';}}
 };
})();


/* V67 — server duplicate conflicts are archived in the distribution operations center. */


/* V69 — Interactive campaign analytics + awaited submit locks.
   Scope: current distribution campaign only. No family records, storage keys, sync endpoints,
   D1 schema, or repository layout are changed. */
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const safe = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = v => String(v ?? '').normalize('NFKC').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[ًٌٍَُِّْـٰ]/g,'')
    .replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
    .replace(/[ـ\u200e\u200f\u202a-\u202e]/g,'')
    .replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim().toLowerCase();
  const idNorm = v => String(v ?? '').normalize('NFKC')
    .replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
  const cancelled = d => ['ملغي','ملغى','ملغاه','الغاء','canceled','cancelled'].includes(normalize(d?.workflowStatus || d?.statusLabel || ''));
  function familyList(){
    const rows = Array.isArray(data) ? data : [];
    const groups = new Map();
    for(const r of rows){
      const id = idNorm(r?.['رقم هوية الأسرة']);
      const name = normalize(r?.['اسم رب الأسرة']);
      const key = id ? 'id:'+id : name ? 'name:'+name : '';
      if(!key) continue;
      if(!groups.has(key)) groups.set(key,{key,id,name:String(r?.['اسم رب الأسرة']||'').trim(),rows:[]});
      groups.get(key).rows.push(r);
    }
    return [...groups.values()].filter(f=>f.name);
  }
  function distributionFamilyKey(d){
    const id=idNorm(d?.familyId);
    if(id) return 'id:'+id;
    const name=normalize(d?.familyName || (d?.beneficiaryType==='عائلة'?d?.beneficiaryName:''));
    return name?'name:'+name:'';
  }
  function renderAnalytics(){
    const host=$('distCampaignAidChart'),kpi=$('distCampaignAnalyticsKpis');
    if(!host||!kpi)return;
    const families=familyList();
    const records=(Array.isArray(distributions)?distributions:[]).filter(d=>!cancelled(d));
    // لا نعرض إلا أنواع المساعدة التي أدخلها المستخدم فعلياً في سجلات التوزيع.
    const types=new Set();
    records.forEach(d=>{const entered=String(d.type||'').trim();if(entered)types.add(entered)});
    const aidTypes=[...types].sort((a,b)=>a.localeCompare(b,'ar'));
    const famKeys=new Set(families.map(f=>f.key));
    const familyRecordKeys=new Map();
    for(const d of records){
      const type=String(d.type||'').trim();
      const did=idNorm(d?.familyId);
      const dname=normalize(d?.familyName || (d?.beneficiaryType==='عائلة'?d?.beneficiaryName:''));
      if(!type||(!did&&!dname))continue;
      const matched=families.find(f=>(did&&f.id&&idNorm(f.id)===did)||((!did||!f.id)&&dname&&normalize(f.name)===dname));
      if(!matched)continue; // Ignore legacy distribution rows that cannot be matched to a registered family.
      if(!familyRecordKeys.has(type))familyRecordKeys.set(type,new Set());
      familyRecordKeys.get(type).add(matched.key);
    }
    const metrics=aidTypes.map(type=>{
      const receivedSet=familyRecordKeys.get(type)||new Set();
      const got=receivedSet.size;
      return {type,total:families.length,got,left:Math.max(0,families.length-got),pct:families.length?Math.round(got*100/families.length):0};
    });
    const totalTypes=metrics.length;
    const selected=$('distCampaignAidType')?.value||'';
    const chosen=metrics.find(x=>normalize(x.type)===normalize(selected));
    const totalReceipts=records.length;
    const totalCoveredTypes=metrics.reduce((n,x)=>n+x.got,0);
    const eligibleSlots=metrics.reduce((n,x)=>n+x.total,0);
    const overallPct=eligibleSlots?Math.round(totalCoveredTypes*100/eligibleSlots):0;
    const current=chosen?chosen.pct:overallPct;
    const kpisData=[
      {label:selected?'تغطية النوع المحدد':'تغطية الحملة',value:current+'%',note:selected?`${chosen.got} من ${chosen.total} عائلة`: `${totalCoveredTypes.toLocaleString('ar')} استفادة عائلية عبر الأنواع`},
      {label:'أنواع المساعدة',value:totalTypes.toLocaleString('ar'),note:'أنواع متاحة أو مسجلة في الحملة'},
      {label:'سجلات التسليم',value:totalReceipts.toLocaleString('ar'),note:'السجلات غير الملغاة حالياً'}
    ];
    kpi.innerHTML=kpisData.map((x,i)=>`<div class="dist-campaign-kpi"><span>${safe(x.label)}</span><strong data-count-index="${i}">${safe(x.value)}</strong><small>${safe(x.note)}</small></div>`).join('');
    if(!families.length){
      host.innerHTML='<div class="dist-empty">لا توجد عائلات مسجلة لاحتساب التغطية.</div>';
    }else if(!metrics.length){
      host.innerHTML='<div class="dist-empty">لا توجد أنواع مساعدة بعد. أضف نوعاً من فحص الاستحقاق أو سجّل أول توزيع.</div>';
    }else{
      host.innerHTML=metrics.map(m=>{
        const pressed=normalize(m.type)===normalize(selected);
        const gotWidth=m.total?Math.min(100,m.got/m.total*100):0;
        return `<button type="button" class="dist-campaign-aid-row" data-campaign-aid="${safe(m.type)}" aria-pressed="${pressed}" aria-label="اختيار ${safe(m.type)}: استفادت ${m.got} عائلة من أصل ${m.total}">
          <span class="dist-campaign-aid-name">${safe(m.type)}<small>${m.got.toLocaleString('ar')} مستفيدة · ${m.left.toLocaleString('ar')} متبقية</small></span>
          <span class="dist-campaign-track" aria-hidden="true"><span class="dist-campaign-got" style="width:${gotWidth}%"></span><span class="dist-campaign-left" style="width:${Math.max(0,100-gotWidth)}%"></span></span>
          <span class="dist-campaign-aid-meta"><b>${m.pct.toLocaleString('ar')}٪</b><small>${m.got}/${m.total}</small></span>
        </button>`;
      }).join('')+'<div class="dist-campaign-legend"><span><i class="got"></i> استفادت من النوع</span><span><i class="left"></i> لم تستفد بعد</span></div>';
      host.querySelectorAll('[data-campaign-aid]').forEach(btn=>btn.addEventListener('click',()=>{
        const type=$('distCampaignAidType');
        if(!type)return;
        type.value=btn.dataset.campaignAid||'';
        type.dispatchEvent(new Event('change',{bubbles:true}));
        renderAnalytics();
        $('distCampaignQuickCheck')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
      }));
    }
    const updated=$('distCampaignAnalyticsUpdated');
    if(updated)updated.textContent='آخر احتساب: '+new Date().toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit'});
  }
  let renderQueued=false;
  function queueRender(){
    if(renderQueued)return;renderQueued=true;
    requestAnimationFrame(()=>{renderQueued=false;try{renderAnalytics()}catch(e){console.warn('V69 campaign analytics',e)}});
  }
  const oldRender=window.renderDistributions;
  if(typeof oldRender==='function')window.renderDistributions=function(){
    const result=oldRender.apply(this,arguments);queueRender();return result;
  };
  const oldCoverage=window.renderDistributionCoverage;
  if(typeof oldCoverage==='function')window.renderDistributionCoverage=function(){
    const result=oldCoverage.apply(this,arguments);queueRender();return result;
  };
  document.addEventListener('change',e=>{
    if(e.target?.id==='distCampaignAidType')queueRender();
  });
  window.addEventListener('online',queueRender);
  window.addEventListener('offline',queueRender);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queueRender,{once:true});else queueRender();

  // Fix double-submit protection to stay locked until asynchronous save finishes.
  const originalSave=window.saveDistribution;
  let singleBusy=false;
  if(typeof originalSave==='function')window.saveDistribution=async function(){
    if(singleBusy)return;
    const button=document.querySelector('#distModal .modalfoot button.primary');
    const id=$('distId')?.value||'';
    const candidate={id,beneficiaryType:$('distBeneficiaryForm')?.value||'',beneficiaryName:$('distName')?.value||'',personId:$('distPersonId')?.value||'',familyId:$('distFamilyId')?.value||'',familyName:$('distFamilyName')?.value||'',type:$('distTypeForm')?.value||''};
    const dup=window.distCampaignFindDuplicate?.(candidate,id);
    if(dup){toast('تم إيقاف العملية لمنع تكرار «'+String(candidate.type||'').trim()+'» لهذه العائلة. المرجع السابق: '+(dup.reference||'غير مسجل'));return;}
    singleBusy=true;const oldText=button?.textContent;
    if(button){button.disabled=true;button.textContent='جارٍ التحقق والتسجيل والتسليم…';}
    try{return await originalSave.apply(this,arguments)}
    finally{singleBusy=false;if(button){button.disabled=false;button.textContent=oldText||'تسجيل واعتماد وتسليم';}queueRender();}
  };
  const originalBulk=window.saveBulkRegisterDistribution;
  let bulkBusy=false;
  if(typeof originalBulk==='function')window.saveBulkRegisterDistribution=async function(){
    if(bulkBusy)return;
    bulkBusy=true;const button=document.querySelector('#distBulkRegisterModal .modalfoot button.primary');const oldText=button?.textContent;
    if(button){button.disabled=true;button.textContent='جارٍ التحقق والحفظ…';}
    try{return await originalBulk.apply(this,arguments)}
    finally{bulkBusy=false;if(button){button.disabled=false;button.textContent=oldText||'حفظ التوزيعات المحددة';}queueRender();}
  };
})();

/* V69 — Interactive campaign analytics + awaited submit locks.
   Scope: current distribution campaign only. No family records, storage keys, sync endpoints,
   D1 schema, or repository layout are changed. */
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const safe = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = v => String(v ?? '').normalize('NFKC').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[ًٌٍَُِّْـٰ]/g,'')
    .replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
    .replace(/[ـ\u200e\u200f\u202a-\u202e]/g,'')
    .replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim().toLowerCase();
  const idNorm = v => String(v ?? '').normalize('NFKC')
    .replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
  const cancelled = d => ['ملغي','ملغى','ملغاه','الغاء','canceled','cancelled'].includes(normalize(d?.workflowStatus || d?.statusLabel || ''));
  function familyList(){
    const rows = Array.isArray(data) ? data : [];
    const groups = new Map();
    for(const r of rows){
      const id = idNorm(r?.['رقم هوية الأسرة']);
      const name = normalize(r?.['اسم رب الأسرة']);
      const key = id ? 'id:'+id : name ? 'name:'+name : '';
      if(!key) continue;
      if(!groups.has(key)) groups.set(key,{key,id,name:String(r?.['اسم رب الأسرة']||'').trim(),rows:[]});
      groups.get(key).rows.push(r);
    }
    return [...groups.values()].filter(f=>f.name);
  }
  function distributionFamilyKey(d){
    const id=idNorm(d?.familyId);
    if(id) return 'id:'+id;
    const name=normalize(d?.familyName || (d?.beneficiaryType==='عائلة'?d?.beneficiaryName:''));
    return name?'name:'+name:'';
  }
  function renderAnalytics(){
    const host=$('distCampaignAidChart'),kpi=$('distCampaignAnalyticsKpis');
    if(!host||!kpi)return;
    const families=familyList();
    const records=(Array.isArray(distributions)?distributions:[]).filter(d=>!cancelled(d));
    // لا نعرض إلا أنواع المساعدة التي أدخلها المستخدم فعلياً في سجلات التوزيع.
    const types=new Set();
    records.forEach(d=>{const entered=String(d.type||'').trim();if(entered)types.add(entered)});
    const aidTypes=[...types].sort((a,b)=>a.localeCompare(b,'ar'));
    const famKeys=new Set(families.map(f=>f.key));
    const familyRecordKeys=new Map();
    for(const d of records){
      const type=String(d.type||'').trim();
      const did=idNorm(d?.familyId);
      const dname=normalize(d?.familyName || (d?.beneficiaryType==='عائلة'?d?.beneficiaryName:''));
      if(!type||(!did&&!dname))continue;
      const matched=families.find(f=>(did&&f.id&&idNorm(f.id)===did)||((!did||!f.id)&&dname&&normalize(f.name)===dname));
      if(!matched)continue; // Ignore legacy distribution rows that cannot be matched to a registered family.
      if(!familyRecordKeys.has(type))familyRecordKeys.set(type,new Set());
      familyRecordKeys.get(type).add(matched.key);
    }
    const metrics=aidTypes.map(type=>{
      const receivedSet=familyRecordKeys.get(type)||new Set();
      const got=receivedSet.size;
      return {type,total:families.length,got,left:Math.max(0,families.length-got),pct:families.length?Math.round(got*100/families.length):0};
    });
    const totalTypes=metrics.length;
    const selected=$('distCampaignAidType')?.value||'';
    const chosen=metrics.find(x=>normalize(x.type)===normalize(selected));
    const totalReceipts=records.length;
    const totalCoveredTypes=metrics.reduce((n,x)=>n+x.got,0);
    const eligibleSlots=metrics.reduce((n,x)=>n+x.total,0);
    const overallPct=eligibleSlots?Math.round(totalCoveredTypes*100/eligibleSlots):0;
    const current=chosen?chosen.pct:overallPct;
    const kpisData=[
      {label:selected?'تغطية النوع المحدد':'تغطية الحملة',value:current+'%',note:selected?`${chosen.got} من ${chosen.total} عائلة`: `${totalCoveredTypes.toLocaleString('ar')} استفادة عائلية عبر الأنواع`},
      {label:'أنواع المساعدة',value:totalTypes.toLocaleString('ar'),note:'أنواع متاحة أو مسجلة في الحملة'},
      {label:'سجلات التسليم',value:totalReceipts.toLocaleString('ar'),note:'السجلات غير الملغاة حالياً'}
    ];
    kpi.innerHTML=kpisData.map((x,i)=>`<div class="dist-campaign-kpi"><span>${safe(x.label)}</span><strong data-count-index="${i}">${safe(x.value)}</strong><small>${safe(x.note)}</small></div>`).join('');
    if(!families.length){
      host.innerHTML='<div class="dist-empty">لا توجد عائلات مسجلة لاحتساب التغطية.</div>';
    }else if(!metrics.length){
      host.innerHTML='<div class="dist-empty">لا توجد أنواع مساعدة بعد. أضف نوعاً من فحص الاستحقاق أو سجّل أول توزيع.</div>';
    }else{
      host.innerHTML=metrics.map(m=>{
        const pressed=normalize(m.type)===normalize(selected);
        const gotWidth=m.total?Math.min(100,m.got/m.total*100):0;
        return `<button type="button" class="dist-campaign-aid-row" data-campaign-aid="${safe(m.type)}" aria-pressed="${pressed}" aria-label="اختيار ${safe(m.type)}: استفادت ${m.got} عائلة من أصل ${m.total}">
          <span class="dist-campaign-aid-name">${safe(m.type)}<small>${m.got.toLocaleString('ar')} مستفيدة · ${m.left.toLocaleString('ar')} متبقية</small></span>
          <span class="dist-campaign-track" aria-hidden="true"><span class="dist-campaign-got" style="width:${gotWidth}%"></span><span class="dist-campaign-left" style="width:${Math.max(0,100-gotWidth)}%"></span></span>
          <span class="dist-campaign-aid-meta"><b>${m.pct.toLocaleString('ar')}٪</b><small>${m.got}/${m.total}</small></span>
        </button>`;
      }).join('')+'<div class="dist-campaign-legend"><span><i class="got"></i> استفادت من النوع</span><span><i class="left"></i> لم تستفد بعد</span></div>';
      host.querySelectorAll('[data-campaign-aid]').forEach(btn=>btn.addEventListener('click',()=>{
        const type=$('distCampaignAidType');
        if(!type)return;
        type.value=btn.dataset.campaignAid||'';
        type.dispatchEvent(new Event('change',{bubbles:true}));
        renderAnalytics();
        $('distCampaignQuickCheck')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
      }));
    }
    const updated=$('distCampaignAnalyticsUpdated');
    if(updated)updated.textContent='آخر احتساب: '+new Date().toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit'});
  }
  let renderQueued=false;
  function queueRender(){
    if(renderQueued)return;renderQueued=true;
    requestAnimationFrame(()=>{renderQueued=false;try{renderAnalytics()}catch(e){console.warn('V69 campaign analytics',e)}});
  }
  const oldRender=window.renderDistributions;
  if(typeof oldRender==='function')window.renderDistributions=function(){
    const result=oldRender.apply(this,arguments);queueRender();return result;
  };
  const oldCoverage=window.renderDistributionCoverage;
  if(typeof oldCoverage==='function')window.renderDistributionCoverage=function(){
    const result=oldCoverage.apply(this,arguments);queueRender();return result;
  };
  document.addEventListener('change',e=>{
    if(e.target?.id==='distCampaignAidType')queueRender();
  });
  window.addEventListener('online',queueRender);
  window.addEventListener('offline',queueRender);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queueRender,{once:true});else queueRender();

  // Fix double-submit protection to stay locked until asynchronous save finishes.
  const originalSave=window.saveDistribution;
  let singleBusy=false;
  if(typeof originalSave==='function')window.saveDistribution=async function(){
    if(singleBusy)return;
    const button=document.querySelector('#distModal .modalfoot button.primary');
    const id=$('distId')?.value||'';
    const candidate={id,beneficiaryType:$('distBeneficiaryForm')?.value||'',beneficiaryName:$('distName')?.value||'',personId:$('distPersonId')?.value||'',familyId:$('distFamilyId')?.value||'',familyName:$('distFamilyName')?.value||'',type:$('distTypeForm')?.value||''};
    const dup=window.distCampaignFindDuplicate?.(candidate,id);
    if(dup){toast('تم إيقاف العملية لمنع تكرار «'+String(candidate.type||'').trim()+'» لهذه العائلة. المرجع السابق: '+(dup.reference||'غير مسجل'));return;}
    singleBusy=true;const oldText=button?.textContent;
    if(button){button.disabled=true;button.textContent='جارٍ التحقق والتسجيل والتسليم…';}
    try{return await originalSave.apply(this,arguments)}
    finally{singleBusy=false;if(button){button.disabled=false;button.textContent=oldText||'تسجيل واعتماد وتسليم';}queueRender();}
  };
  const originalBulk=window.saveBulkRegisterDistribution;
  let bulkBusy=false;
  if(typeof originalBulk==='function')window.saveBulkRegisterDistribution=async function(){
    if(bulkBusy)return;
    bulkBusy=true;const button=document.querySelector('#distBulkRegisterModal .modalfoot button.primary');const oldText=button?.textContent;
    if(button){button.disabled=true;button.textContent='جارٍ التحقق والحفظ…';}
    try{return await originalBulk.apply(this,arguments)}
    finally{bulkBusy=false;if(button){button.disabled=false;button.textContent=oldText||'حفظ التوزيعات المحددة';}queueRender();}
  };
})();

/* ===== Camp sectors (A-D): independent metadata linked to existing family records. ===== */
const CAMP_SECTORS_STORAGE_KEY = "abu_oreiban_camp_sectors_v1";
const CAMP_SECTOR_NAMES = ["A","B","C","D"];
let selectedCampSector = "A";
function loadCampSectors(){
  try{const parsed=JSON.parse(localStorage.getItem(CAMP_SECTORS_STORAGE_KEY)||"{}");const clean={};CAMP_SECTOR_NAMES.forEach(k=>clean[k]=Array.isArray(parsed?.[k])?[...new Set(parsed[k].filter(x=>typeof x==="string"&&x))]:[]);return clean;}catch(_){return {A:[],B:[],C:[],D:[]}}
}
function saveCampSectors(value){
  const clean={};CAMP_SECTOR_NAMES.forEach(k=>clean[k]=Array.isArray(value?.[k])?[...new Set(value[k].filter(x=>typeof x==="string"&&x))]:[]);
  try{localStorage.setItem(CAMP_SECTORS_STORAGE_KEY,JSON.stringify(clean));return true}catch(e){toast("تعذر حفظ القواطع محلياً؛ مساحة التخزين ممتلئة");return false}
}
function campSectorNorm(value){return String(value??"").trim().toLowerCase().replace(/[أإآٱ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").replace(/[ًٌٍَُِّْـ]/g,"").replace(/\s+/g," ")}
function campSectorFamilyKey(name){const rows=(typeof familyMap==="function"?familyMap().get(name):null)||[];const first=rows[0]||{};const id=String(first["رقم هوية الأسرة"]||"").trim();return id?"id:"+id:"name:"+campSectorNorm(name)}
function campSectorFamilies(){const names=typeof familyNames==="function"?familyNames():[];return names.map(name=>{const rows=(typeof familyMap==="function"?familyMap().get(name):null)||[];const first=rows[0]||{};return {key:campSectorFamilyKey(name),name,id:String(first["رقم هوية الأسرة"]||"").trim(),phone:String(first["رقم الجوال"]||"").trim(),address:String(first["العنوان"]||"").trim(),members:rows.length,rows}})}
function campSectorAssignmentMap(){const sectors=loadCampSectors(),map=new Map();CAMP_SECTOR_NAMES.forEach(s=>sectors[s].forEach(key=>{if(!map.has(key))map.set(key,s)}));return map}
function campSectorEsc(value){return typeof esc==="function"?esc(value):String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function campSectorCanEdit(){if(typeof appReadOnly!=="undefined"&&appReadOnly===true){toast("هذا الجهاز للعرض فقط — إدارة القواطع مسموحة من الجهاز الرئيسي");return false}return true}
function renderCampSectors(){
  if(!document.getElementById("sectors"))return;
  const summary=document.getElementById("sectorSummary"),cards=document.getElementById("sectorCards"),families=campSectorFamilies(),assignments=campSectorAssignmentMap();
  const assignedCount=families.filter(f=>assignments.has(f.key)).length,counts={};CAMP_SECTOR_NAMES.forEach(s=>counts[s]=families.filter(f=>assignments.get(f.key)===s).length);
  if(summary)summary.innerHTML=`<div class="sector-stat"><span>إجمالي العائلات المسجلة في القواطع</span><b>${assignedCount.toLocaleString("ar-EG")}</b></div>${CAMP_SECTOR_NAMES.map(s=>`<div class="sector-stat"><span>عائلات القاطع ${s}</span><b>${counts[s].toLocaleString("ar-EG")}</b></div>`).join("")}`;
  if(cards)cards.innerHTML=CAMP_SECTOR_NAMES.map(s=>`<button type="button" class="sector-choice ${selectedCampSector===s?"active":""}" onclick="selectCampSector('${s}')" aria-pressed="${selectedCampSector===s}"><span class="sector-letter">${s}</span><span class="sector-choice-copy"><b>القاطع ${s}</b><small>تجمّع عائلات</small></span><span class="sector-choice-count">${counts[s].toLocaleString("ar-EG")}</span></button>`).join("");
  const title=document.getElementById("sectorCurrentTitle"),meta=document.getElementById("sectorCurrentMeta"),count=document.getElementById("sectorFamilyCount"),current=families.filter(f=>assignments.get(f.key)===selectedCampSector).sort((a,b)=>a.name.localeCompare(b.name,"ar"));
  if(title)title.textContent="القاطع "+selectedCampSector;if(meta)meta.textContent=`${current.length.toLocaleString("ar-EG")} عائلة مرتبطة بسجلات التطبيق`;if(count)count.textContent=current.length.toLocaleString("ar-EG");
  const list=document.getElementById("sectorFamilyList");if(list)list.innerHTML=current.length?current.map(f=>`<div class="sector-family-item"><div class="sector-family-copy"><b>${campSectorEsc(f.name)}</b><small>${f.id?"هوية الأسرة: "+campSectorEsc(f.id)+" · ":""}${f.phone?"الجوال: "+campSectorEsc(f.phone)+" · ":""}عدد الأفراد: ${f.members.toLocaleString("ar-EG")}</small></div><button type="button" class="btn danger sector-remove" onclick="removeCampFamilyFromSector('${encodeURIComponent(f.key)}')">إزالة من القاطع</button></div>`).join(""):'<div class="sector-empty">لا توجد عائلات مضافة لهذا القاطع حتى الآن.<br>استخدم البحث أعلاه واختر العائلات من السجلات الموجودة.</div>';
  renderSectorSearch();
}
function selectCampSector(sector){if(!CAMP_SECTOR_NAMES.includes(sector))return;selectedCampSector=sector;renderCampSectors()}
function renderSectorSearch(){
  const out=document.getElementById("sectorSearchResults");if(!out)return;const q=campSectorNorm(document.getElementById("sectorSearch")?.value||"");
  if(!q){out.innerHTML='<div class="sector-empty">اكتب اسم رب الأسرة أو رقم الهوية لعرض العائلات المطابقة.</div>';return}
  const assignments=campSectorAssignmentMap(),matches=campSectorFamilies().filter(f=>campSectorNorm([f.name,f.id,f.phone,f.address].join(" ")).includes(q)).slice(0,30);
  if(!matches.length){out.innerHTML='<div class="sector-empty">لا توجد عائلة مطابقة في السجلات الحالية.</div>';return}
  out.innerHTML=matches.map(f=>{const assigned=assignments.get(f.key)||"",same=assigned===selectedCampSector;const status=same?'<span class="sector-result-badge current">موجودة في هذا القاطع</span>':assigned?`<span class="sector-result-badge assigned">موجودة في القاطع ${assigned}</span>`:'<span class="sector-result-badge">غير موزّعة</span>';const action=same?'<button type="button" class="btn" disabled>مضافة</button>':`<button type="button" class="btn primary" onclick="addCampFamilyToSector('${encodeURIComponent(f.key)}')">${assigned?"نقل إلى القاطع "+selectedCampSector:"＋ إضافة"}</button>`;return `<div class="sector-search-result"><div class="sector-result-copy"><b>${campSectorEsc(f.name)}</b><small>${f.id?"الهوية: "+campSectorEsc(f.id)+" · ":""}عدد الأفراد: ${f.members.toLocaleString("ar-EG")}</small></div><div class="sector-result-actions">${status}${action}</div></div>`}).join("");
}
function addCampFamilyToSector(encodedKey){
  if(!campSectorCanEdit())return;let key;try{key=decodeURIComponent(encodedKey)}catch(_){key=encodedKey}const family=campSectorFamilies().find(f=>f.key===key);if(!family){toast("لم تعد العائلة موجودة في السجلات الحالية");renderCampSectors();return}
  const sectors=loadCampSectors();let previous="";CAMP_SECTOR_NAMES.forEach(s=>{if(sectors[s].includes(key))previous=s});if(previous===selectedCampSector){toast("العائلة مضافة بالفعل لهذا القاطع");return}if(previous&&!confirm(`العائلة «${family.name}» موجودة في القاطع ${previous}. هل تريد نقلها إلى القاطع ${selectedCampSector}؟`))return;
  CAMP_SECTOR_NAMES.forEach(s=>{sectors[s]=sectors[s].filter(k=>k!==key)});sectors[selectedCampSector].push(key);if(!saveCampSectors(sectors))return;renderCampSectors();toast(previous?`تم نقل العائلة إلى القاطع ${selectedCampSector}`:`تمت إضافة العائلة إلى القاطع ${selectedCampSector}`);
}
function removeCampFamilyFromSector(encodedKey){
  if(!campSectorCanEdit())return;let key;try{key=decodeURIComponent(encodedKey)}catch(_){key=encodedKey}const family=campSectorFamilies().find(f=>f.key===key);if(!family)return;if(!confirm(`إزالة «${family.name}» من القاطع ${selectedCampSector} فقط؟\nلن يتم حذف العائلة أو أي فرد من بيانات التطبيق.`))return;
  const sectors=loadCampSectors();sectors[selectedCampSector]=sectors[selectedCampSector].filter(k=>k!==key);if(saveCampSectors(sectors)){renderCampSectors();toast("تمت إزالة العائلة من القاطع دون حذف بياناتها")}
}
function printSector(){
  const current=campSectorFamilies().filter(f=>campSectorAssignmentMap().get(f.key)===selectedCampSector).sort((a,b)=>a.name.localeCompare(b.name,"ar"));if(!current.length){toast("لا توجد عائلات في هذا القاطع للطباعة");return}
  const body=document.body;body.classList.add("sector-printing");const oldTitle=document.title;document.title=`كشف عائلات القاطع ${selectedCampSector} - مخيم أبو عريبان`;const cleanup=()=>{body.classList.remove("sector-printing");document.title=oldTitle;window.removeEventListener("afterprint",cleanup)};window.addEventListener("afterprint",cleanup);window.print();setTimeout(cleanup,1500);
}
window.addEventListener("storage",e=>{if(e.key===CAMP_SECTORS_STORAGE_KEY&&document.getElementById("sectors")?.classList.contains("active"))renderCampSectors()});


/* Mobile Drawer Menu: closes automatically after choosing a section. */
(function initMobileDrawer(){
 const backdrop=document.getElementById("mobileDrawerBackdrop"),openBtn=document.getElementById("mobileDrawerOpen"),closeBtn=document.getElementById("mobileDrawerClose");
 if(!backdrop||!openBtn||!closeBtn)return;
 function close(){backdrop.classList.remove("open");backdrop.setAttribute("aria-hidden","true");openBtn.setAttribute("aria-expanded","false")}
 function open(){backdrop.classList.add("open");backdrop.setAttribute("aria-hidden","false");openBtn.setAttribute("aria-expanded","true")}
 openBtn.addEventListener("click",open);closeBtn.addEventListener("click",close);
 backdrop.addEventListener("click",e=>{if(e.target===backdrop)close()});
 document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
 backdrop.querySelectorAll("[data-drawer-view]").forEach(btn=>btn.addEventListener("click",()=>{const view=btn.dataset.drawerView;if(typeof showView==="function")showView(view);close()}));
 document.addEventListener("click",e=>{const view=e.target.closest("[data-drawer-view]")?.dataset.drawerView;if(view){backdrop.querySelectorAll("[data-drawer-view]").forEach(b=>b.classList.toggle("active",b.dataset.drawerView===view))}});
 const originalShowView=window.showView;
 if(typeof originalShowView==="function")window.showView=function(id){originalShowView(id);close();backdrop.querySelectorAll("[data-drawer-view]").forEach(b=>b.classList.toggle("active",b.dataset.drawerView===id))};
})();


/* V70.7 — professional Excel exports for one or all camp sectors. */
function campSectorExcelRows(sector){
  const assignments=campSectorAssignmentMap();
  return campSectorFamilies().filter(f=>assignments.get(f.key)===sector)
    .sort((a,b)=>a.name.localeCompare(b.name,"ar"))
    .map((f,i)=>({"م":""+(i+1),"القاطع":"القاطع "+sector,"اسم رب الأسرة":f.name,"رقم هوية الأسرة":f.id,"رقم الجوال":f.phone,"العنوان":f.address,"عدد أفراد الأسرة":f.members}));
}
function campSectorExcelMatrix(rows, title){
  const columns=["م","القاطع","اسم رب الأسرة","رقم هوية الأسرة","رقم الجوال","العنوان","عدد أفراد الأسرة"];
  return [["إدارة وكشف المخيمات — إدارة مخيم أبو عريبان"],[title],[`تاريخ التصدير: ${new Date().toLocaleString('ar-EG')}`],[`عدد العائلات: ${rows.length}`],[],columns,...rows.map(row=>columns.map(k=>row[k]??""))];
}
function exportCampSectorExcel(){
  try{
    const sector=selectedCampSector,rows=campSectorExcelRows(sector);
    if(!rows.length){toast("لا توجد عائلات في القاطع "+sector+" لتصديرها");return}
    downloadXLSX(campSectorExcelMatrix(rows,"كشف عائلات القاطع "+sector),`كشف_عائلات_القاطع_${sector}_${dateStamp()}.xlsx`,{headerRow:6,title:"كشف عائلات القاطع "+sector});
    toast("تم تصدير كشف Excel للقاطع "+sector+" ("+rows.length+" عائلة)");
  }catch(e){console.error("Camp sector Excel export",e);toast("تعذر تصدير Excel: "+(e?.message||"يرجى إعادة المحاولة"))}
}
function exportAllCampSectorsExcel(){
  try{
    const summary=CAMP_SECTOR_NAMES.map(sector=>["القاطع "+sector,campSectorExcelRows(sector).length]);
    const total=summary.reduce((n,r)=>n+r[1],0);
    const matrix=[["إدارة وكشف المخيمات — إدارة مخيم أبو عريبان"],["كشف جميع قواطع المخيم"],[`تاريخ التصدير: ${new Date().toLocaleString('ar-EG')}`],[`إجمالي العائلات الموزعة على القواطع: ${total}`],[],["ملخص القواطع","عدد العائلات"],...summary,[],...CAMP_SECTOR_NAMES.flatMap(sector=>{
      const rows=campSectorExcelRows(sector);
      return [[`كشف عائلات القاطع ${sector}`],[`عدد العائلات: ${rows.length}`],[],["م","القاطع","اسم رب الأسرة","رقم هوية الأسرة","رقم الجوال","العنوان","عدد أفراد الأسرة"],...rows.map(row=>[row["م"],row["القاطع"],row["اسم رب الأسرة"],row["رقم هوية الأسرة"],row["رقم الجوال"],row["العنوان"],row["عدد أفراد الأسرة"]]),[]];
    })];
    downloadXLSX(matrix,`كشف_جميع_قواطع_مخيم_أبو_عريبان_${dateStamp()}.xlsx`,{headerRow:6,title:"كشف جميع قواطع المخيم"});
    toast("تم تصدير جميع القواطع في ملف Excel واحد");
  }catch(e){console.error("All camp sectors Excel export",e);toast("تعذر تصدير Excel: "+(e?.message||"يرجى إعادة المحاولة"))}
}


/* V70.16 — offline camp map, isolated storage: never touches family/distribution records */
const OFFLINE_CAMP_MAP_KEY="abuOreibanOfflineCampMapV1";
let offlineCampMapAddArmed=false;
function offlineCampMapRead(){try{const a=JSON.parse(localStorage.getItem(OFFLINE_CAMP_MAP_KEY)||"[]");return Array.isArray(a)?a.filter(x=>x&&typeof x==="object"):[]}catch(e){return []}}
function offlineCampMapWrite(items){try{localStorage.setItem(OFFLINE_CAMP_MAP_KEY,JSON.stringify(items));return true}catch(e){toast("تعذر حفظ الخريطة على هذا الجهاز");return false}}
function offlineCampMapColor(type){return ({tent:"#2563eb",water:"#0891b2",service:"#16a34a",sector:"#7c3aed",need:"#dc2626"})[type]||"#64748b"}
function offlineCampMapTypeName(type){return ({tent:"خيمة / مأوى",water:"نقطة مياه",service:"خدمة / مرفق",sector:"قطاع / منطقة",need:"احتياج / تدخل"})[type]||"موقع"}
function offlineCampMapEsc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderOfflineCampMap(){const svg=document.getElementById("campMapMarkers"),list=document.getElementById("campMapList"),count=document.getElementById("campMapCount");if(!svg||!list)return;const items=offlineCampMapRead();if(count)count.textContent=items.length.toLocaleString("ar-EG");svg.innerHTML=items.map(m=>{const color=offlineCampMapColor(m.type),x=Math.max(12,Math.min(988,Number(m.x)||50)),y=Math.max(12,Math.min(688,Number(m.y)||50));const symbol=m.type==="water"?"≈":m.type==="service"?"✚":m.type==="sector"?"S":m.type==="need"?"!":"⌂";return `<g class="campmap-pin" tabindex="0" role="button" aria-label="${offlineCampMapEsc(m.label)}" transform="translate(${x} ${y})" onclick="focusOfflineCampMapItem('${offlineCampMapEsc(m.id)}')"><circle r="18" fill="${color}" stroke="#fff" stroke-width="4"/><text y="6" text-anchor="middle" font-size="19" font-weight="900" fill="#fff">${symbol}</text><rect x="22" y="-14" width="${Math.max(70,Math.min(220,String(m.label||'').length*10+18))}" height="28" rx="8" fill="#fff" stroke="${color}" stroke-width="2"/><text x="30" y="5" font-size="14" font-weight="800" fill="#172033">${offlineCampMapEsc(String(m.label||'موقع').slice(0,26))}</text></g>`}).join("");list.innerHTML=items.length?items.slice().reverse().map(m=>`<div class="campmap-item"><div><b>${offlineCampMapEsc(m.label||"موقع دون اسم")}</b><small>${offlineCampMapTypeName(m.type)}${m.note?" · "+offlineCampMapEsc(m.note):""}</small></div><button class="btn danger" type="button" onclick="deleteOfflineCampMapItem('${offlineCampMapEsc(m.id)}')" aria-label="حذف الموقع">حذف</button></div>`).join(""):'<div class="campmap-empty">لا توجد مواقع مسجلة حتى الآن. أضف الخيام ونقاط المياه والخدمات بالضغط على المخطط.</div>';const board=document.getElementById("campMapSvg");if(board&&!board.dataset.mapBound){board.dataset.mapBound="1";board.addEventListener("click",e=>{if(!offlineCampMapAddArmed)return;if(e.target.closest(".campmap-pin"))return;const rect=board.getBoundingClientRect(),vb=board.viewBox.baseVal,x=((e.clientX-rect.left)/rect.width)*vb.width,y=((e.clientY-rect.top)/rect.height)*vb.height;const type=document.getElementById("campMapType")?.value||"tent",label=(document.getElementById("campMapLabel")?.value||"").trim(),note=(document.getElementById("campMapNote")?.value||"").trim();if(!label){toast("اكتب اسم الموقع أو رقمه أولاً");document.getElementById("campMapLabel")?.focus();offlineCampMapAddArmed=false;return}const items=offlineCampMapRead();items.push({id:"m"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),type,label,note,x:Math.round(x),y:Math.round(y),createdAt:new Date().toISOString()});if(offlineCampMapWrite(items)){document.getElementById("campMapLabel").value="";document.getElementById("campMapNote").value="";offlineCampMapAddArmed=false;const status=document.getElementById("campMapStatus");if(status)status.textContent="تم حفظ الموقع على هذا الجهاز. يمكنك إضافة موقع آخر.";renderOfflineCampMap();toast("تم حفظ الموقع محلياً")}})}}
function armOfflineCampMapAdd(){const label=(document.getElementById("campMapLabel")?.value||"").trim();if(!label){toast("اكتب اسم الموقع أو رقمه أولاً");document.getElementById("campMapLabel")?.focus();return}offlineCampMapAddArmed=true;const status=document.getElementById("campMapStatus");if(status)status.textContent="وضع تحديد الموقع مفعّل: اضغط الآن على المكان المناسب في المخطط.";document.getElementById("campMapSvg")?.scrollIntoView({behavior:"smooth",block:"center"})}
function deleteOfflineCampMapItem(id){if(!confirm("حذف هذه العلامة من الخريطة المحلية فقط؟ لن تتأثر بيانات العائلات أو التوزيعات."))return;const items=offlineCampMapRead().filter(m=>String(m.id)!==String(id));if(offlineCampMapWrite(items)){renderOfflineCampMap();toast("تم حذف العلامة من الخريطة")}}
function focusOfflineCampMapItem(id){const m=offlineCampMapRead().find(x=>String(x.id)===String(id));if(m){const status=document.getElementById("campMapStatus");if(status)status.textContent=`الموقع المحدد: ${m.label} — ${offlineCampMapTypeName(m.type)}${m.note?" — "+m.note:""}`}}
function exportOfflineCampMap(){const blob=new Blob([JSON.stringify({format:"abu-oreiban-offline-map-v1",items:offlineCampMapRead()},null,2)],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="خريطة-مخيم-ابو-عريبان-نسخة-احتياطية.json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function importOfflineCampMap(event){const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(String(reader.result||"{}")),items=Array.isArray(parsed)?parsed:parsed.items;if(!Array.isArray(items)||items.some(x=>!x||typeof x.label!=="string"||!Number.isFinite(Number(x.x))||!Number.isFinite(Number(x.y))))throw new Error("format");if(!confirm(`سيتم استبدال علامات الخريطة الحالية بـ ${items.length} موقع. لن تتأثر بيانات العائلات أو التوزيعات. متابعة؟`))return;if(offlineCampMapWrite(items)){renderOfflineCampMap();toast("تم استيراد مخطط الخريطة")}}catch(e){toast("ملف الخريطة غير صالح أو غير متوافق") }finally{event.target.value=""}};reader.readAsText(file)}


/* V70.18 — manual camp-map drawing tools; isolated from beneficiary data */
const CAMP_MAP_DRAW_KEY="abuOreibanCampMapDrawingsV1";
let campMapDrawMode="select",campMapDraft=[],campMapUndoStack=[];
function campMapDrawRead(){try{const v=JSON.parse(localStorage.getItem(CAMP_MAP_DRAW_KEY)||"[]");return Array.isArray(v)?v.filter(x=>x&&typeof x==="object"):[]}catch(e){return []}}
function campMapDrawWrite(v){try{localStorage.setItem(CAMP_MAP_DRAW_KEY,JSON.stringify(v));return true}catch(e){toast("تعذر حفظ الرسومات؛ مساحة التخزين قد تكون ممتلئة");return false}}
function campMapSvgPoint(e){const svg=document.getElementById("campMapSvg"),r=svg.getBoundingClientRect(),vb=svg.viewBox.baseVal;return {x:Math.max(0,Math.min(vb.width,(e.clientX-r.left)*vb.width/r.width)),y:Math.max(0,Math.min(vb.height,(e.clientY-r.top)*vb.height/r.height))}}
function setCampMapDrawMode(mode){campMapDrawMode=mode||"select";campMapDraft=[];const s=document.getElementById("campMapDrawStatus");if(s)s.textContent=campMapDrawMode==="select"?"وضع التحديد: يمكنك إضافة علامة من لوحة المواقع.":campMapDrawMode==="note"?"اضغط على المخطط لوضع اسم نصي؛ اكتب الاسم في حقل اسم الرسم.":"اضغط نقاطًا متتابعة على المخطط، ثم اضغط «إنهاء الرسم». الحدود والقطاعات تُغلق تلقائيًا.";const svg=document.getElementById("campMapSvg");if(svg)svg.style.cursor=campMapDrawMode==="select"?"crosshair":"copy";renderCampMapSketches()}
function campMapDrawColor(type){return ({boundary:"#dc2626",road:"#475569",area:"#0f766e",note:"#111827"})[type]||"#475569"}
function renderCampMapSketches(){const g=document.getElementById("campMapSketches");if(!g)return;const esc=offlineCampMapEsc;let html="";for(const d of campMapDrawRead()){const pts=(d.points||[]).map(p=>`${Number(p.x)},${Number(p.y)}`).join(" "),color=campMapDrawColor(d.type),closed=d.type==="boundary"||d.type==="area";if(d.type==="note"){const p=(d.points||[])[0]||{x:50,y:50};html+=`<g><rect x="${p.x}" y="${p.y-24}" width="${Math.max(90,String(d.label||"").length*13+24)}" height="34" rx="7" fill="#fff7cc" stroke="#a16207" stroke-width="2"/><text x="${Number(p.x)+10}" y="${Number(p.y)-2}" font-size="18" font-weight="900" fill="#422006">${esc(d.label||"ملاحظة")}</text></g>`}else{html+=`<g><${closed?"polygon":"polyline"} points="${pts}" fill="${closed?color:"none"}" fill-opacity="${d.type==="area"?"0.16":"0.08"}" stroke="${color}" stroke-width="${d.type==="road"?"10":"5"}" stroke-linecap="round" stroke-linejoin="round" ${d.type==="road"?'stroke-dasharray="none"':""}/><text x="${(d.points?.[0]?.x||50)+8}" y="${(d.points?.[0]?.y||50)-10}" font-size="17" font-weight="900" fill="${color}" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(d.label||({boundary:"حدود مرسومة",road:"شارع",area:"قطاع"}[d.type]))}</text></g>`}}
if(campMapDraft.length){const pts=campMapDraft.map(p=>`${p.x},${p.y}`).join(" ");html+=`<polyline points="${pts}" fill="none" stroke="#f59e0b" stroke-width="5" stroke-dasharray="8 7" stroke-linecap="round"/>`+campMapDraft.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="7" fill="#f59e0b" stroke="#fff" stroke-width="2"/>`).join("")}
g.innerHTML=html;}
function campMapDrawClick(e){if(campMapDrawMode==="select")return;if(e.target.closest(".campmap-pin"))return;e.preventDefault();e.stopPropagation();const p=campMapSvgPoint(e);if(campMapDrawMode==="note"){const label=(document.getElementById("campMapDrawLabel")?.value||"").trim();if(!label){toast("اكتب اسم النص أولًا");return}campMapUndoStack.push(campMapDrawRead());const a=campMapDrawRead();a.push({id:"d"+Date.now().toString(36),type:"note",label,points:[p],createdAt:new Date().toISOString()});if(campMapDrawWrite(a)){document.getElementById("campMapDrawLabel").value="";renderCampMapSketches();toast("تم حفظ النص على المخطط")}return}campMapDraft.push({x:Math.round(p.x),y:Math.round(p.y)});renderCampMapSketches();const st=document.getElementById("campMapDrawStatus");if(st)st.textContent=`تم تحديد ${campMapDraft.length} نقطة. أضف نقاطًا أخرى ثم اضغط «إنهاء الرسم».`}
function finishCampMapDrawing(){if(campMapDrawMode==="select"){toast("اختر أداة رسم أولًا");return}if(campMapDraft.length<(campMapDrawMode==="road"?2:3)){toast(campMapDrawMode==="road"?"الشارع يحتاج نقطتين على الأقل":"الشكل يحتاج ثلاث نقاط على الأقل");return}const label=(document.getElementById("campMapDrawLabel")?.value||"").trim()||({boundary:"حدود المخيم",road:"شارع / ممر",area:"قطاع"}[campMapDrawMode]||"رسم");const a=campMapDrawRead();campMapUndoStack.push(a);a.push({id:"d"+Date.now().toString(36),type:campMapDrawMode,label,points:campMapDraft.map(p=>({...p})),createdAt:new Date().toISOString()});if(campMapDrawWrite(a)){campMapDraft=[];document.getElementById("campMapDrawLabel").value="";renderCampMapSketches();const st=document.getElementById("campMapDrawStatus");if(st)st.textContent="تم حفظ الرسم محليًا. يمكنك اختيار أداة أخرى ومتابعة المخطط.";toast("تم حفظ الرسم");}}
function cancelCampMapDrawing(){campMapDraft=[];renderCampMapSketches();const st=document.getElementById("campMapDrawStatus");if(st)st.textContent="تم إلغاء الرسم الجاري فقط؛ الرسومات المحفوظة لم تتغير."}
function undoCampMapDrawing(){if(campMapDraft.length){campMapDraft.pop();renderCampMapSketches();return}const prev=campMapUndoStack.pop();if(!prev){toast("لا توجد خطوة رسم للتراجع عنها");return}if(campMapDrawWrite(prev)){renderCampMapSketches();toast("تم التراجع عن آخر رسم")}}
function clearCampMapDrawings(){if(!confirm("هل تريد مسح كل الحدود والشوارع والقطاعات والنصوص التي رسمتها يدويًا؟ لن تتأثر علامات المواقع أو بيانات الأسر والتوزيعات."))return;campMapUndoStack.push(campMapDrawRead());if(campMapDrawWrite([])){campMapDraft=[];renderCampMapSketches();toast("تم مسح الرسومات اليدوية")}}
function toggleCampMapOldBoundary(show){const p=document.getElementById("campMapOldBoundary");if(p)p.style.display=show?"":"none";const svg=document.getElementById("campMapSvg");if(svg){const groups=svg.querySelectorAll("g");groups.forEach(g=>{if(g.querySelector('circle[fill="#dc2626"]')&&g.querySelector('text')?.textContent?.startsWith("نقطة"))g.style.display=show?"":"none"})}}
(function bindCampMapDrawingTools(){const svg=document.getElementById("campMapSvg");if(!svg||svg.dataset.manualDrawBound)return;svg.dataset.manualDrawBound="1";svg.addEventListener("click",campMapDrawClick,true);svg.addEventListener("dblclick",e=>{if(campMapDrawMode!=="select"){e.preventDefault();e.stopPropagation()}},true);renderCampMapSketches()})();
const campMapExportBase=exportOfflineCampMap;
exportOfflineCampMap=function(){const payload={format:"abu-oreiban-map-v2",items:offlineCampMapRead(),drawings:campMapDrawRead(),savedAt:new Date().toISOString()};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="خريطة-مخيم-ابو-عريبان-نسخة-احتياطية.json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
const campMapImportBase=importOfflineCampMap;
importOfflineCampMap=function(event){const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const p=JSON.parse(String(reader.result||"{}")),items=Array.isArray(p)?p:p.items,drawings=Array.isArray(p.drawings)?p.drawings:[];if(!Array.isArray(items)||items.some(x=>!x||typeof x.label!=="string"||!Number.isFinite(Number(x.x))||!Number.isFinite(Number(x.y))))throw new Error("markers");if(drawings.some(d=>!d||!Array.isArray(d.points)||d.points.some(q=>!Number.isFinite(Number(q.x))||!Number.isFinite(Number(q.y)))))throw new Error("drawings");if(!confirm(`سيتم استبدال محتوى الخريطة بـ ${items.length} علامة و${drawings.length} رسم. لن تتأثر بيانات الأسر والتوزيعات. متابعة؟`))return;if(offlineCampMapWrite(items)&&campMapDrawWrite(drawings)){renderOfflineCampMap();renderCampMapSketches();toast("تم استيراد الخريطة والرسومات")}}catch(e){toast("ملف الخريطة غير صالح أو غير متوافق")}finally{event.target.value=""}};reader.readAsText(file)};
