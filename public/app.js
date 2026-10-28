import { initTheme, updateThemeLabels } from './theme-switch.js?v=20261024-dual-theme';
import { ensureHero, ensureDock, flyToDock } from './brand-icon.js';
import { isArchivedTask, tasksForPeriod, periodProgress, nextHkMidnight } from './task-periods.js';
import {renderMailBody} from './mail-reader.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const I18N={
  'zh-CN':{appName:'校园清单',appDescription:'学校邮件、作业与日常待办，在一个清单里。',clearDue:'清除截止时间',mainNav:'主导航',taskStatus:'任务状态',remindBefore:'截止前提醒',exactReminders:'指定提醒时间（香港）',remindWindow:'允许提醒的时段（香港时间）',remindChannel:'提醒方式',mailZh:'中文',close:'关闭',mailSearch:'搜索邮件',mailSearchPlaceholder:'搜索邮件…',addAlias:'添加英文名变体',aliasSuggestionsLabel:'邮件里识别到的相似写法，点击即可添加：',aliasRemove:'移除这个变体',aliasPlaceholder:'输入英文名写法',aliasZhPlaceholder:'输入对应中文名',heroTitle:'把要紧的事<br>放在眼前。',heroSubtitle:'作业、提醒和学校邮件，随时回来查看。',login:'登录',register:'注册',loginEmail:'登录邮箱',registerEmail:'注册邮箱',password:'访问密码',setPassword:'设置密码（至少 12 个字符）',securityQuestion:'自定义密保问题',securityAnswer:'密保答案',openList:'打开我的清单',forgot:'忘记密码？',createAccount:'创建账号',standaloneLogin:'独立登录 · 不需要打开 ChatGPT',tasks:'我的待办',mail:'邮件',settings:'设置',personalAccount:'个人账号',hkTime:'香港时间 · UTC+8',tasksEyebrow:'留出时间，做好重要的事',mailEyebrow:'先看重要的，再看感兴趣的',settingsEyebrow:'管理你的账号与连接',mailNotice:'每日 20:00 日报 · 00:00 按需补充晚间新邮件。原始发件人会单独标出。',profile:'个人空间',logout:'退出登录',save:'保存',language:'界面语言',nickname:'昵称',avatar:'头像',linkedEmail:'关联邮箱',reminderDefaults:'默认提醒设置',offsets:'提前提醒分钟数（逗号分隔）',repeat:'截止后重复间隔（分钟）',start:'提醒开始时间',end:'提醒结束时间',defaultNickname:'用户'},
  'zh-TW':{appName:'校園清單',appDescription:'學校郵件、作業與日常待辦，在一個清單裏。',clearDue:'清除截止時間',mainNav:'主導航',taskStatus:'任務狀態',remindBefore:'截止前提醒',exactReminders:'指定提醒時間（香港）',remindWindow:'允許提醒的時段（香港時間）',remindChannel:'提醒方式',mailZh:'中文',close:'關閉',mailSearch:'搜尋郵件',mailSearchPlaceholder:'搜尋郵件…',addAlias:'新增英文名寫法',aliasSuggestionsLabel:'郵件裏識別到的相似寫法，點擊即可新增：',aliasRemove:'移除這個寫法',aliasPlaceholder:'輸入英文名寫法',aliasZhPlaceholder:'輸入對應中文名',heroTitle:'把重要的事<br>放在眼前。',heroSubtitle:'作業、提醒和學校郵件，隨時回來查看。',login:'登入',register:'註冊',loginEmail:'登入電郵',registerEmail:'註冊電郵',password:'登入密碼',setPassword:'設定密碼（至少 12 個字元）',securityQuestion:'自訂密保問題',securityAnswer:'密保答案',openList:'開啟我的清單',forgot:'忘記密碼？',createAccount:'建立帳號',standaloneLogin:'獨立登入 · 不需要開啟 ChatGPT',tasks:'我的待辦',mail:'郵件',settings:'設定',personalAccount:'個人帳號',hkTime:'香港時間 · UTC+8',tasksEyebrow:'留出時間，做好重要的事',mailEyebrow:'先看重要的，再看感興趣的',settingsEyebrow:'管理你的帳號與連接',mailNotice:'每日 20:00 日報 · 00:00 按需補充晚間新郵件。原始發件人會單獨標出。',profile:'個人空間',logout:'登出',save:'儲存',language:'介面語言',nickname:'暱稱',avatar:'頭像',linkedEmail:'關聯電郵',reminderDefaults:'預設提醒設定',offsets:'提前提醒分鐘數（逗號分隔）',repeat:'截止後重複間隔（分鐘）',start:'提醒開始時間',end:'提醒結束時間',defaultNickname:'用戶'},
  en:{appName:'Campus Companion',appDescription:'School email, assignments, and daily to-dos in one place.',clearDue:'Clear deadline',mainNav:'Main navigation',taskStatus:'Task status',remindBefore:'Remind before due',exactReminders:'Specific reminder times (Hong Kong)',remindWindow:'Allowed reminder window (Hong Kong time)',remindChannel:'Reminder channel',mailZh:'Chinese',close:'Close',mailSearch:'Search mail',mailSearchPlaceholder:'Search mail…',addAlias:'Add name variant',aliasSuggestionsLabel:'Similar spellings found in your mail — click to add:',aliasRemove:'Remove this variant',aliasPlaceholder:'Enter name as written',aliasZhPlaceholder:'Enter corresponding Chinese name',heroTitle:'Keep important things<br>in front of you.',heroSubtitle:'Assignments, reminders, and school email in one place.',login:'Sign in',register:'Create account',loginEmail:'Email',registerEmail:'Email',password:'Password',setPassword:'Password (12 characters minimum)',securityQuestion:'Security question',securityAnswer:'Security answer',openList:'Open my list',forgot:'Forgot password?',createAccount:'Create account',standaloneLogin:'Independent sign-in · no ChatGPT required',tasks:'My tasks',mail:'Mail',settings:'Settings',personalAccount:'Personal account',hkTime:'Hong Kong time · UTC+8',tasksEyebrow:'Make time for what matters',mailEyebrow:'Important first, then interesting',settingsEyebrow:'Manage your account and connections',mailNotice:'Daily digest at 20:00 · evening additions at 00:00. Original senders are shown separately.',profile:'Personal space',logout:'Sign out',save:'Save',language:'Interface language',nickname:'Nickname',avatar:'Avatar',linkedEmail:'Linked email',reminderDefaults:'Default reminders',offsets:'Reminder offsets in minutes (comma separated)',repeat:'Repeat interval after due time (minutes)',start:'Reminder start time',end:'Reminder end time',defaultNickname:'User'}
};
let locale='zh-CN';
let reminderDefaults={offsets:[4320,1440,120,30],repeat:1440,start:'08:00',end:'23:00'};
function detectLocale(){const saved=localStorage.getItem('campus-locale');if(saved&&I18N[saved])return saved;const nav=String(navigator.language||navigator.languages?.[0]||'').toLowerCase();if(nav.startsWith('zh')){if(/(?:hk|tw|mo|hant)/.test(nav))return 'zh-TW';return 'zh-CN';}return 'en';}
function applyLocale(next){locale=I18N[next]?next:'zh-CN';document.documentElement.lang=locale;document.title=I18N[locale].appName;const metaDescription=$('meta[name=description]');if(metaDescription&&I18N[locale].appDescription)metaDescription.content=I18N[locale].appDescription;for(const el of $$('[data-i18n]')){const value=I18N[locale][el.dataset.i18n];if(value!==undefined)el.innerHTML=value;}for(const el of $$('[data-i18n-placeholder]')){const value=I18N[locale][el.dataset.i18nPlaceholder];if(value!==undefined)el.placeholder=value;}for(const el of $$('[data-i18n-aria]')){const value=I18N[locale][el.dataset.i18nAria];if(value!==undefined)el.setAttribute('aria-label',value);}const staticText={'.login h1':'heroTitle','.login>p':'heroSubtitle','.private':'personalAccount','.tasks-eyebrow':'tasksEyebrow'};for(const [selector,key] of Object.entries(staticText)){const el=$(selector),value=I18N[locale][key];if(el&&value!==undefined)el.innerHTML=value;}const logoutButton=$('#logout');if(logoutButton)logoutButton.setAttribute('aria-label',tx('logout'));translateTextNodes();updateManifestLocale();updateThemeLabels();}
function updateManifestLocale(){const link=$('link[rel=manifest]');if(!link)return;if(!link.dataset.src)link.dataset.src=link.href;fetch(link.dataset.src).then(response=>response.ok?response.json():null).then(manifest=>{if(!manifest)return;manifest.name=I18N[locale].appName;manifest.short_name=I18N[locale].appName;manifest.lang=locale;if(I18N[locale].appDescription)manifest.description=I18N[locale].appDescription;const dark=document.documentElement.dataset.theme==='dark';manifest.background_color=manifest.theme_color=dark?'#141817':'#f3f7f6';manifest.icons=manifest.icons.map(icon=>({...icon,src:`/icon-${icon.sizes.split('x')[0]}${dark?'-dark':''}.png?v=20261024-dual-theme`}));link.href=URL.createObjectURL(new Blob([JSON.stringify(manifest)],{type:'application/manifest+json'}));}).catch(()=>{});}
const tx=key=>I18N[locale]?.[key]||I18N['zh-CN'][key]||key;

Object.assign(I18N['zh-CN'],{
  originalSender:'原始发件人：',source:'来源：',viewOriginal:'查看原邮件 ↗',deleteMail:'删除邮件记录',confirmDeleteMail:'确定删除这条邮件摘要吗？原 Outlook 邮件不会被删除。',mailDeleted:'已删除邮件摘要',mailEmptyTitle:'邮件摘要会在这里汇合',mailEmptyText:'连接 Outlook 后，学校转发邮件会自动进入这里。成功提交回执和纯宗教内容会自动略过。',
  cat1:'奖学金 / 金钱 / ITSC',cat2:'课程与作业',cat3:'学校活动',cat4:'课程与 ILP 推荐',
  outlookMail:'关联邮箱',schoolEmail:'学校邮箱',synced:'同步完成',outlookNotConnected:'尚未连接 Outlook',reconnect:'重新连接',connectOutlook:'连接 Outlook',accountSecurity:'账号安全',currentPassword:'当前密码',newPassword:'新密码（至少 12 个字符）',changePassword:'修改密码',customQuestion:'自定义问题',answer:'答案',saveSecurity:'保存密保',signOutHere:'退出账号',signOutHint:'退出当前账号并返回首页。',
  avatarType:'PNG、JPEG、WEBP 或 GIF',avatarPreview:'头像预览',profileSaved:'个人资料已保存',passwordSaved:'密码已更新',securitySaved:'密保问题已保存',avatarInvalid:'头像必须是 PNG、JPEG、WEBP 或 GIF',
  taskAdded:'添加待办',taskEdited:'编辑待办',taskTitle:'任务名称',taskSaved:'待办已保存',settingsTitle:'设置',settingsEyebrow:'管理你的账号与连接'
  ,connectedAs:'已连接账号：',connectOutlookHint:'连接你接收学校转发邮件的个人 Outlook 邮箱。授权时请在 Microsoft 页面选择自己的账号；请勿连接学校邮箱。',outlookEmail:'要连接的 Outlook 邮箱',outlookSetupNeeded:'Outlook 授权尚未配置，请联系网站管理员。',disconnectOutlook:'断开 Outlook',disconnectOutlookHint:'断开连接不会删除已有摘要和待办。',confirmDisconnectOutlook:'确定断开此 Outlook 邮箱吗？之后可以随时重新连接。',outlookDisconnected:'Outlook 已断开',syncNow:'立即同步',syncing:'正在同步…',syncFinished:'同步完成：新增 {count} 封学校邮件',syncSchoolOnly:'当前同步范围：学校转发邮件。'
});
Object.assign(I18N['zh-TW'],{
  originalSender:'原始發件人：',source:'來源：',viewOriginal:'查看原郵件 ↗',deleteMail:'刪除郵件記錄',confirmDeleteMail:'確定刪除這則郵件摘要嗎？原 Outlook 郵件不會被刪除。',mailDeleted:'已刪除郵件摘要',mailEmptyTitle:'郵件摘要會在這裡匯合',mailEmptyText:'連接 Outlook 後，學校轉發郵件會自動進入這裡。成功提交回執和純宗教內容會自動略過。',
  cat1:'獎學金 / 金錢 / ITSC',cat2:'課程與作業',cat3:'學校活動',cat4:'課程與 ILP 推薦',
  outlookMail:'關聯電郵',schoolEmail:'學校電郵',synced:'同步完成',outlookNotConnected:'尚未連接 Outlook',reconnect:'重新連接',connectOutlook:'連接 Outlook',accountSecurity:'帳號安全',currentPassword:'目前密碼',newPassword:'新密碼（至少 12 個字元）',changePassword:'修改密碼',customQuestion:'自訂問題',answer:'答案',saveSecurity:'儲存密保',signOutHere:'登出帳號',signOutHint:'登出目前帳號並返回首頁。',
  avatarType:'PNG、JPEG、WEBP 或 GIF',avatarPreview:'頭像預覽',profileSaved:'個人資料已儲存',passwordSaved:'密碼已更新',securitySaved:'密保問題已儲存',avatarInvalid:'頭像必須是 PNG、JPEG、WEBP 或 GIF',
  taskAdded:'新增待辦',taskEdited:'編輯待辦',taskTitle:'任務名稱',taskSaved:'待辦已儲存',settingsTitle:'設定',settingsEyebrow:'管理你的帳號與連接'
  ,connectedAs:'已連接帳號：',connectOutlookHint:'連接你接收學校轉發郵件的個人 Outlook 電郵。授權時請在 Microsoft 頁面選擇自己的帳號；請勿連接學校電郵。',outlookEmail:'要連接的 Outlook 電郵',outlookSetupNeeded:'Outlook 授權尚未設定，請聯絡網站管理員。',disconnectOutlook:'中斷 Outlook 連接',disconnectOutlookHint:'中斷連接不會刪除已有摘要和待辦。',confirmDisconnectOutlook:'確定中斷此 Outlook 電郵嗎？之後可以隨時重新連接。',outlookDisconnected:'Outlook 已中斷連接',syncNow:'立即同步',syncing:'正在同步…',syncFinished:'同步完成：新增 {count} 封學校郵件',syncSchoolOnly:'目前同步範圍：學校轉發郵件。'
});
Object.assign(I18N.en,{
  originalSender:'Original sender:',source:'Source:',viewOriginal:'View original mail ↗',deleteMail:'Delete mail record',confirmDeleteMail:'Delete this mail summary? The original Outlook email will not be deleted.',mailDeleted:'Mail summary deleted',mailEmptyTitle:'Mail summaries appear here',mailEmptyText:'Forwarded school mail appears here after Outlook is connected. Submission receipts and purely religious mail are skipped.',
  cat1:'Scholarships / money / ITSC',cat2:'Courses & assignments',cat3:'School activities',cat4:'Course & ILP recommendations',
  outlookMail:'Connected email',schoolEmail:'School email',synced:'Synced',outlookNotConnected:'Outlook is not connected',reconnect:'Reconnect',connectOutlook:'Connect Outlook',accountSecurity:'Account security',currentPassword:'Current password',newPassword:'New password (12 characters minimum)',changePassword:'Change password',customQuestion:'Custom question',answer:'Answer',saveSecurity:'Save security question',signOutHere:'Sign out',signOutHint:'Sign out of this account and return home.',
  avatarType:'PNG, JPEG, WEBP, or GIF',avatarPreview:'Avatar preview',profileSaved:'Profile saved',passwordSaved:'Password updated',securitySaved:'Security question saved',avatarInvalid:'Avatar must be PNG, JPEG, WEBP, or GIF',
  taskAdded:'Add task',taskEdited:'Edit task',taskTitle:'Task title',taskSaved:'Task saved',settingsTitle:'Settings',settingsEyebrow:'Manage your account and connections'
  ,connectedAs:'Connected account:',connectOutlookHint:'Connect the personal Outlook mailbox that receives your forwarded school mail. Choose your own account on Microsoft’s page; do not connect your school mailbox.',outlookEmail:'Outlook email to connect',outlookSetupNeeded:'Outlook authorization is not configured. Please contact the site administrator.',disconnectOutlook:'Disconnect Outlook',disconnectOutlookHint:'Existing summaries and tasks are kept when you disconnect.',confirmDisconnectOutlook:'Disconnect this Outlook mailbox? You can reconnect it at any time.',outlookDisconnected:'Outlook disconnected',syncNow:'Sync now',syncing:'Syncing…',syncFinished:'Sync complete: {count} new school email(s)',syncSchoolOnly:'Sync scope: school-forwarded email.'
});


Object.assign(I18N['zh-CN'],{mailNotifications:'邮件提醒',focusCategories:'重点关注的邮件类别',dailyDigest:'日报提醒',lateDigest:'晚间补充提醒',digestTime:'发送时间（香港）',saveMailPreferences:'保存邮件提醒',mailPreferencesSaved:'邮件提醒设置已保存',categoryMoney:'奖学金、金钱与 ITSC',categoryCourse:'课程、作业与考试',categoryActivity:'学校活动与邀请',categoryRecommendation:'课程与 ILP 推荐',mailReminderHelp:'日报涵盖当天从 00:00 至所设时间的邮件；晚间补充涵盖日报后新增邮件。关闭后不会发送对应提醒。'});
Object.assign(I18N['zh-TW'],{mailNotifications:'郵件提醒',focusCategories:'重點關注的郵件類別',dailyDigest:'日報提醒',lateDigest:'晚間補充提醒',digestTime:'發送時間（香港）',saveMailPreferences:'儲存郵件提醒',mailPreferencesSaved:'郵件提醒設定已儲存',categoryMoney:'獎學金、金錢與 ITSC',categoryCourse:'課程、作業與考試',categoryActivity:'學校活動與邀請',categoryRecommendation:'課程與 ILP 推薦',mailReminderHelp:'日報涵蓋當天由 00:00 至所設時間的郵件；晚間補充涵蓋日報後新增郵件。關閉後不會傳送對應提醒。'});
Object.assign(I18N.en,{mailNotifications:'Mail reminders',focusCategories:'Mail categories to prioritise',dailyDigest:'Daily digest',lateDigest:'Evening addition',digestTime:'Delivery time (Hong Kong)',saveMailPreferences:'Save mail reminders',mailPreferencesSaved:'Mail reminder settings saved',categoryMoney:'Scholarships, money & ITSC',categoryCourse:'Courses, assignments & exams',categoryActivity:'School activities & invitations',categoryRecommendation:'Course & ILP recommendations',mailReminderHelp:'The daily digest covers mail from 00:00 to its selected time. The evening addition covers new mail since that digest. Turning one off stops that reminder.'});
Object.assign(I18N['zh-CN'],{outlookMissing:'当前缺少：',outlookSetupHelp:'连接器代码已经就绪；部署者需按 docs/OUTLOOK_SETUP.md 注册 Microsoft 应用并配置这些变量。'});
Object.assign(I18N['zh-TW'],{outlookMissing:'目前缺少：',outlookSetupHelp:'連接器程式已就緒；部署者需依 docs/OUTLOOK_SETUP.md 註冊 Microsoft 應用程式並設定這些變數。'});
Object.assign(I18N.en,{outlookMissing:'Missing configuration:',outlookSetupHelp:'The connector is implemented. The deployer must register a Microsoft app and configure these values using docs/OUTLOOK_SETUP.md.'});

