
(function(){'use strict';
function setup(){
 const drawer=document.getElementById('mobileDrawerBackdrop');
 const openButton=document.getElementById('mobileDrawerOpen');
 const closeButton=document.getElementById('mobileDrawerClose');
 if(!drawer||!openButton)return;
 let wasOpen=drawer.classList.contains('open');
 let previousFocus=null;
 const update=()=>{
  const opened=drawer.classList.contains('open');
  drawer.setAttribute('aria-hidden',String(!opened));
  openButton.setAttribute('aria-expanded',String(opened));
  if(opened===wasOpen)return;
  wasOpen=opened;
  if(opened){previousFocus=document.activeElement;requestAnimationFrame(()=>{if(drawer.classList.contains('open'))(closeButton||drawer.querySelector('button'))?.focus({preventScroll:true})})}
  else if(drawer.contains(document.activeElement)){(previousFocus&&previousFocus.isConnected?previousFocus:openButton).focus({preventScroll:true})}
 };
 new MutationObserver(update).observe(drawer,{attributes:true,attributeFilter:['class']});update();
 drawer.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();(closeButton||openButton).click();return}
  if(e.key!=='Tab'||!drawer.classList.contains('open'))return;
  const controls=[...drawer.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x=>x.getClientRects().length);
  if(!controls.length)return;
  if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls[controls.length-1].focus()}
  else if(!e.shiftKey&&document.activeElement===controls[controls.length-1]){e.preventDefault();controls[0].focus()}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
