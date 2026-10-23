# Coze 托管迁移进度与接续说明

本分支用于独立 Coze 项目，默认构建继续使用 GitHub Pages 子路径。未向 `main` 合并，未部署新站点，也未修改现有 Pages 发布工作流。网站视觉、学生动作识别算法、固定示范动作与关键帧模板均保持原样。

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
| 动作识别 | 浏览器本地 MediaPipe；WASM 来自 `cdn.jsdelivr.net`，模型来自 `storage.googleapis.com`，仍需在实际 Coze 域名验证 TLS、CORS、WebGL |
| 中文教学视频 | 原 `player.bilibili.com` iframe，未替换视频；自动测试检查嵌入地址，不等于远端视频播放已验收 |
| 教学建议 | 未配置 `VITE_COACH_API_URL` 时保留明确标注的基础教学建议；配置后通过安全代理调用真实 Coze 工作流 |
| 训练及成长记录 | 当前浏览器 origin 的 LocalStorage/IndexedDB；新 Coze 域名不会自动获得旧 Pages 域名的记录 |

固定动画规格：800×450，3 秒，45,494 字节。本次生成文件 SHA-256：

`04000eaa9d2a4fe233cab4690b9cd49856b22a29d0d75dc4c1eedf3fab4233cb`

## 在独立 Coze 项目中构建

先在扣子编程完成账号登录与 GitHub 授权，再从仓库导入独立项目并选择本分支。当前聊天未提供可调用的扣子/Chrome 授权工具，不能从此环境发起账号绑定；项目导入与平台原生构建字段仍须在实际界面确认。

构建环境设置非机密变量 `VITE_BASE_PATH=/`，运行：

```bash
npm ci
npm run type-check
npm run test:yuedong
npm run test:coze
npm run build
```

静态产物目录为 `dist`。本次已在本地运行相同的根路径构建与浏览器测试；尚未在扣子编程的构建运行时执行。Coze 开发预览若需要进程，可用 `npm run dev -- --port <平台实际端口>`，不要猜测平台端口或直接把 Vite preview 当成生产后端。

GitHub Pages 继续运行 `npm run build`，无需设置 `VITE_BASE_PATH`。如使用同一环境复测两种目标，必须分别重建，不能把根路径产物直接上传到 Pages。Service Worker 的 scope 跟随部署路径；两站点不同 origin，各自保存自己的缓存与用户记录，不自动迁移数据。

## Coze 工作流与服务端

复用 `WORKFLOW.md`、`knowledge/` 四份文档及 `prompt/运动教练系统提示词.md`，流程仍为开始→检索→大模型→结束。入参为 `question`、`issue_codes`、`tier`、`analysis_state`、`evidence_text`，输出 String `answer`。

服务端继续复用 `coze-proxy/worker.js`，没有将 Token 放进 Vite。实际工作流 ID、发布状态、服务端 Secret、Worker 地址、限流预算与 Coze 托管域名尚未配置或验证。

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
| 类型检查、动作逻辑测试 | 通过 |
| Coze 代理契约测试 | 13/13 通过，包括双源白名单、外站拒绝、无假回复与 28 秒上游取消；这些是契约测试，不是真实 Coze 联调 |
| 默认 Pages 与根路径生产构建 | 均通过 |
| 两种路径的桌面 Chromium 与 390×844 手机尺寸 Chromium | 均通过：页面、滚动、白色主题、原固定动画解码、PWA 图标/scope/Service Worker、基础教练、训练记录刷新恢复、CSV |
| 真实公开 MP4 | 已下载 4,747,725 字节、3.28 秒，仅位于检出目录外的临时验证目录 |
| 真实姿态识别 | 失败：上传视频成功，但 Chromium 报 `ERR_CERT_AUTHORITY_INVALID`，未完成 MediaPipe 初始化和有效诊断 |
| 证书修复 | 自动审批拒绝将环境代理 CA 加入浏览器用户信任库，理由是持久扩大 TLS 信任范围；没有关闭证书校验或修改信任库 |
| 真实 Coze 联调 | 未执行：账号尚未连接，真实工作流/服务端接口尚未配置 |
| 实际 Coze 预览/生产域名 | 未取得，未发布 |
| 手机 Safari | 未执行；手机尺寸 Chromium 截图不能代表 Safari 验收 |
| 原站线上功能比对 | 未完成浏览器全流程比对；本地 Pages 构建回归通过，原 Pages 发布配置未改 |

新增 `coze-hosting-check.yml` 在 PR 或手动触发时分别检查根路径与 Pages 子路径并保存截图；它不含任何部署步骤。原部署工作流没有修改。CI 结果需在实际运行后确认，不能用本地测试代替远端 CI 状态。

复测命令（预览服务已启动后）：

```bash
YUEDONG_BASE_URL=<实际预览根地址并以斜杠结尾> node scripts/smoke-browser.cjs
YUEDONG_BASE_URL=<实际预览根地址并以斜杠结尾> \
  SLJ_VIDEO_FILE=<已获授权的真实跳远视频绝对路径> \
  node scripts/real-video-acceptance.cjs
```

浏览器测试另需 Playwright/Chromium。云环境本次使用外部固定版本 Playwright 1.58.2 与系统 Chromium，截图及日志位于 `/workspace/.cloud-setup/yuedong/handoff/`，没有将外部视频或测试报告混入公开静态资源。

真实视频→四阶段报告→真实 Coze→训练→成长档案、中文视频实际播放、Safari、离线/弱网、缓存升级均仍是发布前验收项。不要合并或正式发布前宣称已经完成。

## 回退与维护

当前无生产变更，保持原 `main` 与 GitHub Pages 即可回退。以后只有全部验收通过才合并；如 Coze 版本故障，回退扣子平台上实际保存的上一发布版本，并保留旧 Pages 入口。更新教师知识库需复测 7 组工作流输入；更新模型、WASM、参考动画或动作模板需重新进行真实视频验收。
