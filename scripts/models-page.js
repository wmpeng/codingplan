(function (root) {
  'use strict';
  async function boot() {
    const host = document.getElementById('modelDirectory'), Catalog = root.FeaturedCatalog, Directory = root.ModelDirectory;
    try {
      const [{context}, preset] = await Promise.all([root.CodingPlanToolPage.load(), root.CodingPlanToolPage.loadPreset()]);
      Catalog.validate(preset, context);
      const search = document.getElementById('modelSearch'), group = document.getElementById('modelGroup');
      const sort = document.getElementById('modelSort'), image = document.getElementById('modelImage');
      const pickers = [root.CodingPlanSingleSelect.mount(group, '分组'), root.CodingPlanSingleSelect.mount(sort, '排序')];
      let pins = Directory.readPins(root.localStorage, context.models);
      function render() {
        const selection = Directory.select(context.models, preset.groups, {query:search.value, group:group.value, sort:sort.value, image:image.checked}, pins);
        host.innerHTML = selection.visible.length ? selection.visible.map(model => Catalog.modelCard(model, context, {
          directory:true, featured:selection.featured.has(model.slug), pinned:selection.pinned.has(model.slug)
        })).join('') : '<p class="tool-empty">没有匹配模型，试着清空搜索或减少条件。</p>';
        document.getElementById('modelCount').textContent = Directory.countLabel(selection);
        host.dataset.mounted = '1';
      }
      document.getElementById('modelControls').addEventListener('input', render);
      search.addEventListener('input', render);
      document.getElementById('modelReset').addEventListener('click', () => {
        search.value = ''; group.value = 'all'; sort.value = 'default'; image.checked = false;
        pickers.forEach(picker => { picker.sync(); picker.close(); }); render();
      });
      host.addEventListener('click', event => {
        const button = event.target.closest('[data-model-pin]'); if (!button) return;
        const slug = button.dataset.modelPin;
        pins = pins.includes(slug) ? pins.filter(id => id !== slug) : [slug, ...pins];
        Directory.writePins(root.localStorage, pins); render();
        [...host.querySelectorAll('[data-model-pin]')].find(item => item.dataset.modelPin === slug)?.focus({preventScroll:true});
      });
      root.addEventListener('storage', event => {
        if (event.key === Directory.pinKey || event.key === null) { pins = Directory.readPins(root.localStorage, context.models); render(); }
      });
      render();
    } catch (error) { root.CodingPlanToolPage.error(host, error.message, {preserveContent:true}); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(globalThis);
