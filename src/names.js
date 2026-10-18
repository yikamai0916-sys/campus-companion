/** Preferred Chinese name substitution for digests / summaries / translations. */

const KNOWN_ALIASES={
  '马艺恺':['马毅凯','马艺凯','马毅恺','马一凯','马一恺','馬藝愷','馬毅凱','馬藝凱','馬毅愷','Ma Yikai','Ma Yi Kai','Yikai Ma','Yi Kai Ma'],
  '馬藝愷':['馬毅凱','馬藝凱','馬毅愷','马艺恺','马毅凯','马艺凯','马毅恺','Ma Yikai','Ma Yi Kai','Yikai Ma','Yi Kai Ma']
};

const VARIANT_GROUPS=[['艺','毅','一','藝'],['恺','凯','愷','凱']];

function expandCharVariants(name=''){
  const chars=[...String(name)];
  if(chars.length<2||chars.length>4)return [];
  const out=new Set();
  const walk=(i,built)=>{
    if(i===chars.length){if(built!==name)out.add(built);return;}
    const ch=chars[i];
    const group=VARIANT_GROUPS.find(g=>g.includes(ch));
    const options=group||[ch];
    for(const opt of options)walk(i+1,built+opt);
  };
  walk(0,'');
  return [...out];
}

export function nameAliases(preferred=''){
  const name=String(preferred||'').trim();
  if(!name)return [];
  const aliases=new Set([...(KNOWN_ALIASES[name]||[]),...expandCharVariants(name)]);
  aliases.delete(name);
  return [...aliases].sort((a,b)=>b.length-a.length);
}

export function applyPreferredName(text,preferred=''){
  const name=String(preferred||'').trim();
  if(!name||text==null)return text;
  let out=String(text);
  for(const wrong of nameAliases(name)){
    if(!wrong)continue;
    if(out.includes(wrong))out=out.split(wrong).join(name);
  }
  return out;
}

export function applyPreferredNameToFields(row,preferred='',fields=['subject','sender','origin','summary','action','quality','title','body']){
  if(!preferred||!row)return row;
  const next={...row};
  for(const field of fields){
    if(typeof next[field]==='string')next[field]=applyPreferredName(next[field],preferred);
  }
  return next;
}

export function preferredNamePromptHint(preferred=''){
  const name=String(preferred||'').trim();
  if(!name)return '';
  return `收件人中文姓名必须写作「${name}」，禁止改写成其他同音字（例如勿写成马毅凯）。英文里如需写姓名可保留拼音，但中文摘要里必须用「${name}」。`;
}
