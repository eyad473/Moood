/* Presentation-only navigation indicator. Never changes active view or application state. */
(function(){'use strict';
function start(){
 var nav=document.querySelector('.mobile-bottom-nav');if(!nav||nav.querySelector('.v80-nav-indicator'))return;
 var indicator=document.createElement('span');indicator.className='v80-nav-indicator';indicator.setAttribute('aria-hidden','true');nav.insertBefore(indicator,nav.firstChild);
 var raf=0;
 function update(){if(raf)return;raf=requestAnimationFrame(function(){raf=0;
  if(!nav.isConnected||!nav.getClientRects().length)return;
  var active=nav.querySelector('button.active,button[aria-current="page"]');
  if(!active){var view=document.querySelector('.view.active');if(view)active=nav.querySelector('button[data-mobile-view="'+CSS.escape(view.id)+'"]');}
  if(!active){indicator.classList.remove('v80-visible');return;}
  var nr=nav.getBoundingClientRect(),ar=active.getBoundingClientRect();
  indicator.style.width=ar.width+'px';indicator.style.height=ar.height+'px';
  indicator.style.transform='translate3d('+(ar.left-nr.left+nav.scrollLeft)+'px,'+(ar.top-nr.top+nav.scrollTop)+'px,0)';
  indicator.classList.add('v80-visible');
 });}
 var observer=new MutationObserver(update);nav.querySelectorAll('button').forEach(function(b){observer.observe(b,{attributes:true,attributeFilter:['class','aria-current']});});
 var viewObserver=new MutationObserver(update);document.querySelectorAll('.view').forEach(function(v){viewObserver.observe(v,{attributes:true,attributeFilter:['class']});});
 window.addEventListener('resize',update,{passive:true});nav.addEventListener('click',function(){requestAnimationFrame(update)});document.addEventListener('visibilitychange',function(){if(!document.hidden)update()});
 if(typeof ResizeObserver!=='undefined'){var resize=new ResizeObserver(update);resize.observe(nav);}
 update();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
