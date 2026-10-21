/** Preferred Chinese name substitution for digests / summaries / translations.
 *
 * Two sources of aliases:
 *  - users.preferred_zh_name (legacy single value): a fixed table of known
 *    variants plus same-pronunciation character expansions.
 *  - name_aliases table (user-defined, many): each row maps a name variant
 *    ("MA Yikai", "mayikai", "Yikai Ma") to the preferred Chinese name.
 *
 * Matching is case/order/spacing-insensitive: "MA Yikai", "Yikai Ma" and
 * "mayikai" all normalize to the same key.  Email addresses inside `<...>`
 * are protected so aliases never rewrite mailbox prefixes.
 */

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

/** "MA Yikai" -> "ma yikai" ; keeps only a-z0-9. */
export const normalizeName=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
/** Order-insensitive key: "Yikai MA" and "MA Yikai" share it. */
export const tokenKey=s=>{const n=normalizeName(s);return n?n.split(' ').sort().join(' '):'';};
/** Spacing-insensitive key: "mayikai" and "ma yikai" share it. */
const compactKey=s=>normalizeName(s).replace(/\s+/g,'');

/** All normalized forms a single alias should match: original order,
 *  compacted, reversed order, reversed-and-compacted. */
export function nameFormKeys(alias=''){
  const n=normalizeName(alias);
  if(!n)return new Set();
  const tokens=n.split(' ');
  if(tokens.length<2)return new Set([n]);
  return new Set([n,tokens.join(''),tokens.slice().reverse().join(' '),tokens.slice().reverse().join('')]);
}

/** [{zhName, patterns:[...]}] sorted longest-pattern-first.  Accepts either
 *  the legacy string form or an array of {alias,zhName}. */
export function buildAliasRules(aliasesOrPreferred='',preferredZhName=''){
  const list=Array.isArray(aliasesOrPreferred)?aliasesOrPreferred:[];
  const preferred=Array.isArray(aliasesOrPreferred)?String(preferredZhName||'').trim():String(aliasesOrPreferred||'').trim();
  const groups=new Map();
  const add=(alias,zhName)=>{
    const a=String(alias||'').trim(),z=String(zhName||'').trim();
    if(!a||!z)return;
    if(!groups.has(z))groups.set(z,new Set());
    const forms=nameFormKeys(a);
    if(forms.size){for(const form of forms)groups.get(z).add(form);}
    else if(/[\u4e00-\u9fff]/.test(a))groups.get(z).add(a.toLowerCase()); // Chinese variant matches verbatim
  };
  for(const row of list){add(row.alias,row.zhName);for(const wrong of nameAliases(row.zhName))add(wrong,row.zhName);}
  if(preferred){for(const wrong of nameAliases(preferred))add(wrong,preferred);}
  return [...groups.entries()].map(([zhName,forms])=>({zhName,patterns:[...forms].sort((a,b)=>b.length-a.length)}));
}

const escapeRegExp=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

/** Replace alias forms in text with the Chinese name, case-insensitively.
 *  Email addresses inside angle brackets are left untouched. */
export function applyNameAliases(text,rules=[]){
  if(text==null||!rules.length)return text;
  const emails=[];
  const guarded=String(text).replace(/<[^<>]*@[^<>]*>/g,email=>{emails.push(email);return `\u0000${emails.length-1}\u0000`;});
  const replacements=new Map();
  for(const {zhName,patterns} of rules)for(const pattern of patterns)if(pattern&&!replacements.has(pattern.toLowerCase()))replacements.set(pattern.toLowerCase(),zhName);
  const pattern=[...replacements.keys()].sort((a,b)=>b.length-a.length).map(escapeRegExp).join('|');
  const out=pattern?guarded.replace(new RegExp(pattern,'ig'),match=>replacements.get(match.toLowerCase())):guarded;
  return out.replace(/\u0000(\d+)\u0000/g,(_,i)=>emails[i]);
}

/** Legacy single-value path kept for callers that pass preferred_zh_name. */
export function applyPreferredName(text,preferred=''){
  return applyNameAliases(text,buildAliasRules(preferred));
}

/** Accepts either the legacy preferred string or an alias-rules array. */
export function applyPreferredNameToFields(row,preferredOrAliases='',fields=['subject','sender','origin','summary','action','quality','title','body']){
  if(!preferredOrAliases||!row)return row;
  const rules=Array.isArray(preferredOrAliases)?preferredOrAliases:buildAliasRules(preferredOrAliases);
  if(!rules.length)return row;
  const next={...row};
  for(const field of fields){
    if(typeof next[field]==='string')next[field]=applyNameAliases(next[field],rules);
  }
  return next;
}

export function preferredNamePromptHint(preferred=''){
  const name=String(preferred||'').trim();
  if(!name)return '';
  return `收件人中文姓名必须写作「${name}」，禁止改写成其他同音字（例如勿写成马毅凯）。英文里如需写姓名可保留拼音，但中文摘要里必须用「${name}」。`;
}

/** Pull the human name out of a sender field: "MA Yikai <mayikai@x>" -> "MA Yikai". */
export function extractSenderName(sender=''){
  const raw=String(sender||'');
  const angle=raw.match(/<[^<>]*>/)||[];
  const head=(angle[0]?raw.slice(0,raw.indexOf(angle[0])):raw).trim();
  if(head&&!/@/.test(head))return head.replace(/^['"]+|['"]+$/g,'').trim();
  const email=raw.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)||[];
  if(email[0])return email[0].split('@')[0].replace(/[._-]+/g,' ');
  return raw.trim();
}

/** Find name variants seen in mail senders that normalize to an existing
 *  alias but are written differently (different word order, compaction or
 *  spacing), so the user can adopt them in one tap. */
export function suggestAliasVariants(senders=[],aliasesOrPreferred='',preferredZhName=''){
  const trim=s=>String(s||'').trim();
  const rawAliases=[];
  if(Array.isArray(aliasesOrPreferred)){
    for(const a of aliasesOrPreferred){const text=trim(a?.alias),zh=trim(a?.zhName);if(text&&zh)rawAliases.push({text,zhName:zh});}
  }else{const p=trim(aliasesOrPreferred);if(p)rawAliases.push({text:p,zhName:p});}
  const preferred=trim(preferredZhName);
  if(preferred&&!rawAliases.some(a=>a.text===preferred))rawAliases.push({text:preferred,zhName:preferred});
  const latin=rawAliases.filter(a=>/[a-z]/i.test(a.text));
  if(!latin.length)return [];
  const out=[],seen=new Set();
  for(const raw of senders){
    const name=extractSenderName(raw);
    const nk=tokenKey(name);
    if(!nk)continue;
    for(const {text,zhName} of latin){
      const sameWritten=normalizeName(text)===normalizeName(name);
      const sameIdentity=tokenKey(text)===nk||compactKey(text)===compactKey(name);
      if(sameIdentity&&!sameWritten){
        const key=normalizeName(name);
        if(!seen.has(key)){seen.add(key);out.push({variant:name.trim(),zhName});}
        break;
      }
    }
  }
  return out;
}
