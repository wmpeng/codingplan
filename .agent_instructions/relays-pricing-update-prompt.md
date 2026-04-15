# API 中转平台模型价格更新提示词（可直接复用）

你现在要更新 `relays.json` 中各平台的 `detail.keyModels` 价格信息。  
目标：**仅更新价格相关字段与必要注释，不改动无关文案/结构**。

---

## 1) 基本要求

1. 只处理以下平台：`openrouter`、`siliconflow`、`poloapi`、`ofox`、`n1n`、`dmxapi`、`llmhub`、`poe`。
2. 价格优先使用平台官方可机读接口；若无公开接口，则使用官方文档声明（如“与官方同价”）并在 `note` 标注依据。
3. 所有价格统一写入 `detail.keyModels`，字段保持：
   - `name`
   - `inputPer1M`
   - `outputPer1M`
   - `note`
4. 处理后同步更新对应平台的 `updatedAt` 为当天日期（格式：`YYYY.MM.DD`）。
5. 不要新增临时下载文件到仓库；若生成了临时文件，结束前删除。
6. 修改后必须校验 `relays.json` 是合法 JSON。

---

## 2) 目标模型清单（标准名）

- Opus-4.6
- Sonnet-4.6
- GPT-5.4
- GPT-5.3-Codex
- Gemini-3.1-Pro-Preview
- Gemini-3 Flash-Preview
- GLM-5.1
- GLM-5
- MiniMax-M2.7
- MiniMax-M2.5
- Kimi-K2.5
- DeepSeek-V3.2
- Qwen-3.6-Plus

> 注意：不同平台的模型 ID 命名不一致，可按“近似可用型号”映射，但要在 `note` 说明。

---

## 3) 各平台固定抓取方法

### A. OpenRouter（`id: openrouter`）

- 数据源：`https://openrouter.ai/api/v1/models`
- 取值字段：`pricing.prompt`、`pricing.completion`（单位是 **$/token**）
- 换算：`每百万 token 价格 = 字段值 × 1,000,000`
- 常见映射示例：
  - `anthropic/claude-opus-4.6`
  - `anthropic/claude-sonnet-4.6`
  - `openai/gpt-5.4`
  - `openai/gpt-5.3-codex`
  - `google/gemini-3.1-pro-preview`
  - `google/gemini-3-flash-preview`
  - `z-ai/glm-5.1`
  - `z-ai/glm-5`
  - `minimax/minimax-m2.7`
  - `minimax/minimax-m2.5`
  - `moonshotai/kimi-k2.5`
  - `deepseek/deepseek-v3.2`
  - `qwen/qwen3.6-plus`

---

### B. SiliconFlow（`id: siliconflow`）

- 页面源：`https://siliconflow.cn/models`
- 该页面可直接提取“输入/输出：￥x / M Tokens”信息。
- 单位已是 `￥/M tokens`，无需换算。
- 优先更新能直接在页面中检索到的模型（如 GLM-5.1、GLM-5、MiniMax-M2.5、Kimi-K2.5、DeepSeek-V3.2）。
- 未公开或未检索到的模型不要乱填，保留 `—` 并注明“未检索到”。

---

### C. Poe（`id: poe`）

- 数据源：`https://api.poe.com/v1/models`
- 取值字段：`pricing.prompt`、`pricing.completion`（单位是 **$/token**）
- 换算：`× 1,000,000` 后写入 `$ / 1M`
- 备注：
  - 若目标是 Preview，但 Poe 仅有非 Preview 近似型号（如 `gemini-3.1-pro` vs `...-preview`），可用近似型号并在 `note` 标注。
  - 若某模型 `pricing` 为 `null` 或仅有 `request` 计费，不要伪造 token 价。

---

### D. OfoxAI（`id: ofox`）

- 数据源：`https://api.ofox.ai/v1/models`
- 结构与 OpenRouter 类似，取 `pricing.prompt`、`pricing.completion`（$/token），再 `× 1,000,000`。
- 若某目标模型不存在（例如当期未上架 `qwen/qwen3.6-plus`），写 `—` 并在 `note` 标注“当前 /v1/models 未检索到”。

---

### E. N1N（`id: n1n`）

- 页面：`https://api.n1n.ai/pricing`
- 机器可读接口：`https://api.n1n.ai/api/pricing_new`
- N1N 是“倍率计价”：
  - 输入倍率：`model_ratio`
  - 输出倍率：`completion_ratio`
  - 通常写法：`官方价 × {倍率}`
- 建议 `keyModels` 直接写倍率格式，不强行转绝对美元（除非你能同时稳定抓到 N1N 的官方基准价映射）。
- 若目标模型不在 `pricing_new.data[].model_name` 中，写 `—` 并说明未检索到。

---

### F. DMXAPI（`id: dmxapi`）

- 页面：`https://rmb.dmxapi.cn`
- 可机读接口：
  - `https://rmb.dmxapi.cn/?api=models`（模型清单）
  - `https://rmb.dmxapi.cn/?api=model_prices`（价格）
- `model_prices` 里的 `input_price`、`output_price` 即可写入 `￥/M`（按当前站点口径）。
- 若目标模型无对应 key（例如某些时期的 Opus/Sonnet/Qwen3.6+），写 `—` 并注明“公开价目接口未检索到”。

---

### G. PoloAPI（`id: poloapi`）

- 页面：`https://poloapi.top/pricing`
- 常见公开接口（多数需登录 token）：
  - `/api/models`
  - `/api/user/models`
  - `/api/vendors`
- 未登录通常返回“无权进行此操作”。因此：
  - 可以写成“需控制台检索”的占位条目（按目标模型分组列出）。
  - `note` 明确写“公开接口未登录不可读；需在控制台定价页检索”。
- 如果后续拿到登录态 token，再补成真实单价。

---

### H. LLM Hub（`id: llmhub`）

- 文档：`https://doc.llmhub.app/guide.html`
- 该平台通常声明“与 OpenAI/Claude 官方同价”。
- 对已声明同价且能明确映射的模型（如 GPT / Claude）可按官方价写入，并在 `note` 写“按官方同价原则”。
- 对文档未给出明确单价或未明确支持的新型号（Gemini 3.x、GLM5.x 等），写 `—` 并在 `note` 标注“公开文档未列出明确单价”。

---

## 4) 写回规范（非常重要）

1. 不要破坏现有 JSON 结构和字段顺序。
2. 同一平台 `keyModels` 可以按“有明确价格优先、无价格在后”排序。
3. 数值展示建议：
   - 美元：保留 2 位或按现有风格（必要时可 3 位）
   - 人民币：按源数据精度或常见展示精度
4. 若有四舍五入，`note` 必须说明“原始值 xxx，已四舍五入”。
5. `notes` 字段保留原有说明，仅在必要时补充数据来源链接。

---

## 5) 更新后的自检清单

1. `python -c "import json, pathlib; json.loads(pathlib.Path('relays.json').read_text(encoding='utf-8')); print('ok')"`
2. 抽查每个平台至少 1~2 个模型是否来源可追溯（接口字段或文档声明）。
3. 检查是否误改了非价格区域（matrix 星级、介绍文案等）。
4. 确认无临时抓取文件残留在仓库根目录。

---

## 6) 建议执行顺序（稳定版）

1. 先更新：`OpenRouter`、`Poe`、`Ofox`、`DMXAPI`（接口稳定、可机读）
2. 再更新：`SiliconFlow`（页面提取）
3. 再更新：`N1N`（倍率制）
4. 最后处理：`PoloAPI`、`LLM Hub`（登录受限/文档同价）

执行时，优先保证“可追溯性”和“不要编造价格”。
