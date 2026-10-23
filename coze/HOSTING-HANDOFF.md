# Coze 托管迁移进度与接续说明

本分支用于独立 Coze 项目，默认构建继续使用 GitHub Pages 子路径。未向 `main` 合并，未发布新生产站点，也未修改现有 Pages 发布工作流。网站视觉、动作诊断算法、固定示范动作与关键帧模板保持原样；识别初始化现改为同源且版本一致的 MediaPipe 运行时，并提供 GPU→CPU 兜底。

## 已核实的基线

- 核查日期：2026-10-24（Asia/Shanghai）。
- `main`：`7c0008892447e39c65b5858aca7d8bc6fd469b4a`。
- 独立分支：`feature/coze-hosting-deployment`。
- 已通过 GitHub API 核实 Actions run `40018585082`：该 SHA、completed、success。
- 对原工程重新执行 `npm ci`、类型检查、动作逻辑测试、10 项 Coze 代理契约测试及生产构建：全部通过。
- `public/` 约 13 MB，其中原工程花滑示例约 6.5 MB，骨架 JSON 约 3.2 MB；没有删除这些原有资源。本次没有加入学生视频或真实视频测试素材。
- 项目保留 MIT `LICENSE`；固定参考动画由仓库自身脚本与 `standard-motion.json` 生成，原脚本声明为自创公有领域作品。

## 构建及资源依赖

| 功能 | 依赖与迁移方式 |
| --- | --- |
| 前端 | Node.js 22、npm 锁文件、React/TypeScript/Vite |
| 静态资源与 PWA | `VITE_BASE_PATH` 统一控制 Vite base、PWA scope/start_url、图标和 Service Worker；默认保留 Pages 子路径 |
| 固定参考动画 | 原样生成的 `public/reference/standing-long-jump-v1.mp4` 已纳入版本控制，Coze 纯 Node 构建无需 Python；生成脚本仍保留 |
| 动作识别 | 浏览器本地 MediaPipe；prebuild/predev 从锁定的 npm 包复制一致版本 WASM，原 Google 模型经摘要校验后随站点同源提供；无需浏览器访问外部模型 CDN，仍需验证实际 Coze 域名与 WebGL/CPU |
| 中文教学视频 | 原 `player.bilibili.com` iframe，未替换视频；自动测试检查嵌入地址，不等于远端视频播放已验收 |
| 教学建议 | 未配置 `VITE_COACH_API_URL` 时保留明确标注的基础教学建议；配置后通过安全代理调用真实 Coze 工作流 |
| 训练及成长记录 | 当前浏览器 origin 的 LocalStorage/IndexedDB；新 Coze 域名不会自动获得旧 Pages 域名的记录 |

固定动画规格：800×450，3 秒，45,494 字节。本次生成文件 SHA-256：

`04000eaa9d2a4fe233cab4690b9cd49856b22a29d0d75dc4c1eedf3fab4233cb`

## 在独立 Coze 项目中构建

已安装官方 `@coze/cli` 0.3.11 及 Codex 技能，通过 OAuth 完成账号授权，并确认个人空间及 GitHub 集成已授权。CLI 的 GitHub 导入不提供分支参数，因此已用 Coze 的已授权 GitHub 集成创建私有独立部署仓库 `Lirael123/yuedong-coze-deployment`，其 `main` 将用于导入，不覆盖原仓库 `main`。网页项目已通过 GitHub 导入建立，管理页为 https://www.coze.cn/p/7699793846426796051 ，预览为 https://a669fe12-412c-4bb8-955b-d0eae0f583ec.dev.coze.site 。此地址是开发预览，不是正式发布地址。

构建环境设置非机密变量 `VITE_BASE_PATH=/`，运行：

```bash
npm ci
npm run type-check
npm run test:yuedong
npm run test:mediapipe
npm run test:coze
npm run build
```

静态产物目录为 `dist`。本地与 Coze 编程构建均已执行；独立部署仓库额外保留 `.coze`、平台启动脚本和从 npm 锁导入的 pnpm 锁。Coze 的 Node 24/pnpm 安装已核对 MediaPipe 为 0.10.21，原仓库仍保留 Node 22/npm。Coze 开发预览若需要进程，可用 `npm run dev -- --port <平台实际端口>`，不要猜测平台端口或直接把 Vite preview 当成生产后端。

