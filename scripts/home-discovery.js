(function () {
  'use strict';
  async function boot() {
    const C=FeaturedCatalog;
    try {
      const [{context,config},preset]=await Promise.all([CodingPlanToolPage.load(),CodingPlanToolPage.loadPreset()]);
      C.validate(preset,context);context.modelGroups=preset.groups;
      window.codingplanEntityContext=context;
      const plans=EntityData.buildPlanCatalog(context).filter(plan=>plan.billingMode==='subscription'),grid=document.getElementById('featuredPlatforms');
      const modelRows=CodingPlanUI.observeModelTagRows(grid);
      let pinned=PlatformCatalog.readPinnedIdsFromStorage(localStorage);
      function platforms(){grid.innerHTML=preset.platformSlugs.map(slug=>PlatformCatalog.buildPlatformCardHtml(context.platformBySlug.get(slug),plans,{capabilitiesBeforeScores:true,supportedModels:CodingPlanUI.prioritizeFeaturedModels(EntityData.platformModels(context,slug),preset.groups),hasApiPlan:EntityData.buildApiPricingGroups(context,slug).length>0,pinnedIds:pinned,sanitizeUrl:C.url})).join('');modelRows.refresh();}
      function pin(slug,placement='home_platforms'){pinned=PlatformCatalog.togglePinnedId(pinned,slug);PlatformCatalog.writePinnedIdsToStorage(localStorage,pinned);platforms();PlatformDetail.syncPinUi();window.CodingPlanEvents?.track('pin_change',{entity_type:'platform',entity_slug:slug,pinned:pinned.includes(slug),placement});}
      platforms();
      PlatformDetail.init({getPlans:()=>plans,getEntityContext:()=>context,isPlatformPinned:slug=>pinned.includes(slug),onTogglePlatformPin:pin,onJumpPlansTable:name=>{const p=context.platforms.find(x=>x.name===name);location.href=CodingPlanUI.route('plans',{platform:p?.slug});}});
      PlatformCatalog.bindPlatformCardActions(grid, {
        onTogglePin: slug => pin(slug),
        onOpen: (slug, card) => PlatformDetail.open(context.platformBySlug.get(slug), {triggerEl:card})
      });
      document.getElementById('featuredModels').innerHTML=C.modelGroups(preset,context);
      C.mountTables(document.getElementById('featuredComparisons'),preset,context,config,{hideHeading:true});
      OfferResults.mount(document.getElementById('purchaseGuideResults'),context,config);
      CodingPlanFilterUI.mount({context,config,featuredPreset:preset});
      window.StaticContent?.ready();
      document.getElementById('homeLoading')?.remove();
      window.dispatchEvent(new Event('codingplan:home-ready'));
    } catch(e) {
      window.StaticContent?.fail();
      const host=document.getElementById('purchaseGuideResults');CodingPlanToolPage.error(host,e.message);
      document.getElementById('homeLoading').textContent='动态内容暂时无法加载，精选摘要仍可浏览。请刷新重试。';
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
