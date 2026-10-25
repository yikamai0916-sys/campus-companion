# Loops 调研与 Campus Companion 适配评估

调研日期：2026-10-21  
资料范围：仅使用 Loops 官方网站、官方文档、官方 API 清单及法律文件。价格和产品能力可能调整，接入前应再次核对。

## 结论

Loops 是面向软件产品的**出站邮件平台**，用于发送营销邮件、生命周期自动化邮件和事务邮件。它不是邮箱客户端，也不是 Outlook 收件箱连接器。

因此：

- **不能**读取、搜索或同步用户的 Outlook 收件箱。
- **不能**替代 Microsoft Graph、Microsoft OAuth、`Mail.Read` 权限或 Entra 应用注册。
- **可以**在 Campus Companion 已经解析出待办、会议结果或日报之后，负责向学生发送提醒邮件。
- 目前不建议把它加入邮件读取主链路。若以后需要真正的邮件提醒，可以把它作为可替换的出站通知服务进行小范围试验。

## Loops 是什么

Loops 官方将产品定义为 SaaS 邮件平台，可以从网页、API 和集成发送营销邮件和事务邮件，并根据联系人属性和产品事件触发自动流程。[官方快速入门](https://app.loops.so/docs/quickstart)

主要能力包括：

- Campaign：一次性群发，例如产品公告或通讯。
- Workflow：基于联系人、事件、等待时间和条件分支的邮件流程。
- Transactional Email：由后端 API 触发的一对一邮件，例如登录验证码、回执和提醒。
- 联系人、属性、邮件列表、受众分组和退订管理。
- 可视化模板、MJML、邮件内容组件、发送与投递指标。
- REST API、OpenAPI、CLI、JavaScript/Go/Nuxt/PHP/Ruby SDK，以及面向代理工具的 MCP。[官方代理工具说明](https://loops.so/agents)、[官方 API 清单](https://loops.so/agents/api)
- Segment、Stripe、Supabase、Clerk、Webhook 和 SMTP 等集成；也可通过 Zapier 或 Make 连接其他服务。[官方集成说明](https://app.loops.so/docs/quickstart)

Loops 的 MCP 只能操作 Loops 自己管理的联系人、事件、邮件内容和发送流程。它不因此获得 Outlook 邮箱权限。[官方 MCP 与工具范围](https://loops.so/agents)

## 为什么不能解决当前 Outlook 问题

Loops 当前官方 API 清单包含联系人、事件、事务邮件、Campaign、Workflow、模板、列表和指标等资源，但没有 Outlook 邮箱授权、收件箱消息读取、邮件搜索或回复接口。[官方 API 清单](https://loops.so/agents/api)

这意味着 Campus Companion 的数据链仍然必须是：

```text
Outlook 邮箱
  → Microsoft OAuth + Graph Mail.Read
  → Campus Companion 筛选、摘要和提取待办
  → 站内通知 / 推送 / 可选的 Loops 出站邮件
```

Loops 只适合最后一步。当前遇到的 Entra 租户、Client ID 和 Client Secret 问题仍需通过 Microsoft 应用注册解决，接入 Loops 不会消除这些要求。

## 对本项目的可用场景

若后续启用出站邮件，Loops 可以发送：

1. 每日学校邮件摘要。
2. 作业截止前提醒。
3. 小组会议投票邀请、投票截止提醒和最终时间确认。
4. 分工确认、负责人接受和任务逾期提醒。
5. 用户注册、重置密码等系统邮件。

推荐只向 Loops 传递发送所需的最少数据，例如收件地址、昵称、提醒标题、时间和应用内链接。不要把完整学校邮件正文、附件、令牌或不必要的个人资料传给 Loops。

接入时应把它放在独立的 `EmailNotificationProvider` 边界后面。业务模块只产生“需要通知谁、通知什么”的事件，由通知层决定使用 Loops、其他邮件服务或暂不发送。这样不会让会议、待办和邮件读取模块依赖某一家供应商。

## 不适合的用途

- 导入或持续监听 Outlook 收件箱。
- 判断学校邮件是否重要、翻译邮件或提取截止日期；这些仍应由本项目完成。
- 代替小组聊天、实时翻译、系统推送或日历同步。
- 使用学生个人 Outlook 地址作为发信域名。Loops 要求验证你们控制的发信域名并配置 DNS；没有域名控制权就无法完成正式发信设置。[官方快速入门](https://app.loops.so/docs/quickstart)

## 当前价格

以 2026-10-21 官方价格页为准：[Loops Pricing](https://loops.so/pricing)

| 方案 | 联系人/订阅者 | 发送限制 | 价格 |
|---|---:|---:|---:|
| Free | 可存储不限量联系人；仅向前 1,000 位发送 | 营销与事务邮件合计每滚动 30 天 4,000 封 | US$0 |
| Paid 起步档 | 1,001–5,000 位已订阅联系人 | 营销与事务邮件不限发送量 | US$49/月 |

免费版包含全部功能，但邮件底部带有 “Powered by Loops”。付费方案按已订阅联系人数量分档，不按团队席位或单封邮件收费。

旧版免费方案文档仍写着“最多存储 1,000 个联系人”，与当前价格页的“不限存储、只向前 1,000 位发送”冲突。[旧版免费方案文档](https://app.loops.so/docs/account/free-plan) 若准备正式采用，应以结算页或 Loops 支持团队的最新确认为准。

## 隐私与安全边界

根据 Loops 的[隐私政策](https://loops.so/privacy)和[数据处理协议](https://loops.so/dpa)：

- Loops/Astrodon 对客户上传的联系人和邮件消息数据充当数据处理者；对账户、账单和支持数据充当数据控制者。
- 服务会自动扫描出站邮件以识别垃圾邮件和恶意链接；被标记的邮件可能接受人工审查。
- 匿名化或聚合数据可能用于支持和改进部分机器学习功能。
- 客户联系人和消息数据在服务终止或书面要求后，可按客户选择在 30 天内返还或安全删除，法律要求继续保留的情况除外。
- 账户、账单和支持相关个人数据在账户删除、停用或终止后最长 12 个月内删除，法律义务等例外除外。
- 公司位于美国，数据可能在美国处理并发生跨境传输；政策提到标准合同条款和 Data Privacy Framework 等机制。
- DPA 承诺合理的技术与组织保护措施、保密义务、持续风险评估、数据泄露通知和审计配合，但公开文本没有给出具体加密算法、备份保留期、RTO/RPO 或确定的事故通知小时数。

官方[子处理者清单](https://loops.so/subprocessors)显示，当前列出的处理者均在美国处理数据，包含 AWS、Amplitude、Atlas、ClickHouse、Cloudflare、Datadog、Google、People Data Labs、OpenAI、Stripe 和 Slack。公开清单只说明服务类别，没有说明每一家会收到哪些具体字段。

这对 Campus Companion 的含义是：一旦通过 Loops 发出包含学校事务的通知，收件地址和邮件内容会进入额外的第三方处理链。因此，课程、奖学金、成绩或个人安排等内容应遵循数据最小化原则；产品界面也应明确说明邮件通知供应商及用户关闭方式。

## 建议决策

当前阶段：**记录为可选支线，不立即接入。**

优先完成 Microsoft Graph 收件箱读取、邮件筛选、待办生成和小组流程闭环。只有在以下条件同时满足后，再做 Loops 试验：

1. 团队拥有可配置 DNS 的独立域名。
2. 确认确实需要邮件提醒，而不是只依赖站内和系统推送。
3. 定义最小发送数据和用户同意/退订流程。
4. 用免费方案验证一条事务邮件链路，并确认 4,000 封滚动额度足够演示。
5. 接入保持可替换，不让核心业务依赖 Loops。

对课程作业而言，Loops 可以提升提醒邮件的完成度和展示效果，但它不是当前 Outlook 接入阻塞的解决方案，也不应成为 MVP 的前置依赖。
