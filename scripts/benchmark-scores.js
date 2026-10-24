(function(root, factory) {
  const api = factory(root.CodingPlanUI || (typeof require === 'function' ? require('./ui-core.js') : null), root.CodingPlanHelp || (typeof require === 'function' ? require('./ui-help.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BenchmarkScores = api;
})(globalThis, function(UI, Help) {
  'use strict';
  const definitions = {
    artificialAnalysis:{label:'AA',short:'AA',digits:1,description:'Artificial Analysis Intelligence Index；智能指数，非百分制。'},
    deepSWE:{label:'DeepSWE',short:'DeepSWE',digits:1,description:'DeepSWE 软件工程任务 pass@1 × 100；置信区间为 95%。'},
    liveBench:{label:'LiveBench',short:'LiveBench',digits:1,description:'LiveBench 2.0 Overall；按官方权重汇总各评测套件，缺失项不计入，零分计入。'},
    arena:{label:'Arena',short:'Arena',digits:2,description:'Arena Agent Overall · Net Improvement；相对基线的净改善百分比，可为负，随榜单和比较基线变化。'}
  };
  const keys = Object.keys(definitions);
  function value(record) {
    const n = record?.scoreExact ?? record?.score;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  }
  function format(record, key) {
    const n = value(record);
    if (n === null) return '—';
    const display = ['liveBench','arena'].includes(key) && typeof record.score === 'number' ? record.score : n;
    return (key === 'arena' && display > 0 ? '+' : '') + display.toFixed(definitions[key].digits) + (key === 'arena' ? '%' : '');
  }
  function details(record, key, metadata = {}) {
    const parts = [definitions[key].description];
    if (record?.configuration) parts.push(`评测配置：${record.configuration}。`);
    if (metadata.version) parts.push(`版本：${metadata.version}。`);
    if (metadata.releaseDate) parts.push(`题集日期：${metadata.releaseDate}。`);
    const date = record?.publishedAt || metadata.publishedAt || metadata.generatedAt;
    if (date) parts.push(`数据日期：${date.slice(0,10)}。`);
    else if (metadata.fetchedAt) parts.push(`采集日期：${metadata.fetchedAt.slice(0,10)}。`);
    if (key === 'deepSWE' && Number.isFinite(record?.confidenceIntervalExact)) parts.push(`95% 置信区间：±${record.confidenceIntervalExact.toFixed(1)}。`);
    if (key === 'arena' && Number.isFinite(record?.confidenceLowerExact) && Number.isFinite(record?.confidenceUpperExact)) parts.push(`95% 置信区间：${record.confidenceLowerExact.toFixed(2)}% ～ ${record.confidenceUpperExact.toFixed(2)}%。`);
    if (key === 'arena') parts.push('数据：Arena / LMArena leaderboard-dataset，CC-BY-4.0；公开数据集与网页榜单可能存在更新延迟。');
    if (value(record) === null) parts.push('暂无可采用的对应型号分数；缺失不代表能力为零。');
    return parts.join(' ');
  }
  function cardHtml(model, key, metadata) {
    const esc = UI.escapeHtml, record = model.scores?.[key], n = value(record), label = definitions[key].label;
    const display = esc(format(record, key));
    let contentHtml = `<p>${esc(details(record,key,metadata))}</p>`;
    if (key === 'arena') contentHtml += '<p><a href="https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset" target="_blank" rel="noopener noreferrer">Arena 官方公开数据集</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC-BY-4.0</a></p>';
    const help = Help.html(`score-${model.slug}-${key}`, `${model.name} ${label}评分详情`, '', {contentHtml})
      .replace('class="ui-help-button"', 'class="ui-help-button benchmark-score-button"')
      .replace('aria-label="关闭变更预告"', 'aria-label="关闭评分详情"')
      .replace(/<span aria-hidden="true">\?<\/span>/, `<span>${display}</span>`);
    const link = n !== null && record.sourceUrl ? ` <a href="${esc(UI.sanitizeUrl(record.sourceUrl, '#'))}" target="_blank" rel="noopener noreferrer" aria-label="${esc(model.name)} ${label}评分来源">↗</a>` : '';
    return `<div class="model-score" data-score="${key}"><span class="model-score-label">${label}</span><span class="model-score-value${n === null ? ' score-unknown' : ''}">${help}${link}</span></div>`;
  }
  return {definitions,keys,value,format,details,cardHtml};
});