GitHub Pages 继续运行 `npm run build`，无需设置 `VITE_BASE_PATH`。如使用同一环境复测两种目标，必须分别重建，不能把根路径产物直接上传到 Pages。Service Worker 的 scope 跟随部署路径；两站点不同 origin，各自保存自己的缓存与用户记录，不自动迁移数据。

## Coze 工作流与服务端

复用 `WORKFLOW.md`、`knowledge/` 四份文档及 `prompt/运动教练系统提示词.md`，流程仍为开始→检索→大模型→结束。入参为 `question`、`issue_codes`、`tier`、`analysis_state`、`evidence_text`，输出 String `answer`。

服务端继续复用 `coze-proxy/worker.js`，没有将 Token 放进 Vite。用户已授权由本任务创建工作流、智能体及独立网页项目。已创建以下资源，不能将编程项目 ID 当作官方工作流 ID：

| 资源 | 实际标识及状态 |
| --- | --- |
| 网页项目 | https://www.coze.cn/p/7699793846426796051 ，已导入原有源码，预览可用，未正式发布 |
| 工作流编程项目 | https://code.coze.cn/p/7699831056379199524 ，已生成并测试 LangGraph 代码；尚未创建/发布官方 Studio 画布工作流，没有真实 `COZE_WORKFLOW_ID` |
| 智能体编程项目 | https://code.coze.cn/p/7699858585521553444 ，代码已生成，与下面的官方 Bot 区分 |
| 官方知识库 | `7699875744503840768`，复用原四份知识文件，4/4 处理成功、各 1 个分片 |
| 官方 Bot | `7699968472318574646`，已绑定上述知识库，模型豆包·2.0·pro，已发布到 API 渠道 1024 |

通过官方 API 对真实 Bot 进行了两次匿名 SSE 调用，`auto_save_history=false`：真实视频摘要获得中文指导；关键点不足且疼痛获得停止练习并告知教师/监护人的回复。初次疼痛回复包含静蹲替代练习，判为失败；系统提示词更新为 V1.1 并重新发布后，重测通过。没有传原视频、姓名、学号、人脸或完整关键点序列。这证明 Bot API 可用，**不代表网页 `/coach` 或正式工作流已接通**。

现有 `/coach` Worker 仍按原规格调用官方 `/v1/workflow/run`；没有擅自替换成直接 Bot 调用。CLI 及当前官方公开 SDK 没有 Studio 工作流创建/发布能力，当前会话也没有可操作已登录工作台的浏览器工具，因此仍需获得工作台操作能力后由本任务创建画布并发布；不要求用户代建。

运行时还需专用服务端 `COZE_API_TOKEN`、正式 `COZE_WORKFLOW_ID`、Worker 地址及访问/限流预算配置。现有管理 OAuth 凭证只存于工作区外受保护目录，没有作为长期生产密钥使用。

新增可选的 `ALLOWED_ORIGINS`，以英文逗号分隔**实际** HTTPS origin，可同时包含 Pages 和 Coze 的精确源；不支持通配符、路径、用户名密码或任意子域匹配。未设置时继续兼容原有单源 `ALLOWED_ORIGIN`。若新旧站共用 Worker，白名单必须保留 `https://lirael123.github.io`；若使用独立 Worker，则分别配置。不应覆盖已有正式 Worker 的 Secret 或发布配置。

生产配置顺序：

1. 在服务端 Secret 配置 `COZE_API_TOKEN`；其他变量为真实 `COZE_WORKFLOW_ID`、源站白名单，按工作流需要任选 `COZE_APP_ID` 或 `COZE_BOT_ID`。
2. 在 Cloudflare 或选用的受支持后端落实速率限制、调用预算和访问控制。CORS 是来源限制，不是用户身份认证。
3. 带实际 Origin 请求 `/health`，确认配置状态；这一步不代表真实模型调用通过。
4. 对 `/coach` 发送匿名教学问题与动作摘要，核实真实 Coze 返回 `source=coze`；再检查错误、超时、OPTIONS 与未授权来源。
5. 在前端设置真实 HTTPS `/coach` 地址为 `VITE_COACH_API_URL` 后重建。不要在前端配置 Coze Token。

