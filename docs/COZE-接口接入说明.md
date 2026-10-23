# 《跃动未来》Coze 工作流接入说明

## 哪些部分需要接 Coze

**只需要 AI 运动教练这个入口。** 学生提出自然语言问题后，前端只传入：问题文本、当前诊断问题代码和选定的学练等级。Coze 负责解释动作、提供针对性练法、安全提醒以及复测建议。

视频上传、MediaPipe 骨架识别、关键帧、动作角度计算、分层任务勾选与成长档案均在浏览器本地运行，不依赖 Coze，不上传视频、姓名或身体关键点。

## Coze 工作流输入输出

在 Coze 中国区新建并发布工作流，开始节点设置：

| 字段 | 类型 | 用途 |
| --- | --- | --- |
| question | String | 学生咨询的问题（不应含隐私） |
| issue_codes | String | 逗号分隔的错误代码，SLJ-01～04 |
| tier | String | foundation / improvement / challenge |

中间智能体或 LLM 节点：根据教师审核的初中立定跳远知识库解释错误、选择相应等级练习，并提出安全提醒。禁止编造已识别的视频信息、准确测距或考试成绩。

结束节点：输出 answer（String）；即一段中文教学建议。

官方 API：POST https://api.coze.cn/v1/workflow/run ，请求 Bearer Token、workflow_id 和 parameters。需先发布工作流并开通 run 权限。
官方文档：https://docs.coze.cn/developer_guides_workflow_run

## 安全连接拓扑

GitHub Pages（React）→ HTTPS Cloudflare Worker → Coze Workflow API

GitHub Pages 无法安全保存 Coze Token，因此提供 coze-proxy/worker.js 作为最小服务端代理。

Worker 环境设置：
- Secret COZE_API_TOKEN：在 Cloudflare Worker 控制台存入，**不要提交到 GitHub**。
- Variable COZE_WORKFLOW_ID：填已发布工作流的数字 ID。
- Variable ALLOWED_ORIGIN：本项目预期为 https://lirael123.github.io 。
- Worker 地址：部署后获得的 HTTPS 域名 + /coach。

构建时前端设置非机密变量 VITE_COACH_API_URL=https://你的worker地址/coach 。可通过 GitHub Actions 的 vars.COACH_API_URL 配置，它不是令牌。

**当前尚无实际工作流 ID / API Token，因此界面会明确显示 Coze 待接入，并输出本地规则建议。不要将此状态写成 Coze 已连接。** 配置接口但调用失败时直接提示错误，不伪造智能体回复。

## 上线前注意
- 使用合规授权的视频材料；不要把学生真实姓名、学号或人像发给模型。
- 教学建议需要体育教师复核，动作阈值仅作为辅助分析。
- 公开服务需要额外部署限流、访问配额和滥用防护。仅靠 CORS 不是完整访问控制。
- 真实视频 → 动作分析 → 智能体 → 训练 → 成长档案，需要端到端验收。
