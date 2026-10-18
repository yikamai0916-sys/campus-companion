// Server-side error-message localization.
//
// The Worker used to return hardcoded Simplified Chinese messages, which
// leaked Simplified Chinese into English / Traditional interfaces.  The
// browser now sends the active interface language as `X-Locale`; this module
// maps each known message to Traditional Chinese (Hong Kong wording) and
// English.  Unknown messages pass through unchanged so internal errors are
// never masked.

export const validLocales=new Set(['zh-CN','zh-TW','en']);
export const normalizeLocale=value=>validLocales.has(String(value||''))?String(value):'zh-CN';

// cn -> [zh-TW (Hong Kong wording), en]
const MESSAGES={
  '请求过大':['請求過大','Request too large'],
  '请求来源无效':['請求來源無效','Invalid request origin'],
  'iPhone 邮件转交尚未配置':['iPhone 郵件轉交尚未設定','iPhone mail forwarding is not configured'],
  '邮件转交密钥无效':['郵件轉交密鑰無效','Invalid mail forwarding key'],
  '请输入有效邮箱地址':['請輸入有效電郵地址','Enter a valid email address'],
  '密保问题需为 4–120 个字符':['密保問題需為 4–120 個字元','Security question must be 4–120 characters'],
  '该邮箱已经注册，请直接登录':['該電郵已經註冊，請直接登入','This email is already registered. Sign in instead.'],
  '该账号尚未设置密保问题，请登录后设置':['該帳戶尚未設定密保問題，請登入後設定','No security question set for this account. Set one after signing in.'],
  '邮箱或密保答案不正确':['電郵或密保答案不正確','Incorrect email or security answer'],
  '尝试次数过多，请 15 分钟后重试':['嘗試次數過多，請 15 分鐘後重試','Too many attempts. Try again in 15 minutes.'],
  '邮箱或密码不正确':['電郵或密碼不正確','Incorrect email or password'],
  '请先登录':['請先登入','Sign in first'],
  '当前密码不正确':['目前密碼不正確','Incorrect current password'],
  '昵称最多 80 个字符；图片头像需为 PNG、JPEG、WEBP 或 GIF':['暱稱最多 80 個字元；圖片頭像需為 PNG、JPEG、WEBP 或 GIF','Nickname is limited to 80 characters; image avatars must be PNG, JPEG, WEBP, or GIF'],
  '偏好中文译名最多 40 个字符':['偏好中文譯名最多 40 個字元','Preferred Chinese name is limited to 40 characters'],
  '关联邮箱格式不正确':['關聯電郵格式不正確','Invalid linked email address'],
  '提醒配置不正确':['提醒設定不正確','Invalid reminder configuration'],
  '邮件提醒时间不正确':['郵件提醒時間不正確','Invalid mail reminder time'],
  '任务不存在':['任務不存在','Task not found'],
  '请先接受或拒绝这项分工':['請先接受或拒絕這項分工','Accept or decline this assignment first'],
  '已拒绝的分工不能修改':['已拒絕的分工不能修改','Declined assignments cannot be edited'],
  '邮件提醒暂不可用，请选择手机通知':['郵件提醒暫不可用，請選擇手機通知','Email reminders are unavailable. Use phone notifications.'],
  '任务已在其他设备更新，请刷新后重试':['任務已在其他裝置更新，請重新整理後再試','Task was updated on another device. Refresh and try again.'],
  '任务已更新，请刷新':['任務已更新，請重新整理','Task was updated. Refresh.'],
  '只有已完成任务可以删除':['只有已完成任務可以刪除','Only completed tasks can be deleted'],
  '邮件不存在':['郵件不存在','Email not found'],
  '请输入有效的 Outlook 邮箱':['請輸入有效的 Outlook 電郵','Enter a valid Outlook email'],
  '尚未连接 Outlook':['尚未連接 Outlook','Outlook is not connected'],
  '通知订阅无效':['通知訂閱無效','Invalid notification subscription'],
  '不支持的通知服务':['不支援的通知服務','Unsupported notification service'],
  '页面不存在':['頁面不存在','Page not found'],
  '暂时无法处理，请重试':['暫時無法處理，請重試','Something went wrong. Try again later.'],
  '无法确认任务所属账号':['無法確認任務所屬帳戶','Could not identify the task owner account'],
  '候选任务标题需为 1–200 个字符':['候選任務標題需為 1–200 個字元','Candidate task title must be 1–200 characters'],
  '小组名称需为 1–80 个字符':['小組名稱需為 1–80 個字元','Group name must be 1–80 characters'],
  '会议名称需为 1–120 个字符':['會議名稱需為 1–120 個字元','Meeting name must be 1–120 characters'],
  '截止时间无效':['截止時間無效','Invalid deadline'],
  '候选任务已经处理':['候選任務已經處理','Candidate task was already handled'],
  '小组不存在或你不是成员':['小組不存在或你不是成員','Group not found, or you are not a member'],
  '只有小组创建者可以添加成员':['只有小組建立者可以新增成員','Only the group owner can add members'],
  '该同学需要先注册 Campus Companion':['該同學需要先註冊 Campus Companion','This classmate must register for Campus Companion first'],
  '该用户已经是成员':['該用戶已經是成員','This user is already a member'],
  '建议负责人不是小组成员':['建議負責人不是小組成員','The proposed assignee is not a group member'],
  '候选任务不存在':['候選任務不存在','Candidate task not found'],
  '审核操作无效':['審核操作無效','Invalid review action'],
  '负责人不是小组成员':['負責人不是小組成員','The assignee is not a group member'],
  '候选任务无法重复创建':['候選任務無法重複建立','Candidate task cannot be created twice'],
  '小组任务不存在':['小組任務不存在','Group task not found'],
  '该分工已经处理':['該分工已經處理','This assignment was already handled'],
  '分工操作无效':['分工操作無效','Invalid assignment action'],
  '操作无效':['操作無效','Invalid action'],
  '邀请不存在或已经处理':['邀請不存在或已經處理','Invitation not found or already handled'],
  '邀请已经处理':['邀請已經處理','Invitation was already handled'],
  '请选择另一位成员接任组长':['請選擇另一位成員接任組長','Choose another member as the new owner'],
  '只有组长可以移除成员':['只有組長可以移除成員','Only the owner can remove members'],
  '请先转让组长，再退出小组':['請先轉讓組長，再退出小組','Transfer ownership before leaving the group'],
  '请先让组长取消小组会议，再变更成员':['請先讓組長取消小組會議，再變更成員','Ask the owner to cancel active meetings before changing membership'],
  '请先完成或拒绝该成员的未完成分工':['請先完成或拒絕該成員的未完成分工','Complete or decline this member’s outstanding assignments first'],
  '会议收集不存在或你不是小组成员':['會議收集不存在或你不是小組成員','Meeting poll not found, or you are not a group member'],
  '可用时间收集已经结束':['可用時間收集已經結束','Availability collection has ended'],
  '会议已更新，请刷新后重试':['會議已更新，請重新整理後再試','Meeting changed. Refresh and try again.'],
  '只有小组创建者可以开启投票':['只有小組建立者可以開啟投票','Only the group owner can open voting'],
  '会议投票已经开启或结束':['會議投票已經開啟或結束','Voting is already open or has ended'],
  '仍有成员未提交可用时间':['仍有成員未提交可用時間','Some members have not submitted availability'],
  '当前没有全员可参加的候选时间':['目前沒有全員可參加的候選時間','No option works for every voter'],
  '会议投票尚未开启或已经结束':['會議投票尚未開啟或已經結束','Voting has not opened or has ended'],
  '你不在本次会议的投票名单中':['你不在本次會議的投票名單中','You are not on this meeting’s voting list'],
  '该时间不在投票选项中':['該時間不在投票選項中','This time is not a voting option'],
  '会议投票已经结束':['會議投票已經結束','Voting has ended'],
  '只有小组创建者可以确认会议时间':['只有小組建立者可以確認會議時間','Only the group owner can confirm the meeting time'],
  '请先完成会议投票':['請先完成會議投票','Finish the meeting vote first'],
  '仍有成员未投票':['仍有成員未投票','Some members have not voted'],
  '只能确认当前得票最高的时间':['只能確認目前得票最高的時間','Only the highest-voted time can be confirmed'],
  '会议时间已经处理':['會議時間已經處理','Meeting time was already handled'],
  '投票结果已变化或会议时间已经处理，请刷新后重试':['投票結果已變化或會議時間已經處理，請重新整理後再試','Votes changed or the meeting was already confirmed. Refresh and try again.'],
  '只有组长可以取消或改期':['只有組長可以取消或改期','Only the owner can cancel or reschedule'],
  '请先正确配置独立 Outlook 应用':['請先正確設定獨立 Outlook 應用','Configure a standalone Outlook app first'],
  'Outlook 授权失败或已过期，请重新连接':['Outlook 授權失敗或已過期，請重新連接','Outlook authorization failed or expired. Reconnect.'],
  '登录请求失效，请重试':['登入請求失效，請重試','Sign-in request expired. Try again.'],
  '无法核对 Outlook 账号':['無法核對 Outlook 帳戶','Could not verify the Outlook account'],
  '无法识别 Outlook 邮箱':['無法識別 Outlook 電郵','Could not identify the Outlook email'],
  '请连接接收学校转发邮件的个人 Outlook 邮箱，不要直接连接学校邮箱':['請連接接收學校轉發郵件的個人 Outlook 電郵，不要直接連接學校電郵','Connect a personal Outlook mailbox that receives forwarded school mail, not the school mailbox directly'],
  '无效邮件分页地址':['無效郵件分頁地址','Invalid mail pagination address'],
  '邮件超过 10 MB，未处理附件内容':['郵件超過 10 MB，未處理附件內容','Email exceeds 10 MB; attachments were not processed'],
  '主账号尚未初始化，请先登录网站':['主帳戶尚未初始化，請先登入網站','Main account is not initialized. Sign in on the website first.'],
  '邮件正文为空，未能导入':['郵件正文為空，未能匯入','Email body is empty; nothing was imported'],
  '系统通知尚未配置':['系統通知尚未設定','Push notifications are not configured'],
  '通知订阅已过期，请在手机重新启用通知':['通知訂閱已過期，請在手機重新啟用通知','Subscription expired. Enable notifications on your phone again.'],
  '不支持的提醒渠道':['不支援的提醒渠道','Unsupported reminder channel'],
  '无法计算提醒时段':['無法計算提醒時段','Could not compute reminder times']
};