Object.assign(I18N['zh-CN'],{digests:'日报与提醒',digestEyebrow:'按你的关注词筛选',focusTerms:'关注词或主题',focusTermsHelp:'输入你关心的关键词，每行一个。留空则不筛选。',digestHistoryEmpty:'尚未生成日报或晚间补充',digestHistoryHelp:'到设置中开启日报或晚间补充后，发送过的总结会保留在这里。'});
Object.assign(I18N['zh-TW'],{digests:'日報與提醒',digestEyebrow:'依你的關注詞篩選',focusTerms:'關注詞或主題',focusTermsHelp:'輸入你關心的關鍵詞，每行一個。留空則不篩選。',digestHistoryEmpty:'尚未產生日報或晚間補充',digestHistoryHelp:'到設定中開啟日報或晚間補充後，已發送的總結會保留在這裡。'});
Object.assign(I18N.en,{digests:'Daily digests & reminders',digestEyebrow:'Filtered by your focus terms',focusTerms:'Focus terms or topics',focusTermsHelp:'Add one keyword per line. Leave blank to include all imported mail.',digestHistoryEmpty:'No daily digests or evening additions yet',digestHistoryHelp:'Turn on a daily digest or evening addition in Settings. Sent summaries will appear here.'});
Object.assign(I18N['zh-CN'],{preferredZhName:'偏好中文译名',preferredZhNameHelp:'用于邮件摘要与翻译中的你的中文姓名。留空则沿用自动翻译。',mailTranslateZh:'提供邮件中文翻译',mailEnglishSummary:'提供英文摘要',mailTranslateHelp:'按需选择邮件的阅读语言。',mailDetail:'邮件详情',mailChinese:'中文翻译',mailEnglish:'英文原文',openMail:'查看邮件',loadMoreMail:'加载更多邮件',noDigestItems:'这份日报没有可展示的邮件条目。'});
Object.assign(I18N['zh-TW'],{preferredZhName:'偏好中文譯名',preferredZhNameHelp:'用於郵件摘要與翻譯中的你的中文姓名。留空則沿用自動翻譯。',mailTranslateZh:'提供郵件中文翻譯',mailEnglishSummary:'提供英文摘要',mailTranslateHelp:'按需要選擇郵件的閱讀語言。',mailDetail:'郵件詳情',mailChinese:'中文翻譯',mailEnglish:'英文原文',openMail:'查看郵件',loadMoreMail:'載入更多郵件',noDigestItems:'這份日報沒有可展示的郵件條目。'});
Object.assign(I18N.en,{preferredZhName:'Preferred Chinese name',preferredZhNameHelp:'Used when digests mention you in Chinese.',mailTranslateZh:'Chinese translation for mail',mailEnglishSummary:'English summary',mailTranslateHelp:'Choose your preferred reading options.',mailDetail:'Mail detail',mailChinese:'Chinese',mailEnglish:'English original',openMail:'Open mail',loadMoreMail:'Load more mail',noDigestItems:'No mail items in this digest.'});



const TEXTS={
'校园清单':['校園清單','校園清單','Campus Companion'],'登录':['登录','登入','Sign in'],'注册':['注册','註冊','Create account'],'登录邮箱':['登入電郵','登入電郵','Email'],'注册邮箱':['註冊電郵','註冊電郵','Email'],'访问密码':['登入密碼','登入密碼','Password'],'打开我的清单':['開啟我的清單','開啟我的清單','Open my list'],'忘记密码？':['忘記密碼？','忘記密碼？','Forgot password?'],'创建账号':['建立帳號','建立帳號','Create account'],'独立登录 · 不需要打开 ChatGPT':['獨立登入 · 不需要開啟 ChatGPT','獨立登入 · 不需要開啟 ChatGPT','Independent sign-in · no ChatGPT required'],'我的待办':['我的待辦','我的待辦','My tasks'],'邮件':['邮件','郵件','Mail'],'提醒与连接':['提醒與連接','提醒與連接','Reminders & connections'],'个人空间':['個人空間','個人空間','Personal space'],'个人账号':['個人帳號','個人帳號','Personal account'],'香港时间 · UTC+8':['香港時間 · UTC+8','香港時間 · UTC+8','Hong Kong time · UTC+8'],'留出时间，做好重要的事':['留出時間，做好重要的事','留出時間，做好重要的事','Make time for what matters'],'先看重要的，再看感兴趣的':['先看重要的，再看感興趣的','先看重要的，再看感興趣的','Important first, then interesting'],'让提醒按你的节奏来':['讓提醒按你的節奏來','讓提醒按你的節奏來','Set reminders at your pace'],'每日 20:00 日报 · 00:00 按需补充晚间新邮件。原始发件人会单独标出。':['每日 20:00 日報 · 00:00 按需補充晚間新郵件。原始發件人會單獨標出。','每日 20:00 日報 · 00:00 按需補充晚間新郵件。原始發件人會單獨標出。','Daily digest at 20:00 · evening additions at 00:00. Original senders are shown separately.'],'未完成':['未完成','未完成','Open'],'三天内截止':['三天內截止','三天內截止','Due within 3 days'],'已完成':['已完成','已完成','Completed'],'进行中':['進行中','進行中','In progress'],'按截止时间排列':['按截止時間排列','按截止時間排列','Sorted by due date'],'自动待办仅来自作业类邮件。活动与课程推荐保留在学校邮件中。':['自動待辦僅來自作業類郵件。活動與課程推薦保留在學校郵件中。','自動待辦僅來自作業類郵件。活動與課程推薦保留在學校郵件中。','Automatic tasks come from assignment mail only. Activities and course recommendations stay in School mail.'],'添加待办':['新增待辦','新增待辦','Add task'],'编辑':['編輯','編輯','Edit'],'日历':['日曆','日曆','Calendar'],'删除':['刪除','刪除','Delete'],'重要':['重要','重要','Important'],'普通':['普通','普通','Normal'],'较低':['較低','較低','Low'],'来自作业邮件':['來自作業郵件','來自作業郵件','From assignment email'],'自己添加':['自己新增','自己新增','Added manually'],'查看备注':['查看備註','查看備註','View notes'],'邮件摘要会在这里汇合':['郵件摘要會在這裡匯合','郵件摘要會在這裡匯合','Mail summaries appear here'],'连接 Outlook 后，学校转发邮件会自动进入这里。成功提交回执和纯宗教内容会自动略过。':['連接 Outlook 後，學校轉發郵件會自動進入這裡。成功提交回執和純宗教內容會自動略過。','連接 Outlook 後，學校轉發郵件會自動進入這裡。成功提交回執和純宗教內容會自動略過。','After Outlook is connected, forwarded school mail appears here. Successful submission receipts and purely religious messages are skipped.'],'奖学金 / 金钱 / ITSC':['獎學金 / 金錢 / ITSC','獎學金 / 金錢 / ITSC','Scholarships / money / ITSC'],'课程与作业':['課程與作業','課程與作業','Courses & assignments'],'学校活动':['學校活動','學校活動','School activities'],'课程与 ILP 推荐':['課程與 ILP 推薦','課程與 ILP 推薦','Course & ILP recommendations'],'原始发件人：':['原始發件人：','原始發件人：','Original sender:'],'来源：':['來源：','來源：','Source:'],'查看原邮件 ↗':['查看原郵件 ↗','查看原郵件 ↗','View original mail ↗'],'删除邮件记录':['刪除郵件記錄','刪除郵件記錄','Delete mail record'],'保存':['儲存','儲存','Save'],'取消':['取消','取消','Cancel'],'截止时间（香港）':['截止時間（香港）','截止時間（香港）','Due time (Hong Kong)'],'重要程度':['重要程度','重要程度','Priority'],'备注':['備註','備註','Notes'],'截止前提醒':['截止前提醒','截止前提醒','Reminders before due'],'指定提醒时间（香港，可多行）':['指定提醒時間（香港，可多行）','指定提醒時間（香港，可多行）','Specific reminder times (Hong Kong, one per line)'],'截止后（无截止则从首次指定时间起）':['截止後（無截止則從首次指定時間起）','截止後（無截止則從首次指定時間起）','After due (or from the first specified time)'],'不重复':['不重複','不重複','No repeat'],'每 30 分钟':['每 30 分鐘','每 30 分鐘','Every 30 minutes'],'每小时':['每小時','每小時','Every hour'],'每 2 小时':['每 2 小時','每 2 小時','Every 2 hours'],'每天':['每天','每天','Daily'],'允许提醒的时段（香港时间）':['允許提醒的時段（香港時間）','允許提醒的時段（香港時間）','Allowed reminder hours (Hong Kong time)'],'提醒方式':['提醒方式','提醒方式','Reminder channels'],'手机系统通知':['手機系統通知','手機系統通知','System notification'],'邮件':['郵件','郵件','Email'],'账号安全':['帳號安全','帳號安全','Account security'],'修改密码':['修改密碼','修改密碼','Change password'],'设置密保问题':['設定密保問題','設定密保問題','Set security question'],'自定义密保问题':['自訂密保問題','自訂密保問題','Security question'],'密保答案':['密保答案','密保答案','Security answer'],'答案':['答案','答案','Answer'],'重置密码':['重設密碼','重設密碼','Reset password'],'总提醒次数（0 表示不限制）':['總提醒次數（0 表示不限制）','總提醒次數（0 表示不限制）','Total reminders (0 means unlimited)'],'其他提前分钟数（逗号分隔）':['其他提前分鐘數（逗號分隔）','其他提前分鐘數（逗號分隔）','Other advance minutes (comma separated)'],'任务名称':['任務名稱','任務名稱','Task name'],'开始':['開始','開始','Start'],'结束':['結束','結束','End'],'指定提醒请使用 YYYY-MM-DD HH:mm 格式':['指定提醒請使用 YYYY-MM-DD HH:mm 格式','指定提醒請使用 YYYY-MM-DD HH:mm 格式','Use YYYY-MM-DD HH:mm for specific reminders']};
Object.assign(TEXTS,{
  '提醒与连接':['設定','Settings'],
  '让提醒按你的节奏来':['管理你的帳號與連接','Manage your account and connections'],
  '设置':['設定','Settings'],'管理你的账号与连接':['管理你的帳號與連接','Manage your account and connections'],'Outlook 学校邮件':['Outlook 學校郵件','Outlook school mail'],'学校邮箱':['學校電郵','School email'],'同步完成':['同步完成','Synced'],'尚未连接 Outlook':['尚未連接 Outlook','Outlook is not connected'],'重新连接':['重新連接','Reconnect'],'连接 Outlook':['連接 Outlook','Connect Outlook'],'账号安全':['帳號安全','Account security'],'当前密码':['目前密碼','Current password'],'新密码':['新密碼','New password'],'修改密码':['修改密碼','Change password'],'自定义问题':['自訂問題','Custom question'],'答案':['答案','Answer'],'保存密保':['儲存密保','Save security question'],'个人资料已保存':['個人資料已儲存','Profile saved'],'密码已更新':['密碼已更新','Password updated'],'密保问题已保存':['密保問題已儲存','Security question saved'],'头像必须是 PNG、JPEG、WEBP 或 GIF':['頭像必須是 PNG、JPEG、WEBP 或 GIF','Avatar must be PNG, JPEG, WEBP, or GIF'],'头像预览':['頭像預覽','Avatar preview'],'关联邮箱':['關聯電郵','Linked email'],'界面语言':['介面語言','Interface language'],'昵称':['暱稱','Nickname'],'头像':['頭像','Avatar'],'保存':['儲存','Save'],'退出登录':['登出','Sign out'],'关闭':['關閉','Close'],'添加待办':['新增待辦','Add task'],'编辑待办':['編輯待辦','Edit task'],'任务名称':['任務名稱','Task title'],'自定义间隔（分钟）':['自訂間隔（分鐘）','Custom interval (minutes)'],'总提醒次数（0 表示不限制）':['總提醒次數（0 表示不限制）','Total reminders (0 means unlimited)'],'手机系统通知':['手機系統通知','System notification'],'邮件':['郵件','Email'],'开始':['開始','Start'],'结束':['結束','End'],'星期一':['星期一','Monday'],'星期二':['星期二','Tuesday'],'星期三':['星期三','Wednesday'],'星期四':['星期四','Thursday'],'星期五':['星期五','Friday'],'星期六':['星期六','Saturday'],'星期日':['星期日','Sunday']
});
Object.assign(TEXTS,{
  '把要紧的事':['把重要的事','Keep important things in front of you.'],'放在眼前。':['放在眼前。',''],
  '作业、提醒和学校邮件，随时回来查看。':['作業、提醒和學校郵件，隨時回來查看。','Assignments, reminders, and school email in one place.'],
  '设置密码（至少 12 个字符）':['設定密碼（至少 12 個字元）','Password (12 characters minimum)'],
  '完成一项，就勾掉一项。':['完成一項，就勾掉一項。','Complete one task at a time.'],
  '后续提醒也会随之停止。':['後續提醒也會隨之停止。','Future reminders stop when it is completed.'],
  '＋ 添加待办':['＋ 新增待辦','＋ Add task'],'保存待办':['儲存待辦','Save task'],'下一步':['下一步','Next'],
  '新密码（至少 12 个字符）':['新密碼（至少 12 個字元）','New password (12 characters minimum)'],
  '3 天':['3 天','3 days'],'2 天':['2 天','2 days'],'1 天':['1 天','1 day'],'2 小时':['2 小時','2 hours'],'30 分钟':['30 分鐘','30 minutes'],
  '自定义间隔':['自訂間隔','Custom interval'],'一':['一','Mon'],'二':['二','Tue'],'三':['三','Wed'],'四':['四','Thu'],'五':['五','Fri'],'六':['六','Sat'],'日':['日','Sun'],
  '落在时段外的提醒顺延；开始与结束相同代表全天。勾选完成后停止后续提醒。':['落在時段外的提醒順延；開始與結束相同代表全天。勾選完成後停止後續提醒。','Outside the time window, reminders are deferred. Matching start and end means all day. Completing the task stops later reminders.'],
  '关闭':['關閉','Close'],'主导航':['主導覽','Main navigation'],'任务状态':['任務狀態','Task status'],
  '请输入有效邮箱地址':['請輸入有效電郵地址','Enter a valid email address'],'操作失败':['操作失敗','Action failed'],'服务暂时不可用，请稍后重试':['服務暫時無法使用，請稍後再試','Service is temporarily unavailable. Try again shortly.']
});

Object.assign(TEXTS,{'日报与提醒':['日報與提醒','Daily digests & reminders'],'按你的关注词筛选':['依你的關注詞篩選','Filtered by your focus terms']});

Object.assign(TEXTS,{
  '我的小组':['我的小組','My groups'],'先确认分工，再确定大家都能来的时间':['先確認分工，再確定大家都能參加的時間','Confirm responsibilities, then find a time everyone can attend'],'＋ 创建小组':['＋ 建立小組','＋ Create group'],'创建小组':['建立小組','Create group'],'小组名称':['小組名稱','Group name'],'创建后，用同学的注册邮箱邀请成员。':['建立後，以同學的註冊電郵邀請成員。','Invite classmates with their registered email after creating the group.'],'创建':['建立','Create'],
  '成员与提交身份':['成員與提交身分','Members and submission identity'],'所有操作绑定登录账号，不绑定“关联邮箱”':['所有操作均綁定登入帳號，而非「關聯電郵」','Every action belongs to the signed-in account, not the linked email'],'用注册邮箱邀请成员':['以註冊電郵新增成員','Add member by registered email'],'添加成员':['新增成員','Add member'],
  '分工确认':['分工確認','Responsibility confirmation'],'候选 → 组长审核 → 负责人接受 → 全组可见':['候選 → 組長審核 → 負責人接受 → 全組可見','Candidate → owner review → assignee acceptance → shared with the group'],'候选任务':['候選任務','Candidate task'],'由组长审核时决定':['由組長審核時決定','Owner decides during review'],'建议负责人':['建議負責人','Proposed assignee'],'截止时间（可留空）':['截止時間（可留空）','Deadline (optional)'],'任务说明':['任務說明','Task details'],'依据':['依據','Evidence'],'提交候选':['提交候選','Submit candidate'],'待审核':['待審核','Awaiting review'],'确认并发送给负责人':['確認並傳送給負責人','Confirm and send to assignee'],'不采用':['不採用','Reject'],
  '全组分工看板':['全組分工看板','Shared responsibility board'],'每位成员都能看到负责人和当前状态':['每位成員都能看到負責人和目前狀態','Every member can see the owner and current status'],'接受分工':['接受分工','Accept assignment'],'拒绝分工':['拒絕分工','Decline assignment'],'小组公告':['小組公告','Group announcements'],'未来可直接接入群聊置顶':['未來可直接接入群組聊天置頂','Ready to become a pinned group-chat announcement'],
  '共同会议时间':['共同會議時間','Shared meeting time'],'收集时间 → 推荐方案 → 全员投票 → 加入待办':['收集時間 → 推薦方案 → 全員投票 → 加入待辦','Collect availability → recommend options → vote → add to tasks'],'会议名称':['會議名稱','Meeting name'],'可选范围开始':['可選範圍開始','Range starts'],'可选范围结束':['可選範圍結束','Range ends'],'会议时长':['會議時長','Meeting duration'],'前后缓冲':['前後緩衝','Buffer before and after'],'不需要':['不需要','None'],'发起时间收集':['發起時間收集','Collect availability'],'提交时间 / 查看推荐':['提交時間／查看推薦','Submit time / view options'],'参与投票':['參與投票','Vote'],'查看结果':['查看結果','View result'],
  '我可以参加':['我可以參加','I can attend'],'可以参加，但希望避开（可选）':['可以參加，但希望避開（可選）','Available, but prefer to avoid (optional)'],'＋ 添加可用时段':['＋ 新增可用時段','＋ Add available time'],'＋ 添加希望避开的时段':['＋ 新增希望避開的時段','＋ Add a time to avoid'],'保存我的时间':['儲存我的時間','Save my time'],'锁定候选并开启投票':['鎖定候選並開始投票','Lock options and open voting'],'投票':['投票','Vote'],'已投此项':['已投此項','Selected'],'删除这个时段':['刪除這個時段','Remove this interval']
});
Object.assign(TEXTS,{'来自已确认的小组会议':['來自已確認的小組會議','From a confirmed group meeting']});

