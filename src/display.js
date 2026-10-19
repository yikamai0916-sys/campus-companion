// System-generated content is rendered in the account language; user text is preserved.
export const wording=(locale,cn,tw,en)=>locale==='en'?en:locale==='zh-TW'?tw:cn;
export const formatTime=(value,locale)=>new Date(value).toLocaleString(locale||'zh-CN',{timeZone:'Asia/Hong_Kong',hour12:false});
export function meetingTask(task,poll,locale){
 if(!poll)return task;
 return {...task,title:wording(locale,'参加会议：','參加會議：','Attend meeting: ')+poll.name,notes:wording(locale,'会议时间：','會議時間：','Meeting time: ')+formatTime(task.due,locale)};
}
export function reminderPayload(task,locale='zh-CN'){
 return {title:wording(locale,'待办提醒：','待辦提醒：','Task reminder: ')+task.title,body:(task.due?wording(locale,'截止：','截止：','Due: ')+formatTime(task.due,locale):wording(locale,'自定义提醒','自訂提醒','Custom reminder'))+wording(locale,'。完成后请在清单打勾，后续提醒会停止。','。完成後請在清單勾選，後續提醒會停止。','. Mark it complete to stop future reminders.'),url:'/?task='+encodeURIComponent(task.id)};
}
