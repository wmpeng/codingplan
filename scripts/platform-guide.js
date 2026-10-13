/* 静态介绍页保留无 JS 的亿 Token 数据，增强后跟随全站显示设置。 */
(() => {
  'use strict';
  function updateUnits() {
    const unit = window.CodingPlanDisplaySettings?.getTokenUnit() || 'yi';
    document.querySelectorAll('[data-guide-token-m]').forEach(element => {
      element.textContent = NumberDisplay.tokenAmount(Number(element.dataset.guideTokenM), unit);
    });
    document.querySelectorAll('[data-guide-token-unit]').forEach(element => {
      element.textContent = NumberDisplay.tokenUnit(unit);
    });
  }
  window.addEventListener('codingplan:token-unit-changed', updateUnits);
  // 共享顶栏脚本最后加载；等它建立显示设置后再读取已保存的单位。
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', updateUnits);
  else updateUnits();
})();
