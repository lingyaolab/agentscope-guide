# 更新记录

本站内容对应 **AgentScope Java 2.0.4**。日期为发布日，站点版本与框架版本分开记。

## v1.0.0 — 2026-11-05

当前内容：43 页（37 章 + 5 附录 + 首页），零构建纯静态，`file://` 直接可读。

### 内容

- SDK 地基 11 章（00 学习地图 – 11）
- Harness 工程能力 7 章（12–18）
- Service 服务化 8 章路线（19–26）：第 19–26 章已可读——起站与第一个 Managed Agent，发布 Endpoint 与 SSE 调用，Agent 定义与 Workspace / Environment / Memory / Vault 四类资源，已有应用注册为 External Agent 的 HTTP 合约与 ASDP 派发边界，Hosted Agent 的 claim 主循环、provider 能力矩阵与恢复条件，Team 的 Leader 回合、成员委派、策略默认值与结果收敛分层，Workflow 的 draft / revision、八种节点、失败策略，Automation 的 cron / Webhook / 队列，Issue 与 Inbox 的验收闭环，以及生产环境的 Helm 安装、共享存储、一致备份、升级迁移与恢复验收
- 集成生态 10 章路线（27–36）：第 27 章已可读——按契约 / 实现 / 装配三层给扩展画地图，分清出站能力与入站入口，讲清 10 个模型 id 与 6 个 artifact、记忆 / 状态 / 分布式存储 / RAG / 协议 / 渠道 / 技能仓库的选型边界，并标出 LongTermMemory 与 Knowledge 的弃用状态；第 28 章拆开 10 个模型 provider 的 id、artifact、凭证、formatter、结构化输出、思考参数与 fallbackModel 切换；第 29 章拆记忆接入，讲清 LongTermMemory 的 record / retrieve、三种模式、Mem0 / 百炼 / ReMe 的默认值与写入过滤差异，以及 2.0.0 起的弃用边界；第 30 章拆分布式存储，讲清 DistributedStore 的九个组件、Redis / JDBC / MongoDB / OSS 的能力差异、混合后端、CAS 与托管 Store；第 31 章拆 Agent 状态存储，讲清 AgentState 的字段与 JSON、各后端落点、UNVERSIONED 与 saveIfVersion、ConflictPolicy 与 SessionTurnGate；第 32 章拆 RAG，讲清 Knowledge 的两个方法、三种模式、RetrieveConfig 两层参数、Simple / 百炼 / Dify / HayStack / RAGFlow 的写入与检索差异，以及 2.0.0 起的弃用边界；第 33 章拆三种协议，讲清 A2A 的客户端 / 服务端与 AgentCard、Agent Protocol 的 /tasks 与 SSE / HITL、AG-UI 的事件映射与 interrupt resume，以及三者的入口、默认值和部署边界；第 34 章拆五个渠道，讲清钉钉 Stream / HTTP、飞书事件订阅、企微加密回调、GitHub / GitLab Webhook，以及验签、去重、防循环、access token 与多副本共享状态；第 35 章拆技能仓库，讲清 AgentSkillRepository 的读写契约、Git 的只读与 autoSync、MySQL / PostgreSQL 的表结构与 metadata_json 兼容、多仓库优先级与动态刷新；第 36 章收尾基础设施与生态，讲清 Nacos 的 A2A 注册发现 / Prompt 缓存 / Skill 只读枚举、Higress 的 MCP 工具与网关治理边界、Quartz 与 XXL-Job 的调度职责差异、Studio 的自动 Hook 与 PostCall 推送、Training 的影子流量与 300 秒 commit，以及 Chat Completions Web 的核心适配器与 starter 分工；至此 00–36 章与五个附录全部可读
- 附录 A 术语表、附录 B 报错速查、附录 C API 速查、附录 D 源码地图、附录 E 勘误汇总
- 附录 E 把全书 19 个有偏差章节里的 78 条「官方文档这么说、2.0.4 源码那么写」抽成一张表，每条带文档与源码双出处
- 每处数字、默认值与抛错点都带 `file:line` 出处；`check-sources` 3257 条全部可定位

### 阅读体验

- 全文检索（889 段正文索引）与标题锚点深链
- 右侧三级小节目录、手机目录抽屉、窄屏搜索层
- 阅读设置：正文字号、内容宽度、代码自动换行、目录精简；顶部阅读进度条
- 暗色主题、`prefers-reduced-motion`、skip link、抽屉 Esc 关闭与焦点回收

### 学习闭环

- 练习勾选跨页快照，练完全部步骤自动点亮「标记本章读完」
- 记录读完时间；超过 7 天出现复习提示，可标记「已复习」
- 首页待办最多 3 条：收尾 → 练习 → 复习；进度可导出/导入 JSON、可清空
- 所有学习数据只存本机 `localStorage`，不上传

### 发布与质量

- 404 页、favicon、robots.txt、`.nojekyll`、仓库根跳转入口
- GitHub Pages 工作流：重建索引 → 静态检查 → 发布
- `check-site` 39 项（静态结构 + headless Edge 回归）全过，含首页分组卡与 nav 组名对齐、nav 小节标题与页面 h2 对齐