const PLACEHOLDERS={}; // inputs have no example placeholders any more
Object.assign(TEXTS,{"邮件提醒暂不可用": ["電郵提醒暫不可用", "Email reminders unavailable"], "用注册邮箱邀请成员": ["以註冊電郵邀請成員", "Invite by registered email"], "邀请成员": ["邀請成員", "Invite member"], "从一个真实的小组项目开始": ["從一個真實的小組專案開始", "Start with a group project"], "创建小组后，可以确认每个人的分工，并收集共同空闲时间。": ["建立小組後，可以確認每個人的分工，並收集共同空閒時間。", "Create a group to agree on responsibilities and find a shared meeting time."], "选择一个小组，查看分工与会议时间。": ["選擇一個小組，查看分工與會議時間。", "Choose a group to view responsibilities and meeting times."], "可审核分工与确认会议": ["可審核分工與確認會議", "Review assignments and confirm meetings"], "可提交建议、接受分工与参与投票": ["可提交建議、接受分工與參與投票", "Suggest tasks, accept assignments and vote"], "还没有候选分工。候选不会自动变成正式任务。": ["還沒有候選分工。候選不會自動變成正式任務。", "No candidates yet. Suggestions only become tasks after review."], "暂无正式分工。组长审核候选后，负责人会在这里接受或拒绝。": ["暫無正式分工。組長審核候選後，負責人會在這裡接受或拒絕。", "No assignments yet. After owner review, assignees accept or decline here."], "还没有会议时间收集。": ["還沒有會議時間收集。", "No meeting polls yet."], "所有成员提交后，组长可以开启投票。": ["所有成員提交後，組長可以開始投票。", "The owner can open voting after everyone submits availability."], "候选分工已提交，等待审核": ["候選分工已提交，等待審核", "Candidate submitted for review"], "分工已发送，等待负责人接受": ["分工已傳送，等待負責人接受", "Assignment sent; waiting for acceptance"], "小组已创建": ["小組已建立", "Group created"], "密码已重置，请使用新密码登录": ["密碼已重設，請使用新密碼登入", "Password reset. Sign in with your new password."], "会议已更新，请刷新后重试": ["會議已更新，請重新整理後再試", "Meeting changed. Refresh and try again."], "请先让组长取消小组会议，再变更成员": ["請先讓組長取消小組會議，再變更成員", "Ask the owner to cancel active meetings before changing membership."], "请先完成或拒绝该成员的未完成分工": ["請先完成或拒絕該成員的未完成分工", "Complete or decline this member’s outstanding assignments first."], "请先转让组长，再退出小组": ["請先轉讓組長，再退出小組", "Transfer ownership before leaving the group."], "请选择另一位成员接任组长": ["請選擇另一位成員接任組長", "Choose another member as the new owner."], "邀请不存在或已经处理": ["邀請不存在或已經處理", "Invitation not found or already handled."], "建议不存在或已经处理": ["建議不存在或已經處理", "Suggestion not found or already handled."], "操作无效": ["操作無效", "Invalid action"], "45 分钟": ["45 分鐘", "45 minutes"], "60 分钟": ["60 分鐘", "60 minutes"], "90 分钟": ["90 分鐘", "90 minutes"], "15 分钟": ["15 分鐘", "15 minutes"], "待办已删除": ["待辦已刪除", "Task deleted"], "确定删除这条待办吗？": ["確定刪除這項待辦嗎？", "Delete this task?"]});
Object.assign(TEXTS,{"已完成，后续提醒已取消": ["已完成，後續提醒已取消", "Completed; future reminders cancelled"], "已重新打开待办": ["已重新開啟待辦", "Task reopened"], "已删除任务": ["已刪除任務", "Task deleted"], "账号已创建": ["帳號已建立", "Account created"], "候选已标记为不采用": ["候選已標記為不採用", "Candidate dismissed"], "可用时间已保存，成员提交状态与推荐已更新": ["可用時間已儲存，成員提交狀態與推薦已更新", "Availability saved; recommendations updated"], "候选时间已锁定，投票开始": ["候選時間已鎖定，投票開始", "Options locked; voting is open"], "投票已保存，可在结束前修改": ["投票已儲存，可在結束前修改", "Vote saved; you can change it before voting closes"], "会议时间已确认": ["會議時間已確認", "Meeting confirmed"], "至少保留一个可用时段": ["至少保留一個可用時段", "Keep at least one available interval"], "此设备已启用通知": ["此裝置已啟用通知", "Notifications enabled on this device"], "请从 iPhone 主屏幕打开，或使用支持通知的浏览器": ["請從 iPhone 主畫面開啟，或使用支援通知的瀏覽器", "Open from your iPhone Home Screen or use a browser that supports notifications"], "通知权限尚未允许，请在系统设置中启用": ["通知權限尚未允許，請在系統設定中啟用", "Allow notifications in your device settings"], "已导出日历副本；它不会自动同步": ["已匯出日曆副本；它不會自動同步", "Calendar copy exported; it does not sync automatically"], "确定永久删除这项已完成任务吗？": ["確定永久刪除此已完成任務嗎？", "Permanently delete this completed task?"], "已接受分工，提醒已生效": ["已接受分工，提醒已生效", "Assignment accepted; reminders enabled"], "已拒绝分工": ["已拒絕分工", "Assignment declined"], "会议时间收集已创建": ["會議時間收集已建立", "Meeting poll created"]});
for(const [key,cn] of Object.entries(I18N['zh-CN']))if(I18N.en[key]&&I18N['zh-TW'][key])TEXTS[cn]=[I18N['zh-TW'][key],I18N.en[key]];
Object.assign(TEXTS,{'来自已确认的邮件建议':['來自已確認的郵件建議','From a reviewed mail suggestion'],'来自小组分工':['來自小組分工','From a group assignment'],'还没有已完成任务':['還沒有已完成任務','No completed tasks yet'],'清单里，留一点从容':['清單裡，留一點從容','Make room for what matters'],'完成的任务会显示在这里，并可随时删除。':['完成的任務會顯示在這裡，並可隨時刪除。','Completed tasks appear here and can be deleted.'],'先添加一项待办，或在小组中接受一项已经确认的分工。':['先新增一項待辦，或在小組中接受一項已經確認的分工。','Add a task or accept a reviewed group assignment.']});
Object.assign(TEXTS,{'过往代办':['過往待辦','Past tasks']});
Object.assign(TEXTS,{'中文':['中文','Chinese'],'同步中':['同步中','Syncing'],'已连接，等待首次同步':['已連接，等待首次同步','Connected; waiting for first sync'],'转发接收正常':['轉發接收正常','Forwarding ingestion OK'],'iPhone 自动转交正常':['iPhone 自動轉交正常','iPhone shortcut ingestion OK'],'成员与提交身份':['成員與提交身份','Members and submission identity'],'邮件分析只提供摘要和建议；确认“加入我的待办”后才会创建任务。小组分工需经审核，并由负责人接受。':['郵件分析只提供摘要和建議；確認「加入我的待辦」後才會建立待辦。小組分工需經審核，並由負責人接受。','Mail summaries are suggestions; a task is created only after you choose “Add to My Tasks”. Group assignments require review and acceptance by the assignee.']});
const textSources=new WeakMap();
function translateCopy(value){
 const raw=String(value??''),key=raw.trim();if(!key)return raw;
 const source=Object.hasOwn(TEXTS,key)?key:Object.keys(TEXTS).find(k=>TEXTS[k].includes(key));
 if(!source)return raw;
 const variants=TEXTS[source],translated=locale==='zh-CN'?source:locale==='zh-TW'?variants.at(-2):variants.at(-1);
 return raw.replace(key,translated);
}
Object.assign(TEXTS,{'全部待办完成率':['全部待辦完成率','All tasks completion rate'],'一点一点，完成重要的事':['一點一點，完成重要的事','One small step at a time'],'全部待办进度':['全部待辦進度','Your overall progress'],'每一个小小的完成，都算数。':['每一個小小的完成，都算數。','Every small finish counts.'],'展开摘要':['展開摘要','Read summary'],'收起摘要':['收起摘要','Close summary']});
// Copy for the wheel pickers and reminder chips (zh-TW, en).
Object.assign(TEXTS,{'点此选择截止时间':['點此選擇截止時間','Choose a due time'],'＋ 自定义':['＋ 自訂','＋ Custom'],'把当前选择设为新待办默认':['把目前選擇設為新待辦預設','Use this selection for new tasks'],'设置截止时间后，这些提醒才会生效。':['設定截止時間後，這些提醒才會生效。','These reminders start working once a due time is set.'],'指定提醒时间（香港）':['指定提醒時間（香港）','Specific reminder times (Hong Kong)'],'＋ 添加提醒时间':['＋ 新增提醒時間','＋ Add a reminder time'],'选择间隔':['選擇間隔','Choose interval']});
function translateTextNodes(){
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
 while(node=walker.nextNode()){
  if(node.parentElement?.closest('script,style,textarea,[data-user-content]'))continue;
  const previous=textSources.get(node),source=previous&&node.nodeValue===previous.rendered?previous.source:node.nodeValue;
  const rendered=translateCopy(source);if(rendered!==node.nodeValue)node.nodeValue=rendered;textSources.set(node,{source,rendered});
 }
 for(const input of $$('[placeholder]')){
  const source=input.dataset.i18nPlaceholderSource||input.placeholder;input.dataset.i18nPlaceholderSource=source;
  const item=PLACEHOLDERS[source];if(item)input.placeholder=locale==='zh-CN'?source:locale==='zh-TW'?item[0]:item[1];
 }
 for(const el of $$('[aria-label]')){if(el.classList.contains('theme-toggle'))continue;const source=el.dataset.labelSource||el.getAttribute('aria-label');el.dataset.labelSource=source;el.setAttribute('aria-label',translateCopy(source));}
}


