<!-- 本文件由 scripts/codingplan/generate-readme.js 生成，请勿手工修改。 -->

# AI Coding Plan 平台评测与对比

> 更新日期 2026.9.10 | DeepSeek 官方上线 V4.1 Flash 并调价；OpenCode Go 新增 DeepSeek V4.1 Flash 与 Muse Spark 1.3

当前展示 **37 个平台、99 个在售订阅套餐、2 个按量 API、118 个模型和 1090 条套餐模型关系**。

[在线平台对比](https://www.codingplan.fyi) · [额度/价格对比](https://www.codingplan.fyi/?view=usage) · [套餐对比](https://www.codingplan.fyi/?view=plans)

## 目录

- [当前推荐](#当前推荐)
- [热门模型额度与价格对比](#热门模型额度与价格对比)
- [平台对比](#平台对比)
- [套餐概览](#套餐概览)
- [数据口径](#数据口径)
- [最近更新](#最近更新)
- [延伸阅读](#延伸阅读)

## 当前推荐

### 综合推荐

各维度综合评估，最值得入手的几家。智谱和Kimi暂时不开放了，暂时不推荐了

| 平台 | 状态 | 评分 | 推荐理由 |
|---|---|---:|---|
| [MiniMax](https://api.dreamfree.space/c/s/cpyqminimax) | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | 性价比依然是所有平台最高<br>支持MiniMax-M3模型，支持多模态<br>适合自动化、Agent、酒馆、高强度Coding等高强度场景 |
| [智谱国际版](https://api.dreamfree.space/c/s/cpyqzai) | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | 无需抢购<br>支持GLM-5.2，国内最强的代码模型之一<br>用量与国内版完全一致，价格大约为国内版两倍左右。使用[邀请链接](https://api.dreamfree.space/c/s/cpyqzai)可享额外9折。有成品号出售，加入[飞书群](https://api.dreamfree.space/c/s/cpfeishulink)查看群公告了解详情。 |
| [OpenCode](https://api.dreamfree.space/c/s/cpyqopencode) | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | 支持 DeepSeek-V4.1-Flash、Kimi-K3、GLM-5.3、GPT-5.6-Luna 等 27 个模型<br>首月半价$5。但只有go这一种套餐，不够重度使用<br>无需抢购，可支付宝付款 |
| [字节·方舟 Coding Plan](https://api.dreamfree.space/c/s/cpyqfangzhou) | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | 已解除限购，开放购买，无需抢购<br>支持GLM-5.3、DeepSeek-V4，MiniMax-M3，Kimi-K3 |

### 包含 GLM-5.3

| 平台 | 状态 | 评分 | 推荐理由 |
|---|---|---:|---|
| [智谱AI](https://api.dreamfree.space/c/s/cpyqzhipu) | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | 在售新套餐支持 GLM-5.3，国内领先的代码模型之一<br>新套餐无需抢购<br>官方服务，模型与套餐信息透明 |
| [OpenCode](https://api.dreamfree.space/c/s/cpyqopencode) | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | 支持 GLM-5.3、Kimi-K3、DeepSeek-V4.1-Flash、DeepSeek-V4-Pro 等最新模型<br>Go 套餐首月半价 $5，无需抢购<br>可支付宝付款，调用抵扣透明 |
| [字节·方舟 Coding Plan](https://api.dreamfree.space/c/s/cpyqfangzhou) | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | Coding Plan 支持 GLM-5.3<br>同时支持 DeepSeek-V4、MiniMax-M3、Kimi-K3 等模型<br>已解除限购，开放购买 |
| [共绩算力](https://api.dreamfree.space/c/s/cpyqgongji) | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | 按量调用，支持 GLM-5.3、DeepSeek-V4-Pro、Kimi-K3<br>平台不拥挤，稳定性高<br>通过**[邀请链接](https://api.dreamfree.space/c/s/cpyqgongji)**进入注册，可以锁定专属8折折扣与额外￥20额度 |

### 包含 DeepSeek 最新模型

| 平台 | 状态 | 评分 | 推荐理由 |
|---|---|---:|---|
| [DeepSeek](https://platform.deepseek.com/) | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | 官方 DeepSeek-V4.1-Flash，推理、代码与多模态能力处于国产第一梯队<br>空闲时段 ¥1/¥0.02/¥4 每百万 tokens，按量标价透明，适合不想抢套餐的用户<br>高峰时段价格为空闲的两倍，错峰使用成本优势更明显 |
| [OpenCode](https://api.dreamfree.space/c/s/cpyqopencode) | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | 支持 DeepSeek-V4.1-Flash（限时 4 倍额度）、DeepSeek-V4-Pro、Kimi-K3 等最新模型<br>首月半价$5。但只有go这一种套餐，够尝鲜，不够重度使用<br>无需抢购，可支付宝付款 |
| [字节·方舟 Coding Plan](https://api.dreamfree.space/c/s/cpyqfangzhou) | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | Coding Plan 支持 DeepSeek-V4-Flash-0731 正式版<br>同时支持 GLM-5.2、DeepSeek-V4-Pro、DeepSeek-V4-Flash-0731、MiniMax-M3，是国内模型最全的全家桶平台。<br>已解除限购，开放购买 |
| [优云智算](https://api.dreamfree.space/c/s/cpyqyyzs) | 开放购买 | ⭐️⭐️⭐️⭐️ | 全档位支持 DeepSeek-V4-Flash-0731 正式版和 GLM-5.2<br>按照真实接口调用量计费，模型倍率透明<br>用量较少，适合作为低成本补充 |

### 包含 Kimi-3

Kimi-K3，7.16日发布的目前最强模型，但费用较贵，按需使用。官方需要抢购

| 平台 | 状态 | 评分 | 推荐理由 |
|---|---|---:|---|
| [Kimi](https://api.dreamfree.space/c/s/cpyqkimi) | 暂停销售 | ⭐️⭐️⭐️⭐️⭐️ | 官方原生平台，模型体验最稳定，老会员推荐使用。需要抢购，目前无法新购买了<br>发布 Kimi-K3 之后，会员停售了，之后应该会启用新的Coding套餐 |
| [OpenCode](https://api.dreamfree.space/c/s/cpyqopencode) | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | 支持Kimi-K3、GLM-5.2、DeepSeek-V4-Pro等最新模型<br>首月半价$5。但只有go这一种套餐，够尝鲜，不够重度使用<br>无需抢购，可支付宝付款 |
| [共绩算力](https://api.dreamfree.space/c/s/cpyqgongji) | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | 按量调用，支持 Kimi-K3、GLM-5.2、DeepSeek-V4-Pro<br>平台不拥挤，稳定性高<br>通过**[邀请链接](https://api.dreamfree.space/c/s/cpyqgongji)**进入注册，可以锁定专属8折折扣与额外￥20额度 |
| [字节·方舟 Agent Plan](https://api.dreamfree.space/c/s/cpyqfangzhout) | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | Agent Plan 全档位支持 Kimi-K3<br>同时支持 GLM-5.2、DeepSeek-V4-Pro/Flash、MiniMax-M3，是国内模型最全的全家桶平台。<br>现货开放购买。 |

## 热门模型额度与价格对比

以下使用网站“快速对比”中的模型。综合单价统一折算为人民币每 M Token；每个模型最多展示 8 个可计算选项，并为按量 API 保留位置。

### DeepSeek-V4-Flash-0731

| 平台 / 套餐 | 档位 | 计费 | 5小时 | 每周 | 每月 | 综合单价 | 口径 |
|---|---|---|---:|---:|---:|---:|---|
| [Command Code · Go](https://api.dreamfree.space/c/s/cpcommandcode) | [谷] | $1/月 | 143.8M | 287.61M | 479.3M | ¥0.0143/M | 计算 |
| [Command Code · GOAT](https://api.dreamfree.space/c/s/cpcommandcode) | [谷] | $10/月 | 575.22M | 1,438.04M | 2,876.1M | ¥0.0238/M | 计算 |
| [Command Code · Go](https://api.dreamfree.space/c/s/cpcommandcode) | [峰] | $1/月 | 71.9M | 143.8M | 239.7M | ¥0.0286/M | 计算 |
| [OpenCode · Go](https://api.dreamfree.space/c/s/cpyqopencode) | [谷] | $10/月 | 451.19M | 1,127.97M | 2,255.9M | ¥0.0299/M | 计算 |
| [Command Code · Pro](https://api.dreamfree.space/c/s/cpcommandcode) | [谷] | $20/月 | 671.08M | 1,677.71M | 3,355.4M | ¥0.0408/M | 计算 |
| [Command Code · GOAT](https://api.dreamfree.space/c/s/cpcommandcode) | [峰] | $10/月 | 287.61M | 719.02M | 1,438M | ¥0.0476/M | 计算 |
| [OpenCode · Go](https://api.dreamfree.space/c/s/cpyqopencode) | [峰] | $10/月 | 225.59M | 563.98M | 1,128M | ¥0.0605/M | 计算 |
| [字节·方舟 Coding Plan · Lite](https://api.dreamfree.space/c/s/cpyqfangzhou) | - | ¥40/月 | 40M | 300M | 600M | ¥0.0667/M | 实测 |

还有 18 个可比较选项，见[在线额度/价格对比](https://www.codingplan.fyi/?view=usage)。

### DeepSeek-V4.1-Flash

| 平台 / 套餐 | 档位 | 计费 | 5小时 | 每周 | 每月 | 综合单价 | 口径 |
|---|---|---|---:|---:|---:|---:|---|
| [OpenCode · Go](https://api.dreamfree.space/c/s/cpyqopencode) | [谷] | $10/月 | 902.37M | 2,255.94M | 4,511.9M | ¥0.015/M | 计算 |
| [OpenCode · Go](https://api.dreamfree.space/c/s/cpyqopencode) | [峰] | $10/月 | 451.19M | 1,127.97M | 2,255.9M | ¥0.0299/M | 计算 |
| [DeepSeek · 按量 API](https://platform.deepseek.com/) | [谷] | 入¥1 / 缓存¥0.02 / 出¥4 | - | - | - | ¥0.0887/M | 计算 |
| [DeepSeek · 按量 API](https://platform.deepseek.com/) | [峰] | 入¥2 / 缓存¥0.04 / 出¥8 | - | - | - | ¥0.1773/M | 计算 |

### GLM-5.3-Flash

| 平台 / 套餐 | 档位 | 计费 | 5小时 | 每周 | 每月 | 综合单价 | 口径 |
|---|---|---|---:|---:|---:|---:|---|
| [Command Code · Go](https://api.dreamfree.space/c/s/cpcommandcode) | - | $1/月 | 78.29M | 156.58M | 261M | ¥0.0258/M | 计算 |
| [字节·方舟 Coding Plan · Lite](https://api.dreamfree.space/c/s/cpyqfangzhou) | - | ¥40/月 | 80M | 600M | 1,200M | ¥0.0333/M | 倍率换算 |
| [字节·方舟 Coding Plan · Pro](https://api.dreamfree.space/c/s/cpyqfangzhou) | - | ¥200/月 | 400M | 3,000M | 6,000M | ¥0.0333/M | 倍率换算 |
| [OpenCode · Go](https://api.dreamfree.space/c/s/cpyqopencode) | - | $10/月 | 313.15M | 782.88M | 1,565.8M | ¥0.0435/M | 计算 |
| [字节·方舟 Agent Plan · Small](https://api.dreamfree.space/c/s/cpyqfangzhout) | - | ¥40/月 | 80M | 280M | 800M | ¥0.05/M | 计算 |
| [字节·方舟 Agent Plan · Medium](https://api.dreamfree.space/c/s/cpyqfangzhout) | - | ¥200/月 | 400M | 1,400M | 4,000M | ¥0.05/M | 计算 |
| [字节·方舟 Agent Plan · Large](https://api.dreamfree.space/c/s/cpyqfangzhout) | - | ¥500/月 | 1,000M | 3,500M | 10,000M | ¥0.05/M | 计算 |
| [共绩算力 · 按量 API](https://api.dreamfree.space/c/s/cpyqgongji) | - | 入¥0.32 / 缓存¥0.09 / 出¥1.12 | - | - | - | ¥0.1047/M | 计算 |

还有 15 个可比较选项，见[在线额度/价格对比](https://www.codingplan.fyi/?view=usage)。

### GPT-5.6-Luna

| 平台 / 套餐 | 档位 | 计费 | 5小时 | 每周 | 每月 | 综合单价 | 口径 |
|---|---|---|---:|---:|---:|---:|---|
| [Codex · Pro *20](https://api.dreamfree.space/c/s/cpyqchatgpt) | - | $200/月 | 24,000M | 24,000M | 96,000M | ¥0.0143/M | 倍率换算 |
| [Command Code · Go](https://api.dreamfree.space/c/s/cpcommandcode) | - | $1/月 | 86.07M | 172.14M | 286.9M | ¥0.0238/M | 计算 |
| [Codex · Plus](https://api.dreamfree.space/c/s/cpyqchatgpt) | - | $20/月 | 200M | 1,200M | 4,800M | ¥0.0286/M | 倍率换算 |
| [Codex · Pro *5](https://api.dreamfree.space/c/s/cpyqchatgpt) | - | $100/月 | 6,000M | 6,000M | 24,000M | ¥0.0286/M | 倍率换算 |
| [Command Code · GOAT](https://api.dreamfree.space/c/s/cpcommandcode) | - | $10/月 | 114.76M | 286.9M | 573.8M | ¥0.1183/M | 计算 |
| [Command Code · Pro](https://api.dreamfree.space/c/s/cpcommandcode) | - | $20/月 | 172.14M | 430.35M | 860.7M | ¥0.1578/M | 计算 |
| [OpenCode · Go](https://api.dreamfree.space/c/s/cpyqopencode) | [272K] | $10/月 | 86.07M | 215.18M | 430.4M | ¥0.1578/M | 计算 |
| [OpenCode · Go](https://api.dreamfree.space/c/s/cpyqopencode) | - | $10/月 | 44.97M | 112.43M | 224.9M | ¥0.3026/M | 计算 |

### GPT-6-Astra

| 平台 / 套餐 | 档位 | 计费 | 5小时 | 每周 | 每月 | 综合单价 | 口径 |
|---|---|---|---:|---:|---:|---:|---|
| [Codex · Pro *20](https://api.dreamfree.space/c/s/cpyqchatgpt) | - | $200/月 | 800M | 800M | 3,200M | ¥0.425/M | 倍率换算 |
| [Codex · Plus](https://api.dreamfree.space/c/s/cpyqchatgpt) | - | $20/月 | 6.67M | 40M | 160M | ¥0.85/M | 倍率换算 |
| [Codex · Pro *5](https://api.dreamfree.space/c/s/cpyqchatgpt) | - | $100/月 | 200M | 200M | 800M | ¥0.85/M | 实测 |

### Claude Opus 5

| 平台 / 套餐 | 档位 | 计费 | 5小时 | 每周 | 每月 | 综合单价 | 口径 |
|---|---|---|---:|---:|---:|---:|---|
| [Claude · Max *5](https://api.dreamfree.space/c/s/cpyqclaudeup) | - | $100/月 | 132.4M | 836.1M | 3,344.5M | ¥0.2033/M | 实测 |
| [Claude · Max *20](https://api.dreamfree.space/c/s/cpyqclaudeup) | - | $200/月 | 441.5M | 1,672.2M | 6,689M | ¥0.2033/M | 实测 |
| [Claude · Pro](https://api.dreamfree.space/c/s/cpyqclaudeup) | - | $20/月 | 22.1M | 100.3M | 401.3M | ¥0.3386/M | 实测 |

### GPT-5.6-Sol

| 平台 / 套餐 | 档位 | 计费 | 5小时 | 每周 | 每月 | 综合单价 | 口径 |
|---|---|---|---:|---:|---:|---:|---|
| [Codex · Pro *20](https://api.dreamfree.space/c/s/cpyqchatgpt) | - | $200/月 | 2,400M | 2,400M | 9,600M | ¥0.1414/M | 倍率换算 |
| [Codex · Plus](https://api.dreamfree.space/c/s/cpyqchatgpt) | - | $20/月 | 20M | 120M | 480M | ¥0.2836/M | 实测 |
| [Codex · Pro *5](https://api.dreamfree.space/c/s/cpyqchatgpt) | - | $100/月 | 600M | 600M | 2,400M | ¥0.2836/M | 实测 |
| [Command Code · GOAT](https://api.dreamfree.space/c/s/cpcommandcode) | - | $10/月 | 16.07M | 40.17M | 80.3M | ¥0.8466/M | 计算 |
| [Command Code · Pro](https://api.dreamfree.space/c/s/cpcommandcode) | - | $20/月 | 18.36M | 45.9M | 91.8M | ¥1.481/M | 计算 |

### GLM-5.3

| 平台 / 套餐 | 档位 | 计费 | 5小时 | 每周 | 每月 | 综合单价 | 口径 |
|---|---|---|---:|---:|---:|---:|---|
| [智谱AI · Max](https://api.dreamfree.space/c/s/cpyqzhipu) | [谷] | ¥1,078/月 | 270.51M | 1,352.53M | 5,410.1M | ¥0.1993/M | 计算 |
| [智谱国际版 · 新Max](https://api.dreamfree.space/c/s/cpyqzai) | [谷] | $168/月 | 270.51M | 1,352.53M | 5,410.1M | ¥0.2115/M | 计算 |
| [Command Code · Go](https://api.dreamfree.space/c/s/cpcommandcode) | - | $1/月 | 8.89M | 17.78M | 29.6M | ¥0.2292/M | 计算 |
| [智谱AI · Pro](https://api.dreamfree.space/c/s/cpyqzhipu) | [谷] | ¥538/月 | 115.93M | 579.65M | 2,318.6M | ¥0.232/M | 计算 |
| [智谱国际版 · 新Pro](https://api.dreamfree.space/c/s/cpyqzai) | [谷] | $80/月 | 115.93M | 579.65M | 2,318.6M | ¥0.2346/M | 计算 |
| [智谱AI · Lite](https://api.dreamfree.space/c/s/cpyqzhipu) | [谷] | ¥118/月 | 19.32M | 96.61M | 386.4M | ¥0.3054/M | 计算 |
| [智谱国际版 · 新Lite](https://api.dreamfree.space/c/s/cpyqzai) | [谷] | $18/月 | 19.32M | 96.61M | 386.4M | ¥0.3169/M | 计算 |
| [共绩算力 · 按量 API](https://api.dreamfree.space/c/s/cpyqgongji) | - | 入¥6.4 / 缓存¥1.6 / 出¥22.4 | - | - | - | ¥1.9428/M | 计算 |

还有 15 个可比较选项，见[在线额度/价格对比](https://www.codingplan.fyi/?view=usage)。

### Kimi-K3

| 平台 / 套餐 | 档位 | 计费 | 5小时 | 每周 | 每月 | 综合单价 | 口径 |
|---|---|---|---:|---:|---:|---:|---|
| [Kimi · Allegretto](https://api.dreamfree.space/c/s/cpyqkimi) | [256K] | ¥199/月 | 45M | 225M | 900M | ¥0.2211/M | 倍率换算 |
| [Kimi · Allegro](https://api.dreamfree.space/c/s/cpyqkimi) | [256K] | ¥699/月 | 120M | 600M | 2,400M | ¥0.2913/M | 倍率换算 |
| [Kimi · Allegretto](https://api.dreamfree.space/c/s/cpyqkimi) | - | ¥199/月 | 30M | 150M | 600M | ¥0.3317/M | 实测 |
| [Command Code · Go](https://api.dreamfree.space/c/s/cpcommandcode) | - | $1/月 | 5.91M | 11.82M | 19.7M | ¥0.3454/M | 计算 |
| [Kimi · Allegro](https://api.dreamfree.space/c/s/cpyqkimi) | - | ¥699/月 | 80M | 400M | 1,600M | ¥0.4369/M | 实测 |
| [Kimi · Moderato](https://api.dreamfree.space/c/s/cpyqkimi) | [256K] | ¥99/月 | 4.2M | 21M | 84M | ¥1.1786/M | 实测 |
| [Command Code · GOAT](https://api.dreamfree.space/c/s/cpcommandcode) | - | $10/月 | 7.88M | 19.69M | 39.4M | ¥1.7265/M | 计算 |
| [共绩算力 · 按量 API](https://api.dreamfree.space/c/s/cpyqgongji) | - | 入¥16 / 缓存¥1.6 / 出¥80 | - | - | - | ¥2.7084/M | 计算 |

还有 5 个可比较选项，见[在线额度/价格对比](https://www.codingplan.fyi/?view=usage)。

## 平台对比

| 平台 | 状态 | 综合评分 | 标签 | 简介 |
|---|---|---:|---|---|
| 智谱AI | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | - | 涨价后新套餐无需抢购。 |
| OpenCode | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | - | 模型支持全，调用抵扣透明，性价比高，可直接支付宝付款，无需抢购。 |
| 字节·方舟 Coding Plan | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | - | 开放购买，模型覆盖全面。 |
| 字节·方舟 Agent Plan | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | - | 开放购买，按 AFP 抵扣，模型覆盖全面。 |
| MiniMax | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | - | 额度高、随时可买，支持多模态，日常编程助手与轻量任务性价比突出。 |
| 智谱国际版 | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | - | 国内版的替代，无需抢购。 |
| Kimi | 暂停销售 | ⭐️⭐️⭐️⭐️ | - | 拥有 Kimi-K3 国产最强模型。已暂停新用户套餐购买。发布后 Kimi-K3 后，变得比较拥挤且用量有所下降。新会员体系上天一天后又撤回，估计后续要调价。 |
| [DeepSeek](https://platform.deepseek.com/) | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | - | 官方 DeepSeek 按量通道，适合不想抢套餐，和想主要使用DeepSeek模型的用户。 |
| [共绩算力](https://api.dreamfree.space/c/s/cpyqgongji) | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | - | GLM、Kimi、Qwen、DeepSeek 等模型标价 8 折按量，人少时更稳，适合灵活充值调用。 |
| 优云智算 | 开放购买 | ⭐️⭐️⭐️⭐️ | - | 支持GLM-5.2和DeepSeek-V4-Flash-0731正式版。按照真实接口调用量计费，且模型倍率透明，但包含的调用量较少。 |
| Codex | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | 外币支付 | OpenAI 官方会员，性价比很高，用量很大。美中不足是需要外币信用卡或者Paypal，不能直接支付宝/微信付款。 |
| Claude | 开放购买 | ⭐️⭐️⭐️⭐️ | 外币支付 | Anthropic 官方会员，性价比高，支持多模型。国内使用限时比较多，除需要外币信用卡或者Paypal外，还需要境外手机号，和境外网络环境。 |
| Ollama | 开放购买 | ⭐️⭐️⭐️⭐️ | 外币支付 | Ollama 官方推出的云端模型会员，支持模型全，性价比很高。但需要外币信用卡或者Paypal，不能直接支付宝/微信付款。 |
| 阿里·百炼 Token Plan | 开放购买 | ⭐️⭐️⭐️⭐️ | - | 开放购买，支持 Qwen-3.8-Max 等模型，夜间抵扣成本更低。 |
| 阿里·百炼 Coding Plan | 定时放量 | ⭐️⭐️⭐️⭐️ | - | Pro 套餐性价比高，但供应有限。 |
| 小米·MiMo | 开放购买 | ⭐️⭐️⭐️⭐️ | - | 定价、模型定位、模型能力都和DeepSeek相似。价格比DeepSeek略低一些，能力也略低一点。 |
| Command Code | 开放购买 | ⭐️⭐️⭐️⭐️⭐️ | 性价比高 / 模型强 / 无需抢购 | $1/月起，按模型实际 Token 价格扣减美元 Credits，模型覆盖广且额度规则透明。 |
| 百度·千帆 | 开放购买 | ⭐️⭐️⭐️ | - | Coding Plan 下线，Token Plan 个人版新上线，首月半价活动中。搬家入手勉强还行，但是有其他更好的选择 |
| 华为云 | 定时放量 | ⭐️⭐️⭐️ | - | - |
| 腾讯云 | 开放购买 | ⭐️⭐️⭐️ | - | 中规中矩，如果不是要使用混元模型，不推荐。 |
| 京东云 | 定时放量 | ⭐️⭐️ | - | 已经很久不更新，模型较差 |
| GitHub | 开放购买 | ⭐️⭐️⭐️ | - | GitHub 官方会员，支持多模型，但性价比低，不推荐。 |
| Qoder 国内版 | 开放购买 | - | - | 阿里旗下 AI 编程与办公工具，个人订阅覆盖 Qoder CN 全家桶。 |
| Qoder 国际版 | 开放购买 | - | - | AI 编程平台，提供 Pro、Pro+、Ultra 个人订阅。 |
| WorkBuddy | 开放购买 | - | - | 腾讯 AI 办公工作台，与 CodeBuddy 同账号共享订阅积分。 |
| TRAE 国内版 | 开放购买 | - | - | 字节旗下 AI 编程与办公工具，采用积分制个人订阅。 |
| TRAE 国际版 | 开放购买 | - | - | 提供 TraeCode 与 TraeWork，个人订阅采用美元计价。 |
| 讯飞·星火 | 开放购买 | ⭐️⭐️⭐️ | - | 曾经的高性价比平台，现已陨落。 仅剩高效版（199元）和速通版（699元）套餐，199元套餐限购且高峰期拥挤，699元套餐性价比低。 |
| 联通云 | 开放购买 | ⭐️⭐️ | - | Coding Plan已经下线。仅剩TokenPlan，模型差。 |
| 移动云 | 开放购买 | ⭐️⭐️ | - | - |
| 阶跃星辰 | 开放购买 | ⭐️⭐️ | - | - |
| TaoToken | 开放购买 | ⭐️⭐️⭐️ | - | CSDN推出的平台，专注 GLM-5.2，定价合理但当前套餐已售罄。 |
| 超算 | 暂停销售 | ⭐️⭐️ | - | 已停售，证据不足。 |
| 商汤·日日新 | 开放购买 | ⭐️⭐️ | - | - |
| 摩尔线程 | 定时放量 | ⭐️⭐️ | - | - |
| 无问芯穹 | 已下线 | ⭐️ | - | - |
| 天翼云 | 已下线 | ⭐️ | - | - |

更详细的性价比、模型覆盖、稳定性评价和状态筛选见[在线平台对比](https://www.codingplan.fyi)。

## 套餐概览

这里按平台汇总当前在售套餐，不展开全部套餐明细。

| 平台 | 在售套餐 | 月费 / 计费 | 代表模型 |
|---|---:|---|---|
| 智谱AI | 3 | ¥118–¥1,078/月 | GLM-5.3、GLM-5.3-Flash、GLM-5、GLM-5-Turbo、等 6 个 |
| OpenCode | 1 | $10/月 | DeepSeek-V4-Flash-0731、DeepSeek-V4.1-Flash、GLM-5.3、GLM-5.3-Flash、等 27 个 |
| 字节·方舟 Coding Plan | 2 | ¥40–¥200/月 | DeepSeek-V4-Flash-0731、GLM-5.3、GLM-5.3-Flash、Auto、等 17 个 |
| 字节·方舟 Agent Plan | 4 | ¥40–¥1,000/月 | DeepSeek-V4-Flash-0731、GLM-5.3、GLM-5.3-Flash、Kimi-K3、等 19 个 |
| MiniMax | 3 | ¥49–¥469/月 | MiniMax-M2.5、MiniMax-M2.7、MiniMax-M3 |
| 智谱国际版 | 3 | $18–$168/月 | GLM-5.3、GLM-5.3-Flash、GLM-5、GLM-5-Turbo、等 6 个 |
| Kimi | 4 | ¥49–¥699/月 | Kimi-K3、Kimi-K2、Kimi-K2.5、Kimi-K2.6、等 5 个 |
| DeepSeek | 1 | 按量 API | DeepSeek-V4.1-Flash、DeepSeek-V4-Pro-0813 |
| 共绩算力 | 1 | 按量 API | GLM-5.3、GLM-5.3-Flash、Kimi-K3、DeepSeek-V4-Preview、等 10 个 |
| 优云智算 | 6 | ¥49–¥999/月 | DeepSeek-V4-Flash-0731、DeepSeek-V3.2、DeepSeek-V4-Flash-Vision-Exp、GLM-5.1、等 8 个 |
| Codex | 3 | $20–$200/月 | GPT-5.6-Luna、GPT-5.6-Sol、GPT-6-Astra、GPT-5.2、等 10 个 |
| Claude | 3 | $20–$200/月 | Claude Opus 5、Claude Fable 5、Claude Fable 5.1、Claude Haiku 4.5、等 10 个 |
| Ollama | 2 | $20–$100/月 | DeepSeek-V4-Flash-0731、DeepSeek-V4-Pro-0813、Gemini-3-Flash-Preview、GLM-5.1、等 9 个 |
| 阿里·百炼 Token Plan | 3 | ¥198–¥1,398/月 | DeepSeek-V4-Flash-0731、DeepSeek-V3.2、DeepSeek-V4-Pro-0813、DeepSeek-V4-Pro-Preview、等 15 个 |
| 阿里·百炼 Coding Plan | 1 | ¥200/月 | GLM-4.7、GLM-5、Kimi-K2.5、MiniMax-M2.5、等 10 个 |
| 小米·MiMo | 4 | ¥39–¥659/月 | MiMo-V2-Omni、MiMo-V2-Pro、MiMo-V2.5、MiMo-V2.5-Pro、等 5 个 |
| Command Code | 3 | $1–$20/月 | DeepSeek-V4-Flash-0731、GLM-5.3、GLM-5.3-Flash、GPT-5.6-Luna、等 59 个 |
| 百度·千帆 | 4 | ¥9.9–¥600/月 | DeepSeek-V4-Flash-0731、DeepSeek-V4-Pro-0813、ERNIE-5.1、GLM-5.1、等 6 个 |
| 华为云 | 4 | ¥59–¥799/月 | DeepSeek-V4-Flash-0731、GLM-5、GLM-5.1、Kimi-K2.6 |
| 腾讯云 | 4 | ¥39–¥599/月 | GLM-5.1、HY-2.0、Kimi-K2.5、MiniMax-M2.7 |
| 京东云 | 2 | ¥40–¥200/月 | DeepSeek-V3.2、GLM-5、Kimi-K2.5、MiniMax-M2.5、等 5 个 |
| GitHub | 3 | $0–$39/月 | Claude Haiku 4.5、Claude Opus 4.7、Claude Sonnet 4.6、Gemini 3.1 Pro、等 12 个 |
| Qoder 国内版 | 3 | ¥59–¥559/月 | DeepSeek-V4-Flash-0731、Auto、DeepSeek-V4-Pro-0813、GLM-5.2、等 10 个 |
| Qoder 国际版 | 3 | $20–$200/月 | DeepSeek-V4-Flash-0731、GLM-5.3、GLM-5.3-Flash、Kimi-K3、等 12 个 |
| WorkBuddy | 3 | ¥70–¥700/月 | DeepSeek-V4-Flash-0731、Kimi-K3、Auto、DeepSeek-V4-Pro-0813、等 12 个 |
| TRAE 国内版 | 4 | ¥45–¥629/月 | DeepSeek-V4-Flash-0731、GLM-5.3、GLM-5.3-Flash、Kimi-K3、等 18 个 |
| TRAE 国际版 | 4 | $3–$100/月 | Doubao-Seed-2.1-Turbo、Gemini 3.1 Pro、Gemini-3-Flash-Preview、GPT-5.2、等 8 个 |
| 讯飞·星火 | 2 | ¥199–¥699/月 | DeepSeek-V4-Flash-0731、DeepSeek-V3.2、DeepSeek-V4-Pro-0813、GLM-5、等 11 个 |
| 联通云 | 6 | ¥15–¥1,398/月 | DeepSeek-V4-Flash-0731、DeepSeek-V4-Pro-0813、MiniMax-M2.5 |
| 移动云 | 2 | ¥40–¥200/月 | MiniMax-M2.5 |
| 阶跃星辰 | 4 | ¥49–¥699/月 | step-3.5-flash、step-3.5-flash-2603、step-3.7-flash、step-router-v1 |
| TaoToken | 2 | ¥149–¥388/月 | GLM-5.2 |
| 超算 | 2 | ¥20–¥100/月 | MiniMax-M2.5、Qwen-3-235B-A22B |
| 商汤·日日新 | 1 | ¥0/月 | DeepSeek-V4-Flash-0731、SenseNova 6.7 Flash-Lite、SenseNova U1 Fast |
| 摩尔线程 | 1 | ¥0/月 | GLM-4.7 |

全部价格、周期优惠、请求数、权益和备注见[在线套餐对比](https://www.codingplan.fyi/?view=plans)。

## 数据口径

实测 14 · 计算 324 · 请求估算 42 · 倍率换算 29 · 未知 681

| 标记 | 含义 |
|---|---|
| 实测 | 根据真实使用记录得到 |
| 计算 | 根据官方额度和模型价格，在统一工作负载下换算 |
| 请求估算 | 请求次数乘以统一的单次 Token 假设 |
| 倍率换算 | 从同平台基准模型或基准套餐按倍率计算 |
| 未知 | 已确认支持该模型，但没有足够可靠的额度数据 |
| 无独立限制 | 该时间窗口没有单独上限，不代表整个套餐无限使用 |

- 使用表格邀请链接，部分平台可享优惠
- 综合单价 = 连续包月价（美元按汇率折算人民币）÷ 实测月 Token，单位为 ￥/M Token；缺数时显示「-」，仅供横向对比。
- 本页面数据仅供参考，价格及权益最终以平台官方公布为准，建议在选择套餐前仔细阅读各平台的官方条款和服务协议

## 最近更新

### 2026.9.10

- DeepSeek 官方上线 V4.1 Flash（552B MoE、原生多模态、1M 上下文）并下调价格：空闲 ¥1/¥0.02/¥4、高峰 ¥2/¥0.04/¥8 每百万 tokens，新价格 9.10 12:00 生效
- DeepSeek 官方旧模型名 deepseek-v4-flash、deepseek-v4-flash-vision-exp 改由 V4.1 Flash 承接并按 Flash 价格计费；V4 Pro 将于 9.14 12:00 后路由到 V4.1 Flash
- OpenCode Go 对齐官方当前 27 个模型，新增 DeepSeek-V4.1-Flash（限时 4 倍用量，官方未公布活动起止日期）与 Muse-Spark-1.3 Contributor
- 同步 DeepSeek V4 Flash / Vision Exp 最新价格，以及 GLM-5.3-Flash 月额度 $60、Qwen-3.7-Max 月额度 $30；移除已不在官方当前支持列表的 GLM-5、MiniMax-M2.5

### 2026.9.9

- 新增 Qoder 国内/国际版、WorkBuddy、TRAE 国内/国际版，共 17 档个人套餐；补齐支持模型、公开价格与倍率、地区和模式限制及活动说明，Token 用量暂未收录。

### 2026.9.8

- 收录 Command Code：新增平台介绍及 Go、GOAT、Pro 三档个人订阅
- Command Code 同步当前模型价格与套餐支持关系，新增 GPT-6-Astra、Gemini-3.8-Flash、Muse-Spark-1.3、LongCat-2.0 等模型

### 2026.9.7

- Claude 新增 Fable 5.1：Pro 可用但需额外 Usage Credits，Max 套餐内最多使用周额度的 50%
- Codex 新增 GPT-6-Astra，支持 Plus、Pro *5、Pro *20 套餐
- GPT-6-Astra Pro *5 周额度按实测更新为 200M Tokens；缓存命中约 96.8%，输出占比约 0.24%，以中等思考强度为主

### 2026.9.4

- 平台按实际产品线独立展示，套餐计费结构统一为订阅与按量，筛选和对比更简洁
- 共绩算力重新核对模型广场：收录 10 个当前可用模型，并按邀请资格的标价 8 折更新按量价格

### 2026.8.16

- DeepSeek-V4-Flash-0731 正式版同步更新 DeepSeek、OpenCode、字节·方舟、优云智算支持
- 智谱国内&国际版、OpenCode、字节·方舟在售套餐追加支持 GLM-5.3

### 2026.8.6

- 阿里发布Qwen-3.8-Max

### 2026.7.30

- 智谱国内&国际版更新新套餐
- 更新Ollama预估用量

## 延伸阅读

- [2026年9月主流大模型能力对比：Fable 5.1 综合领先，GPT-6 Astra 编码突出，GLM Flash 与 Luna 如何选](articles/model_comparisons/20260907/index.html) — 过去一个月，Fable 5.1、GPT-6 Astra、GLM-5.3 Flash 等模型陆续进入选型名单。综合能力、网页开发和仓库工程的榜首并不完全相同，日常大量调用时，还要考虑完成任务的成本。
- [2026年8月24日 AI Coding Plan 与 API 平台对比：智谱 GLM-5.3、MiniMax、DeepSeek 视觉版和 OpenCode 调整后怎么选](articles/plan_comparisons/20260824/index.html) — 8 月下旬这轮变化，不只是某个平台又加了一个模型。智谱把 GLM-5.3 纳入新套餐，DeepSeek 同时调整了峰谷价格并推出视觉实验版，OpenCode 的模型池和套餐展示也发生变化。
- [查看全部文章](articles/index.html)

## 数据反馈

发现价格、额度、支持模型或平台状态有误时，可前往 [GitHub Discussions](https://github.com/wmpeng/codingplan/discussions) 补充来源和核对日期，或[加入飞书讨论群](https://api.dreamfree.space/c/s/cpfeishulink)交流。
