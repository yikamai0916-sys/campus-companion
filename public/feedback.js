export const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())&&String(value).trim().length<=254;

export async function requestJSON(url,options={},fetcher=fetch,timeoutMs=30000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetcher(url,{...options,signal:controller.signal});
    let data;
    try{data=await response.json();}catch{throw Object.assign(new Error('服务返回了异常响应，请稍后重试'),{code:'response'});}
    if(!response.ok)throw Object.assign(new Error(data.error||'操作失败，请重试'),{status:response.status,code:data.code});
    return data;
  }catch(error){
    if(error.status||error.code)throw error;
    const read=!options.method||options.method==='GET';
    throw Object.assign(new Error(controller.signal.aborted?'请求超时，请先刷新确认操作结果，再决定是否重试':read?'无法连接服务器，请检查网络或本地服务，再重试':'连接中断，操作结果尚未确认；请刷新检查后再重试'),{code:'network'});
  }finally{clearTimeout(timer);}
}

export function enhanceForms(root,translate){
  for(const form of root.querySelectorAll('form')){
    const primary=form.id==='password-form'?form.elements.next:['register-form','recovery-form'].includes(form.id)?form.elements.password:null;
    if(primary&&!form.elements.confirmPassword){
      const label=document.createElement('label');
      const text=document.createElement('span');text.textContent=translate('确认密码');label.append(text);
      const confirm=document.createElement('input');Object.assign(confirm,{type:'password',name:'confirmPassword',autocomplete:'new-password',required:primary.required,maxLength:256});label.append(confirm);
      primary.closest('label').after(label);
      const validate=()=>confirm.setCustomValidity(confirm.value!==primary.value?translate('两次输入的密码不一致'): '');
      primary.addEventListener('input',validate);confirm.addEventListener('input',validate);
      form.addEventListener('reset',()=>confirm.setCustomValidity(''));
    }
    for(const input of form.querySelectorAll('input[type=email]')){
      if(input.dataset.emailChecked)continue;input.dataset.emailChecked='true';
      const validate=()=>input.setCustomValidity(input.value&&!validEmail(input.value)?translate('请输入完整邮箱地址，例如 name@outlook.com'):'');
      input.addEventListener('input',validate);input.addEventListener('change',validate);
      input.addEventListener('blur',validate);
      form.addEventListener('reset',()=>input.setCustomValidity(''));
    }
    for(const input of form.querySelectorAll('input[type=password]')){
      if(input.dataset.revealReady)continue;input.dataset.revealReady='true';
      const wrap=document.createElement('span');wrap.className='password-field';input.before(wrap);wrap.append(input);
      const button=document.createElement('button');button.type='button';button.className='password-toggle';
      button.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
      const update=()=>{const visible=input.type==='text';button.setAttribute('aria-pressed',String(visible));button.setAttribute('aria-label',translate(visible?'隐藏密码':'显示密码'));button.dataset.labelSource=visible?'隐藏密码':'显示密码';};
      button.onclick=()=>{input.type=input.type==='password'?'text':'password';update();};
      form.addEventListener('reset',()=>{input.type='password';update();});update();wrap.append(button);
    }
    if(!form.dataset.feedbackReady){
      form.dataset.feedbackReady='true';
      form.addEventListener('submit',()=>{const notice=form.querySelector('.error');if(notice)notice.textContent='';},true);
      form.addEventListener('invalid',event=>{
        let notice=form.querySelector('.error');
        if(!notice){notice=document.createElement('p');notice.className='error';notice.setAttribute('role','alert');form.append(notice);}
        notice.textContent=event.target.validationMessage;
      },true);
    }
  }
}

export function clearAuthSecrets(form){
  for(const input of form.querySelectorAll('input')){
    if(input.type!=='password'&&!input.dataset.revealReady)continue;
    input.value='';input.setCustomValidity('');
    if(input.type==='text')input.parentElement.querySelector('.password-toggle')?.click();
    input.dispatchEvent(new Event('input',{bubbles:true}));
  }
}
