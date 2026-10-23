// Build a new allowlisted document. Never insert email markup into the live DOM.
export function safeMailUrl(value,image=false){
  try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password)return u.href;
    if(!image&&u.protocol==='mailto:')return u.href;
    if(image&&/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(value))return value;
  }catch{}return '';
}
export function compactPlainBody(value){
  let text=String(value||'').replace(/\r/g,'').replace(/[ \t]+\n/g,'\n');
  // Only remove a recognized forwarding header at the beginning, never quoted history.
  const match=text.match(/^[\s_\-]*(?:Begin forwarded message:\s*|Forwarded message\s*)?(?:From|发件人|寄件者)\s*[:：][\s\S]{0,2500}?(?:Subject|主题|主旨)\s*[:：][^\n]*(?:\n|$)/i);
  if(match&&/(?:Sent|Date|发送时间|寄件日期)\s*[:：]/i.test(match[0])&&/(?:To|收件人|收件者)\s*[:：]/i.test(match[0]))text=text.slice(match[0].length);
  return text.replace(/\n[\s\n]*\n/g,'\n\n').trim();
}
export function renderMailBody({html,body,images={}},doc=document){
 const root=doc.createElement('div');root.className='original-mail-body';
 if(!html){root.textContent=compactPlainBody(body);root.classList.add('plain-mail');return root;}
 const template=doc.createElement('template');template.innerHTML=html;
 const allowed=new Set('p div span br a img strong b em i u s ul ol li blockquote h1 h2 h3 h4 table tbody thead tr td th hr'.split(' '));
 const drop=new Set('script style iframe object embed form input button select textarea link meta base svg math video audio source noscript'.split(' '));
 function copy(node,parent){
  if(node.nodeType===3){parent.append(doc.createTextNode(node.textContent));return;}
  if(node.nodeType!==1)return;
  const tag=node.localName;if(drop.has(tag))return;
  if(!allowed.has(tag)){for(const c of node.childNodes)copy(c,parent);return;}
  const el=doc.createElement(tag);
  if(tag==='img'){
   const raw=node.getAttribute('src')||'';
   const cid=raw.replace(/^cid:/i,'').replace(/^<|>$/g,'');
   const src=safeMailUrl(/^cid:/i.test(raw)?images[cid]||'':raw,true);
   // Skip known tracking pixels and invisible spacer images.
   if(!src||Number(node.getAttribute('width')||99)<=2||Number(node.getAttribute('height')||99)<=2)return;
   el.src=src;el.alt=node.getAttribute('alt')||'';el.loading='lazy';el.referrerPolicy='no-referrer';el.decoding='async';
   el.addEventListener('error',()=>{el.replaceWith(doc.createTextNode(el.alt||''));},{once:true});
  }
  if(tag==='a'){const href=safeMailUrl(node.getAttribute('href'));if(href){el.href=href;el.target='_blank';el.rel='noopener noreferrer';el.referrerPolicy='no-referrer';}}
  if(tag==='td'||tag==='th')for(const attr of ['colspan','rowspan']){const n=Number(node.getAttribute(attr));if(n>0&&n<=20)el.setAttribute(attr,String(n));}
  for(const child of node.childNodes)copy(child,el);parent.append(el);
 }
 for(const child of template.content.childNodes)copy(child,root);
 // Outlook's leading forwarding block ends with Subject. Remove only that prefix.
 const walker=doc.createTreeWalker(root,4);const nodes=[];let n;
 while((n=walker.nextNode())){nodes.push(n);if(nodes.map(x=>x.textContent).join('').length>3500)break;}
 const all=nodes.map(x=>x.textContent).join('');
 const from=all.search(/(?:From|发件人|寄件者)\s*[:：]/i);
 const subject=/(?:Subject|主题|主旨)\s*[:：]/i.exec(all);
 if(from>=0&&from<250&&/^[\s_\-]*(?:(?:Begin forwarded message:|Forwarded message)\s*)?$/i.test(all.slice(0,from))&&subject&&subject.index>from&&/(?:Sent|Date|发送时间|寄件日期)\s*[:：]/i.test(all.slice(from,subject.index))&&/(?:To|收件人|收件者)\s*[:：]/i.test(all.slice(from,subject.index))){
   let offset=0,target;for(const node of nodes){offset+=node.textContent.length;if(offset>subject.index+subject[0].length){target=node;break;}}
   if(target){
     let block=target.parentElement;while(block&&block!==root&&!['P','DIV','TD'].includes(block.tagName))block=block.parentElement;
     // Do not remove an ancestor containing the entire message.
     if(block===root){
       let end=target;while(end.nextSibling&&end.nextSibling.nodeName!=='BR'&&end.nextSibling.nodeType===3)end=end.nextSibling;
       if(end.nextSibling?.nodeName==='BR'){const range=doc.createRange();range.setStart(root,0);range.setEndAfter(end.nextSibling);range.deleteContents();}
     }else if(block&&block.textContent.length<1500){
       const range=doc.createRange();range.setStart(root,0);range.setEndAfter(block);range.deleteContents();
     }
   }
 }
 // Empty Outlook paragraphs/spacer tables create oversized gaps.
 for(const el of [...root.querySelectorAll('p,div,span,td,tr,table')].reverse())
   if(!el.textContent.replace(/\u00a0/g,' ').trim()&&!el.querySelector('img'))el.remove();
 for(const br of [...root.querySelectorAll('br')])if(br.previousSibling?.nodeName==='BR')br.remove();
 return root;
}