## 本次验证与仍待完成的验收

| 检查 | 结果 |
| --- | --- |
| 类型检查、动作逻辑测试 | 通过；另有 4 项识别初始化测试通过，覆盖版本/路径、CPU 兜底、并发、超时和失败重试 |
| Coze 代理契约测试 | 13/13 通过，包括双源白名单、外站拒绝、无假回复与 28 秒上游取消；这些是契约测试，不是真实 Coze 联调 |
| 默认 Pages 与根路径生产构建 | 均通过 |
| 两种路径的桌面 Chromium 与 390×844 手机尺寸 Chromium | 均通过：页面、滚动、白色主题、原固定动画解码、PWA 图标/scope/Service Worker、基础教练、训练记录刷新恢复、CSV |
| 真实公开 MP4 | 已下载 4,747,725 字节、3.28 秒，仅位于检出目录外的临时验证目录 |
| 真实姿态识别 | 修复后通过：50 个有效姿态帧，自动定位与四阶段报告、训练记录保存/刷新恢复；本地根路径预览验证，不等于 Coze 线上验收 |
| 资源初始化修复 | 初始浏览器外部资源访问因代理证书失败。自动审批拒绝修改持久信任库；最终改为经 TLS 与摘要验证的同源部署资源，未关闭校验或修改信任库；另修复 JS 0.10.21/WASM 0.10.8 混用 |
| 真实 Coze 联调 | 官方 Bot 独立 API 两例实测通过；网页→Worker→官方工作流尚未完成，不记为端到端通过 |
| 实际 Coze 预览/生产域名 | 上述真实 dev.coze.site 预览已取得；正式 coze.site 尚未发布 |
| Coze 预览真实视频 | Coze 环境报告 50 个有效帧、自动四阶段诊断与训练保存/刷新通过；原始 JSON 与四张截图已实际下载，SHA256SUMS 的 7 项全部一致，已查看桌面/手机尺寸截图；该测试不含真实 Coze 指导，不是完整闭环 |
| 中文教学视频 | B站嵌入遭遇 412 风控，未完成实际解码验收；仅请求视频分片不能证明播放通过 |
| 手机 Safari | 未执行；手机尺寸 Chromium 截图不能代表 Safari 验收 |
| 原站线上功能比对 | 未完成浏览器全流程比对；本地 Pages 构建回归通过，原 Pages 发布配置未改 |

新增 `coze-hosting-check.yml` 在 PR 或手动触发时分别检查根路径与 Pages 子路径并保存截图；它不含任何部署步骤。原部署工作流没有修改。PR #7 的最新识别修复提交 `41f5c5f` 已通过双路径矩阵与原 build/smoke；Actions runs `40022642368`、`40022642362` 均 success，deploy skipped。

复测命令（预览服务已启动后）：

```bash
YUEDONG_BASE_URL=<实际预览根地址并以斜杠结尾> node scripts/smoke-browser.cjs
YUEDONG_BASE_URL=<实际预览根地址并以斜杠结尾> \
  SLJ_VIDEO_FILE=<已获授权的真实跳远视频绝对路径> \
  node scripts/real-video-acceptance.cjs
```

浏览器测试另需 Playwright/Chromium。云环境本次使用外部固定版本 Playwright 1.58.2 与系统 Chromium，截图及日志位于 `/workspace/.cloud-setup/yuedong/handoff/`，没有将外部视频或测试报告混入公开静态资源。

本地另用无人物黑色视频实测：明确提示关键点不足，没有生成有效诊断且可重试。真实视频→四阶段报告→真实 Coze→训练→成长档案的完整线上闭环、中文视频实际播放、Safari、离线/弱网、缓存升级仍是发布前验收项。不要合并或正式发布前宣称已经完成。

## 回退与维护

当前无生产变更，保持原 `main` 与 GitHub Pages 即可回退。以后只有全部验收通过才合并；如 Coze 版本故障，回退扣子平台上实际保存的上一发布版本，并保留旧 Pages 入口。更新教师知识库需复测 7 组工作流输入；更新模型、WASM、参考动画或动作模板需重新进行真实视频验收。