// cn -> ({twLabel, enLabel}) for the few parameterized templates.
const LABELS={
  '候选任务标题':['候選任務標題','Candidate task title'],
  '小组名称':['小組名稱','Group name'],
  '会议名称':['會議名稱','Meeting name']
};

// cn pattern -> (cn, locale) => localized string.  Matched after exact lookup.
const TEMPLATES=[
  {re:/^([\u4e00-\u9fff]+)需为 1–(\d+) 个字符$/,apply:(cn,locale)=>{
    const match=cn.match(/^([\u4e00-\u9fff]+)需为 1–(\d+) 个字符$/);
    const [label,max]=[match[1],match[2]],pair=LABELS[label]||[label,label];
    return locale==='zh-TW'?`${pair[0]}需為 1–${max} 個字元`:locale==='en'?`${pair[1]} must be 1–${max} characters`:cn;
  }},
  {re:/^Outlook 请求失败（(\d+)），稍后重试或重新连接$/,apply:(cn,locale)=>{
    const match=cn.match(/^Outlook 请求失败（(\d+)），稍后重试或重新连接$/);
    return locale==='zh-TW'?`Outlook 請求失敗（${match[1]}），稍後重試或重新連接`:locale==='en'?`Outlook request failed (${match[1]}). Retry later or reconnect.`:cn;
  }},
  {re:/^推送服务暂不可用（(\d+)）$/,apply:(cn,locale)=>{
    const match=cn.match(/^推送服务暂不可用（(\d+)）$/);
    return locale==='zh-TW'?`推送服務暫不可用（${match[1]}）`:locale==='en'?`Push service temporarily unavailable (${match[1]})`:cn;
  }}
];

export function serverMessage(cn,locale){
  const target=normalizeLocale(locale);
  if(target==='zh-CN')return cn;
  const pair=MESSAGES[cn];
  if(pair)return target==='zh-TW'?pair[0]:pair[1];
  for(const template of TEMPLATES)if(template.re.test(cn))return template.apply(cn,target);
  return cn;
}
