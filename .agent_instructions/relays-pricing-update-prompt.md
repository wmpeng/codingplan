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
4. `detail.keyModels[].name` 一律使用第 2 节中的标准名，不要写平台自己的原始模型 ID。
5. 某平台如果不存在某模型，就直接省略该条；不要写 `—` 占位，也不要写“未检索到”占位行。
6. 如果某平台存在“充值人民币到账美元额度 1:1”这类规则，把它补到对应平台的 `detail.notes` 中。
7. 如果仓库内存在本地脚本，优先运行这些脚本获取结构化结果，再回写 `relays.json`：
  - 单平台：`local/scripts/fetch_<platform>_prices.py`
  - 批量入口：`local/scripts/fetch_relay_prices.py`
8. 本地脚本如果支持 `--write`，优先直接用写入模式更新 `relays.json`，避免手工复制粘贴。
9. 不要新增临时下载文件到仓库；若生成了临时文件，结束前删除。
10. 修改后必须校验 `relays.json` 是合法 JSON。

---

## 2) 目标模型清单（标准名）

- Opus-4.6
- Sonnet-4.6
- GPT-5.4
- GPT-5.3-Codex
- Gemini-3.1-Pro
- Gemini-3-Flash
- GLM-5.1
- GLM-5
- MiniMax-M2.7
- MiniMax-M2.5
- Kimi-K2.5
- DeepSeek-V3.2
- Qwen-3.6-Plus
- Qwen-3.5
- Doubao-Seed-2.0-Code

> 注意：不同平台的模型 ID 命名不一致，可按“近似可用型号”映射，但要在 `note` 说明。

> 写回 `relays.json` 时，`name` 仍然使用上面的标准名；映射后的平台原始型号只写进 `note`，不要直接写进 `name`。

---

## 3) 固定执行流程

优先按下面的固定流程执行，不要每次临时拼接新的抓取命令。

### A. 单平台更新

- 先运行对应平台脚本，检查输出是否合理：
  - `python local/scripts/fetch_openrouter_prices.py`
  - `python local/scripts/fetch_siliconflow_prices.py`
  - `python local/scripts/fetch_poloapi_prices.py`
  - `python local/scripts/fetch_ofox_prices.py`
  - `python local/scripts/fetch_n1n_prices.py`
  - `python local/scripts/fetch_dmxapi_prices.py`
  - `python local/scripts/fetch_llmhub_prices.py`
  - `python local/scripts/fetch_poe_prices.py`
- 确认输出无误后，优先使用写入模式直接回写：
  - `python local/scripts/fetch_<platform>_prices.py --write`
- 若需要写入其它文件路径：
  - `python local/scripts/fetch_<platform>_prices.py --write /path/to/relays.json`

### B. 批量更新

- 全量抓取预览：`python local/scripts/fetch_relay_prices.py`
- 全量直接回写：`python local/scripts/fetch_relay_prices.py --write`
- 只更新部分平台：`python local/scripts/fetch_relay_prices.py --platform openrouter --platform poe --write`

### C. 写入后的固定自检

- `python -m json.tool relays.json > /dev/null`
- 抽查刚更新的平台是否仍符合第 4 节写回规范。
- 若脚本输出与 `relays.json` 不一致，以脚本输出和平台官方来源为准，修正脚本，不要手工硬改出另一套口径。

## 4) 各平台固定抓取方法

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
- 优先直接抓取页面 HTML 源码中的模型卡片信息，不依赖第三方网页理解服务。
- 该页面部分模型卡片可直接提取“输入/输出：￥x / M Tokens”信息。
- 单位已是 `￥/M tokens`，无需换算。
- 优先更新能直接在页面中检索到的模型（如 GLM-5.1、GLM-5、MiniMax-M2.5、Kimi-K2.5、DeepSeek-V3.2）。
- 页面源码里未直接检索到价格的模型就省略，不要补 `—` 占位。

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
- 若某目标模型不存在（例如当期未上架 `qwen/qwen3.6-plus`），直接省略该条。

---

### E. N1N（`id: n1n`）

- 页面：`https://api.n1n.ai/pricing`
- 机器可读接口：`https://api.n1n.ai/api/pricing_new`
- N1N 是“倍率计价”：
  - 输入基准价：`model_ratio × 2`，得到基准输入价（单位数值等同于美元价）
  - 输出基准价：`输入基准价 × completion_ratio`
  - 每个模型可用分组在 `enable_groups`
  - 各分组倍率在顶层 `group_ratio`
  - 最终价格：在 `enable_groups` 中找到可用且倍率最小的分组，用 `基准输入/输出价 × 最低 group_ratio`
- 充值汇率按文档 `https://docs.n1n.ai/llm-api-quickstart` 的 1:1 规则处理：`1 人民币充值到账 1 美元额度`，因此上一步得到的数值可直接按 `￥/1M` 写入。
- 建议 `keyModels` 直接写最终人民币价格，不再写“官方价 × 倍率”格式。
- `note` 中给用户看的链接统一写 `https://api.n1n.ai/pricing`；不要把 `pricing_new` 接口地址直接写进面向用户的说明。
- 若目标模型不在 `pricing_new.data[].model_name` 中，直接省略该条。

