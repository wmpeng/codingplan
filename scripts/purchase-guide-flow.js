(function(root,factory){
  const api=factory(root.CodingPlanFilters || require('./filter-state.js'),root.EntityData || require('./entity-data.js'),root.CodingPlanUI || require('./ui-core.js'),root.NumberDisplay || require('./number-display.js'));
  if(typeof module==='object' && module.exports)module.exports=api;
  root.PurchaseGuideFlow=api;
})(globalThis,function(F,E,UI,Numbers){
  'use strict';
  // These are explicit selector groups, not inferred manufacturer identities.
  const families=[['gpt','GPT 系列',/^gpt-/],['claude','Claude 系列',/^claude-/],['gemini','Gemini 系列',/^gemini-/],
    ['deepseek','DeepSeek 系列',/^deepseek-/],['glm','GLM 系列',/^glm-/],['kimi','Kimi 系列',/^kimi-/],
    ['minimax','MiniMax 系列',/^minimax-/],['qwen','Qwen 系列',/^qwen/],['grok','Grok 系列',/^grok-/],['doubao','豆包系列',/^doubao-/]];
  const tasks=[['coding','编程、修改项目、排查 Bug'],['writing','写作、改稿'],['analysis','阅读资料、分析问题'],['everyday','日常问答、办公']];
  const pains=[['cost','价格偏高'],['quality','模型能力不够'],['fiveHours','经常被 5 小时额度限制'],['monthly','每月额度不够'],['models','缺少想用的模型'],['tool','想换个工具使用'],['experience','速度或稳定性不满意']];
  const sizes={coding:[['small','修改几处代码，或解决一个小问题'],['normal','围绕一个功能反复修改、调试'],['large','经常读取大量文件，连续开发或排错']],
    writing:[['small','短文案，修改一两轮'],['normal','完整文章，反复修改几轮'],['large','长稿或多篇内容，持续修改']],
    analysis:[['small','几段材料，问几个问题'],['normal','多份材料，比较并追问'],['large','大量长资料，持续分析']],
    everyday:[['small','简单问答'],['normal','处理几件事，交流几轮'],['large','连续处理任务，反复追问']]};
  const textModels=context=>context.models.filter(model=>model.modalities?.output?.includes('text'));
  function availableFamilies(context){return families.filter(([, , pattern])=>textModels(context).some(model=>pattern.test(model.slug)));}
  function steps(a){return ['start',...(a.start==='existing'?['baseline']:[]),'task','entry','models','access','budget','usage','priority'];}
  function suggestedPriorities(a){
    const map={cost:'cost',quality:'quality',models:'quality',fiveHours:'volume',monthly:'volume',experience:'balanced'};
    const values=[...new Set((a.pains || []).map(pain=>map[pain]).filter(Boolean))];
    return values.length?values.slice(0,1):['balanced'];
  }
  function estimate(a){
    const base={occasional:100,daily:1000,heavy:4000}[a.frequency] || 1000;
    const task={coding:1,writing:0.35,analysis:0.6,everyday:0.2}[a.task] || 1;
    const size={small:0.25,normal:1,large:2}[a.size] || 1;
    const amount=Math.round(base*task*size);
    return {amount,min:Math.round(amount*0.5),max:Math.round(amount*2)};
  }
  function compile(context,a,base={}){
    const errors=[];
    let models=textModels(context);
    if(a.modelKind==='exact') {
      models=models.filter(model=>(a.exact || []).includes(model.slug));
      if(!a.exact?.length)errors.push('请选择至少一个具体型号。');
    } else if(a.modelKind==='family') {
      const group=families.find(([key])=>key===a.family);
      models=group?models.filter(model=>group[2].test(model.slug)):[];
      if(!group)errors.push('请选择一个模型系列。');
    } else if(['balanced','top'].includes(a.modelKind)) {
      const slugs=UI.modelPresetSlugs(context.modelGroups,a.modelKind==='top'?'sota-models':'high-volume-models',context.models);
      models=models.filter(model=>slugs.includes(model.slug));
    }
    if(a.modelKind!=='exact' && a.image==='yes')models=models.filter(E.supportsImageInput);
    const domesticRequired=a.domestic==='required' || a.network==='domestic' || a.payment==='domestic';
    let platforms=context.platforms.filter(platform=>!domesticRequired || F.isMainlandPlatform(platform));
    if(!models.length)errors.push('这组要求下还没有可选择的模型，请调整模型范围或图片要求。');
    if(!platforms.length)errors.push('尚未找到符合境内使用要求的平台，请调整条件。');
    const amount=a.usageMode==='known'?a.tokens:a.usageMode==='estimate'?(a.estimatedTokens??estimate(a).amount):null;
    if(a.usageMode==='known' && (amount==null || !Number.isFinite(amount) || amount<0))errors.push('请填写月用量，或选择暂时不确定。');
    if(a.budgetMode==='limit' && (a.budget==null || !Number.isFinite(a.budget) || a.budget<0))errors.push('请填写每月预算上限。');
    return {errors,state:F.normalizeState({...base,platformSlugs:platforms.map(platform=>platform.slug),modelSlugs:models.map(model=>model.slug),
      modelMatch:a.modelKind==='exact' && a.match==='all'?'all':'any',usageEntry:a.entry || 'any',apiOnly:false,
      harnessApiRequired:false,modelGroup:'any',imageRequired:false,domesticNetworkOnly:false,domesticPaymentOnly:false,
      multimodal:'all',aaScoreMin:null,deepSWEScoreMin:null,requestRanges:{},priceRanges:{},
      budgetCny:a.budgetMode==='free'?{min:null,max:0}:a.budgetMode==='limit'?{min:null,max:a.budget}:null,
      monthlyTokenRange:amount==null?null:{min:amount,max:null},priorities:a.priorities || ['balanced'],
      preference:(a.priorities || [])[0] || 'balanced',includeDiscontinued:false}),amount};
  }
  function baselineSummary(context,a,item,rate){
    if(a.start!=='existing' || !a.plan)return [];
    const previous=context.planBySlug.get(a.plan);if(!previous)return [];
    const notes=[];
    if((a.pains || []).includes('cost')){
      const cost=F.firstMonthCost(previous,rate);
      const label=item.plan.billingMode==='payg'?'按量 API 月支出估算':'首月费用';
      if(cost!==null && item.cost!==null)notes.push(item.cost===cost?`${label}与原套餐首月费用相同`:`${label}比原套餐首月${item.cost<cost?'少':'多'} ${Numbers.monthlyFee(Math.abs(item.cost-cost),'')} 元`);
    }
    if((a.pains || []).includes('quality')){
      const models=(context.relationsByPlanSlug.get(a.plan) || []).filter(row=>!a.baselineModel || row.modelSlug===a.baselineModel).map(row=>context.modelBySlug.get(row.modelSlug));
      const scores=models.map(model=>model?.scores?.artificialAnalysis?.scoreExact??model?.scores?.artificialAnalysis?.score).filter(value=>typeof value==='number');
      notes.push(scores.length && item.score!==null?`与原套餐相比，匹配模型的最高 AA 分${item.score>Math.max(...scores)?'更高':item.score===Math.max(...scores)?'相同':'更低'}；不代表每项任务都更强`:'缺少可比评分，暂时无法判断模型能力是否提升');
    }
    if((a.pains || []).includes('models')){
      const old=new Set((context.relationsByPlanSlug.get(a.plan) || []).map(row=>row.modelSlug));
      const added=item.models.filter(model=>!old.has(model.slug));
      notes.push(added.length?`包含原套餐未收录的模型：${added.slice(0,3).map(model=>model.name).join('、')}${added.length>3?'等':''}`:'当前匹配模型均已在原套餐收录');
    }
    for(const [pain,field,label] of [['fiveHours','fiveHourTokenInM','5 小时'],['monthly','monthlyTokenInM','月']]){
      if(!(a.pains || []).includes(pain))continue;
      const oldRows=(context.relationsByPlanSlug.get(a.plan) || []).filter(row=>!a.baselineModel || row.modelSlug===a.baselineModel);
      const oldSlugs=new Set(oldRows.map(row=>row.modelSlug));
      const shared=item.rows.filter(row=>oldSlugs.has(row.modelSlug));
      // Only claim an improvement when all comparable tiers exceed the old maximum.
      const old=oldRows.map(row=>row.usage?.[field]),next=shared.map(row=>row.usage?.[field]);
      if(!old.length || !next.length || [...old,...next].some(value=>typeof value!=='number' && value!=='unlimited'))notes.push(`与原套餐的${label}额度暂时无法直接比较`);
      else {
        const n=value=>value==='unlimited'?Infinity:value;
        notes.push(Math.min(...next.map(n))>Math.max(...old.map(n))?`共同模型的${label}参考额度高于原套餐（估算）`:`尚不能确认${label}额度比原套餐更充足`);
      }
    }
    if((a.pains || []).includes('experience'))notes.push('平台综合评分仅供比较，不保证实际速度或稳定性');
    return notes;
  }
  return {families,availableFamilies,textModels,tasks,pains,sizes,steps,estimate,compile,baselineSummary,suggestedPriorities};
});