## 后续 Codex 更新流程

1. 原仓库从最新 main 更新 `feature/coze-hosting-deployment`，保留原视觉、参考视频和分析逻辑；检查 PR #7，不直接推原 main。
2. 修改后执行类型、动作、MediaPipe、代理测试及根路径/Pages 双构建回归；真实视频素材只放在仓库外。
3. 将验收过的提交同步到独立私有部署仓库 main，保留该仓库的根路径 `.env.production` 和 `.coze`。真实 git push/pull 才算同步，CLI 的 repo push/pull 当前占位命令不算。
4. 在现有网页项目拉取独立仓库并确认实际 SHA，预览验收完整视频→Coze→训练→记录流程。只配置公开前端接口地址；所有令牌由服务器 Secret 提供。
5. 全部发布门槛通过后才执行 `coze code deploy <project_id>`；先检查 message status 为 done。取得平台实际正式 URL 后重新测试，记录部署版本和 SHA。不得用开发预览地址替代正式交付。
6. 每次更新模型、运行时、提示词或知识库，都重测真实样例及失败/疼痛案例。不同域名浏览器记录各自保存；迁移前通过现有 CSV 导出，不假定自动跨域迁移。


## 验收证据的范围

Coze 预览真实视频报告时间为 `2026-10-23T21:09:27.318Z`，对应独立仓库 `ad8af7aa5f49046b8e88f404d1bed4728820d297`。实际值：预摆 124.9°、蹬伸 171.1°、腾空 58.9°、落地 163.4°；这只证明执行了真实姿态计算，不证明体育技术判断精度或正式测距能力。测试素材来自 Paralympics Ireland 公开示范，不是本班学生的样本覆盖。

截图尺寸：桌面 1440×2606、手机尺寸 390×3270；另有 PWA smoke 两张。真实视频 JSON 的 `browserErrors=[]` 只覆盖该脚本采集的浏览器错误，不能扩写成“所有网络请求零失败”。B站播放仍未通过，手机截图仍是 Chromium 模拟。原始文件留在仓库外，打包交付，不提交视频、截图或测试临时产物到源码/静态资源。

独立仓库后续 `d418ff3707bc57cc878d3d5abb640913663c04a6` 锁定 `serve@14.2.4` 并改为冻结安装、固定端口、关闭更新检查。本地已对该安装产物执行类型、业务、4项初始化、13项代理、生产构建和桌面/手机尺寸 smoke，全通过；Coze 环境需另行拉取该 SHA 重建核验，不把上一 SHA 的证据当成此 SHA 的测试。


## 2026-10-24 后续部署修复

Coze 环境重建曾依赖临时 pnpm11 包装，而默认 pnpm9 不能解析 allowBuilds。独立部署仓库提交 `7926253bbbfea96e63b741701de0860d8bff781f` 在 package.json 精确声明 pnpm@11.25.0，平台脚本直接使用 Corepack，保留 TLS/包签名及模型摘要验证；不再依靠临时 PATH 或全局 pnpm。预览使用 --strictPort，移除自动终止已有端口进程的命令。该改动只在独立部署仓库，不改变本仓库 npm/Pages 构建。

本地实际执行 build.sh、preview-build.sh、预览 HTTP 启动及端口占用失败测试均通过；Corepack 在本 Codex 的环境代理下需 NODE_USE_ENV_PROXY=1，pnpm 需可写缓存目录。环境启动脚本与说明已更新并保存到云配置草稿，保存不等于发布。

补测真实视频的起跳前 1 秒片段（素材只在仓库外）：真实 MediaPipe 识别人后，系统明确提示未发现足够离地过程，要求手动标记；打开人工向导直接到第3/4步，实际视频关键帧滑块可见，没有自动产生完整诊断。第一次测试因本地服务器未启动而连接拒绝，启动服务器后重测通过；保留前后两份报告，不将基础设施失败掩盖为算法通过。

用户已表示启用浏览器连接；当前工具列表仍未提供 Chrome/工作台操作能力。OAuth 登录有效不能证明工作台浏览器可用，官方画布工作流、生产 /coach 与正式站发布仍未完成。
