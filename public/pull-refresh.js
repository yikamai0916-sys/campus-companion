import {mountIcon} from './brand-icon.js?v=20261102';

// Pull down from the top of the task list; leave normal and nested scrolling alone.
export function initPullRefresh({canRefresh,refresh,label,onError}){
  const indicator=document.createElement('div');
  indicator.className='pull-refresh';
  indicator.setAttribute('role','status');indicator.setAttribute('aria-live','polite');
  const icon=document.createElement('span');icon.className='bi-tile pull-refresh-icon';
  const text=document.createElement('span');text.className='pull-refresh-label';
  indicator.append(icon,text);document.body.append(indicator);mountIcon(icon);
  let start=null,tracking=false,distance=0,busy=false;
  const threshold=72;
  function clear(){start=null;tracking=false;distance=0;indicator.classList.remove('is-visible','is-ready','is-refreshing');indicator.style.removeProperty('--pull');text.textContent='';}
  function blocked(target){
    if(!(target instanceof Element))return true;
    if(target.closest('dialog[open],input,textarea,select,button,[contenteditable="true"],.picker-popup'))return true;
    for(let el=target;el&&el!==document.body;el=el.parentElement){
      const style=getComputedStyle(el);
      if(/auto|scroll/.test(style.overflowY)&&el.scrollHeight>el.clientHeight+1)return true;
    }
    return false;
  }
  document.addEventListener('touchstart',e=>{
    if(busy||e.touches.length!==1||!matchMedia('(max-width: 700px)').matches||!canRefresh()||window.scrollY>0||blocked(e.target)){start=null;return;}
    start={x:e.touches[0].clientX,y:e.touches[0].clientY};tracking=false;
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!start||busy)return;
    if(e.touches.length!==1||!canRefresh()){clear();return;}
    const dx=e.touches[0].clientX-start.x,dy=e.touches[0].clientY-start.y;
    if(!tracking&&(dy<8||Math.abs(dx)>dy)){if(dy< -8||Math.abs(dx)>12)start=null;return;}
    if(window.scrollY>0&&!tracking){start=null;return;}
    tracking=true;if(e.cancelable)e.preventDefault();
    distance=Math.max(0,Math.min(106,dy*.55));
    indicator.style.setProperty('--pull',`${distance}px`);
    indicator.classList.toggle('is-visible',distance>4);
    indicator.classList.toggle('is-ready',distance>=threshold);
    text.textContent=label(distance>=threshold?'release':'pull');
  },{passive:false});
  async function end(){
    if(!start)return;
    if(!tracking||distance<threshold){clear();return;}
    start=null;tracking=false;busy=true;
    indicator.classList.add('is-refreshing');indicator.classList.remove('is-ready');
    indicator.style.setProperty('--pull','72px');text.textContent=label('refreshing');
    try{await refresh();}catch(error){onError(error);}finally{busy=false;clear();}
  }
  document.addEventListener('touchend',end,{passive:true});
  document.addEventListener('touchcancel',()=>{if(!busy)clear();},{passive:true});
}