const dateLocale=()=>locale==='zh-TW'?'zh-TW':locale==='en'?'en-GB':'zh-CN';
const local=(cn,tw,en)=>locale==='zh-TW'?tw:locale==='en'?en:cn;
const fmt=n=>n?new Date(Number(n)).toLocaleString(dateLocale(),{timeZone:'Asia/Hong_Kong',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}):locale==='en'?'Deadline to confirm':locale==='zh-TW'?'截止時間待確認':'截止时间待确认';
const localDate=n=>n?new Date(Number(n)+8*3600000).toISOString().slice(0,16):'';
let tasks=[],status={},editing=null,mailTaskDraft=null,taskTab='pending',activePeriod=null,periodTimer,activeView='tasks';
let toastTimer;
function toast(s){$('#toast').textContent=translateCopy(s);$('#toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.add('hidden'),4500);}
function accountLabel(account){const nickname=String(account?.nickname||'').trim();return nickname||`${tx('defaultNickname')} ${String(account?.userCode||'0000')}`;}
function setAvatar(value,fallback='U'){const el=$('#avatar');el.textContent='';if(/^data:image\//.test(value||'')){const img=document.createElement('img');img.src=value;img.alt='';el.append(img);}else el.textContent=value||fallback;}
async function api(path,options={}){const response=await fetch('/api/'+path,{...options,headers:{'Content-Type':'application/json','X-Locale':locale,...options.headers},body:options.body===undefined?undefined:JSON.stringify(options.body)});let data;try{data=await response.json();}catch{throw Error('服务暂时不可用，请稍后重试');}if(!response.ok){if(response.status===401&&!['login','register','recovery/question','recovery/reset'].includes(path))showLogin();throw Error(translateCopy(data.error||'操作失败'));}return data;}
function showLogin(){
  $('#app').classList.add('hidden');$('#login').classList.remove('hidden');ensureHero();
  if(location.search)history.replaceState(null,'','/');
  applyLocale(localStorage.getItem('campus-locale')||detectLocale());
  $$('[data-login-locale]').forEach(b=>b.classList.toggle('selected',b.dataset.loginLocale===locale));
}
function view(name){activeView=name;for(const v of ['tasks','groups','mail','digests','settings'])$('#'+v+'-view').classList.toggle('hidden',v!==name);$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));history.replaceState(null,'','/?view='+name);if(name==='tasks'&&tasks.length)renderTasks();if(name==='groups')loadGroups();if(name==='mail')loadMail().then(translateTextNodes);if(name==='digests')loadDigests().then(translateTextNodes);if(name==='settings')loadSettings();}
const periodName=period=>({today:local('今天','今天','Today'),week:local('本周','本週','This week'),future:local('未来全部','未來全部','All upcoming')})[period];
// Last rendered percent per period, so the ring firework fires only on the
// transition into 100% — never on first paint for an already-full period.
const prevPeriodPercent={};
function celebrateRing(card){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  if(card.offsetParent===null)return;
  const ring=card.querySelector('.period-ring');if(!ring||ring.querySelector('.ring-burst'))return;
  const burst=document.createElement('span');burst.className='ring-burst';burst.setAttribute('aria-hidden','true');
  for(let i=0;i<12;i++){const dot=document.createElement('i');dot.style.setProperty('--angle',i*30+'deg');burst.append(dot);}
  ring.append(burst);setTimeout(()=>burst.remove(),1200);
}
function renderPeriodCards(now){
  $('.period-grid').setAttribute('aria-label',local('待办进度','待辦進度','Task progress'));
  $$('[data-period]').forEach(card=>{
    const period=card.dataset.period,{done,total,percent}=periodProgress(tasks,period,now);
    if(percent===100&&prevPeriodPercent[period]!==undefined&&prevPeriodPercent[period]<100)celebrateRing(card);
    prevPeriodPercent[period]=percent;
    card.style.setProperty('--progress',percent);
    card.querySelector('.period-name').textContent=periodName(period);
    card.querySelector('.period-percent').textContent=percent+'%';
    card.querySelector('.period-fraction').textContent=`${done}/${total}`;
    card.setAttribute('aria-label',`${periodName(period)} · ${done}/${total} · ${percent}%`);
    card.setAttribute('aria-expanded',String(activePeriod===period));
  });
  const detail=$('#period-details');detail.hidden=!activePeriod;
  if(!activePeriod)return;
  const matching=tasksForPeriod(tasks,activePeriod,now).sort((a,b)=>a.due-b.due);
  $('#period-details-title').textContent=periodName(activePeriod);
  $('#period-details-list').innerHTML=matching.length?matching.map(t=>`<li><button type="button" data-period-task="${esc(t.id)}"><strong data-user-content>${esc(t.title)}</strong><span>${esc(fmt(t.due))} · ${t.completed?local('已完成','已完成','Done'):local('进行中','進行中','Open')}</span></button></li>`).join(''):`<li class="period-empty">${local('暂无待办','暫無待辦','No tasks')}</li>`;
  $$('[data-period-task]').forEach(button=>button.onclick=()=>openForm(tasks.find(t=>t.id===button.dataset.periodTask)));
}
function schedulePeriodRefresh(){
  clearTimeout(periodTimer);
  periodTimer=setTimeout(()=>{renderTasks();schedulePeriodRefresh();},Math.max(1000,nextHkMidnight()+1000-Date.now()));
}
function renderTasks(){
  const now=Date.now(),pending=tasks.filter(t=>!t.completed);
  $('#nav-count').textContent=pending.length;
  renderPeriodCards(now);
  const visible=tasks.filter(t=>taskTab==='archive'?isArchivedTask(t,now):taskTab==='done'?t.completed&&!isArchivedTask(t,now):!t.completed);
  for(const [tab,id] of [['pending','show-pending'],['done','show-completed'],['archive','show-archived']])$('#'+id).classList.toggle('selected',taskTab===tab);
  $('#task-list').innerHTML=visible.length?visible.map(t=>{const overdue=t.due&&t.due<now&&!t.completed,soon=t.due&&t.due>=now&&t.due<=now+3*86400000&&!t.completed,source=t.source==='candidate'?'来自小组分工':t.source==='meeting'?'来自已确认的小组会议':t.source==='email'?local('来自邮件日程','來自郵件日程','From email schedule'):'自己添加';return `<article class="task ${t.completed?'done':''}"><input class="task-check" type="checkbox" aria-label="${esc(t.completed?local('重新打开','重新開啟','Reopen'):local('完成','完成','Complete'))} ${esc(t.title)}" data-check="${esc(t.id)}" ${t.completed?'checked':''}><div><h3 data-user-content>${esc(t.title)}</h3><div class="meta"><span class="${overdue||soon?'badge urgent':''}">${overdue?local('已逾期 · ','已逾期 · ','Overdue · '):soon?local('即将截止 · ','即將截止 · ','Due soon · '):''}${esc(fmt(t.due))}</span><span class="badge ${t.priority===1?'high':''}">${['','重要','普通','较低'][t.priority]}</span><span>${source}</span></div>${t.notes?`<details><summary class="task-note">查看备注</summary><p class="task-note">${esc(t.notes)}</p></details>`:''}</div><div class="task-actions"><button data-edit="${esc(t.id)}">编辑</button>${t.due?`<button data-calendar="${esc(t.id)}">${esc(local('导出到系统日历','匯出到系統日曆','Export to calendar'))}</button>`:''}${t.completed?`<button class="danger-text" data-delete-task="${esc(t.id)}">删除</button>`:''}</div></article>`;}).join(''):`<div class="empty"><span class="empty-mark">✓</span><h2>${taskTab==='archive'?local('暂无过往代办','暫無過往待辦','No past tasks'):taskTab==='done'?local('暂无已完成待办','暫無已完成待辦','No completed tasks'):local('暂无进行中的待办','暫無進行中的待辦','No active tasks')}</h2></div>`;
  $$('[data-check]').forEach(c=>c.onchange=async()=>{const task=tasks.find(t=>t.id===c.dataset.check);c.disabled=true;try{const completed=c.checked;await api('tasks/'+task.id,{method:'PATCH',body:{version:task.version,completed}});if(completed)await celebrateTask(c);await loadTasks();toast(completed?'已完成，后续提醒已取消':'已重新打开待办');if(completed)offerUndo(task.id);}catch(e){c.checked=!c.checked;toast(e.message);c.disabled=false;}});
  $$('[data-edit]').forEach(b=>b.onclick=()=>openForm(tasks.find(t=>t.id===b.dataset.edit)));
  $$('[data-calendar]').forEach(b=>b.onclick=()=>exportCalendar(tasks.find(t=>t.id===b.dataset.calendar)));
  $$('[data-delete-task]').forEach(b=>b.onclick=async()=>{if(!confirm(translateCopy('确定永久删除这项已完成任务吗？')))return;b.disabled=true;try{await api('tasks/'+b.dataset.deleteTask,{method:'DELETE',body:{}});await loadTasks();toast('已删除任务');}catch(e){toast(e.message);b.disabled=false;}});
}
async function loadTasks(){tasks=await api('tasks');renderTasks();schedulePeriodRefresh();translateTextNodes();}
// ES module imports are hoisted, so these work even though they are not at the very top.
// (They sit here because test/localization.test.js evaluates the top of this file as a plain script.)
import { TaskReminderPicker } from './task-reminders.js';
import { playButtonSuccess, resetSuccessButton, circularTransition, pageTransition, setupCardStack } from './motion.js?v=20261025-glass-motion-2';
import { watchTimeInputs } from './native-pickers.js';
import { digestOverview, daysUntil, suggestedTaskDue, digestTextForLocale, digestTitleForLocale } from './digest-insights.js';

// Every native date/time input (task form, groups, meetings, settings) becomes a wheel picker.
watchTimeInputs();

// Handles the due time, reminder chips, exact times and custom repeat inside #task-form.
const reminderPicker = new TaskReminderPicker({
  form: $('#task-form'),
  getDefaults: () => reminderDefaults,
  // Saves part of the reminder defaults (for example {presets:[90]}) on the server, in users.reminder_defaults.
  saveDefaults: async patch => { const r = await api('profile', {method:'PATCH', body:{reminders:patch}}); reminderDefaults = r.reminders; return r.reminders; },
  notify: text => toast(text),
});

function openForm(task=null,mailDraft=null){
  editing=task;
  mailTaskDraft=mailDraft;
  const f=$('#task-form');
  f.reset();
  $('#task-dialog').classList.toggle('mail-task-review',!!mailDraft);
  $('#form-error').textContent='';
  $('#form-heading').textContent=task?local('编辑待办','編輯待辦','Edit task'):mailDraft?local('确认邮件待办','確認郵件待辦','Review email task'):local('添加待办','新增待辦','Add task');
  f.querySelector('[type=submit]').textContent=mailDraft?local('确认并加入待办','確認並加入待辦','Add to My Tasks'):local('保存待办','儲存待辦','Save task');
  const mailHint=$('#mail-task-hint');
  if(mailHint){mailHint.textContent=mailDraft?local('已根据邮件内容预填标题和时间；未注明具体时刻时，暂按当天 23:59 预填。请核对或修改后再保存。','已根據郵件內容預填標題和時間；未註明具體時刻時，暫按當天 23:59 預填。請核對或修改後再儲存。','Title and time were prefilled from the email. If no exact time was stated, 23:59 is suggested for that date. Review or edit before saving.'):'';mailHint.classList.toggle('hidden',!mailDraft);}
  const r=task?task.reminders:reminderDefaults;
  if(task){
    f.elements.title.value=task.title;
    f.elements.notes.value=task.notes;
    f.elements.priority.value=task.priority;
    f.elements.push.checked=r.push;
  }
  if(mailDraft){f.elements.title.value=mailDraft.title;f.elements.notes.value=mailDraft.notes;f.elements.priority.value=mailDraft.priority;}
  f.elements.maxCount.value=r.maxCount||0;
  f.elements.start.value=r.start||'08:00';
  f.elements.end.value=r.end||'23:00';
  if(Array.isArray(r.days)&&r.days.length)$$('[name=day]').forEach(c=>c.checked=r.days.includes(Number(c.value)));
  f.elements.email.checked=false;
  reminderPicker.load(task); // due time, offsets, exact times, repeat
  if(mailDraft)reminderPicker.setDue(mailDraft.due);
  translateTextNodes();
  syncPrioritySegments();
  $('#task-dialog').showModal();
}
$('#task-form').onsubmit=async event=>{
  event.preventDefault();
  const f=event.currentTarget,save=f.querySelector('[type=submit]');
  save.disabled=true;$('#form-error').textContent='';
  try{
    const picked=reminderPicker.collect(); // {due, offsets, exact, repeat} — same format as before
    const data={title:f.elements.title.value,notes:f.elements.notes.value,due:picked.due,priority:Number(f.elements.priority.value),
      reminders:{offsets:picked.offsets,exact:picked.exact,repeat:picked.repeat,maxCount:Number(f.elements.maxCount.value)||0,start:f.elements.start.value,end:f.elements.end.value,days:$$('[name=day]:checked').map(c=>Number(c.value)),push:f.elements.push.checked,email:f.elements.email.checked}};
    if(editing)data.version=editing.version;
    const mailDraft=mailTaskDraft;
    const result=mailDraft?await api('tasks/from-mail',{method:'POST',body:{messageId:mailDraft.messageId,title:data.title,notes:data.notes,due:data.due,priority:data.priority}}):await api(editing?'tasks/'+editing.id:'tasks',{method:editing?'PATCH':'POST',body:data});
    await playButtonSuccess(save); // shrink → tick → particles (skipped with reduced motion)
    mailTaskDraft=null;
    $('#task-dialog').close();
    resetSuccessButton(save);
    await loadTasks();toast(result?.alreadyAdded?local('这封邮件已在我的待办中','這封郵件已在我的待辦中','This email is already in My Tasks'):local('待办已保存','待辦已儲存','Task saved'));
  }catch(e){resetSuccessButton(save);$('#form-error').textContent=e.message;}
  finally{save.disabled=false;}
};
// Priority switcher in the task dialog: three pill segments backed by the
// hidden priority field, so the submit handler keeps reading
// f.elements.priority.value exactly as before.
function syncPrioritySegments(){
  const value=$('#task-form').elements.priority.value;
  $$('#priority-segments button').forEach(button=>{
    const selected=button.dataset.priority===String(value);
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-checked',selected?'true':'false');
  });
}
$('#priority-segments').addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  $('#task-form').elements.priority.value=button.dataset.priority;
  syncPrioritySegments();
});
$('#priority-segments').addEventListener('keydown',event=>{
  if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
  const buttons=$$('#priority-segments button'),index=buttons.findIndex(button=>button.classList.contains('selected'));
  const next=buttons[(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length];
  if(next){next.focus();$('#task-form').elements.priority.value=next.dataset.priority;syncPrioritySegments();event.preventDefault();}
});
let mailNextBefore=null,mailLoadingMore=false;
const categoryKey=c=>({1:'cat1',2:'cat2',3:'cat3',4:'cat4'}[c]||'cat3');
const briefRequests=new Map();
const containsCjk=value=>/[\u3400-\u9fff]/.test(String(value||''));
const englishBriefIsUsable=brief=>!!brief&&![brief.title,brief.topic,...(brief.points||[]).map(p=>p.text),...(brief.actions||[]).map(p=>p.text)].some(containsCjk);
function briefContent(m,compact=false){
  const b=m.brief;
  if(!b)return `<p class="quality">${esc(local('正在依据原文整理详细要点；若未生成，可稍后重试。','正在依據原文整理詳細重點；若未產生，可稍後重試。','Preparing detailed notes from the original email. Retry later if unavailable.'))}</p>`;
  const points=compact?b.points.slice(0,2):b.points;
  return `<ul class="mail-points">${points.map(p=>`<li data-user-content>${esc(p.text)}</li>`).join('')}</ul>${b.actions.length?`<div class="brief-actions"><strong>${local('邮件中的请求','郵件中的請求','Requests in this email')}</strong><ul>${b.actions.map(p=>`<li data-user-content>${esc(p.text)}</li>`).join('')}</ul></div>`:''}`;
}
// ---------- 日报专属摘要渲染 ----------
// 与邮件页的 briefContent 区分开：日报用更紧凑的简报风格，带明确的"AI 详细要点"标识，
// 避免用户觉得"和邮件页一样"。
function digestBriefContent(m){
  const b=m.brief;
  if(!b)return '';
  const points=b.points||[];
  const actions=b.actions||[];
  let html=`<div class="dg-brief"><p class="dg-brief-label">${esc(local('AI 详细要点','AI 詳細重點','AI detailed notes'))}</p><ul class="dg-brief-points">`;
  html+=points.map(p=>`<li data-user-content>${esc(p.text)}</li>`).join('');
  html+=`</ul>`;
  if(actions.length){
    html+=`<p class="dg-brief-label is-action">${esc(local('需要你处理的请求','需要你處理的請求','Requests for you'))}</p><ul class="dg-brief-points is-action">`;
    html+=actions.map(p=>`<li data-user-content>${esc(p.text)}</li>`).join('');
    html+=`</ul>`;
  }
  html+=`</div>`;
  return html;
}
async function prepareBriefs(rows,onUpdate,isCurrent,opts={}){
  // Briefs are generated on demand (original mail fetch + AI), two mails per request.
  // `live` also reports per-row loading/error state so the page can show progress, and
  // `concurrency` runs several requests side by side.
  const queue=rows.filter(m=>m.id&&!m.brief&&!m.briefLoading),batches=[];
  for(let i=0;i<queue.length;i+=2)batches.push(queue.slice(i,i+2));
  let warned=false;
  const worker=async()=>{
    while(batches.length&&isCurrent()){
      const batch=batches.shift(),ids=batch.map(m=>m.id),key=locale+':'+ids.join('|');
      if(opts.live){batch.forEach(m=>{m.briefLoading=true;m.briefError=false;});await onUpdate();}
      try{
        if(!briefRequests.has(key))briefRequests.set(key,Promise.race([api('mail/briefs',{method:'POST',body:{ids}}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),60000))]));
        const result=await briefRequests.get(key),results=result.results||[];
        for(const row of batch){const item=results.find(r=>r.id===row.id);row.briefLoading=false;if(item?.brief)row.brief=item.brief;row.briefError=!item||!!item.error;}
        if(results.length&&results.every(r=>r.error)){
          if(!warned){warned=true;toast(local('摘要暂不可用，请确认邮箱连接后重试。','摘要暫不可用，請確認電郵連接後重試。','Summaries are unavailable. Check your mailbox connection and retry.'));}
          batches.length=0; // do not hammer the service when everything fails
        }
      }catch{for(const row of batch){row.briefLoading=false;row.briefError=true;}batches.length=0;}
      finally{briefRequests.delete(key);}
      if(isCurrent())await onUpdate();
    }
  };
  await Promise.all(Array.from({length:Math.max(1,opts.concurrency||1)},worker));
}
function briefFallback(m){
  if(m.briefError)return `<p class="quality">${local('详细摘要暂未生成，请确认邮箱连接后刷新重试。可点击邮件查看原文。','詳細摘要暫未產生，請確認電郵連接後重新整理。可點擊郵件查看原文。','Detailed summary unavailable. Check your mailbox connection and refresh to retry. Open the email to read the original.')}</p>`;
  // 如果有本地化摘要，先显示它，而不是卡在"正在整理"
  if(m.summary)return `<p class="mail-summary-preview" data-user-content>${esc(m.summary)}</p>`;
  return briefContent(m);
}
function mailCard(m){
  const english=locale==='en',brief=english&&!englishBriefIsUsable(m.brief)?null:m.brief;
  const safe=(value,fallback)=>english&&containsCjk(value)?fallback:value;
  const subject=safe(String(m.subject||'').replace(/^(?:(?:fw|fwd|re)\s*:\s*)+/i,''),'Email summary unavailable');
  const sender=safe(m.sender,'Sender unavailable'),origin=safe(m.origin,'Source not identified');
  return `<article class="mail-card" data-open-mail="${encodeURIComponent(m.id)}" tabindex="0" role="button"><div class="mail-card-head"><div class="meta"><span class="badge ${m.category===1?'high':''}">${esc(safe(brief?.topic,'Email'))||esc(local('待整理','待整理','Pending summary'))}</span><span>${esc(fmt(m.received))}</span></div><button class="icon-delete" data-delete-mail="${encodeURIComponent(m.id)}" aria-label="${esc(tx('deleteMail'))}">${esc(tx('delete'))}</button></div><h2>${esc(brief?.title||subject)}</h2><div class="sender">${esc(tx('originalSender'))} ${esc(sender)}<br>${esc(tx('source'))} ${esc(origin)}</div>${brief?briefContent({...m,brief}):briefFallback({...m,brief:null,summary:safe(m.summary,'')})}</article>`;
}
function bindMailList(root){
  root.querySelectorAll('[data-open-mail]').forEach(card=>{
    card.onclick=e=>{if(e.target.closest('[data-delete-mail]'))return;openMailDetail(decodeURIComponent(card.dataset.openMail));};
    card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openMailDetail(decodeURIComponent(card.dataset.openMail));}};
  });
  root.querySelectorAll('[data-delete-mail]').forEach(b=>b.onclick=async e=>{e.stopPropagation();if(!confirm(tx('confirmDeleteMail')))return;b.disabled=true;try{await api('messages/'+b.dataset.deleteMail,{method:'DELETE',body:{}});await loadMail();toast(tx('mailDeleted'));}catch(err){toast(err.message);b.disabled=false;}});
}
// ---------- 邮件正文清理与美化 ----------
// 1. 去掉 "Click here<...> if you cannot see the image"，把图片直接渲染出来
// 2. 把 [描述<url>] 或 描述<url> 转为超链接
// 3. 裸 URL 转为简洁超链接
function cleanMailBody(body){
  if(!body) return '';
  let html = String(body);
  // 先转义 HTML，防止 XSS（后续我们会有意插入的标签用占位符保护）
  const placeholders = [];
  const protect = (s) => { placeholders.push(s); return `\u0000${placeholders.length-1}\u0000`; };

  // 1. 处理 "Click here<url> if you cannot see the image." → 直接渲染图片
  //    匹配: Click here<https://...> if you cannot see the image.
  html = html.replace(/Click here<([^>]+)>\s*if you cannot see the image\.?/gi, (m, url) => {
    url = url.trim();
    if (/\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(url)) {
      return protect(`<img src="${url}" alt="邮件图片" class="mail-body-img" loading="lazy" />`);
    }
    return protect(`<a href="${url}" target="_blank" rel="noopener">查看图片</a>`);
  });

  // 2. 处理 [描述<url>] 格式 → 超链接（描述为文本，url 为 href）
  html = html.replace(/\[([^\]<]+)<(https?:\/\/[^>]+)>\]/g, (m, desc, url) => {
    desc = desc.trim(); url = url.trim();
    // 如果描述本身就是 URL，则用简化显示
    const display = /^https?:\/\//.test(desc) ? shortenUrl(desc) : desc;
    return protect(`<a href="${url}" target="_blank" rel="noopener">${display}</a>`);
  });

  // 3. 处理 描述<url> 格式（无方括号）→ 超链接
  //    注意：避免匹配到已经处理过的，以及 email 地址
  html = html.replace(/([^\s<>\[\]]+?)<(https?:\/\/[^>\s]+)>/g, (m, desc, url) => {
    desc = desc.trim(); url = url.trim();
    if (/^https?:\/\//.test(desc)) return m; // 描述本身是 URL，跳过（后面统一处理）
    // 如果描述是 email 地址，保留原样
    if (/^[^@\s]+@[^@\s]+$/.test(desc)) return m;
    return protect(`<a href="${url}" target="_blank" rel="noopener">${desc}</a>`);
  });

  // 4. 转义剩余的 HTML
  html = esc(html);

  // 5. 恢复占位符（我们插入的安全 HTML）
  html = html.replace(/\u0000(\d+)\u0000/g, (m, i) => placeholders[parseInt(i)]);

  // 6. 处理剩余的裸 URL → 简洁超链接（带 data-bare-link 标记，后续异步增强）
  //    先保护已有的 <a> 标签，避免重复处理
  const linkPlaceholders = [];
  html = html.replace(/<a\s[^>]*>.*?<\/a>/gs, (m) => {
    linkPlaceholders.push(m);
    return `\u0001${linkPlaceholders.length-1}\u0001`;
  });
  html = html.replace(/(https?:\/\/[^\s<>"']+)/g, (url) => {
    // 跳过图片 URL（已在步骤1处理）
    if (/\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(url)) {
      return `<img src="${url}" alt="邮件图片" class="mail-body-img" loading="lazy" />`;
    }
    // 标记为裸链接，前端会异步获取 AI 总结替换显示文本
    return `<a href="${url}" target="_blank" rel="noopener" data-bare-link="${esc(url)}">${shortenUrl(url)}</a>`;
  });
  html = html.replace(/\u0001(\d+)\u0001/g, (m, i) => linkPlaceholders[parseInt(i)]);

  // 7. 换行转 <br>，段落之间保留空行
  html = html.replace(/\n{3,}/g, '\n\n');
  html = html.replace(/\n/g, '<br>');

  return html;
}

function shortenUrl(url){
  try{
    const u = new URL(url);
    let path = u.pathname;
    // 太长的路径截断
    if (path.length > 30) path = path.slice(0, 27) + '…';
    // 去掉追踪参数
    return u.hostname.replace(/^www\./, '') + (path === '/' ? '' : path);
  }catch{
    return url.length > 40 ? url.slice(0, 37) + '…' : url;
  }
}

// 异步增强裸链接：用 AI 总结替换显示文本
// 只处理没有描述文字的裸 URL（data-bare-link 标记的）
const linkSummaryCache = new Map();
async function enhanceBareLinks(container){
  if(!container) return;
  const links = container.querySelectorAll('a[data-bare-link]');
  for(const link of links){
    const url = link.dataset.bareLink;
    if(!url || link.dataset.enhanced) continue;
    link.dataset.enhanced = '1';
    try{
      if(linkSummaryCache.has(url)){
        const summary = linkSummaryCache.get(url);
        if(summary) link.textContent = summary;
        continue;
      }
      const result = await api('mail/link-summary', {method: 'POST', body: {url}});
      if(result?.summary){
        linkSummaryCache.set(url, result.summary);
        link.textContent = result.summary;
      }
    }catch{
      // 失败则保留原来的简化 URL 显示
    }
  }
}

// 直观的发件/收件显示：从哪个部门 → 到谁
function formatMailFromTo(detail){
  const zh = detail.chinese || detail.display || {};
  const en = detail.english || {};
  // 发件人：优先用本地化的部门名，去掉 <email> 部分
  let fromDept = zh.sender || '';
  // "职业新闻 <career@ln.edu.hk>" → "职业新闻"
  fromDept = fromDept.replace(/\s*<[^>]+>\s*/g, '').trim();
  // 收件人：用后端返回的 recipients
  let toText = '';
  const recipients = en.recipients || [];
  if(recipients.length){
    // 如果收件人很多，显示"全体"或数量
    if(recipients.length > 3){
      toText = local(`全体收件人（${recipients.length}人）`,`全體收件人（${recipients.length}人）`,`All recipients (${recipients.length})`);
    }else{
      toText = recipients.map(r => r.name || r.address).join('、');
    }
  }else{
    // fallback：从正文 To: 头解析
    const body = en.body || '';
    const toMatch = String(body).match(/^To:\s*(.+)$/mi);
    if(toMatch) toText = toMatch[1].trim();
  }
  return { from: fromDept, to: toText };
}

let readerRequest=0;
function hideMailReader(){
  readerRequest++;$('#mail-detail-dialog').classList.add('hidden');document.body.classList.remove('reader-open');$('#app').inert=false;
}
async function openMailDetail(id,{push=true}={}){
  const page=$('#mail-detail-dialog'),request=++readerRequest;
  if(push&&new URLSearchParams(location.search).get('message')!==id)history.pushState({mailReader:true},'','/?view=mail&message='+encodeURIComponent(id));
  page.classList.remove('hidden');document.body.classList.add('reader-open');$('#app').inert=true;page.scrollTop=0;
  $('#close-mail-detail').textContent=local('← 返回','← 返回','← Back');
  $('#mail-detail-label').textContent=tx('mailDetail');
  $('#mail-detail-title').textContent=local('加载中…','載入中…','Loading…');
  $('#mail-detail-title').focus();$('#mail-detail-meta').textContent='';
  $('#mail-detail-zh').textContent='';$('#mail-detail-en').textContent='';$('#mail-detail-outlook').hidden=true;
  const summaryTab=page.querySelector('[data-mail-pane="zh"]'),originalTab=page.querySelector('[data-mail-pane="en"]');
  const englishUi=locale==='en';
  page.querySelector('.mail-detail-tabs').classList.toggle('hidden',englishUi);
  summaryTab.hidden=englishUi;
  summaryTab.textContent=local('中文','中文','Summary');originalTab.textContent=local('原文','原文','Original');
  const selectPane=name=>{for(const tab of [summaryTab,originalTab]){const selected=tab.dataset.mailPane===name;tab.classList.toggle('selected',selected);tab.setAttribute('aria-selected',String(selected));}$('#mail-detail-zh').classList.toggle('hidden',name!=='zh');$('#mail-detail-en').classList.toggle('hidden',name!=='en');};
  selectPane(englishUi?'en':'zh');summaryTab.onclick=()=>selectPane('zh');originalTab.onclick=()=>selectPane('en');
  try{
    const detail=await api('messages/'+encodeURIComponent(id));if(request!==readerRequest)return;
    const display=detail.display||detail.chinese||{},englishBrief=englishUi&&!englishBriefIsUsable(display.brief)?null:display.brief;
    const safe=(value,fallback)=>englishUi&&containsCjk(value)?fallback:value;
    const subject=String(detail.english?.subject||display.subject||'').replace(/^(?:(?:fw|fwd|re)\s*:\s*)+/i,'');
    $('#mail-detail-title').textContent=englishBrief?.title||safe(subject,'Original email');
    $('#mail-detail-meta').innerHTML=`<span class="badge">${esc(safe(englishBrief?.topic||tx(categoryKey(detail.category)),'Email'))}</span><span>${esc(safe(display.sender,'Sender unavailable'))}</span><span>${esc(safe(display.origin,'Source not identified'))}</span><time>${esc(fmt(detail.received))}</time>`;
    $('#mail-detail-zh').innerHTML=englishUi?'':display.brief?briefContent(display):`<p data-user-content>${esc(display.summary||'')}</p>`;
    $('#mail-detail-zh').classList.toggle('hidden',englishUi);
    const original=renderMailBody(detail.english||{});
    $('#mail-detail-en').replaceChildren(original);
    if(!englishUi&&detail.chinese?.fullBody){
      const translated=renderMailBody({body:detail.chinese.fullBody});
      $('#mail-detail-zh').replaceChildren(translated);
      for(const img of original.querySelectorAll('img'))if(![...translated.querySelectorAll('img')].some(i=>i.src===img.src))$('#mail-detail-zh').append(img.cloneNode(true));
    }else if(!englishUi&&detail.translationEnabled){
      if(!display.brief){
        const summary=String(display.summary||'').trim();
        $('#mail-detail-zh').replaceChildren();
        if(summary&&!/^[_\-\s]*(?:From|发件人|寄件者)\s*[:：]/i.test(summary))$('#mail-detail-zh').append(Object.assign(document.createElement('p'),{textContent:summary}));
      }
      const notice=document.createElement('p');
      notice.textContent=detail.translationStatus==='quota'
        ?local('全文翻译暂不可用：AI 服务今日用量已达上限。英文原文仍可查看，额度恢复后再次打开即可生成译文。','全文翻譯暫不可用：AI 服務今日用量已達上限。英文原文仍可查看，額度恢復後再次開啟即可生成譯文。','Full translation is temporarily unavailable because the AI daily limit has been reached. The original is still available; reopen this email after the limit resets to generate a translation.')
        :local('全文翻译暂时无法生成，英文原文仍可在「原文」中查看，请稍后重试。','全文翻譯暫時無法生成，英文原文仍可在「原文」中查看，請稍後重試。','The full translation could not be generated. The original is available in “Original”; please try again later.');
      $('#mail-detail-zh').append(notice);
    }
    if(!detail.translationEnabled)selectPane('en');
    const link=$('#mail-detail-outlook');
    if(/^https:\/\/(?:outlook\.live\.com|outlook\.office\.com|outlook\.office365\.com)\//.test(detail.url||'')){link.hidden=false;link.href=detail.url;link.textContent=tx('viewOriginal');}
  }catch(e){if(request===readerRequest){$('#mail-detail-title').textContent=tx('mailDetail');$('#mail-detail-zh').textContent=e.message;}}
}
let currentMailQuery='';
async function loadMail(opts={}){
  try{
    const append=!!opts.append;
    if(!append){mailNextBefore=null;$('#mail-list').innerHTML=`<div class="empty"><span class="empty-mark">▤</span><h2>${esc(local('加载中…','載入中…','Loading…'))}</h2></div>`;}
    await renderMailSuggestions().catch(()=>{});
    const q=String(opts.q===undefined?currentMailQuery:opts.q).trim();
    const params=new URLSearchParams({limit:'40'});if(mailNextBefore)params.set('before',String(mailNextBefore));if(q)params.set('q',q);
    const payload=await api('messages?'+params.toString());
    const messages=Array.isArray(payload)?payload:(payload.messages||[]);
    mailNextBefore=Array.isArray(payload)?null:payload.nextBefore;
    const html=messages.map(mailCard).join('');
    if(!append){
      const mailEmptyCta=q?'':`<button type="button" class="primary" data-goto-settings style="margin-top:14px">${esc(local('去设置连接 Outlook','去設定連接 Outlook','Connect Outlook in Settings'))}</button>`;
      $('#mail-list').innerHTML=messages.length?html:`<div class="empty"><span class="empty-mark">▤</span><h2>${esc(tx('mailEmptyTitle'))}</h2><p>${esc(q?local('没有找到匹配「'+q+'」的邮件。','沒有找到符合「'+q+'」的郵件。','No mail matches “'+q+'”.'):tx('mailEmptyText'))}</p>${mailEmptyCta}</div>`;
      const gotoSettingsBtn=$('#mail-list [data-goto-settings]');if(gotoSettingsBtn)gotoSettingsBtn.onclick=()=>view('settings');
    }else if(html){
      $('#mail-list').insertAdjacentHTML('beforeend',html);
    }
    const more=$('#mail-load-more');if(more)more.remove();
    if(mailNextBefore){
      const btn=document.createElement('button');btn.id='mail-load-more';btn.type='button';btn.className='chip-button mail-load-more';btn.textContent=tx('loadMoreMail');
      btn.onclick=async()=>{if(mailLoadingMore)return;mailLoadingMore=true;btn.disabled=true;try{await loadMail({append:true});}finally{mailLoadingMore=false;}};
      $('#mail-list').appendChild(btn);
    }
    bindMailList($('#mail-list'));
    const activeLocale=locale;
    void prepareBriefs(messages,()=>{
      for(const card of $$('#mail-list .mail-card[data-open-mail]')){const row=messages.find(m=>encodeURIComponent(m.id)===card.dataset.openMail);if(row)card.outerHTML=mailCard(row);}
      bindMailList($('#mail-list'));
    },()=>locale===activeLocale&&!$('#mail-view').classList.contains('hidden'));

    const focusId=new URLSearchParams(location.search).get('message');

  }catch(e){$('#global-error').textContent=e.message;}
}
function wireMailSearch(){
  const toggle=$('#mail-search-toggle'),input=$('#mail-search');
  if(!toggle||!input)return;
  let timer=null;
  const setQuery=q=>{currentMailQuery=q;loadMail({q});};
  const open=()=>{input.classList.add('open');input.tabIndex=0;input.removeAttribute('aria-hidden');toggle.classList.add('active');toggle.setAttribute('aria-expanded','true');input.focus();};
  const close=()=>{clearTimeout(timer);input.classList.remove('open');input.tabIndex=-1;input.setAttribute('aria-hidden','true');toggle.classList.remove('active');toggle.setAttribute('aria-expanded','false');};
  toggle.onclick=()=>{if(input.classList.contains('open')){if(input.value){input.value='';setQuery('');}close();}else open();};
  input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>setQuery(input.value.trim()),300);});
  input.addEventListener('focusout',e=>{if(!input.value&&e.relatedTarget!==toggle)close();});
  input.addEventListener('keydown',e=>{if(e.key==='Escape'){input.value='';setQuery('');close();toggle.focus();}});
}
// ---------- 日报 / Digest briefing ----------
// A digest is a *briefing*, not a second mail list: a one-sentence lede, three counters, the next
// dates, and compact rows sorted by urgency that expand in place. Mail cards stay on the mail page.
let digestData=[],digestViews=[],digestFilter='all',digestBound=false,digestStackOpen=false;
const digestOpen=new Set();
const motionOk=()=>!matchMedia('(prefers-reduced-motion: reduce)').matches;
const digestText=(value,fallback)=>digestTextForLocale(value,locale,fallback);
const digestTitle=title=>digestTitleForLocale(title,locale);
const tierLabel=t=>({act:local('需处理','需處理','Action'),upcoming:local('日程','日程','Dated'),info:local('资讯','資訊','Info')}[t]);
function dayLabel(ts){
  const n=daysUntil(ts,Date.now()),date=new Date(ts).toLocaleDateString(dateLocale(),{timeZone:'Asia/Hong_Kong',month:'short',day:'numeric',weekday:'short'});
  return {text:n===0?local('今天','今日','Today'):n===1?local('明天','明日','Tomorrow'):date,title:date,soon:n<=1};
}
function digestLede(o){
  const {counts,nextAct}=o,when=nextAct?dayLabel(nextAct.when).text:'';
  if(!counts.total)return '';
  if(counts.act)return local(`有 ${counts.act} 封邮件可能需要你处理${when?`，最近的是 ${when}`:''}。`,`有 ${counts.act} 封郵件可能需要你處理${when?`，最近的是 ${when}`:''}。`,`${counts.act} ${counts.act===1?'email may':'emails may'} need you to act${when?` — the nearest is ${when}`:''}.`);
  if(counts.upcoming)return local(`没有需要马上处理的邮件；有 ${counts.upcoming} 项日期安排可以留意。`,`沒有需要即時處理的郵件；有 ${counts.upcoming} 項日期安排可以留意。`,`Nothing urgent. ${counts.upcoming} dated ${counts.upcoming===1?'item is':'items are'} worth keeping in mind.`);
  return local('这个时段只有资讯类邮件，没有需要处理的事项。','這個時段只有資訊類郵件，沒有需要處理的事項。','Only informational mail this time — nothing to act on.');
}
function digestBody(r,key){
  const it=r.item,brief=locale==='en'&&!englishBriefIsUsable(it.brief)?null:it.brief;
  const meta=[digestText(brief?.topic||(it.category?tx(categoryKey(it.category)):''),'Topic unavailable'),digestText(it.origin||it.sender,'Sender unavailable'),it.received?fmt(it.received):''].filter(Boolean);
  let html=meta.length?`<p class="dg-meta" data-user-content>${esc(meta.join(' · '))}</p>`:'';
  if(brief)html+=digestBriefContent({...it,brief});
  else if(it.briefLoading)html+=`<div class="dg-skel" role="status" aria-label="${esc(local('正在从原文整理要点','正在從原文整理重點','Reading the original email'))}"><span></span><span></span><span></span></div><p class="dg-note">${esc(local('正在从原文整理要点…','正在從原文整理重點…','Reading the original email…'))}</p>`;
  else{
    // 没有 AI 摘要时，先展示已有的速览（extractive summary），而不是一直"正在整理"。
    // 这样用户总能看到内容，不会觉得卡住了。
    if(r.gist.text)html+=`<p class="dg-quick"><b>${esc(local('速览','速覽','Quick view'))}</b> <span data-user-content>${esc(r.gist.text)}</span></p>`;
    if(it.briefError)html+=`<p class="dg-note is-error">${esc(local('详细要点暂未生成，可能是原文暂时不可用。','詳細重點暫未產生，可能是原文暫時不可用。','Detailed notes could not be prepared; the original mail may be unavailable.'))}</p>`;
    else if(!r.gist.text)html+=`<p class="dg-note">${esc(local('暂无摘要，可点击下方按钮生成详细要点。','暫無摘要，可點擊下方按鈕產生詳細重點。','No summary yet. Tap the button below to generate detailed notes.'))}</p>`;
  }
  const buttons=[];
  if(it.id)buttons.push(`<button type="button" class="dg-btn primary" data-dg-open="${key}">${esc(local('查看邮件','查看郵件','Open email'))}<span aria-hidden="true"> ↗</span></button>`);
  if(r.when!==null&&it.id&&!it.ignored){const added=tasks.some(t=>t.source==='email'&&t.source_id===`digest-mail:${it.id}`);buttons.push(`<button type="button" class="dg-btn" data-dg-add-task="${key}" ${added?'disabled':''}>${esc(local(added?'已加入我的待办':'加入我的待办',added?'已加入我的待辦':'加入我的待辦',added?'Added to my tasks':'Add to my tasks'))}</button>`);}
  if(it.id&&(r.tier==='act'||it.ignored))buttons.push(`<button type="button" class="dg-btn" data-dg-ignore="${key}">${esc(local(it.ignored?'恢复提醒':'忽略',it.ignored?'恢復提醒':'忽略',it.ignored?'Restore reminders':'Ignore'))}</button>`);
  if(it.id&&!it.brief&&!it.briefLoading)buttons.push(`<button type="button" class="dg-btn" data-dg-brief="${key}">${esc(it.briefError?local('重试','重試','Retry'):local('生成详细要点','產生詳細重點','Prepare notes'))}</button>`);
  return html+(buttons.length?`<div class="dg-actions">${buttons.join('')}</div>`:'');
}
function digestRow(r,di,n){
  const key=di+':'+n,id=r.item.id||key,open=digestOpen.has(id),when=r.when!==null?dayLabel(r.when):null;
  const gist=r.gist.text&&!r.item.briefLoading?`<span class="dg-gist${r.gist.provisional?' is-quick':''}" data-user-content>${esc(r.gist.text)}</span>`:'';
  return `<li class="dg-row tier-${r.tier}${open?' open':''}" data-dg-row="${key}" data-tier="${r.tier}"><button type="button" class="dg-head" aria-expanded="${open}" aria-controls="dg-b-${di}-${n}"><span class="dg-dot" role="img" aria-label="${esc(tierLabel(r.tier))}"></span><span class="dg-main"><span class="dg-title" data-user-content>${esc(r.headline)}</span>${gist}</span>${when?`<span class="dg-when${when.soon?' soon':''}" title="${esc(when.title)}">${esc(when.text)}</span>`:''}<span class="dg-chev" aria-hidden="true"></span></button><div class="dg-body" id="dg-b-${di}-${n}"><div class="dg-body-inner">${digestBody(r,key)}</div></div></li>`;
}
function digestCard(d,di){
  const o=digestViews[di],c=o.counts;
  const stats=[['act',c.act,local('需处理','需處理','Need action')],['upcoming',c.upcoming,local('日程提醒','日程提醒','Dates ahead')],['total',c.total,local('封邮件','封郵件','Emails')]].map(([k,v,label])=>`<div class="dg-stat is-${k}"><b data-count="${v}">${v}</b><span>${esc(label)}</span></div>`).join('');
  const chips=[['all',local('全部','全部','All'),c.total],['act',tierLabel('act'),c.act],['upcoming',tierLabel('upcoming'),c.upcoming],['info',tierLabel('info'),c.info]].map(([k,label,n])=>`<button type="button" data-dg-filter="${k}" class="${digestFilter===k?'selected':''}" aria-pressed="${digestFilter===k}"${k!=='all'&&!n?' disabled':''}>${esc(label)} <i>${n}</i></button>`).join('');
  const timeline=o.timeline.length?`<ol class="dg-timeline" aria-label="${esc(local('即将到来','即將到來','Coming up'))}">${o.timeline.map(r=>{const w=dayLabel(r.when),n=o.rows.indexOf(r);return `<li><button type="button" data-dg-jump="${di}:${n}"><time class="${w.soon?'soon':''}" title="${esc(w.title)}">${esc(w.text)}</time><span data-user-content>${esc(r.headline)}</span></button></li>`;}).join('')}</ol>`:'';
  return `<article class="mail-card digest-card dg-card" data-dg-card="${di}"><div class="meta"><span class="badge">${esc(fmt(d.created))}</span></div><h2>${esc(digestTitle(d.title))}</h2><p class="dg-lede">${esc(digestLede(o))}</p><div class="dg-stats">${stats}</div>${timeline}<div class="dg-toolbar"><div class="dg-filter" role="group" aria-label="${esc(local('筛选','篩選','Filter'))}"><span class="dg-ind" aria-hidden="true"></span>${chips}</div><button type="button" class="dg-btn ghost" data-dg-all="${di}"></button></div><ul class="dg-list">${o.rows.map((r,n)=>digestRow(r,di,n)).join('')}</ul></article>`;
}
function moveIndicators(){
  $$('#digest-list .dg-filter').forEach(box=>{
    const on=box.querySelector('.selected'),ind=box.querySelector('.dg-ind');
    if(!on||!ind||!on.offsetWidth)return;
    ind.style.width=on.offsetWidth+'px';ind.style.transform=`translateX(${on.offsetLeft}px)`;
    requestAnimationFrame(()=>box.classList.add('ready'));
  });
}
function syncToggleAll(card){
  const rows=[...card.querySelectorAll('.dg-row:not([hidden])')],btn=card.querySelector('[data-dg-all]');
  if(!btn)return;
  const allOpen=rows.length>0&&rows.every(r=>r.classList.contains('open'));
  btn.dataset.state=allOpen?'close':'open';btn.disabled=!rows.length;
  btn.textContent=allOpen?local('全部收起','全部收起','Collapse all'):local('全部展开','全部展開','Expand all');
}
function applyDigestFilter(pop){
  $$('#digest-list .dg-card').forEach(card=>{
    let shown=0;
    card.querySelectorAll('.dg-row').forEach(row=>{
      const hide=digestFilter!=='all'&&row.dataset.tier!==digestFilter;
      row.hidden=hide;row.classList.remove('dg-pop');
      if(!hide){if(pop&&motionOk()){row.style.setProperty('--n',String(Math.min(shown,8)));void row.offsetWidth;row.classList.add('dg-pop');}shown++;}
    });
    card.querySelectorAll('[data-dg-filter]').forEach(b=>{const on=b.dataset.dgFilter===digestFilter;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});
    syncToggleAll(card);
  });
  moveIndicators();
}
function countUp(el){
  const target=Number(el.dataset.count)||0;
  if(!target||!motionOk()){el.textContent=String(target);return;}
  const t0=performance.now(),dur=650;el.textContent='0';
  const step=now=>{const p=Math.min(1,(now-t0)/dur);el.textContent=String(Math.round(target*(1-Math.pow(1-p,3))));if(p<1)requestAnimationFrame(step);};
  requestAnimationFrame(step);
}
function renderDigests(animate){
  const root=$('#digest-list');
  if(!digestData.length){root.innerHTML=`<div class="empty"><span class="empty-mark">◷</span><h2>${esc(tx('digestHistoryEmpty'))}</h2><p>${esc(tx('digestHistoryHelp'))}</p></div>`;return;}
  digestViews=digestData.map(d=>digestOverview(Array.isArray(d.items)?d.items:[],Date.now()));
  if(locale==='en')for(const view of digestViews)for(const row of view.rows){
    row.headline=digestText(row.headline,'Email summary unavailable');
    if(containsCjk(row.gist.text))row.gist={...row.gist,text:'English summary unavailable. Open the email for details.'};
  }
  const stacked=digestData.length>1;
  const list=digestData.map((d,di)=>Array.isArray(d.items)&&d.items.length?digestCard(d,di):`<article class="mail-card digest-card dg-card"><div class="meta"><span class="badge">${esc(fmt(d.created))}</span></div><h2>${esc(digestTitle(d.title))}</h2><p class="body-text" data-user-content>${esc(digestText(d.body||tx('noDigestItems'),'No mail items in this digest.'))}</p></article>`).join('');
  root.classList.toggle('dg-animate',!!animate&&motionOk());
  root.innerHTML=(stacked?`<button type="button" class="stack-toggle chip-button" aria-expanded="false"></button><div class="card-stack">`:'')+list+(stacked?'</div>':'');
  if(stacked)setupCardStack($('#digest-list .card-stack'),$('#digest-list .stack-toggle'),{open:local(`展开全部 ${digestData.length} 份日报`,`展開全部 ${digestData.length} 份日報`,`Show all ${digestData.length} digests`),close:local('收起','收起','Collapse')});
  if(stacked&&digestStackOpen)$('#digest-list .stack-toggle').click();
  $$('#digest-list .dg-row').forEach((row,i)=>row.style.setProperty('--n',String(Math.min(i,10))));
  $$('#digest-list [data-count]').forEach(el=>animate?countUp(el):(el.textContent=el.dataset.count));
  applyDigestFilter(false);
  if(animate)setTimeout(()=>root.classList.remove('dg-animate'),1400);
}
function bindDigestEvents(){
  if(digestBound)return;digestBound=true;
  const root=$('#digest-list');
  addEventListener('resize',moveIndicators);
  root.addEventListener('click',()=>{const t=root.querySelector('.stack-toggle');if(t)digestStackOpen=t.getAttribute('aria-expanded')==='true';});
  root.addEventListener('click',async e=>{
    if(e.target.closest('.card-stack.is-collapsed'))return; // first click only unfolds the stack
    const find=sel=>e.target.closest(sel);
    const rowOf=key=>{const [di,n]=key.split(':').map(Number);return {row:root.querySelector(`[data-dg-row="${key}"]`),r:digestViews[di]?.rows[n]};};
    const head=find('.dg-head');
    if(head){
      try{
        const row=head.closest('.dg-row');
        if(!row)return;
        const open=!row.classList.contains('open');
        row.classList.toggle('open',open);
        head.setAttribute('aria-expanded',String(open));
        syncToggleAll(row.closest('.dg-card'));
      }catch(e){console.warn('digest row click failed',e);}
      return;
    }
    const filter=find('[data-dg-filter]');
    if(filter&&!filter.disabled){digestFilter=filter.dataset.dgFilter;applyDigestFilter(true);return;}
    const all=find('[data-dg-all]');
    if(all){
      const card=all.closest('.dg-card'),open=all.dataset.state!=='close';
      card.querySelectorAll('.dg-row:not([hidden])').forEach(row=>{const {r}=rowOf(row.dataset.dgRow),id=r?.item.id||row.dataset.dgRow;row.classList.toggle('open',open);row.querySelector('.dg-head').setAttribute('aria-expanded',String(open));open?digestOpen.add(id):digestOpen.delete(id);});
      syncToggleAll(card);return;
    }
    const jump=find('[data-dg-jump]');
    if(jump){
      const {row,r}=rowOf(jump.dataset.dgJump);if(!row)return;
      if(row.hidden){digestFilter='all';applyDigestFilter(false);}
      row.classList.add('open');row.querySelector('.dg-head').setAttribute('aria-expanded','true');if(r?.item.id)digestOpen.add(r.item.id);
      syncToggleAll(row.closest('.dg-card'));row.scrollIntoView({behavior:motionOk()?'smooth':'auto',block:'center'});
      row.classList.remove('dg-flash');void row.offsetWidth;row.classList.add('dg-flash');return;
    }
    const ignore=find('[data-dg-ignore]');
    if(ignore){
      const {row,r}=rowOf(ignore.dataset.dgIgnore);if(!r?.item.id)return;
      ignore.disabled=true;
      const ignored=!r.item.ignored,wasOpen=row?.classList.contains('open');
      let collapse=Promise.resolve();
      if(ignored&&wasOpen){
        const head=row.querySelector('.dg-head'),body=row.querySelector('.dg-body');
        digestOpen.delete(r.item.id);row.classList.remove('open');head.setAttribute('aria-expanded','false');syncToggleAll(row.closest('.dg-card'));
        if(motionOk())collapse=new Promise(resolve=>{
          let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);body.removeEventListener('transitionend',onEnd);resolve();};
          const onEnd=event=>{if(event.target===body&&event.propertyName==='grid-template-rows')finish();};
          const timer=setTimeout(finish,460);body.addEventListener('transitionend',onEnd);
        });
      }
      try{
        await Promise.all([api('digests/ignore',{method:ignored?'POST':'DELETE',body:{messageId:r.item.id}}),collapse]);
        for(const digest of digestData)for(const item of digest.items||[])if(item.id===r.item.id)item.ignored=ignored;
        if(!ignored)digestOpen.add(r.item.id);
        renderDigests(false);
      }catch(error){
        if(ignored&&wasOpen&&row){digestOpen.add(r.item.id);row.classList.add('open');row.querySelector('.dg-head')?.setAttribute('aria-expanded','true');syncToggleAll(row.closest('.dg-card'));}
        ignore.disabled=false;$('#global-error').textContent=error.message;
      }
      return;
    }
    const addTask=find('[data-dg-add-task]');
    if(addTask){const {r}=rowOf(addTask.dataset.dgAddTask);if(!r||r.when===null||r.item.ignored||!r.item.id)return;openForm(null,{messageId:r.item.id,title:r.headline.slice(0,200),notes:[r.gist.text||r.item.summary||'',`${local('来源邮件：','來源郵件：','Source email: ')}${r.item.subject||r.headline}`].filter(Boolean).join('\n'),due:suggestedTaskDue(r.item,r.when),priority:r.tier==='act'?1:2});return;}
    const open=find('[data-dg-open]');
    if(open){const {r}=rowOf(open.dataset.dgOpen);if(r?.item.id){history.replaceState(null,'','/?view=mail&message='+encodeURIComponent(r.item.id));view('mail');openMailDetail(r.item.id);}return;}
    const brief=find('[data-dg-brief]');
    if(brief){
      const {r}=rowOf(brief.dataset.dgBrief);if(!r||r.item.briefLoading)return;
      // 按钮即时反馈：禁用并显示"生成中"，避免重复点击
      brief.disabled=true;
      brief.dataset.origText=brief.textContent;
      brief.textContent=local('生成中…','生成中…','Preparing…');
      const activeLocale=locale;r.item.briefError=false;
      void prepareBriefs([r.item],()=>renderDigests(false),()=>locale===activeLocale&&!$('#digests-view').classList.contains('hidden'),{live:true});
    }
  });
}
async function loadDigests(opts={}){
  try{
    digestData=await api('digests');
    digestData.sort((a,b)=>(Number(b.created)||0)-(Number(a.created)||0));
    bindDigestEvents();
    renderDigests(true);
    if(opts.generate!==false){
      const activeLocale=locale;
      void prepareBriefs(digestData.flatMap(d=>d.items||[]),()=>renderDigests(false),()=>locale===activeLocale&&!$('#digests-view').classList.contains('hidden'),{live:true,concurrency:2});
    }
  }catch(e){$('#global-error').textContent=e.message;}
}

