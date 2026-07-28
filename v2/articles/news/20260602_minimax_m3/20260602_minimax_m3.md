# MiniMax-M3 重磅升级：原生多模态、Ultra 套餐登场、性价比再封王
**更新日期 2026.6.2** 数据来源 [https://vibecoding.dreamfree.space](https://vibecoding.dreamfree.space) 

> 本次核心更新：MiniMax-M3 全量上线公开订阅（MiniMax 侧为 Token Plan，站内对比仍按 Coding Plan 展示）；原生多模态；现行公开档 M3 无 highspeed；新增 Ultra（官方月 Token 上限 7100M ≈ 71 亿）；Starter / Plus-极速 / Max-极速 停售、老用户可续订；Max-极速 可迁移至新版 Max（199→119 并补发差价积分）；M2.7-highspeed 全档通用可调。

2026 年 6 月，国产大模型迭代节奏持续加快。**MiniMax** 正式推出 **MiniMax-M3**（以下简称 M3）旗舰模型，定位为"原生多模态 + 极致性价比"的代际跃迁之作。在智谱AI、字节·方舟、阿里·百炼等头部平台持续限购、Coding Plan 愈发稀缺的当下，M3 的发布为个人开发者提供了一个**不限购、零抢购、模型顶尖**的稳定选择。本文围绕 M3 模型能力升级、MiniMax 套餐体系调整、选型建议展开。

## 一、M3 核心升级：模型能力跃迁
### 1. 原生多模态：图像、视频、语音、音乐统一表征
M3 最核心的代际升级是**原生多模态支持**。M2.7 时代仅支持纯文本输入，而 M3 **从训练的第 0 步起就进行混合模态训练**，实现了图像、视频、语音、音乐的统一表征，文本与模态数据在序列内自然交错（interleaved）。官方明确标注"**支持 M3 与多模态**"作为 Coding Plan 的核心权益。

技术上 M3 重建了完整的数据管道，训练数据规模扩展至 **10 万亿 token 量级**。interleaved 数据的引入被官方明确指出"比预期更关键"——这意味着 M3 不是"事后拼接"的多模态，而是从基础架构层就支持任意模态组合。

对于 OpenClaw、Harness 等 Agent 场景，这意味着：
- 设计图 → 前端代码：直接丢截图即可生成可用前端；
- 报错截图 → 修复建议：UI Bug 不再需要手动描述；
- 视频帧 → 流程分析：复杂动画/交互逻辑一键理解；
- 语音/音乐输入：原生支持（API 层面开放，Coding Plan 暂以文本/图像/视频为主）。

### 2. MSA 稀疏注意力架构：1M 上下文与极致吞吐
M3 引入 **MSA（MiniMax 稀疏注意力机制）** 作为核心技术架构：
- **更精确的 KV 块划分**：比 DSA 和 MoBA 更精确地划分 KV 块，实现更高有效上下文覆盖率
- **"KV 外积聚合 Q"方法**：KV 块作为外循环聚合查询，每个块只读取一次，内存访问连续
- **比开源 Flash-Sparse-Attention / flash-moba 快 4 倍以上**
- **100 万 token 上下文时，每 token 计算量仅为上一代模型的 1/20**
- **Prefill 阶段提速 9×+，Decode 阶段提速 15×+**

配合 **1M token 上下文窗口**，M3 可一次性分析整个大型 monorepo 代码库、长篇技术文档、整本技术书籍。模型同时支持**思考模式可开关**：启用时适合复杂推理和长程协作，关闭时响应更快。

### 3. 性能基准：超越 GPT-5.5，逼近 Opus 4.7
M3 在多个核心编程与 Agent 基准上达到或超过当前国际顶尖模型水平（[来源：MiniMax 官方博客](https://www.minimaxi.com/blog/minimax-m3)）：

| 基准测试 | M3 分数 | 横向对比 |
|----------|---------|----------|
| SWE-Bench Pro | **59.0%** | 超越 GPT-5.5、Gemini 3.1 Pro，逼近 Opus 4.7 |
| Terminal-Bench 2.1 | **66.0%** | 终端操作能力突出 |
| SWE-fficiency | **34.8%** | 软件工程效率 |
| KernelBench Hard | **28.8%** | CUDA 内核优化 |
| MCP Atlas | **74.2%** | MCP 工具调用 |
| SVG-Bench | 最高分 | 超越 Opus 4.7 |
| OmniDocBench | 高于 Gemini 3.1 Pro | 文档理解 |
| Claw-Eval | 最高分 | Agent 综合能力 |

### 4. 长程任务与 Agent 能力：24 小时自主 + MiniMax Code
M3 在长程 Agent 任务上展现出当前 SOTA 级别的能力（[来源：MiniMax 官方博客](https://www.minimaxi.com/blog/minimax-m3)）：

**论文复现**：独立复现 ICLR 2025 Outstanding Paper《Learning Dynamics of LLM Finetuning》，**近 12 小时**内完成 18 次 commit、23 张实验图，验证 SFT/DPO 阶段预测概率变化趋势与 Extend 缓解方法。

**CUDA 内核优化**：在 NVIDIA Hopper 架构 GPU 上优化 FP8 GEMM 内核，**约 24 小时**内完成 147 次基准提交、1959 次工具调用，硬件利用率从 **7.6% 提升至 71.3%**，实现 **9.4 倍加速**。**大多数模型在前 30 次提交后停止改进，M3 最佳方案出现在第 145 次提交**——展现出在长程迭代中持续优化、不易陷入局部最优的独特能力。

**PostTrainBench 自主训练**：12 小时内从 4 个 Base 模型完成"数据合成→训练→评估→迭代"完整流程。M3 得分 **0.37**，与 Opus 4.7（0.42）、GPT-5.5（0.39）相近，明显领先其他模型。

**配套 Agent 产品 MiniMax Code**（与 M3 共训练）：
- **Agent Team 功能**：多阶段、并发、动态可调的工作流，支持多智能体协作
- **Producer + Verifier 对抗循环**：持续产出、反思、自我纠正
- **Computer Use 支持**：用户可通过手机指令控制电脑操作应用、文件和系统
- 基于 OpenCode 和 Pi 等开源项目构建

### 5. 能力跃迁：与 M2.7 对比迈入国产第一梯队
基于 Artificial Analysis 历史评测数据，MiniMax-M2.7 Agentic 智能指数 61 分，处于国产第二梯队，与 Claude Sonnet 4.6 基本持平。结合 M3 官方 benchmark 数据可清晰看出代际跃迁：
- **Agentic 能力**：从第二梯队（61 分）跃升至**国际第一梯队**水平——Claw-Eval 取得最高分，PostTrainBench 0.37 与 Opus 4.7（0.42）、GPT-5.5（0.39）相当
- **Coding Agent 能力**：M2.7 未纳入 Artificial Analysis 编码代理评测；M3 凭借 SWE-Bench Pro 59%、Terminal-Bench 2.1 66%、KernelBench Hard 28.8% 跻身**全球第一梯队**，逼近 Opus 4.7
- **上下文窗口**：从 M2.7 的 200K 量级跃升至 **1M token**（5 倍提升）
- **多模态**：从纯文本跃升至**图像+视频+语音+音乐统一表征**
- **响应速度**：M3 与 M2.7 标准版 TPS 50；M2.7-highspeed 极速版 TPS 100，**所有现行公开档通用可调**，每次请求按需选择

### 6. 适用场景对比

| 场景 | M2.7 推荐度 | M3 推荐度 | 备注 |
|------|-------------|-----------|------|
| 纯文本日常补全 | ★★★★★ | ★★★★★ | M3 与 M2.7 持平或略优 |
| 多模态（截图/设计图） | ✗ | ★★★★★ | M3 唯一选择 |
| 长上下文代码库分析 | ★★★★ | ★★★★★ | M3 上下文从 200K 跃升至 1M |
| 实时 Agent 任务 | ★★★★（M2.7-highspeed）| ★★★★（M2.7-highspeed）| M3 无 highspeed，需用 M2.7-highspeed 端点 |
| 复杂多步骤自动化 | ★★★★ | ★★★★★ | 多模态 + MSA 架构双重提升 |
| OpenClaw 日常任务 | ★★★★★ | ★★★★★ | M3 完全兼容 |
| 极低预算入门 | ★★★★★（Starter）| ★★★（仅 Plus/以上）| M2.7 Starter 仍是最低门槛 |

## 二、MiniMax 全系套餐调整解读
### 1. 现行三档主力：Plus / Max / Ultra

公开订阅的 Plus / Max / Ultra 在 MiniMax 侧正式记为 **Token Plan**（M3 与 M2.7 **共享月度 Token 池**）并给出token上限。额度受 **5 小时、周、月** 多窗口控制（下表含周请求数）。

| 套餐 | 月费 | 5小时 | 周 | 月请求 | 官方月Token上限 | M2.7 请求窗口估算 | M2.7-highspeed 可调 | 核心定位 |
|------|------|-------|-----|--------|-----------------|-------------------|---------------------|----------|
| Plus | ¥49 | 1,500 | 15,000 | 60,000 | 600M（≈6 亿） | 2,400M（≈24 亿） | ✓（TPS 100） | 入门档，初次订阅首选 |
| Max | ¥119 | 4,500 | 45,000 | 180,000 | 1800M（≈18 亿） | 7,200M（≈72 亿） | ✓（TPS 100） | 主力档，高频日常 + 复杂 Agent 任务 |
| Ultra | ¥469 | 15,000 | 150,000 | 600,000 | 7100M（≈71 亿） | — | ✓（TPS 100） | 团队级、高强度、大规模测试 |

注 1：**官方月 Token 上限**来自 MiniMax 公开订阅档（M3 与 M2.7 共享池），与站内 `tokenLimit` / 用量对比数据一致。单位 M = 百万（1M = 100 万 Token）。
注 2：**M2.7 请求窗口估算**按日常开发场景（缓存命中率 90%、输入输出 99:1）与 5 小时 / 周 / 月请求额度折算，反映「打满请求次数」时的 M2.7 用量参考，**不等于官方月 Token 上限**，二者不做直接倍率对比。
注 3：**现行公开档 M3 没有 highspeed 变体**——仅标准 M3 一种调用方式。**所有套餐均可调 M2.7-highspeed 极速版**（TPS 100，每次请求按需选择）（[来源：MiniMax 平台订阅页](https://api.dreamfree.space/c/s/cpyqminimax)）。

**核心变化：**
- **Plus 档（¥49）保持不变**：仍是入门首选，月 6 万次请求；官方共享池约 **6 亿** Token/月，按请求窗口估算的 M2.7 参考用量约 **24 亿**。
- **Max 档（¥119）保持不变**：高强度日常开发首选，4.5 万次/5 小时、18 万次/月；官方池约 **18 亿** Token/月，M2.7 请求窗口估算约 **72 亿**。
- **Ultra 档（¥469）全新上线**：官方月 Token 上限 **7100M ≈ 71 亿**（[来源：MiniMax 平台订阅页](https://api.dreamfree.space/c/s/cpyqminimax)），月请求 60 万次（约为 Max 的 3.3 倍）。目标用户为团队、高强度 Agent、长上下文代码库分析。

### 2. 共享额度池：M3 与 M2.7 灵活混用
M3 并没有"挤占" M2.7 的额度，而是采用**共享额度池**设计：用户在一次订阅内可以同时调用 M3 和 M2.7，Token 在二者间通用。这种设计的好处是：
- 复杂 Agent 任务用 M3 处理多模态/复杂推理；
- 简单日常补全用 M2.7，单次调用更经济；
- 避免"升级套餐才能用新模型"的强制绑定。

### 3. 上下文与吞吐量：Ultra 套餐月度约 71 亿 Token
M3 在长上下文与吞吐量上有显著提升。**Ultra** 套餐（¥469/月）官方月 Token 上限 **7100M ≈ 71 亿**（M3 与 M2.7 共享池，[来源：MiniMax 平台订阅页](https://api.dreamfree.space/c/s/cpyqminimax)），定位于高强度 Agent 任务与大规模代码库分析场景。配合 1M+ 上下文窗口，可一次性分析整个大型 monorepo 代码库。

注：Ultra 以**官方月 Token 上限**为准；Plus / Max 另提供 **M2.7 请求窗口估算**（见上表），与官方上限口径不同，**不直接做 Token 倍率对比**。请求次数维度上，Ultra 月 60 万次约为 Max（18 万次）的 3.3 倍。

### 4. 极速模型：M2.7-highspeed 全套餐通用可调
需要特别说明的是：**现行公开档的 M3 没有 highspeed 变体**——仅有标准 M3，没有"M3-highspeed"端点（已停售的 Plus-极速 / Max-极速 老档曾列 MiniMax-M3-highspeed）。highspeed 适用于 **M2.7 系列**。

M2.7 系列仍然保留 highspeed 与非 highspeed 两个变体。在新套餐体系下，**所有现行公开档（Plus / Max / Ultra）每次请求均可自行选择** M2.7 标准版（TPS 50）或 **M2.7-highspeed 极速版**（TPS 100）（[来源：MiniMax 平台订阅页](https://api.dreamfree.space/c/s/cpyqminimax)）。

这意味着：
- 选型时**无需为 TPS 100 单独购买"极速版"档位**——Plus / Max / Ultra 任一档位均可调 M2.7-highspeed；
- 旧 Max-极速（¥199）订阅虽然已停售，但迁移至新版 Max（¥119）后，**TPS 100 通过 M2.7-highspeed 端点完整保留**；
- 极速响应是 M2.7 模型的**通用能力选项**，由用户每次请求时按需选择。

### 5. 停售档位与 Max-极速 订阅档位自动迁移方案
**停售档位说明**：Starter（¥29）、Plus-极速（¥98）、Max-极速（¥199）三档订阅已停售：仅 Token Plan 升级前的老用户可续订，**若中途断订，后续不可再次订阅同档**。但订阅档位停售**不影响 M2.7-highspeed 调用**——M2.7-highspeed 仍是 MiniMax 平台上的活跃模型，停售档老用户续订后仍可正常调用（[来源：MiniMax 平台订阅页](https://api.dreamfree.space/c/s/cpyqminimax)）。建议老用户保持连续订阅以免断档。

**Max-极速 订阅档位自动迁移方案**：针对已订阅 Max-极速（¥199/月）的老用户，官方提供订阅档位自动迁移方案：
- **月费 199 → 119**：订阅费用降 40%
- **请求次数不变**：4.5 万次/5 小时、18 万次/月保持
- **TPS 100 完整保留**：迁移后通过 M2.7-highspeed 端点继续享受 100 tokens/s（[来源：MiniMax 平台订阅页](https://api.dreamfree.space/c/s/cpyqminimax)），不需要为极速响应额外付费
- **补发差价积分**：以 Credits 形式退回差价部分
- **额外权益**：新方案完整支持 M3 与多模态

> 整体体验不降反升：订阅费 -40%、模型能力升级到 M3 + 多模态、响应速度保留 TPS 100。

## 三、套餐选型建议
### 1. 个人开发者
- **首次接触 / 低频尝试**：从 **Plus（¥49）** 开始，月 6 万次请求；官方共享池约 **6 亿** Token/月，日常开发下 M2.7 请求窗口估算约 **24 亿**，足够多数场景。
- **日常高频开发**：**Max（¥119）** 是首选，4.5 万次/5 小时、18 万次/月；官方池约 **18 亿** Token/月，M2.7 估算约 **72 亿**，TPS 50 满足绝大多数开发场景。
- **多模态重度使用**：必须 **Max 或 Ultra**，充分利用 M3 多模态优势。
- **预算敏感的老用户**：保留 **Starter（¥29）** 老档，但需注意中途断订不可再续。

### 2. 团队与小工作室
- **高强度 Agent 项目**：**Ultra（¥469）** 官方月 Token 上限约 **71 亿**（7100M，[来源：MiniMax 平台订阅页](https://api.dreamfree.space/c/s/cpyqminimax)），月请求 60 万次（约为 Max 的 3.3 倍），适合多 Agent 并行、长上下文代码库分析。
- **实时性敏感场景**：所有现行公开档（Plus/Max/Ultra）每次请求均可选择 M2.7-highspeed 获取 TPS 100（[来源：MiniMax 平台订阅页](https://api.dreamfree.space/c/s/cpyqminimax)），无需保留 Max-极速 老档。

### 3. 跨境与海外开发者
- 通过 OpenCode Go、Ollama Pro/Max 等聚合平台间接调用 MiniMax-M3，月费 $10 起，多模型聚合适合需要切换 Claude/GPT 的用户。

## 四、与国产第一梯队对比
- **智谱 GLM-5.1**：编码能力国产顶尖，Claude Code 框架下最强，但需要抢购、限购严重。
- **DeepSeek V4 Pro**：开源第一、纯按量计费，但不支持多模态。
- **MiMo-V2.5-Pro**：Agentic 能力国产第一梯队，Token Plan 用量充足，但非 Coding Plan 模式。
- **Kimi K2.6**：长上下文与多模态表现均衡，¥199/月的 Allegretto 套餐性价比不错。
- **MiniMax-M3**：在 2026 年 6 月这个 Coding Plan 全面稀缺的时间点，MiniMax 的稳定供应 + M3 的代际升级 + Ultra 套餐的扩展性，构成了独特的"无抢购 + 强能力 + 多模态 + 高性价比"组合。

## 五、总结
MiniMax-M3 的发布标志着国产大模型在**多模态 + 性价比 + 稳定供应**三个维度的进一步成熟。在头部平台持续收紧 Coding Plan、Token Plan 替代潮持续的当下，MiniMax 通过：
- **M3 模型代际升级**（原生多模态 + 共享额度池 + Ultra 套餐）
- **套餐体系稳中有进**（Plus/Max 维持主力，新增 Ultra；公开档升级为 Token Plan，停售旧档但保留老用户权益）
- **M2.7-highspeed 通用可调**（TPS 100 tokens/s，所有现行公开档可用，每次请求按需选择）
- **不限购、不抢购**（在头部平台普遍限购的当下独树一帜）

为个人开发者提供了一个**长期、稳定、划算**的 AI 编程订阅选择。

对绝大多数**个人开发者**而言，**Plus（¥49）** 仍是入门首选（官方池约 6 亿 Token/月），**Max（¥119）** 是高强度日常开发主力（约 18 亿）；**Ultra（¥469）** 则面向团队级、高强度 Agent（官方上限约 71 亿 Token/月）。需要 TPS 100 极速响应的用户，每次请求时选择 M2.7-highspeed 端点即可，无需保留已停售的极速版老档。Max-极速 老用户可选择保留订阅防断档，或迁移至新版 Max（同等请求次数、更低价、M2.7-highspeed 仍可调）。建议结合自身使用频率、多模态需求与官方 Token 上限，合理选择套餐档位。

> 数据来源 [https://vibecoding.dreamfree.space](https://vibecoding.dreamfree.space)
>
> 原文链接 [https://vibecoding.dreamfree.space/articles/news/20260602_minimax_m3/](https://vibecoding.dreamfree.space/articles/news/20260602_minimax_m3/)
