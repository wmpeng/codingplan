# 推荐区域重构 — 分组推荐

## 概述

将 index.html 中现有的 5 张平铺推荐卡片重构为**4 组分类推荐**，每组有独立标题和卡片列表，帮助用户按不同维度快速定位适合自己的 Coding Plan 套餐。所有分组数据均为 `config.json` 中的静态配置，JS 仅负责渲染，不做动态筛选。

## 技术方案

| 维度 | 选择 | 理由 |
|------|------|------|
| 项目类型 | 原生静态 HTML（native-static） | 现有项目技术栈，不改动架构 |
| 推荐分组数据 | `config.json` 新增 `recommendationGroups`，全部手动维护 | 用户要求静态配置，不做代码动态筛选 |
| 渲染方式 | JS 读取 config 渲染分组 | 与现有 `renderRecommendations()` 模式一致 |
| 布局 | 分组卡片网格（每组独立 section） | 视觉清晰，每组有标题区分 |

## 功能模块

### 1. 推荐分组配置（config.json）

在 `config.json` 中新增 `recommendationGroups` 数组，定义 4 个分组，每个分组包含 `title` 和 `items`（推荐项列表，结构复用现有 `recommendations` 的 item 结构：`name`、`rating`、`reasons`）：

```json
{
  "recommendationGroups": [
    {
      "title": "综合推荐",
      "items": [
        { "name": "智谱AI", "rating": 5, "reasons": [...] },
        { "name": "讯飞·星火", "rating": 5, "reasons": [...] },
        { "name": "MiniMax", "rating": 5, "reasons": [...] },
        { "name": "字节·方舟", "rating": 5, "reasons": [...] },
        { "name": "Kimi", "rating": 4, "reasons": [...] }
      ]
    },
    {
      "title": "有 GLM-5.2",
      "items": [
        { "name": "智谱AI", "rating": 5, "reasons": [...] },
        { "name": "字节·方舟", "rating": 5, "reasons": [...] },
        { "name": "优云智算", "rating": 4, "reasons": [...] }
      ]
    },
    {
      "title": "量大管饱",
      "items": [
        { "name": "MiniMax", "rating": 5, "reasons": [...] },
        { "name": "智谱AI", "rating": 5, "reasons": [...] },
        { "name": "字节·方舟", "rating": 5, "reasons": [...] },
        { "name": "讯飞·星火", "rating": 5, "reasons": [...] }
      ]
    },
    {
      "title": "不用抢",
      "items": [
        { "name": "讯飞·星火", "rating": 5, "reasons": [...] },
        { "name": "MiniMax", "rating": 5, "reasons": [...] },
        { "name": "字节·方舟", "rating": 5, "reasons": [...] },
        { "name": "Kimi", "rating": 4, "reasons": [...] }
      ]
    }
  ]
}
```

- **综合推荐**：沿用现有 `recommendations` 数据，覆盖各维度最值得推荐的平台
- **有 GLM-5.2**：筛选支持 GLM-5.2 模型的平台（智谱AI、字节方舟、优云智算等）
- **量大管饱**：月请求数/额度最充足的平台（MiniMax、智谱AI、字节方舟、讯飞星火）
- **不用抢**：无需抢购、随时可买的平台（排除智谱AI/智谱国际版）

### 2. 分组渲染逻辑（index.html JS）

新增 `renderRecommendationGroups()` 函数：
- 读取 `config.json` 的 `recommendationGroups` 配置
- 遍历每个分组，渲染为独立 section（标题 + 卡片网格）
- 每组内的卡片复用现有 `renderRecommendations` 的卡片渲染逻辑

### 3. 分组卡片样式

- 每组一个 section，带分组标题（h3）
- 卡片样式复用现有 `.recommendation-card`
- 响应式：大屏 3 列 → 中屏 2 列 → 小屏 1 列

## 是否有原型设计

是

## 实施步骤

1. **阶段一：原型设计** — 加载 `design-canvas` 技能，按该技能流程完成推荐分组区域的原型 HTML 页面设计。完成后提示用户验收，用户确认后进入开发阶段。
2. **阶段二：代码开发** — 更新 `config.json` 新增 `recommendationGroups` 配置（含 4 组推荐数据）；修改 `index.html` 中的推荐区域 HTML 结构（替换现有平铺卡片为分组 section）和 JS 渲染逻辑（新增 `renderRecommendationGroups` 函数）；调整推荐区域 CSS 样式以适配分组布局。
3. **验证** — 通过 `test_run` 执行静态检查，确保页面正常渲染。

## 页面规格

### 全局导航

##### @nav(web-topbar)
> type: topbar
> platform: web

- @page(/) 首页

### 页面详情

##### @page(/) 首页

**核心职责**：展示 AI Coding Plan 套餐对比，包含分组推荐、筛选表格、使用量图表。
**布局**：顶部 Header → 推荐分组区域（4 组 section，每组标题 + 卡片网格）→ 评分标准 → 套餐使用量图表 → 筛选栏 → 数据表格 → 更新日志 → 页脚。

**推荐分组区域**：
- 4 个独立 section，每个有分组标题（如「综合推荐」「有 GLM-5.2」）和卡片网格
- 卡片网格每行 3 张（响应式缩为 2 列/1 列）
- 卡片内容：平台名、星级、推荐理由、跳转链接

**交互说明**

| 元素 | 动作 | 响应 | 传参 | 备注 |
|------|------|------|------|------|
| 推荐卡片标题 | 点击 | 新标签打开对应平台购买链接 | — | — |
