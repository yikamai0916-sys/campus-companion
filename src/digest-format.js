/** Shape school-mail digests into card-friendly items (no raw Outlook URLs). */

const URL_RE=/https?:\/\/\S+/gi;

export function stripUrls(text=''){
  return String(text||'').replace(URL_RE,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}

/** Short actionable blurb from subject + summary when AI is off. */
export function extractiveSummary(subject='',summary='',max=140){
  let text=stripUrls(summary||'');
  if(!text)text=stripUrls(subject||'');
  text=text.replace(/\s+/g,' ').trim();
  if(!text)return '';
  const sentence=text.match(/^[\s\S]{1,140}?[。！？.!?](?=\s|$)/);
  const cut=(sentence?sentence[0]:text).trim();
  return cut.length>max?cut.slice(0,max-1)+'…':cut;
}

export function shapeDigestItem(message){
  const summary=extractiveSummary(message.subject,message.summary);
  return {
    id:String(message.id||''),
    subject:String(message.subject||'无主题').slice(0,300),
    sender:String(message.sender||'').slice(0,320),
    origin:String(message.origin||'').slice(0,180),
    summary,
    action:stripUrls(String(message.action||'')).slice(0,220),
    category:Number(message.category)||0,
    received:Number(message.received)||0
  };
}

export function digestPushBody(items,emptyText){
  if(!items.length)return emptyText||'这个时段没有需要总结的学校邮件。';
  return items.map(item=>`• ${item.subject}\n  ${item.summary||item.action||''}`).join('\n\n');
}

export function shapeDigestRecord({title,created,items,emptyText}){
  const list=Array.isArray(items)?items:[];
  return {
    title,
    created,
    items:list,
    body:digestPushBody(list,emptyText)
  };
}

/** Upgrade legacy digest JSON that only had a plain `body` with Outlook URLs. */
export function normalizeDigestRecord(raw){
  if(!raw||typeof raw!=='object')return null;
  const title=String(raw.title||'');
  const created=Number(raw.created)||0;
  if(Array.isArray(raw.items)&&raw.items.length){
    const items=raw.items.map(item=>({
      id:String(item.id||''),
      subject:String(item.subject||'').slice(0,300),
      sender:String(item.sender||'').slice(0,320),
      origin:String(item.origin||'').slice(0,180),
      summary:extractiveSummary(item.subject,item.summary||item.body||''),
      action:stripUrls(String(item.action||'')).slice(0,220),
      category:Number(item.category)||0,
      received:Number(item.received)||0
    }));
    return {title,created,items,body:stripUrls(raw.body||digestPushBody(items))};
  }
  const body=stripUrls(raw.body||'');
  const chunks=body.split(/\n{2,}/).map(chunk=>chunk.trim()).filter(Boolean);
  const items=chunks.map((chunk,index)=>{
    const lines=chunk.split('\n').map(line=>line.trim()).filter(Boolean);
    const subject=lines[0]||`条目 ${index+1}`;
    const sender=(lines.find(line=>/^发件人[:：]/.test(line))||'').replace(/^发件人[:：]\s*/,'');
    const origin=(lines.find(line=>/^来源[:：]/.test(line))||'').replace(/^来源[:：]\s*/,'');
    const rest=lines.filter(line=>!/^发件人[:：]/.test(line)&&!/^来源[:：]/.test(line)&&line!==subject);
    const summary=extractiveSummary(subject,rest[0]||'');
    const action=rest.find(line=>/无需操作|请|截止|提交|核对/.test(line))||rest[1]||'';
    return {id:'',subject:subject.slice(0,300),sender:sender.slice(0,320),origin:origin.slice(0,180),summary,action:stripUrls(action).slice(0,220),category:0,received:0};
  }).filter(item=>item.subject&&!/^在这个时段|^这个时段/.test(item.subject));
  return {title,created,items,body:body||digestPushBody(items)};
}
