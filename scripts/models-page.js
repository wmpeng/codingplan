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
      const viewButtons = [...document.querySelectorAll('[data-model-view]')];
      buttons.forEach(button => { if (button.dataset.modelFeatured !== 'all') button.textContent = root.CodingPlanUI.modelGroupLabel(preset.groups, button.dataset.modelFeatured); });
      const picker = root.CodingPlanSingleSelect.mount(sort, '排序');
      const Url = root.CodingPlanFilterUrl;
      const urlSchema = {
        query:Url.text('q'), sort:Url.choice('sort', Directory.sortKeys, 'default'), direction:Url.choice('dir', ['asc','desc'], ''),
        multimodal:Url.flag('multimodal'), featuredMode:Url.choice('featured', ['all', ...preset.groups.map(group => group.id)], ''),
        view:Url.choice('view', ['cards','table'], 'cards')
      };
      const saved = Url.read(urlSchema);
      let featuredMode = saved.featuredMode || '';
      let view = saved.view || 'cards';
      search.value = saved.query || ''; sort.value = saved.sort || 'default'; multimodal.checked = saved.multimodal === true;
      let direction = sort.value === 'default' ? 'asc' : saved.direction || Directory.defaultDirection(sort.value);
      let stickyHeader;
      const platformCounts = new Map(context.models.map(model => [model.slug,Catalog.modelPlatformCount(model,context)]));
      picker.sync();
      let pins = Directory.readPins(root.localStorage, context.models);
      function render() {
        Url.replace(urlSchema, {query:search.value, sort:sort.value, direction:sort.value==='default'?'':direction, multimodal:multimodal.checked, featuredMode, view});
        const selection = Directory.select(context.models, preset.groups, {query:search.value, featuredMode, sort:sort.value, direction, multimodal:multimodal.checked}, pins, platformCounts);
        fields.disabled = selection.featuredMode; fields.inert = selection.featuredMode;
        fields.classList.toggle('is-paused', selection.featuredMode);
        search.disabled = selection.featuredMode; reset.disabled = selection.featuredMode;
        buttons.forEach(button => { button.disabled = false; button.setAttribute('aria-pressed', String(button.dataset.modelFeatured === featuredMode)); });
        viewButtons.forEach(button => { button.disabled = false; button.setAttribute('aria-pressed', String(button.dataset.modelView === view)); });
        host.classList.toggle('model-grid', view === 'cards');
        host.dataset.view = view;
        const table = host.querySelector('.model-directory-table');
        if (view === 'table' && table) table.tBodies[0].innerHTML = Directory.tableRowsHtml(selection,context);
        else {
          stickyHeader?.destroy(); stickyHeader = null;
          host.innerHTML = view === 'table' ? Directory.tableHtml(selection,context) : selection.visible.length ? selection.visible.map(model => Catalog.modelCard(model, context, {
            directory:true, featured:selection.featured.has(model.slug), pinned:selection.pinned.has(model.slug)
          })).join('') : '<p class="tool-empty">没有匹配模型，试着清空搜索或减少条件。</p>';
        }
        if (view === 'table') {
          host.querySelector('.model-table-wrap thead').querySelectorAll('[data-model-sort]').forEach(button => {
            const active = button.dataset.modelSort === sort.value;
            button.closest('th').setAttribute('aria-sort',active ? direction === 'asc' ? 'ascending' : 'descending' : 'none');
            button.classList.toggle('is-active-sort',active);
          });
          stickyHeader ||= root.CodingPlanStickyTableHeader.mount(host,host.querySelector('.model-table-wrap'),host.querySelector('table'),{filters:document.getElementById('modelControls'),fields:null});
          stickyHeader.refresh();
        }
        document.getElementById('modelCount').textContent = Directory.countLabel(selection);
        host.dataset.mounted = '1';
        root.CodingPlanEvents?.results({result_count:selection.visible.length,result_key:JSON.stringify(selection.visible.map(x=>x.slug))});
      }
      sort.addEventListener('input', () => { direction = Directory.defaultDirection(sort.value); });
      document.getElementById('modelControls').addEventListener('input', render);
      viewButtons.forEach(button => button.addEventListener('click', () => {
        if (view === button.dataset.modelView) return;
        view = button.dataset.modelView; render();
      }));
      buttons.forEach(button => button.addEventListener('click', () => {
        featuredMode = featuredMode === button.dataset.modelFeatured ? '' : button.dataset.modelFeatured; render();
      }));
      reset.addEventListener('click', () => {
        search.value = ''; featuredMode = ''; sort.value = 'default'; multimodal.checked = false;
        direction = 'asc';
        picker.sync(); picker.close(); render();
      });
      host.addEventListener('click', event => {
        const sorter = event.target.closest('[data-model-sort]');
        if (sorter) {
          const next = Directory.cycleSort({key:sort.value,direction},sorter.dataset.modelSort);
          sort.value = next.key; direction = next.direction; picker.sync(); render(); return;
        }
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
      root.DirectoryFilters.mount(document.getElementById('modelControls'), search, document.getElementById('modelCount'), {
        controls: [
          {element:fields, label:'支持多模态', read:()=>[multimodal.checked,multimodal.checked?'开启':'关闭']},
          {element:document.querySelector('.model-featured-controls'), label:'精选模型', read:()=>[!!featuredMode,buttons.find(button=>button.getAttribute('aria-pressed')==='true')?.textContent || '全部模型']},
          {element:document.querySelector('.model-view-controls'), label:'视图', display:true, read:()=>[view!=='cards',view==='table'?'表格视图':'卡片视图']},
          {element:document.getElementById('modelSortPicker'), label:'排序', picker:true, display:true, read:()=>[sort.value!=='default',sort.selectedOptions[0]?.textContent || '']}
        ]
      });
    } catch (error) { root.CodingPlanToolPage.error(host, error.message, {preserveContent:true}); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(globalThis);