let invitations=[],groups=[],selectedGroupId=null,groupState=null,activePoll=null;
const hkValue=n=>n?new Date(Number(n)+8*3600000).toISOString().slice(0,16):'';
const hkTime=value=>value?Date.parse(value+':00+08:00'):null;
const stateLabel=value=>({
  'zh-CN':{pending:'待处理',confirmed:'已确认',accepted:'已接受',declined:'已拒绝',rejected:'未采用',open:'收集中',collecting:'收集时间',voting:'投票中',in_progress:'进行中',completed:'已完成',closed:'已结束'},
  'zh-TW':{pending:'待處理',confirmed:'已確認',accepted:'已接受',declined:'已拒絕',rejected:'未採用',open:'收集中',collecting:'收集時間',voting:'投票中',in_progress:'進行中',completed:'已完成',closed:'已結束'},
  en:{pending:'Pending',confirmed:'Confirmed',accepted:'Accepted',declined:'Declined',rejected:'Rejected',open:'Collecting',collecting:'Collecting time',voting:'Voting',in_progress:'In progress',completed:'Completed',closed:'Closed'}
}[locale]?.[value]||value);
const memberName=id=>{const member=groupState?.members.find(item=>item.user_id===id);return member?.nickname||member?.email||local('未指定成员','未指定成員','Unassigned member');};
const memberOptions=(selected='')=>(groupState?.members||[]).map(member=>`<option value="${esc(member.user_id)}" ${member.user_id===selected?'selected':''}>${esc(member.nickname||local('用户 ','用戶 ','User ')+member.user_id.slice(-4))}</option>`).join('');
const evidenceText=evidence=>Object.values(evidence||{}).filter(Boolean).join('\n');

