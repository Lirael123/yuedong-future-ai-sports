# 跃动未来 V1 · 立定跳远动作诊断与分层学练

> 本项目复用 [figure-skating/feedback-loop](https://github.com/figure-skating/feedback-loop) MIT 许可工程的视频上传、MediaPipe 姿态识别、双视频分析、起跳落地标记和对比回放功能；保留原项目 `LICENSE`。

## 与第一、二阶段的整合对应

| 原计划模块 | GitHub 实际实现 |
| --- | --- |
| 动作关键点分析 | 原项目 `src/services/mediapipe/poseDetector.ts` 与 `videoAnalysisService.ts` |
| 关键帧对齐 | 原项目 `FrameMarkingWizard` + `jumpMetricsService` 映射后的分析帧 |
| 四类动作诊断 | `src/logic/yuedong.ts` 的 `analyzeLongJump` |
| 动作诊断展示 | `src/components/Analysis/YuedongDashboard.tsx` |
| 基础 / 提高 / 拓展三级训练 | 同一 Dashboard + `planFor` |
| 训练保存与成长记录 | 浏览器 LocalStorage + `loadRecords` |
| 实测成绩变化 / CSV | 教师手动录入 + 趋势图 + `toCsv` |

## 本地运行

- Node.js 22 与 npm
- `npm ci`
- `npm run type-check`
- `npm run test:yuedong`
- `npm run build`
- `npm run dev` 后打开终端提供的本地地址

## 完整演示流程

1. 在“标准示范”和“学生立定跳远”两处上传经授权的侧面跳远视频；不要使用原花滑示例。
2. 按关键帧向导给两段视频分别标记起跳及落地。
3. 点击 **开始动作分析**，由原项目在浏览器提取真实人体关键点。
4. 在 **动作诊断** 查看各阶段真实估算膝角、提示及证据；如数据不足，按拍摄提示重试。
5. 使用匿名编号保存诊断结果，在 **分层学练** 选择三档练习中的适合项目并勾选完成。
6. 教师如有现场实测厘米成绩可填写，没有则留空；点击 **保存本次训练**。
7. 在 **运动成长档案** 查看历史、实测成绩变化，并导出 CSV。

## 验收边界

- **不得虚构识别结果**：没有足够真实关键点时必须返回“数据不足”。
- **不得把视频位移当成厘米成绩**：厘米值仅由教师人工测量并输入。
- **动作角度阈值为试验性对比规则**：教师必须复核，不直接作为体育正式考试成绩。
- **数据隐私**：使用匿名编号，尽量不保存含身份信息的视频。本项目记录存储在当前浏览器，清除浏览器数据后可能丢失；不同设备不自动同步。
- **标准视频要求**：尽量与学生视频同机位、同方向、全身入镜。
- **云端状态**：分支上的代码不是已部署服务，只有 GitHub Actions 类型检查与构建成功，且完成真实视频回放验证后，才能将网页视为已验收。

## 正式部署

`vite.config.ts` 已将生产构建基础目录改为 `/yuedong-future-ai-sports/`。仓库原有 GitHub Pages workflow 针对 main 分支，PR 分支只有构建检查、不部署。准备好后合并 PR，并在仓库 Settings → Pages 选择 **GitHub Actions** 为部署源。如果 Fork 的 Actions 默认禁用，需要先在 Actions 页面启用工作流。网站预期路径取决于 GitHub Pages 实际部署设置，勿在部署之前声称 URL 已上线。

## 真实视频测试清单

- [ ] 可上传两段合规视频
- [ ] 能分别标注两段视频的起跳及落地
- [ ] MediaPipe 模型资源成功加载、骨架随视频显示
- [ ] 完成视频分析后，诊断依据真实关键点出现
- [ ] 无关键点或异常视频显示“数据不足”，不出现假分数
- [ ] 训练勾选、教师实测成绩与备注保存成功
- [ ] 刷新页面后成长档案仍在
- [ ] CSV 下载文件内容与保存记录一致
- [ ] Windows Chrome 页面正常；移动浏览器布局不遮挡关键操作