---

### F. DMXAPI（`id: dmxapi`）

- 页面：`https://rmb.dmxapi.cn`
- 可机读接口：
  - `https://rmb.dmxapi.cn/?api=models`（模型清单）
  - `https://rmb.dmxapi.cn/?api=model_prices`（价格）
- `model_prices` 里的 `input_price`、`output_price` 即可写入 `￥/M`（按当前站点口径）。
- 若目标模型无对应 key（例如某些时期的 Opus/Sonnet/Qwen3.6+），直接省略该条。

---

### G. PoloAPI（`id: poloapi`）

- 官网：`https://xy.poloapi.com/`
- 价格页：`https://xy.poloapi.com/pricing`
- 公开价格接口（无需登录）：`https://xy.poloapi.com/api/pricing`
- PoloAPI 的接口结构与 N1N 类似，核心也是“倍率计价”：
  - 输入基准价：`model_ratio × 2`，得到基准输入价（单位数值等同于美元价）
  - 输出基准价：`输入基准价 × completion_ratio`
  - 每个模型可用分组在 `enable_groups`
  - 各分组倍率在顶层 `group_ratio`
  - 最终价格：在 `enable_groups` 中找到可用且倍率最小的分组，用 `基准输入/输出价 × 最低 group_ratio`
- 充值汇率按帮助文档 `https://help.poloapi.com/node/019c412b-e079-7e87-bedf-5c4ddb2402d4` 的规则处理：`平台充值:充值1人民=1美金`，因此上一步得到的数值可直接按 `￥/1M` 写入。
- 建议 `keyModels` 直接写最终人民币价格，不再写旧的美元换算说明，也不再依赖 `api/status`。
- `note` 中给用户看的链接统一写 `https://xy.poloapi.com/pricing`；不要把 `https://xy.poloapi.com/api/pricing` 这种接口地址直接写进面向用户的说明。
- 若目标模型不在 `api/pricing.data[].model_name` 中，直接省略该条。

---

### H. LLM Hub（`id: llmhub`）

- 公开接口（无需登录）：`https://www.llmhub.com.cn/api/pricing`
- 换算元数据接口：`https://www.llmhub.com.cn/api/status`
- `api/pricing` 里主要取：
  - `data[].model_name`
  - `data[].model_ratio`
  - `data[].completion_ratio`
- `api/status` 里主要取：
  - `data.quota_per_unit`
  - `data.price`
- 推荐换算（按每百万 token，直接写人民币）：
  - `input_cny_per_1m = 1_000_000 * model_ratio / quota_per_unit * price`
  - `output_cny_per_1m = input_cny_per_1m * completion_ratio`
- 不要再把人民币结果除以 `usd_exchange_rate` 折算成美元；`keyModels` 直接展示 `￥/1M`。
- `note` 中给用户看的链接优先写 `https://www.llmhub.com.cn/pricing`；若需要说明换算依据，可补充公开接口 `api/pricing` 与 `api/status`，但不要把最终展示价再写成美元。
- 若目标模型在 `api/pricing` 中不存在，直接省略该条。

---

## 5) 写回规范（非常重要）

1. 不要破坏现有 JSON 结构和字段顺序。
2. 同一平台 `keyModels` 可以按“有明确价格优先、无价格在后”排序。
3. 数值展示建议：
   - 美元：保留 2 位或按现有风格（必要时可 3 位）
   - 人民币：按源数据精度或常见展示精度
4. 若有四舍五入，`note` 必须说明“原始值 xxx，已四舍五入”。
5. `notes` 字段保留原有说明，仅在必要时补充数据来源链接。
6. 不要添加“换算说明”“未检索到型号”等占位行；`keyModels` 只保留当前平台实际存在且已取到价格的模型。

---

## 6) 更新后的自检清单

1. `python -c "import json, pathlib; json.loads(pathlib.Path('relays.json').read_text(encoding='utf-8')); print('ok')"`
2. 如果用了本地脚本写入模式，再额外运行一次：`python -m json.tool relays.json > /dev/null`
3. 抽查每个平台至少 1~2 个模型是否来源可追溯（接口字段或文档声明）。
4. 检查是否误改了非价格区域（matrix 星级、介绍文案等）。
5. 确认无临时抓取文件残留在仓库根目录。

## 7) 建议执行顺序（稳定版）

1. 先更新：`OpenRouter`、`Poe`、`Ofox`、`DMXAPI`（接口稳定、可机读）
2. 再更新：`SiliconFlow`（页面提取）
3. 再更新：`N1N`（倍率制）
4. 最后处理：`PoloAPI`（登录受限）
5. `LLM Hub` 可在任意阶段处理（公开接口可机读）

执行时，优先保证“可追溯性”和“不要编造价格”。