function groupIndex(){return `<div class="group-index" aria-label="${local('小组列表','小組列表','Group list')}">${groups.map(group=>`<button type="button" data-group-id="${esc(group.id)}" class="${group.id===selectedGroupId?'active':''}" ${group.id===selectedGroupId?'aria-current="true"':''}><strong>${esc(group.name)}</strong><small>${group.member_count} ${local('位成员','位成員','members')} · ${group.open_task_count} ${local('项任务','項任務','tasks')}</small></button>`).join('')}</div>`;}

function candidateCard(candidate,isOwner){
  const assignee=memberName(candidate.proposed_assignee_id),evidence=evidenceText(candidate.evidence);
  if(candidate.status==='pending'&&isOwner)return `<article class="candidate-card"><span class="state-pill pending">待审核</span><form class="candidate-review" data-review-candidate="${esc(candidate.id)}"><label>任务标题<input name="title" required maxlength="200" value="${esc(candidate.title)}"></label><div class="form-row"><label>建议负责人<select name="assignee">${memberOptions(candidate.proposed_assignee_id)}</select></label><label>截止时间（可留空）<input name="due" type="datetime-local" value="${hkValue(candidate.due)}"></label></div><label>任务说明<textarea name="notes" rows="2">${esc(candidate.notes||'')}</textarea></label><label>依据<textarea name="evidence" rows="2" required>${esc(evidence)}</textarea></label><div class="inline-actions"><button class="primary" type="submit">确认并发送给负责人</button><button type="button" data-reject-candidate="${esc(candidate.id)}">不采用</button></div></form></article>`;
  const next=candidate.next_action==='owner_review'?local(`等待组长 ${memberName(candidate.next_actor_user_id)} 审核`,`等待組長 ${memberName(candidate.next_actor_user_id)} 審核`,`Waiting for owner ${memberName(candidate.next_actor_user_id)} to review`):candidate.next_action==='assignee_accept'?local(`等待负责人 ${memberName(candidate.next_actor_user_id)} 接受`,`等待負責人 ${memberName(candidate.next_actor_user_id)} 接受`,`Waiting for ${memberName(candidate.next_actor_user_id)} to accept`):stateLabel(candidate.next_action);
  return `<article class="candidate-card"><span class="state-pill ${esc(candidate.status)}">${esc(stateLabel(candidate.status))}</span><h3 data-user-content>${esc(candidate.title)}</h3><p>${local('建议负责人：','建議負責人：','Proposed assignee: ')}${esc(assignee)} · ${esc(fmt(candidate.due))}</p><p class="next-action">${local('下一步：','下一步：','Next: ')}${next}</p>${candidate.notes?`<p>${esc(candidate.notes)}</p>`:''}${evidence?`<p class="evidence"><strong>依据</strong><br>${esc(evidence)}</p>`:''}</article>`;
}

function taskCard(task){
  const mine=task.user_id===status.account.id,pending=task.acceptance_status==='pending',next=pending?(mine?local('需要你决定是否接受','需要你決定是否接受','You need to accept or decline'):local('等待 ','等待 ','Waiting for ')+memberName(task.user_id)+local(' 接受',' 接受',' to accept')):task.acceptance_status==='accepted'?(task.completed?local('负责人已完成','負責人已完成','Completed by assignee'):local('负责人正在执行','負責人正在執行','In progress')):local('负责人已拒绝，组长需要重新分配','負責人已拒絕，組長需要重新分配','Declined; the owner needs to reassign it');
  return `<article class="group-task ${mine&&pending?'needs-action':''}"><span class="state-pill ${esc(task.acceptance_status)}">${esc(stateLabel(task.acceptance_status))}</span><h3>${esc(task.title)}</h3><p>${local('负责人：','負責人：','Assignee: ')}${esc(memberName(task.user_id))} · ${esc(fmt(task.due))}</p><p class="next-action">${local('下一步：','下一步：','Next: ')}${esc(next)}</p>${task.notes?`<p>${esc(task.notes)}</p>`:''}${mine&&pending?`<div class="inline-actions"><button class="primary" data-assignment="accept" data-task-id="${esc(task.id)}">接受分工</button><button data-assignment="reject" data-task-id="${esc(task.id)}">拒绝分工</button></div>`:''}</article>`;
}

function pollWorkspace(){
  if(!activePoll)return '';
  const {poll,result,submissions,memberStatuses,votes,ownVote,missingVoterIds}=activePoll,own=submissions.find(item=>item.userId===status.account.id),intervals=own?.intervals?.length?own.intervals:[[poll.range_start,poll.range_end]],avoidIntervals=own?.avoidIntervals||[],isOwner=groupState.group.role==='owner';
  const identity=local(`你正在以 ${status.account.email} 的身份提交`,`你正以 ${status.account.email} 的身份提交`,`Submitting as ${status.account.email}`),submissionMatrix=memberStatuses.map(item=>`<span class="submission-status ${item.submitted?'done':''}">${item.submitted?'✓':'○'} ${esc(memberName(item.userId))} · ${item.submitted?local('已提交','已提交','Submitted'):local('待提交','待提交','Waiting')}</span>`).join('');
  const candidateOptions=poll.phase==='voting'?votes:result.proposals;
  const proposals=candidateOptions.length?candidateOptions.map((proposal,index)=>{const proposalTime=fmt(proposal.start),selectedVote=Number(ownVote)===Number(proposal.start),voteLabel=selectedVote?local('已投此项','已投此項','Selected'):local('投票','投票','Vote');return `<div class="proposal ${selectedVote?'selected':''}"><div><strong>${local('方案','方案','Option')} ${index+1} · ${esc(proposalTime)}</strong><small>${proposal.availableMemberIds.length}/${memberStatuses.length} ${local('人可参加','人可參加','available')}${proposal.preferencePenalty?' · '+proposal.preferencePenalty+' '+local('人希望避开','人希望避開','prefer to avoid'):''}${proposal.unavailableMemberIds.length?' · '+local('冲突：','衝突：','Conflicts: ')+proposal.unavailableMemberIds.map(memberName).join('、'):''}${poll.phase==='voting'?' · '+proposal.count+' '+local('票','票','votes'):''}</small></div>${poll.phase==='voting'&&poll.status==='open'?`<button class="${selectedVote?'primary':''}" data-vote-poll="${proposal.start}" aria-label="${esc(voteLabel+' · '+proposalTime)}">${voteLabel}</button>`:''}</div>`;}).join(''):`<p class="form-help">${local('当前范围内没有全员可参加的候选时段。请检查每位成员提交的账号与时间范围。','目前範圍內沒有全員可參加的候選時段。請檢查每位成員提交的帳號與時間範圍。','No option works for every voter. Check each member’s signed-in account and submitted range.')}</p>`;
  if(poll.status==='closed')return `<p>${local('会议已取消；旧待办和提醒已撤销。','會議已取消；舊待辦和提醒已撤銷。','Meeting cancelled. Old tasks and reminders have been removed.')}</p>`;
  if(poll.status==='confirmed')return `<div class="candidate-review"><h3 data-user-content>${esc(poll.name)}</h3><p><span class="state-pill confirmed">${esc(stateLabel('confirmed'))}</span> ${esc(fmt(poll.confirmed_start))}</p><p class="next-action">${local('会议已加入每位参与投票成员的“我的待办”，并发布为小组公告。','會議已加入每位參與投票成員的「我的待辦」，並發布為小組公告。','The meeting was added to every voter’s tasks and published as a group announcement.')}</p></div>`;
  if(poll.phase==='voting')return `<div class="candidate-review"><h3 data-user-content>${esc(poll.name)}</h3><p class="form-help">${identity}</p><div class="poll-proposals">${proposals}</div><p class="form-help">${missingVoterIds.length?local('仍待投票：','仍待投票：','Waiting for: ')+esc(missingVoterIds.map(memberName).join('、')):local('全员已投票。得票最高的方案可以确认。','全員已投票。得票最高的方案可以確認。','Everyone has voted. A highest-voted option can be confirmed.')}</p>${isOwner&&!missingVoterIds.length?`<div class="inline-actions">${votes.filter(item=>item.count===Math.max(...votes.map(vote=>vote.count))).map(item=>`<button class="primary" data-confirm-poll="${item.start}" aria-label="${esc(local('确认 ','確認 ','Confirm ')+fmt(item.start))}">${local('确认 ','確認 ','Confirm ')}${esc(fmt(item.start))}</button>`).join('')}</div>`:''}</div>`;
  const rows=intervals.map(([start,end])=>availabilityRow(start,end,'available')).join(''),avoidRows=avoidIntervals.map(([start,end])=>availabilityRow(start,end,'avoid')).join('');
  return `<div class="candidate-review"><h3 data-user-content>${esc(poll.name)}</h3><p class="form-help">${identity}</p><p class="form-help">${local('范围：','範圍：','Range: ')}${esc(fmt(poll.range_start))} – ${esc(fmt(poll.range_end))} · ${poll.duration_minutes} ${local('分钟','分鐘','minutes')} · ${local('缓冲','緩衝','Buffer')} ${poll.buffer_minutes} ${local('分钟','分鐘','minutes')}</p><div class="submission-matrix">${submissionMatrix}</div><form id="availability-form"><h4>我可以参加</h4><div class="availability-rows" data-interval-kind="available">${rows}</div><div class="inline-actions"><button type="button" id="add-availability">＋ 添加可用时段</button></div><h4>可以参加，但希望避开（可选）</h4><div class="availability-rows" data-interval-kind="avoid">${avoidRows}</div><div class="inline-actions"><button type="button" id="add-avoid">＋ 添加希望避开的时段</button><button type="submit" class="primary">保存我的时间</button></div></form><div class="poll-proposals">${proposals}</div>${result.missingMemberIds.length?`<p class="form-help">${local('仍待提交：','仍待提交：','Waiting for: ')}${esc(result.missingMemberIds.map(memberName).join('、'))}</p>`:isOwner&&result.hasAllMemberOption?'<button class="primary open-vote" id="open-vote">锁定候选并开启投票</button>':'<p class="form-help">所有成员提交后，组长可以开启投票。</p>'}</div>`;
}

function availabilityRow(start='',end='',kind='available'){const required=kind==='available'?'required':'';return `<div class="availability-row"><label>开始<input name="${kind}Start" type="datetime-local" ${required} value="${hkValue(start)}"></label><label>结束<input name="${kind}End" type="datetime-local" ${required} value="${hkValue(end)}"></label><button type="button" data-remove-availability aria-label="删除这个时段">删除</button></div>`;}

function renderGroups(){
  const root=$('#groups-content');
  $('#invitations').innerHTML=invitations.map(inv=>`<article class="setting-card"><h3>${esc(inv.name)}</h3><p>${local('邀请你加入小组','邀請你加入小組','You are invited to this group')}</p><button class="primary" data-invitation="${inv.id}" data-decision="accept">${local('接受邀请','接受邀請','Accept invitation')}</button> <button data-invitation="${inv.id}" data-decision="reject">${local('拒绝','拒絕','Decline')}</button></article>`).join('');
  $$('[data-invitation]').forEach(b=>b.onclick=()=>runAction(b,()=>api('invitations/'+b.dataset.invitation,{method:'POST',body:{decision:b.dataset.decision}}),()=>loadGroups(true)));
  if(!groups.length){root.innerHTML='<div class="empty"><span class="empty-mark">◎</span><h2>从一个真实的小组项目开始</h2><p>创建小组后，可以确认每个人的分工，并收集共同空闲时间。</p></div>';translateTextNodes();return;}
  if(!groupState){root.innerHTML=`<div class="groups-layout">${groupIndex()}<div class="workspace-placeholder"><p>选择一个小组，查看分工与会议时间。</p></div></div>`;bindGroupIndex();translateTextNodes();return;}
  const {group,members,candidates,tasks,meetingPolls,announcements}=groupState,isOwner=group.role==='owner';
  root.innerHTML=`<div class="groups-layout">${groupIndex()}<div class="group-panel"><div class="group-panel-head"><div><h2 data-user-content>${esc(group.name)}</h2><p>${members.length} ${local('位成员','位成員','members')} · ${esc(accountLabel(status.account))} · ${isOwner?local('组长','組長','Owner'):local('成员','成員','Member')}</p></div></div>${announcements?.length?`<section class="group-section announcements"><div class="section-heading"><h2>小组公告</h2></div>${announcements.map(item=>`<article class="announcement"><strong>${esc(announcementText(item).title)}</strong><p>${esc(announcementText(item).body)}</p></article>`).join('')}</section>`:''}<section class="group-section"><div class="section-heading"><h2>成员与提交身份</h2></div><div class="member-list">${members.map(member=>`<span class="member-chip ${member.user_id===status.account.id?'current':''}"><b>${esc(member.nickname||local('用户 ','用戶 ','User ')+member.user_id.slice(-4))}</b>${esc(member.role==='owner'?local('创建者','建立者','Owner'):local('成员','成員','Member'))}${member.user_id===status.account.id?local(' · 当前账号',' · 目前帳號',' · You'):''}</span>`).join('')}</div>${membershipControls(isOwner)}${isOwner?`<form id="member-form" class="compact-form"><label>用注册邮箱邀请成员<input name="email" type="email" required></label><button type="submit">邀请成员</button></form>`:''}</section><section class="group-section"><div class="section-heading"><h2>分工确认</h2></div><form id="candidate-form" class="candidate-form"><label>候选任务<input name="title" maxlength="200" required></label><div class="form-row"><label>建议负责人<select name="assignee"><option value="">由组长审核时决定</option>${memberOptions()}</select></label><label>截止时间（可留空）<input name="due" type="datetime-local"></label></div><label>任务说明<textarea name="notes" rows="2"></textarea></label><label>依据<textarea name="evidence" rows="2" required></textarea></label><div class="form-actions"><button type="submit" class="primary">提交候选</button></div></form>${candidates.length?candidates.map(candidate=>candidateCard(candidate,isOwner)).join(''):'<p class="form-help">还没有候选分工。候选不会自动变成正式任务。</p>'}</section><section class="group-section"><div class="section-heading"><h2>全组分工看板</h2></div>${tasks.length?tasks.map(taskCard).join(''):'<p class="form-help">暂无正式分工。组长审核候选后，负责人会在这里接受或拒绝。</p>'}</section><section class="group-section"><div class="section-heading"><h2>共同会议时间</h2></div><form id="meeting-form" class="meeting-form"><label>会议名称<input name="name" maxlength="120" required></label><div class="form-row"><label>可选范围开始<input name="rangeStart" type="datetime-local" required></label><label>可选范围结束<input name="rangeEnd" type="datetime-local" required></label></div><div class="form-row"><label>会议时长<select name="duration"><option value="30">30 分钟</option><option value="45">45 分钟</option><option value="60" selected>60 分钟</option><option value="90">90 分钟</option></select></label><label>前后缓冲<select name="buffer"><option value="0">不需要</option><option value="15" selected>15 分钟</option><option value="30">30 分钟</option></select></label></div><div class="form-actions"><button class="primary" type="submit">发起时间收集</button></div></form>${meetingPolls.length?meetingPolls.map(poll=>`<article class="poll-card"><span class="state-pill ${esc(poll.phase||poll.status)}">${esc(stateLabel(poll.phase||poll.status))}</span><h3 data-user-content>${esc(poll.name)}</h3><p>${esc(fmt(poll.range_start))} – ${esc(fmt(poll.range_end))} · ${poll.duration_minutes} ${local('分钟','分鐘','minutes')}</p><button type="button" data-open-poll="${esc(poll.id)}">${poll.status==='confirmed'?'查看结果':poll.phase==='voting'?'参与投票':'提交时间 / 查看推荐'}</button></article>`).join(''):'<p class="form-help">还没有会议时间收集。</p>'}${pollWorkspace()}${meetingControls()}</section></div></div>`;
  bindGroupActions();
  translateTextNodes();
  bindUpgradeControls();
}

function bindGroupIndex(){$$('[data-group-id]').forEach(button=>button.onclick=async()=>{selectedGroupId=button.dataset.groupId;activePoll=null;await loadGroups(true);});}

