(function () {
  'use strict';
  async function boot() {
    const C=FeaturedCatalog;
    try {
      const [{context,config},preset]=await Promise.all([CodingPlanToolPage.load(),fetch('/model-comparison-presets.json').then(r=>{if(!r.ok)throw new Error('精选配置加载失败');return r.json();})]);
      C.validate(preset,context);context.modelGroups=preset.groups;
      window.codingplanEntityContext=context;
      const plans=EntityData.buildPlanCatalog(context),grid=document.getElementById('featuredPlatforms');
      let pinned=PlatformCatalog.readPinnedIdsFromStorage(localStorage);
      function platforms(){grid.innerHTML=preset.platformSlugs.map(slug=>PlatformCatalog.buildPlatformCardHtml(context.platformBySlug.get(slug),plans,{supportedModels:EntityData.platformModels(context,slug),hasApiPlan:EntityData.buildApiPricingGroups(context,slug).length>0,pinnedIds:pinned,sanitizeUrl:C.url})).join('');}
      function pin(slug){pinned=PlatformCatalog.togglePinnedId(pinned,slug);PlatformCatalog.writePinnedIdsToStorage(localStorage,pinned);platforms();PlatformDetail.syncPinUi();}
      platforms();
      PlatformDetail.init({getPlans:()=>plans,getEntityContext:()=>context,isPlatformPinned:slug=>pinned.includes(slug),onTogglePlatformPin:pin,onJumpPlansTable:name=>{const p=context.platforms.find(x=>x.name===name);location.href='/plans/?platform='+encodeURIComponent(p?.slug || '');}});
      grid.addEventListener('click',e=>{const b=e.target.closest('[data-platform-pin]');if(b){pin(b.dataset.platformId);grid.querySelector(`[data-platform-pin][data-platform-id="${b.dataset.platformId}"]`)?.focus({preventScroll:true});return;}if(e.target.closest('a'))return;const card=e.target.closest('[data-platform-id]');if(card)PlatformDetail.open(context.platformBySlug.get(card.dataset.platformId),{triggerEl:card});});
      grid.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('a,button')){const card=e.target.closest('[data-platform-id]');if(card){e.preventDefault();PlatformDetail.open(context.platformBySlug.get(card.dataset.platformId),{triggerEl:card});}}});
      document.getElementById('featuredModels').innerHTML=C.modelGroups(preset,context);
      C.mountTables(document.getElementById('featuredComparisons'),preset,context,config,6);
      OfferResults.mount(document.getElementById('purchaseGuideResults'),context,config);
      CodingPlanFilterUI.mount({context,config});
      if(typeof renderSettingsOnly==='function'){renderSettingsOnly('settingsMount',{settings:{buttonTitle:'显示设置',panelTitle:'显示设置',ultraWideLabel:'超宽屏'}});window.initUltraWideSettings?.();}
      document.getElementById('homeLoading')?.remove();
    } catch(e) {
      const host=document.getElementById('purchaseGuideResults');CodingPlanToolPage.error(host,e.message);
      document.getElementById('homeLoading').textContent='动态内容暂时无法加载，精选摘要仍可浏览。请刷新重试。';
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
