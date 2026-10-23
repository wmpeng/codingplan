(function (root) {
  'use strict';
  async function boot() {
    const host = document.getElementById('modelDirectory'), Catalog = root.FeaturedCatalog, Directory = root.ModelDirectory;
    try {
      const [{context}, preset] = await Promise.all([root.CodingPlanToolPage.load(), root.CodingPlanToolPage.loadPreset()]);
      Catalog.validate(preset, context);
      const search = document.getElementById('modelSearch'), sort = document.getElementById('modelSort');
      const multimodal = document.getElementById('modelMultimodal'), fields = document.getElementById('modelFilterFields');
      const reset = document.getElementById('modelReset'), buttons = [...document.querySelectorAll('[data-model-featured]')];
      buttons.forEach(button => { if (button.dataset.modelFeatured !== 'all') button.textContent = root.CodingPlanUI.modelGroupLabel(preset.groups, button.dataset.modelFeatured); });
      const picker = root.CodingPlanSingleSelect.mount(sort, '排序');
      const Url = root.CodingPlanFilterUrl;
      const urlSchema = {
        query:Url.text('q'), sort:Url.choice('sort', ['default','name','artificialAnalysis','deepSWE'], 'default'),
        multimodal:Url.flag('multimodal'), featuredMode:Url.choice('featured', ['all', ...preset.groups.map(group => group.id)], '')
      };
      const saved = Url.read(urlSchema);
      let featuredMode = saved.featuredMode || '';
      search.value = saved.query || ''; sort.value = saved.sort || 'default'; multimodal.checked = saved.multimodal === true;
      picker.sync();
      let pins = Directory.readPins(root.localStorage, context.models);
      function render() {
        Url.replace(urlSchema, {query:search.value, sort:sort.value, multimodal:multimodal.checked, featuredMode});
        const selection = Directory.select(context.models, preset.groups, {query:search.value, featuredMode, sort:sort.value, multimodal:multimodal.checked}, pins);
        fields.disabled = selection.featuredMode; fields.inert = selection.featuredMode;
        fields.classList.toggle('is-paused', selection.featuredMode);
        search.disabled = selection.featuredMode; reset.disabled = selection.featuredMode;
        buttons.forEach(button => { button.disabled = false; button.setAttribute('aria-pressed', String(button.dataset.modelFeatured === featuredMode)); });
        host.innerHTML = selection.visible.length ? selection.visible.map(model => Catalog.modelCard(model, context, {
          directory:true, featured:selection.featured.has(model.slug), pinned:selection.pinned.has(model.slug)
        })).join('') : '<p class="tool-empty">没有匹配模型，试着清空搜索或减少条件。</p>';
        document.getElementById('modelCount').textContent = Directory.countLabel(selection);
        host.dataset.mounted = '1';
        root.CodingPlanEvents?.results({result_count:selection.visible.length,result_key:JSON.stringify(selection.visible.map(x=>x.slug))});
      }
      document.getElementById('modelControls').addEventListener('input', render);
      search.addEventListener('input', render);
      buttons.forEach(button => button.addEventListener('click', () => {
        featuredMode = featuredMode === button.dataset.modelFeatured ? '' : button.dataset.modelFeatured; render();
      }));
      reset.addEventListener('click', () => {
        search.value = ''; featuredMode = ''; sort.value = 'default'; multimodal.checked = false;
        picker.sync(); picker.close(); render();
      });
      host.addEventListener('click', event => {
        const button = event.target.closest('[data-model-pin]'); if (!button) return;
        const slug = button.dataset.modelPin;
        pins = pins.includes(slug) ? pins.filter(id => id !== slug) : [slug, ...pins];
        Directory.writePins(root.localStorage, pins); render();
        root.CodingPlanEvents?.track('pin_change', {entity_type:'model',entity_slug:slug,pinned:pins.includes(slug),placement:'models'});
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