function bindGroupActions(){
  bindGroupIndex();
  const memberForm=$('#member-form');if(memberForm)memberForm.onsubmit=async event=>{event.preventDefault();const button=memberForm.querySelector('[type=submit]');button.disabled=true;try{await api(`groups/${selectedGroupId}/members`,{method:'POST',body:{email:memberForm.elements.email.value}});toast(local('邀请已发送，等待对方接受','邀請已發送，等待對方接受','Invitation sent; waiting for acceptance'));await loadGroups(true);}catch(error){toast(error.message);}finally{button.disabled=false;}};
  $('#candidate-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type=submit]');button.disabled=true;try{await api(`groups/${selectedGroupId}/candidates`,{method:'POST',body:{title:form.elements.title.value,notes:form.elements.notes.value,due:hkTime(form.elements.due.value),proposedAssigneeId:form.elements.assignee.value||null,evidence:{source:form.elements.evidence.value}}});toast('候选分工已提交，等待审核');await loadGroups(true);}catch(error){toast(error.message);}finally{button.disabled=false;}};
  $$('[data-review-candidate]').forEach(form=>form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;try{await api(`task-candidates/${form.dataset.reviewCandidate}/review`,{method:'POST',body:{decision:'confirm',changes:{title:form.elements.title.value,notes:form.elements.notes.value,due:hkTime(form.elements.due.value),proposedAssigneeId:form.elements.assignee.value,evidence:{source:form.elements.evidence.value}}}});toast('分工已发送，等待负责人接受');await loadGroups(true);await loadTasks();}catch(error){toast(error.message);}finally{button.disabled=false;}});
  $$('[data-reject-candidate]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await api(`task-candidates/${button.dataset.rejectCandidate}/review`,{method:'POST',body:{decision:'reject'}});toast('候选已标记为不采用');await loadGroups(true);}catch(error){toast(error.message);button.disabled=false;}});
  $$('[data-assignment]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await api(`tasks/${button.dataset.taskId}/assignment`,{method:'POST',body:{decision:button.dataset.assignment}});toast(button.dataset.assignment==='accept'?'已接受分工':'已拒绝分工');await loadGroups(true);await loadTasks();}catch(error){toast(error.message);button.disabled=false;}});
  $('#meeting-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type=submit]');button.disabled=true;try{const poll=await api(`groups/${selectedGroupId}/meeting-polls`,{method:'POST',body:{name:form.elements.name.value,rangeStart:hkTime(form.elements.rangeStart.value),rangeEnd:hkTime(form.elements.rangeEnd.value),durationMinutes:Number(form.elements.duration.value),slotMinutes:15,bufferMinutes:Number(form.elements.buffer.value)}});activePoll=await api(`meeting-polls/${poll.id}`);toast('会议时间收集已发起');await loadGroups(true,true);}catch(error){toast(error.message);}finally{button.disabled=false;}};
  $$('[data-open-poll]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{activePoll=await api(`meeting-polls/${button.dataset.openPoll}`);renderGroups();setTimeout(()=>$('#availability-form')?.scrollIntoView({behavior:'smooth',block:'center'}),0);}catch(error){toast(error.message);button.disabled=false;}});
  const addAvailability=$('#add-availability');if(addAvailability)addAvailability.onclick=()=>{$('[data-interval-kind=available]').insertAdjacentHTML('beforeend',availabilityRow('','','available'));bindAvailabilityRemove();};
  const addAvoid=$('#add-avoid');if(addAvoid)addAvoid.onclick=()=>{$('[data-interval-kind=avoid]').insertAdjacentHTML('beforeend',availabilityRow('','','avoid'));bindAvailabilityRemove();};
  bindAvailabilityRemove();
  const availabilityForm=$('#availability-form');if(availabilityForm)availabilityForm.onsubmit=async event=>{event.preventDefault();const read=kind=>$$(`[name=${kind}Start]`,availabilityForm).map((input,index)=>[hkTime(input.value),hkTime($$(`[name=${kind}End]`,availabilityForm)[index].value)]),intervals=read('available'),avoidIntervals=read('avoid'),button=availabilityForm.querySelector('[type=submit]');button.disabled=true;try{await api(`meeting-polls/${activePoll.poll.id}/availability`,{method:'PUT',body:{intervals,avoidIntervals}});activePoll=await api(`meeting-polls/${activePoll.poll.id}`);toast('可用时间已保存，成员提交状态与推荐已更新');renderGroups();bindUpgradeControls();}catch(error){toast(error.message);button.disabled=false;}};
  const openVote=$('#open-vote');if(openVote)openVote.onclick=async()=>{openVote.disabled=true;try{await api(`meeting-polls/${activePoll.poll.id}/voting`,{method:'POST',body:{}});activePoll=await api(`meeting-polls/${activePoll.poll.id}`);toast('候选时间已锁定，投票开始');renderGroups();bindUpgradeControls();}catch(error){toast(error.message);openVote.disabled=false;}};
  $$('[data-vote-poll]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await api(`meeting-polls/${activePoll.poll.id}/vote`,{method:'POST',body:{start:Number(button.dataset.votePoll)}});activePoll=await api(`meeting-polls/${activePoll.poll.id}`);toast('投票已保存，可在结束前修改');renderGroups();bindUpgradeControls();}catch(error){toast(error.message);button.disabled=false;}});
  $$('[data-confirm-poll]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await api(`meeting-polls/${activePoll.poll.id}/confirm`,{method:'POST',body:{start:Number(button.dataset.confirmPoll)}});activePoll=await api(`meeting-polls/${activePoll.poll.id}`);toast('会议时间已确认');await loadGroups(true,true);}catch(error){toast(error.message);button.disabled=false;}});
}

function bindAvailabilityRemove(){$$('[data-remove-availability]').forEach(button=>button.onclick=()=>{const container=button.closest('.availability-rows');if(container.dataset.intervalKind==='available'&&container.children.length===1){toast('至少保留一个可用时段');return;}button.closest('.availability-row').remove();});}

async function loadGroups(force=false,keepPoll=false){
  const root=$('#groups-content');if(!force&&!groups.length)root.innerHTML='<div class="group-loading"><span></span><span></span></div>';
  try{[groups,invitations]=await Promise.all([api('groups'),api('invitations')]);if(selectedGroupId&&!groups.some(group=>group.id===selectedGroupId))selectedGroupId=null;if(!selectedGroupId)selectedGroupId=groups[0]?.id||null;groupState=selectedGroupId?await api(`groups/${selectedGroupId}`):null;if(!keepPoll)activePoll=null;renderGroups();bindUpgradeControls();}catch(error){root.innerHTML=`<p class="error">${esc(error.message)}</p>`;}
}

async function loadSettings(){return loadSettingsProfile();}
async function enablePush(){try{if(!('serviceWorker'in navigator)||!('PushManager'in window))throw Error('请从 iPhone 主屏幕打开，或使用支持通知的浏览器');const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('通知权限尚未允许，请在系统设置中启用');const registration=await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;const raw=atob(status.vapid.replace(/-/g,'+').replace(/_/g,'/'));const applicationServerKey=Uint8Array.from(raw,c=>c.charCodeAt(0));const sub=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey});await api('subscriptions',{method:'POST',body:sub.toJSON()});toast('此设备已启用通知');}catch(e){toast(e.message);}}
function exportCalendar(t){if(!t.due)return;const quote=s=>String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');const stamp=n=>new Date(n).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z');const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Campus Companion//Tasks//ZH','BEGIN:VEVENT','UID:'+t.id+'@campus-companion','DTSTAMP:'+stamp(Date.now()),'DTSTART:'+stamp(t.due),'DTEND:'+stamp(t.due+1800000),'SUMMARY:'+quote(local('截止：','截止：','Due: ')+t.title),'DESCRIPTION:'+quote(t.notes+'\n'+local('一次性日历副本，完成或改期请在校园清单操作。','一次性日曆副本，完成或改期請在校園清單操作。','One-time calendar copy. Update or complete the task in Campus Companion.')),'END:VEVENT','END:VCALENDAR'];const blob=new Blob([lines.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=local('待办截止日期.ics','待辦截止日期.ics','task-deadline.ics');a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast(local('日历文件已下载，可导入系统日历；不会自动同步','日曆檔案已下載，可匯入系統日曆；不會自動同步','Calendar file downloaded for import; it will not sync automatically'));}
$('#login-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,b=form.querySelector('button');b.disabled=true;b.classList.add('pending');const original=b.textContent;b.textContent=local('提交中…','提交中…','Submitting…');try{await api('login',{method:'POST',body:{email:form.elements.email.value,password:form.elements.password.value}});form.reset();await flyToDock(boot);}catch(e){$('#login-error').textContent=e.message;}finally{b.disabled=false;b.classList.remove('pending');b.textContent=original;}};
$('#register-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,b=form.querySelector('[type=submit]');b.disabled=true;b.classList.add('pending');const original=b.textContent;b.textContent=local('提交中…','提交中…','Submitting…');$('#register-error').textContent='';try{await api('register',{method:'POST',body:{email:form.elements.email.value,password:form.elements.password.value,question:form.elements.question.value,answer:form.elements.answer.value}});form.reset();await flyToDock(boot);toast('账号已创建');}catch(e){$('#register-error').textContent=e.message;}finally{b.disabled=false;b.classList.remove('pending');b.textContent=original;}};
$$('[data-auth]').forEach(button=>button.onclick=()=>{$$('[data-auth]').forEach(b=>b.classList.toggle('selected',b===button));$('#login-form').classList.toggle('hidden',button.dataset.auth!=='login');$('#register-form').classList.toggle('hidden',button.dataset.auth!=='register');});
$('#forgot-password').onclick=()=>{$('#recovery-form').reset();$('#recovery-answer').classList.add('hidden');$('#recovery-error').textContent='';$('#recovery-dialog').showModal();};
$('#close-recovery').onclick=()=>$('#recovery-dialog').close();
$('#load-question').onclick=async()=>{const f=$('#recovery-form');$('#recovery-error').textContent='';try{const result=await api('recovery/question',{method:'POST',body:{email:f.elements.email.value}});$('#security-question').textContent='密保问题：'+result.question;$('#recovery-answer').classList.remove('hidden');f.elements.answer.required=true;f.elements.password.required=true;}catch(e){$('#recovery-error').textContent=e.message;}};
$('#recovery-form').onsubmit=async event=>{event.preventDefault();const f=event.currentTarget,b=f.querySelector('[type=submit]');b.disabled=true;try{await api('recovery/reset',{method:'POST',body:{email:f.elements.email.value,answer:f.elements.answer.value,password:f.elements.password.value}});$('#recovery-dialog').close();toast('密码已重置，请使用新密码登录');}catch(e){$('#recovery-error').textContent=e.message;}finally{b.disabled=false;}};
async function logout(){try{await api('logout',{method:'POST',body:{}});}finally{tasks=[];location.replace('/');}}
$('#logout').onclick=logout;
$('#add-task').onclick=()=>openForm();$('#close-dialog').onclick=$('#cancel-task').onclick=()=>$('#task-dialog').close();
$('#task-dialog').addEventListener('close',()=>{mailTaskDraft=null;$('#task-dialog').classList.remove('mail-task-review');$('#mail-task-hint')?.classList.add('hidden');});
$('#new-group').onclick=()=>{$('#group-form').reset();$('#group-form-error').textContent='';$('#group-dialog').showModal();};$('#close-group-dialog').onclick=$('#cancel-group').onclick=()=>$('#group-dialog').close();
$('#group-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type=submit]');button.disabled=true;try{const group=await api('groups',{method:'POST',body:{name:form.elements.name.value}});selectedGroupId=group.id;$('#group-dialog').close();toast('小组已创建');await loadGroups(true);}catch(error){$('#group-form-error').textContent=error.message;}finally{button.disabled=false;}};
for(const [id,tab] of [['show-pending','pending'],['show-completed','done'],['show-archived','archive']])$('#'+id).onclick=()=>{taskTab=tab;renderTasks();};
$$('[data-period]').forEach(card=>card.onclick=()=>{activePeriod=activePeriod===card.dataset.period?null:card.dataset.period;renderPeriodCards(Date.now());if(activePeriod)$('#period-details').scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
$('#close-period-details').onclick=()=>{activePeriod=null;renderPeriodCards(Date.now());};
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&tasks.length){renderTasks();schedulePeriodRefresh();}});
$$('[data-view]').forEach(b=>b.onclick=event=>{if(b.dataset.view===activeView)view(b.dataset.view);else pageTransition(()=>view(b.dataset.view));});
function wireMailDetail(){
  const dialog=$('#mail-detail-dialog');if(!dialog||dialog.dataset.wired)return;dialog.dataset.wired='1';
  const close=()=>{if(history.state?.mailReader)history.back();else{hideMailReader();view('mail');}};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!dialog.classList.contains('hidden'))close();});
  window.addEventListener('popstate',()=>{const id=new URLSearchParams(location.search).get('message');if(id)openMailDetail(id,{push:false});else hideMailReader();});
  $('#close-mail-detail')?.addEventListener('click',close);
  $('#mail-detail-done')?.addEventListener('click',close);
  dialog.querySelectorAll('[data-mail-pane]').forEach(btn=>btn.onclick=()=>{
    dialog.querySelectorAll('[data-mail-pane]').forEach(b=>b.classList.toggle('selected',b===btn));
    $('#mail-detail-zh').classList.toggle('hidden',btn.dataset.mailPane!=='zh');
    $('#mail-detail-en').classList.toggle('hidden',btn.dataset.mailPane!=='en');
  });
}
async function boot(){wireMailDetail();wireMailSearch();try{status=await api('status');const profile=await api('profile');reminderDefaults=profile.reminders||reminderDefaults;applyLocale(status.account.locale||localStorage.getItem('campus-locale')||'zh-CN');localStorage.setItem('campus-locale',locale);$('#login').classList.add('hidden');$('#app').classList.remove('hidden');ensureDock();$('#account-label').textContent=accountLabel(status.account);setAvatar(status.account.avatar,accountLabel(status.account).slice(0,1).toUpperCase());$('#date-label').textContent=new Date().toLocaleDateString(dateLocale(),{timeZone:'Asia/Hong_Kong',year:'numeric',month:'long',day:'numeric',weekday:'long'});await loadTasks();const params=new URLSearchParams(location.search),v=params.get('view'),message=params.get('message');view(['groups','mail','digests','settings'].includes(v)?v:'tasks');if(message){history.replaceState(null,'','/?view=mail&message='+encodeURIComponent(message));openMailDetail(message,{push:false});}}catch(e){if(!$('#app').classList.contains('hidden'))$('#global-error').textContent=e.message;else showLogin();}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('#app').classList.contains('hidden'))loadTasks().catch(e=>toast(e.message));});

function announcementText(item){if(item.kind==='meeting-change')return {title:item.title,body:item.body==='cancel'?local('会议已取消','會議已取消','Meeting cancelled'):local('会议已改期，请重新提交可用时间','會議已改期，請重新提交可用時間','Meeting rescheduled. Submit availability again.')};if(item.kind==='meeting'){const poll=groupState.meetingPolls.find(p=>p.id===item.source_id);if(poll)return {title:local('会议时间已确认：','會議時間已確認：','Meeting confirmed: ')+poll.name,body:fmt(poll.confirmed_start)+' · '+poll.duration_minutes+' '+local('分钟','分鐘','minutes')};}return item;}
async function runAction(button,action,refresh){button.disabled=true;try{await action();toast(local('已保存','已儲存','Saved'));await refresh?.();}catch(error){toast(error.message);}finally{button.disabled=false;}}
function membershipControls(isOwner){
 return `<div class="inline-actions">${isOwner?`<select id="member-target" aria-label="${local('选择成员','選擇成員','Choose member')}">${groupState.members.filter(m=>m.user_id!==status.account.id).map(m=>`<option value="${esc(m.user_id)}">${esc(m.nickname||local('用户 ','用戶 ','User ')+m.user_id.slice(-4))}</option>`).join('')}</select><button data-member-action="transfer">${local('转让组长','轉讓組長','Transfer ownership')}</button><button data-member-action="remove">${local('移除成员','移除成員','Remove member')}</button>`:`<button data-member-action="leave">${local('退出小组','退出小組','Leave group')}</button>`}</div>`;
}
function meetingControls(){
 if(!activePoll||groupState?.group.role!=='owner')return '';
 const poll=activePoll.poll;
 return `<form id="meeting-change" class="candidate-review"><h3>${local('管理会议','管理會議','Manage meeting')}</h3><p>${local('改期会撤销旧待办和提醒，并重新收集全员时间。','改期會撤銷舊待辦和提醒，並重新收集全員時間。','Rescheduling removes old tasks and reminders and collects availability again.')}</p><div class="form-row"><label>${local('新范围开始','新範圍開始','New range starts')}<input type="datetime-local" name="rangeStart" required value="${hkValue(poll.range_start)}"></label><label>${local('新范围结束','新範圍結束','New range ends')}<input type="datetime-local" name="rangeEnd" required value="${hkValue(poll.range_end)}"></label></div><button type="submit">${local('改期 / 重新收集','改期／重新收集','Reschedule / collect again')}</button> <button type="button" id="cancel-meeting" ${poll.status==='closed'?'disabled':''}>${local('取消会议','取消會議','Cancel meeting')}</button></form>`;
}
function bindUpgradeControls(){
 $$('[data-member-action]').forEach(b=>b.onclick=()=>{const action=b.dataset.memberAction,target=action==='leave'?status.account.id:$('#member-target')?.value;if(!target)return;if(!confirm(local('确认变更小组成员？','確認變更小組成員？','Confirm this membership change?')))return;runAction(b,()=>api(`groups/${selectedGroupId}/membership`,{method:'POST',body:{action:action==='leave'?'remove':action,userId:target}}),()=>loadGroups(true));});
 const form=$('#meeting-change');if(!form)return;
 const change=(action,button)=>{if(!confirm(local('确认撤销旧会议待办与提醒？','確認撤銷舊會議待辦與提醒？','Remove the old meeting tasks and reminders?')))return;return runAction(button,()=>api(`meeting-polls/${activePoll.poll.id}/lifecycle`,{method:'POST',body:{action,revision:activePoll.poll.revision,rangeStart:hkTime(form.elements.rangeStart.value),rangeEnd:hkTime(form.elements.rangeEnd.value)}}),async()=>{await loadGroups(true);await loadTasks();});};
 form.onsubmit=e=>{e.preventDefault();change('reopen',form.querySelector('[type=submit]'));};$('#cancel-meeting').onclick=e=>change('cancel',e.currentTarget);
}
async function renderMailSuggestions(){
 const suggestions=await api('mail-suggestions');
 $('#mail-suggestions').innerHTML=suggestions.length?`<section class="setting-card mail-suggestions-section"><h2>${local('待确认的邮件任务','待確認的郵件任務','Mail tasks to review')}</h2><p>${local('核对标题、原文依据和截止时间，确认后才会创建待办与提醒。','核對標題、原文依據和截止時間，確認後才會建立待辦與提醒。','Check the title, source evidence and deadline. Tasks and reminders are created only after confirmation.')}</p><div class="mail-suggestion-list">${suggestions.map(s=>`<form class="mail-suggestion-card" data-mail-review="${esc(s.id)}"><div class="mail-suggestion-head"><span class="state-pill pending">${local('邮件待办建议','郵件待辦建議','Suggested task')}</span><button type="button" class="mail-source-link" data-source-mail="${esc(s.message_id)}">${local('来源邮件：','來源電郵：','Source email: ')}${esc(String(s.message_subject||local('查看中文与原文','查看中文與原文','View summary and original')).replace(/^(?:(?:fw|fwd|re)\s*:\s*)+/i,''))} ↗</button></div><div class="mail-suggestion-fields"><label>${tx('taskTitle')}<input name="title" required maxlength="200" value="${esc(s.title)}"></label><label>${local('截止时间（可留空）','截止時間（可留空）','Deadline (optional)')}<input name="due" type="datetime-local" value="${hkValue(s.due)}"></label></div><label class="mail-suggestion-notes">${local('备注','備註','Notes')}<textarea name="notes" rows="2">${esc(s.notes)}</textarea></label><p class="mail-suggestion-evidence" data-user-content>${esc(evidenceText(s.evidence))}</p><div class="inline-actions"><button type="submit" class="primary">${local('确认并加入我的待办','確認並加入我的待辦','Confirm and add to my tasks')}</button><button type="button" data-dismiss-mail="${esc(s.id)}">${local('不采用','不採用','Dismiss')}</button></div></form>`).join('')}</div></section>`:'';
 $$('[data-mail-review]').forEach(f=>f.onsubmit=e=>{e.preventDefault();runAction(f.querySelector('[type=submit]'),()=>api('mail-suggestions/'+f.dataset.mailReview,{method:'POST',body:{decision:'confirm',title:f.elements.title.value,notes:f.elements.notes.value,due:hkTime(f.elements.due.value)}}),async()=>{await renderMailSuggestions();await loadTasks();});});
 $$('[data-dismiss-mail]').forEach(b=>b.onclick=()=>runAction(b,()=>api('mail-suggestions/'+b.dataset.dismissMail,{method:'POST',body:{decision:'reject'}}),renderMailSuggestions));
 $$('[data-source-mail]').forEach(b=>b.onclick=()=>openMailDetail(b.dataset.sourceMail));
}

loadSettings=loadSettingsProfile;
const localeObserver=new MutationObserver(()=>translateTextNodes());
localeObserver.observe(document.body,{childList:true,subtree:true,characterData:true});
$$('[data-login-locale]').forEach(button=>button.onclick=()=>{localStorage.setItem('campus-locale',button.dataset.loginLocale);applyLocale(button.dataset.loginLocale);$$('[data-login-locale]').forEach(b=>b.classList.toggle('selected',b===button));});
applyLocale(detectLocale());
initTheme();
document.addEventListener('campus-theme-change',updateManifestLocale);
$$('[data-login-locale]').forEach(b=>b.classList.toggle('selected',b.dataset.loginLocale===locale));
boot();

