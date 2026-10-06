(function(){
  'use strict';
  async function boot(){
    const host=document.getElementById('modelDirectory'),C=FeaturedCatalog;
    try{
      const [{context},preset]=await Promise.all([CodingPlanToolPage.load(),fetch('/model-comparison-presets.json').then(r=>{if(!r.ok)throw new Error('精选模型加载失败');return r.json();})]);
      C.validate(preset,context);
      document.getElementById('modelHighlights').innerHTML=C.modelGroups(preset,context);
      const search=document.getElementById('modelSearch'),group=document.getElementById('modelGroup'),sort=document.getElementById('modelSort'),image=document.getElementById('modelImage');
      const available=new Set(context.planModels.filter(r=>{const p=context.planBySlug.get(r.planSlug),platform=context.platformBySlug.get(p?.platformSlug);return p&&!p.discontinued&&platform?.catalogVisible!==false&&['open','limited'].includes(platform?.platformStatus || 'open');}).map(r=>r.modelSlug));
      const listed=document.getElementById('modelAvailable');
      function render(){
        const q=search.value.trim().toLocaleLowerCase(),selected=preset.groups.find(g=>g.id===group.value);
        const models=context.models.filter(m=>(!q||`${m.name} ${m.slug}`.toLocaleLowerCase().includes(q))&&(!selected||selected.modelSlugs.includes(m.slug))&&(!image.checked||m.modalities?.input?.includes('image'))&&(!listed.checked||available.has(m.slug)));
        models.sort((a,b)=>{if(sort.value==='name')return a.name.localeCompare(b.name,'zh-CN');const x=C.score(a,sort.value),y=C.score(b,sort.value);return x==null?(y==null?a.name.localeCompare(b.name):1):y==null?-1:y-x||a.name.localeCompare(b.name);});
        host.innerHTML=models.length?models.map(m=>C.modelCard(m,context)).join(''):'<p class="tool-empty">没有匹配模型，试着清空搜索或减少条件。</p>';
        document.getElementById('modelCount').textContent=`${models.length} / ${context.models.length} 个模型`;
      }
      document.getElementById('modelControls').addEventListener('input',render);
      document.getElementById('modelReset').addEventListener('click',()=>{search.value='';group.value='all';sort.value='artificialAnalysis';image.checked=false;listed.checked=false;render();});
      render();
    }catch(error){CodingPlanToolPage.error(host,error.message);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
