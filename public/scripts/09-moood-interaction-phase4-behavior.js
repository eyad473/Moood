
(function(){'use strict';
 function init(){
  // Make existing mobile navigation and drawer buttons report the active page.
  // Only add accessibility metadata: never dispatch clicks or change navigation state.
  const navs=[...document.querySelectorAll('.mobile-bottom-nav button,.drawer-items button')];
  if(navs.length){
   const refresh=()=>{
    for(const b of navs){
     const active=b.classList.contains('active')||b.getAttribute('data-active')==='true';
     if(active)b.setAttribute('aria-current','page');
     else b.removeAttribute('aria-current');
    }
   };
   const observer=new MutationObserver(refresh);
   for(const b of navs)observer.observe(b,{attributes:true,attributeFilter:['class','data-active']});
   refresh();
  }
  // Keep modal overlays from exposing invisible controls to screen readers only
  // where the app explicitly sets aria-hidden; no interference with modal lifecycle.
  document.querySelectorAll('button[disabled]').forEach(b=>b.setAttribute('aria-disabled','true'));
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