// Profile and language settings override the legacy settings renderer above.
async function loadSettingsProfile(){
  try{
    status=await api('status');const p=await api('profile');const mailPrefs=p.mailPreferences||{focusTerms:[],daily:{enabled:true,time:'20:00'},late:{enabled:true,time:'00:00'},translateZh:true,englishSummary:false};applyLocale(p.locale);localStorage.setItem('campus-locale',p.locale);
    const outlook=`<div class="setting-card"><h2>${tx('outlookMail')}</h2><p class="status">${status.outlook?esc(translateCopy(status.mailStatus))+(status.lastSync?' · '+esc(fmt(status.lastSync)):''):esc(tx('outlookNotConnected'))}</p>${status.outlook?`<p class="connection-detail">${esc(tx('connectedAs'))} ${esc(status.outlookEmail)}</p><p><button id="sync-outlook" type="button">${tx('syncNow')}</button> <a href="/api/outlook/start">${tx('reconnect')} ↗</a></p><p><button id="disconnect-outlook" type="button" class="danger-text">${tx('disconnectOutlook')}</button></p><small>${esc(tx('disconnectOutlookHint'))}</small>`:`<p class="connection-detail">${esc(tx('connectOutlookHint'))}</p>`}${status.outlookConfigured?(status.outlook?'':`<form id="outlook-connect-form" class="connection-form"><label>${tx('outlookEmail')}<input name="email" type="email" autocomplete="email" required></label><button class="primary" type="submit">${tx('connectOutlook')} ↗</button></form>`):`<div class="setup-block"><p class="error">${esc(tx('outlookSetupNeeded'))}</p><p>${esc(tx('outlookMissing'))} <code>${esc((status.outlookMissingConfig||[]).join(', '))}</code></p><small>${esc(tx('outlookSetupHelp'))}</small></div>`}${status.outlook?`<small>${esc(tx('syncSchoolOnly'))}</small>`:''}</div>`;
    const zhUi=p.locale==='zh-CN'||p.locale==='zh-TW';
    const aliasRows=(p.nameAliases||[]).map((a,i)=>aliasRowHTML(a,i)).join('');
    const zhNameField=zhUi?`<div class="name-aliases-block"><div class="alias-list" id="alias-list">${aliasRows}</div><div class="alias-actions"><button type="button" id="alias-add" class="chip-button">＋ ${tx('addAlias')}</button></div><div id="alias-suggestions" class="alias-suggestions"></div></div>`:'';
    const translateFields=zhUi?`<div class="zh-only-settings"><label><input type="checkbox" name="translateZh" ${mailPrefs.translateZh!==false?'checked':''}> ${tx('mailTranslateZh')}</label><label><input type="checkbox" name="englishSummary" ${mailPrefs.englishSummary?'checked':''}> ${tx('mailEnglishSummary')}</label><small>${tx('mailTranslateHelp')}</small></div>`:'';
    const mailPreferences=`<div class="setting-card"><h2>${tx('mailNotifications')}</h2><p>${tx('mailReminderHelp')}</p><form id="mail-preferences-form"><label>${tx('focusTerms')}<textarea name="focusTerms" rows="4" maxlength="2400">${esc((mailPrefs.focusTerms||[]).join('\n'))}</textarea><small>${tx('focusTermsHelp')}</small></label><div class="settings-grid"><label><span><input type="checkbox" name="dailyEnabled" ${mailPrefs.daily.enabled?'checked':''}> ${tx('dailyDigest')}</span><input type="time" name="dailyTime" value="${esc(mailPrefs.daily.time)}"></label><label><span><input type="checkbox" name="lateEnabled" ${mailPrefs.late.enabled?'checked':''}> ${tx('lateDigest')}</span><input type="time" name="lateTime" value="${esc(mailPrefs.late.time)}"></label></div>${translateFields}<button class="primary" type="submit">${tx('saveMailPreferences')}</button></form></div>`;
    const displayName=p.nickname||`${tx('defaultNickname')} ${String(status.account.userCode||'0000')}`;
    const hasAvatar=p.avatar&&p.avatar.startsWith('data:image/');
    const qqProfileCard=`<div class="setting-card qq-profile-card"><h2>${tx('profile')}</h2>
      <div class="qq-profile-hero">
        <button type="button" class="qq-avatar-btn" id="qq-avatar-btn" aria-label="${esc(tx('avatar'))}">
          ${hasAvatar?`<img src="${esc(p.avatar)}" alt="">`:`<span class="qq-avatar-default" aria-hidden="true"><svg viewBox="0 0 24 24" width="44" height="44" fill="currentColor"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.2c-3.3 0-9.8 1.6-9.8 5v2.6h19.6V19.2c0-3.4-6.5-5-9.8-5z"/></svg></span>`}
          <span class="qq-avatar-edit-hint" aria-hidden="true">📷</span>
        </button>
        <div class="qq-profile-info">
          <div class="qq-name-row">
            <span class="qq-name" id="qq-name-display" data-user-content>${esc(displayName)}</span>
            <button type="button" class="qq-edit-btn" id="qq-name-edit-btn" aria-label="${esc(local('修改昵称','修改暱稱','Edit nickname'))}">
              <svg class="qq-edit-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
                <path class="qq-edit-sparkle" d="M6 5.5 7.1 8.4 10 9.5 7.1 10.6 6 13.5 4.9 10.6 2 9.5l2.9-1.1L6 5.5Z"/>
                <path class="qq-edit-pencil" d="m8.2 22.8 2-7.1L22.4 3.5a2.1 2.1 0 0 1 3 0l3.1 3.1a2.1 2.1 0 0 1 0 3L16.3 21.8l-8.1 1Z"/>
                <path class="qq-edit-pencil-detail" d="m10.2 15.7 6.1 6.1M22.4 3.5l6.1 6.1M8.2 22.8l4.1-4.1"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <form id="profile-form" class="qq-profile-form">
        <input type="hidden" name="nickname" value="${esc(p.nickname)}">
        <input type="hidden" name="avatar" value="${esc(p.avatar)}">
        <label>${tx('language')}<select name="locale"><option value="zh-CN" ${p.locale==='zh-CN'?'selected':''}>简体中文</option><option value="zh-TW" ${p.locale==='zh-TW'?'selected':''}>繁體中文</option><option value="en" ${p.locale==='en'?'selected':''}>English</option></select></label>
        ${zhNameField}
        <div class="qq-form-actions"><button class="primary" type="submit">${tx('save')}</button></div>
      </form>
    </div>
    <div id="avatar-page" class="avatar-page" hidden>
      <div class="avatar-page-inner">
        <div class="avatar-page-header">
          <button type="button" class="avatar-page-back" id="avatar-page-back" aria-label="Back">←</button>
          <h3>更换头像</h3>
          <span class="avatar-page-spacer"></span>
        </div>
        <div class="avatar-page-preview">
          <div class="avatar-page-img-wrap" id="avatar-page-img-wrap">
            <!-- preview inserted by JS -->
          </div>
        </div>
        <div class="avatar-page-actions">
          <label class="avatar-page-upload-btn">选择图片<input type="file" id="avatar-page-file" accept="image/png,image/jpeg,image/webp,image/gif" hidden></label>
          <button type="button" id="avatar-page-remove" class="avatar-page-remove">移除头像</button>
        </div>
        <p class="avatar-page-hint">PNG、JPEG、WEBP 或 GIF</p>
        <div class="avatar-page-footer">
          <button type="button" class="primary avatar-page-done" id="avatar-page-done">完成</button>
        </div>
      </div>
    </div>
    `;
    $('#settings-content').innerHTML=qqProfileCard+`${outlook}${mailPreferences}<div class="setting-card"><h2>${local('通知渠道','通知渠道','Notification channels')}</h2><p>${local('可以启用本机推送，或在网站查看待办与日报。','可以啟用本機推送，或在網站查看待辦與日報。','Enable push on this device or check tasks and digests here.')}</p><p>${local('iPhone：在 Safari 添加到主屏幕后，再开启通知。','iPhone：在 Safari 加入主畫面後，再開啟通知。','iPhone: add this site to your Home Screen in Safari before enabling notifications.')}</p><button id="enable-push" ${status.pushReady?'':'disabled'}>${local('在此设备启用通知','在此裝置啟用通知','Enable notifications on this device')}</button> <button id="test-push" ${status.pushReady?'':'disabled'}>${local('测试手机通知','測試手機通知','Test push notification')}</button></div><div class="setting-card"><h2>${tx('accountSecurity')}</h2><div class="settings-grid"><form id="password-form"><label>${tx('currentPassword')}<input name="current" type="password" required></label><label>${tx('newPassword')}<input name="next" type="password" minlength="12" required></label><button class="primary" type="submit">${tx('changePassword')}</button></form><form id="security-form"><label>${tx('currentPassword')}<input name="password" type="password" required></label><label>${tx('customQuestion')}<input name="question" required></label><label>${tx('answer')}<input name="answer" type="password" required></label><button type="submit">${tx('saveSecurity')}</button></form></div></div><div class="setting-card account-exit"><h2>${tx('signOutHere')}</h2><p>${tx('signOutHint')}</p><button type="button" id="settings-logout" class="danger-text">${tx('logout')}</button></div>`;
    const mailPreferencesForm=$('#mail-preferences-form');if(mailPreferencesForm)mailPreferencesForm.onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,button=f.querySelector('[type=submit]');button.disabled=true;try{const mailPreferences={focusTerms:[...new Set(f.elements.focusTerms.value.split(/[\n,，]/).map(x=>x.trim()).filter(Boolean))],daily:{enabled:f.elements.dailyEnabled.checked,time:f.elements.dailyTime.value},late:{enabled:f.elements.lateEnabled.checked,time:f.elements.lateTime.value},translateZh:f.elements.translateZh?f.elements.translateZh.checked:true,englishSummary:f.elements.englishSummary?f.elements.englishSummary.checked:false};await api('profile',{method:'PATCH',body:{mailPreferences}});toast(tx('mailPreferencesSaved'));}catch(err){toast(err.message);}finally{button.disabled=false;}};
    const outlookForm=$('#outlook-connect-form');if(outlookForm)outlookForm.onsubmit=e=>{e.preventDefault();const input=outlookForm.elements.email;if(!input.reportValidity())return;location.assign('/api/outlook/start?email='+encodeURIComponent(input.value.trim()));};
    const syncOutlook=$('#sync-outlook');if(syncOutlook)syncOutlook.onclick=async()=>{syncOutlook.disabled=true;syncOutlook.textContent=tx('syncing');try{const r=await api('outlook/sync',{method:'POST',body:{}});toast(tx('syncFinished').replace('{count}',r.imported));await loadMail();await loadSettingsProfile();}catch(err){toast(err.message);}finally{syncOutlook.disabled=false;syncOutlook.textContent=tx('syncNow');}};
    const disconnectOutlook=$('#disconnect-outlook');if(disconnectOutlook)disconnectOutlook.onclick=async()=>{if(!confirm(tx('confirmDisconnectOutlook')))return;disconnectOutlook.disabled=true;try{await api('outlook',{method:'DELETE',body:{}});toast(tx('outlookDisconnected'));await loadSettingsProfile();}catch(err){toast(err.message);disconnectOutlook.disabled=false;}};
    // ---------- QQ 风格头像：点击进二级界面 ----------
    const qqAvatarBtn=$('#qq-avatar-btn'),avatarPage=$('#avatar-page');
    if(qqAvatarBtn&&avatarPage){
      let avatarCloseTimer=0;
      // 打开头像二级页面（从右侧滑入）
      const openAvatarPage=()=>{
        window.clearTimeout(avatarCloseTimer);
        avatarCloseTimer=0;
        updateAvatarPagePreview();
        avatarPage.hidden=false;
        void avatarPage.offsetWidth;
        avatarPage.classList.add('open');
      };
      const closeAvatarPage=()=>{
        avatarPage.classList.remove('open');
        window.clearTimeout(avatarCloseTimer);
        avatarCloseTimer=window.setTimeout(()=>{avatarPage.hidden=true;avatarCloseTimer=0;},320);
      };
      qqAvatarBtn.onclick=openAvatarPage;
      $('#avatar-page-back').onclick=closeAvatarPage;
      $('#avatar-page-done').onclick=()=>{
        // 同步预览到主页面按钮
        const form=$('#profile-form');
        const avatarVal=form.elements.avatar.value;
        const btnImg=qqAvatarBtn.querySelector('img');
        const btnDefault=qqAvatarBtn.querySelector('.qq-avatar-default');
        if(avatarVal&&avatarVal.startsWith('data:image/')){
          if(btnImg)btnImg.src=avatarVal;
          else{
            if(btnDefault)btnDefault.remove();
            const img=document.createElement('img');img.src=avatarVal;img.alt='';
            qqAvatarBtn.insertBefore(img,qqAvatarBtn.firstChild);
          }
        }else{
          if(btnImg)btnImg.remove();
        }
        closeAvatarPage();
      };
      const qqFile=$('#avatar-page-file');
      const updateAvatarPagePreview=()=>{
        const form=$('#profile-form');
        const avatarVal=form?form.elements.avatar.value:'';
        const wrap=$('#avatar-page-img-wrap');
        if(!wrap)return;
        if(avatarVal&&avatarVal.startsWith('data:image/')){
          wrap.innerHTML=`<img src="${avatarVal}" alt="">`;
        }else{
          wrap.innerHTML=`<span class="qq-avatar-default large"><svg viewBox="0 0 24 24" width="64" height="64" fill="currentColor"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.2c-3.3 0-9.8 1.6-9.8 5v2.6h19.6V19.2c0-3.4-6.5-5-9.8-5z"/></svg></span>`;
        }
      };
      const setPreview=dataUrl=>{
        const form=$('#profile-form');
        if(form)form.elements.avatar.value=dataUrl||'';
        updateAvatarPagePreview();
      };
      qqFile.onchange=()=>{
        const file=qqFile.files&&qqFile.files[0];if(!file)return;
        if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)){toast(tx('avatarInvalid'));return;}
        const reader=new FileReader();
        reader.onload=()=>setPreview(reader.result);
        reader.readAsDataURL(file);
      };
      $('#avatar-page-remove').onclick=()=>{setPreview('');qqFile.value='';};
    }
    // ---------- 名字内联编辑：点击笔变成文本框（流畅高级） ----------
    const qqNameBtn=$('#qq-name-edit-btn'),qqNameDisplay=$('#qq-name-display'),qqNameRow=qqNameBtn?.closest('.qq-name-row');
    if(qqNameBtn&&qqNameDisplay&&qqNameRow){
      let editing=false,closing=false,originalName='';
      const startEdit=()=>{
        if(editing||closing)return;
        editing=true;
        originalName=qqNameDisplay.textContent;
        const input=document.createElement('input');
        input.type='text';
        input.className='qq-name-input';
        input.value=$('#profile-form').elements.nickname.value||originalName;
        input.maxLength=80;
        input.setAttribute('aria-label',local('修改昵称','修改暱稱','Edit nickname'));
        qqNameRow.insertBefore(input,qqNameBtn);
        void input.offsetWidth;
        qqNameDisplay.classList.add('editing');
        qqNameDisplay.setAttribute('aria-hidden','true');
        input.classList.add('open');
        input.focus();
        input.select();
        const finish=(save)=>{
          if(!editing)return;
          editing=false;
          closing=true;
          const val=input.value.trim().slice(0,80);
          if(save&&val){
            $('#profile-form').elements.nickname.value=val;
            const fallback=`${tx('defaultNickname')} ${String(status.account.userCode||'0000')}`;
            qqNameDisplay.textContent=val||fallback;
          }
          input.classList.remove('open');
          qqNameDisplay.classList.remove('editing');
          setTimeout(()=>{
            input.remove();
            qqNameDisplay.removeAttribute('aria-hidden');
            closing=false;
          },380);
        };
        input.addEventListener('keydown',e=>{
          if(e.key==='Enter'){finish(true);}
          else if(e.key==='Escape'){input.value=originalName;finish(false);}
        });
        input.addEventListener('blur',()=>finish(true));
      };
      qqNameBtn.onclick=startEdit;
    }
    $('#profile-form').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('[type=submit]');b.disabled=true;b.classList.add('pending');const original=b.textContent;b.textContent=local('保存中…','儲存中…','Saving…');try{const body={nickname:f.elements.nickname.value,avatar:f.elements.avatar.value,locale:f.elements.locale.value,preferredZhName:f.elements.preferredZhName?f.elements.preferredZhName.value:undefined};const aliasListEl=f.querySelector('#alias-list');if(aliasListEl)body.nameAliases=[...aliasListEl.querySelectorAll('.alias-row')].map(row=>({alias:row.querySelector('[name=alias]').value.trim(),zhName:row.querySelector('[name=aliasZh]').value.trim()})).filter(a=>a.alias&&a.zhName);const r=await api('profile',{method:'PATCH',body});applyLocale(r.locale);localStorage.setItem('campus-locale',r.locale);$('#account-label').textContent=r.nickname||accountLabel(status.account);setAvatar(r.avatar,(r.nickname||accountLabel(status.account)).slice(0,1).toUpperCase());b.textContent=local('已保存 ✓','已儲存 ✓','Saved ✓');setTimeout(()=>location.reload(),150);}catch(err){toast(err.message);b.disabled=false;b.classList.remove('pending');b.textContent=original;}};
    const aliasList=$('#alias-list'),aliasAdd=$('#alias-add');
    if(aliasAdd&&aliasList){
      aliasAdd.onclick=()=>{aliasList.insertAdjacentHTML('beforeend',aliasRowHTML());bindAliasRows();};
      bindAliasRows();
      loadAliasSuggestions(aliasList);
    }
    $('#password-form').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;try{await api('password',{method:'POST',body:{current:f.elements.current.value,next:f.elements.next.value}});f.reset();toast(tx('passwordSaved'));}catch(err){toast(err.message);}};
    $('#security-form').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;try{await api('security-question',{method:'POST',body:{password:f.elements.password.value,question:f.elements.question.value,answer:f.elements.answer.value}});f.reset();toast(tx('securitySaved'));}catch(err){toast(err.message);}};
    $('#settings-logout').onclick=logout;$('#enable-push').onclick=enablePush;$('#test-push').onclick=async()=>{try{await api('test-notification',{method:'POST',body:{}});toast(local('已提交推送，请检查设备通知','已提交推送，請檢查裝置通知','Push requested. Check this device.'));}catch(error){toast(error.message);}};
  }catch(e){$('#global-error').textContent=e.message;}
}
function aliasRowHTML(a={},i=0){
  return `<div class="alias-row" data-index="${i}"><input name="alias" placeholder="${esc(tx('aliasPlaceholder'))}" maxlength="80" value="${esc(a.alias||'')}" aria-label="${esc(tx('aliasPlaceholder'))}"><span class="alias-arrow" aria-hidden="true">→</span><input name="aliasZh" placeholder="${esc(tx('aliasZhPlaceholder'))}" maxlength="40" value="${esc(a.zhName||'')}" aria-label="${esc(tx('aliasZhPlaceholder'))}"><button type="button" class="icon-button alias-remove" data-i18n-aria="aliasRemove" aria-label="${esc(tx('aliasRemove'))}">×</button></div>`;
}
function bindAliasRows(){
  $$('#alias-list .alias-remove').forEach(button=>button.onclick=()=>button.closest('.alias-row').remove());
}
async function loadAliasSuggestions(aliasList){
  try{
    const box=$('#alias-suggestions');if(!box)return;
    const {suggestions}=await api('name-alias-suggestions');
    if(!suggestions||!suggestions.length){box.innerHTML='';return;}
    box.innerHTML=`<small>${esc(tx('aliasSuggestionsLabel'))}</small><div class="alias-suggestion-list">${suggestions.map(s=>`<button type="button" class="chip-button" data-alias="${esc(s.variant)}" data-zh="${esc(s.zhName)}">${esc(s.variant)} → ${esc(s.zhName)}</button>`).join('')}</div>`;
    $$('#alias-suggestions [data-alias]').forEach(button=>button.onclick=()=>{
      aliasList.insertAdjacentHTML('beforeend',aliasRowHTML({alias:button.dataset.alias,zhName:button.dataset.zh}));bindAliasRows();
      button.remove();if(!$$('#alias-suggestions [data-alias]').length)box.innerHTML='';
    });
  }catch{/* suggestions are best-effort */}
}
const renderSettingsLocalized=loadSettingsProfile;
loadSettingsProfile=async()=>{await renderSettingsLocalized();translateTextNodes();};
loadSettings=loadSettingsProfile;

async function celebrateTask(control){
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const card=control.closest('.task');card.classList.add('just-completed');
 const burst=document.createElement('span');burst.className='completion-burst';burst.setAttribute('aria-hidden','true');
 for(let i=0;i<8;i++){const dot=document.createElement('i');dot.style.setProperty('--angle',i*45+'deg');burst.append(dot);}card.append(burst);
 await new Promise(resolve=>setTimeout(resolve,520));burst.remove();
}

function offerUndo(id){
 const button=document.createElement('button');button.type='button';button.textContent=local('撤销','復原','Undo');$('#toast').append(button);clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.add('hidden'),8000);
 button.onclick=async()=>{button.disabled=true;try{const current=tasks.find(t=>t.id===id);if(!current)throw Error(local('任务不存在','任務不存在','Task not found'));await api('tasks/'+id,{method:'PATCH',body:{version:current.version,completed:false}});await loadTasks();toast('已重新打开待办');}catch(e){toast(e.message);}};
}

