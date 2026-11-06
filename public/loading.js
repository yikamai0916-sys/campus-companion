const line=(width='100%',height=16)=>`<span class="loading-line" style="width:${width};height:${height}px"></span>`;
const lines=()=>line('94%')+line('79%')+line('56%');
export function loadingFrame(kind){
  const head=`<div class="meta">${line('140px')}</div><h2>${line('65%',28)}</h2>`;
  if(kind==='groups')return `<div class="groups-layout"><div class="group-index"><div class="loading-index">${line('60%')}${line('80%',12)}</div></div><div class="group-panel"><div class="group-panel-head"><div style="flex:1">${head}${line('40%')}</div>${line('100px',42)}</div><section class="group-section">${line('90px',22)}<div class="member-list">${line('130px',56)}${line('130px',56)}</div>${line('100%',48)}</section><section class="group-section">${line('160px',22)}${line('140px',40)}</section><section class="group-section">${line('160px',22)}<div class="meeting-form">${line('80px',12)}${line('100%',48)}<div class="form-row">${line('100%',48)}${line('100%',48)}</div><div class="form-row">${line('100%',48)}${line('100%',48)}</div></div></section></div></div>`;
  if(kind==='digests')return `<article class="mail-card dg-card">${head}${line('70%')}<div class="dg-stats">${Array.from({length:3},()=>`<div class="dg-stat">${line('38px',32)}${line('72px',12)}</div>`).join('')}</div><div class="dg-toolbar">${line('310px',40)}</div><ul class="dg-list">${Array.from({length:3},()=>`<li class="loading-row">${line('85%',20)}${line('70%',14)}</li>`).join('')}</ul></article>`;
  return Array.from({length:3},()=>`<article class="mail-card"><div class="mail-card-head">${line('210px')}${line('70px',36)}</div><h2>${line('76%',24)}</h2><div class="sender">${line('46%',14)}${line('30%',14)}</div><div class="loading-copy">${lines()}</div></article>`).join('');
}
export function startLoading(root,kind){
  const token={};root.loadingToken=token;
  root.setAttribute('aria-busy','true');
  const timer=setTimeout(()=>{
    if(root.loadingToken!==token)return;
    if(!root.children.length){
      root.innerHTML=`<div data-loading-frame aria-hidden="true">${loadingFrame(kind)}</div>`;
      root.classList.add('content-loading');
    }
  },200);
  return ()=>{
    clearTimeout(timer);
    if(root.loadingToken!==token)return;
    root.classList.remove('content-loading');root.removeAttribute('aria-busy');
    root.querySelector('[data-loading-frame]')?.remove();
  };
}
