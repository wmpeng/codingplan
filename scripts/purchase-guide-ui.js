(function(root){
  'use strict';
  const host=document.getElementById('purchaseGuide');if(!host)return;
  const G=root.PurchaseGuide, Flow=root.PurchaseGuideFlow, UI=root.CodingPlanUI, N=root.NumberDisplay, esc=UI.escapeHtml;
  let controller=root.CodingPlanHomeFilters, active=false, step='start', pending=false, applied=false, estimateActive=false, notice='';
  let answers=fresh(), singleSelects;
  function fresh(){return {start:'new',task:'coding',entry:'any',modelKind:'any',exact:[],match:'any',image:'any',domestic:'any',budgetMode:'any',usageMode:'unsure',frequency:'daily',size:'normal',priorities:['balanced'],pains:[]};}
  const titles={start:'对现有或之前的订阅不满意吗？',baseline:'你用过什么套餐，哪里不满意？',task:'主要用 AI 做什么？',entry:'你准备从哪里使用？',models:'倾向于什么模型？',access:'境内使用要求',budget:'每个月最多打算花多少？',usage:'你每个月大概用多少？',priority:'你更看重什么？'};
  const labels={start:'开始',baseline:'原套餐',task:'用途',entry:'使用方式',models:'模型',access:'使用条件',budget:'预算',usage:'用量',priority:'优先级'};
  const unit=()=>controller?.getState().tokenUnit || 'yi';
  const amount=value=>`${N.tokenAmount(value,unit())} ${N.tokenUnit(unit())} Token`;
  const number=(key,label,value,suffix)=>`<label class="guide-number"><span>${label}</span><input type="number" min="0" step="any" inputmode="decimal" data-number="${key}" aria-label="${label}" value="${value??''}"><span>${suffix}</span></label>`;
  const buttons=(key,options)=>`<div class="guide-options">${options.map(([value,label])=>`<button type="button" data-answer="${key}" data-value="${esc(value)}" aria-pressed="${Array.isArray(answers[key])?answers[key].includes(value):answers[key]===value}">${esc(label)}</button>`).join('')}</div>`;
  function select(key,label,options,placeholder='请选择'){
    return `<div class="guide-select"><span>${label}</span><select id="guide-${key}" data-custom-select data-answer-select="${key}" aria-label="${label}"><option value="">${placeholder}</option>${options.map(([value,label])=>`<option value="${esc(value)}" ${answers[key]===value?'selected':''}>${esc(label)}</option>`).join('')}</select></div>`;
  }
  function content(){
    const c=controller.context;
    if(step==='start')return buttons('start',[['existing','是的，想改善现在或之前的使用体验'],['new','不是，直接帮我选']]);
    if(step==='baseline'){
      const plans=c.plans.filter(plan=>plan.billingMode==='subscription');
      const slugs=[...new Set((c.relationsByPlanSlug.get(answers.plan)||[]).map(row=>row.modelSlug))];
      return select('plan','当前或曾经使用的套餐',plans.map(plan=>[plan.slug,`${c.platformBySlug.get(plan.platformSlug)?.name} · ${plan.name}`]),'不记得具体套餐')+
        (answers.plan?select('baselineModel','主要使用的模型',slugs.map(slug=>[slug,c.modelBySlug.get(slug)?.name || slug]),'没有固定型号'):'')+
        '<p>哪些地方不满意？可以多选。</p>'+buttons('pains',Flow.pains);
    }
    if(step==='task')return buttons('task',Flow.tasks);
    if(step==='entry')return buttons('entry',G.entryOptions.map(option=>[option.value,option.value==='any'?'没有特别指定的工具':option.label]))+
      (answers.entry==='third-party'?'<p class="guide-note">例如 DeepSeek Harness、ZCode、MiniMax Code、Kimi Code、OpenCode。此项筛选通用 API 接入，具体智能体框架的兼容性还需确认。</p>':'');
    if(step==='models'){
      let html=buttons('modelKind',[['exact','具体型号'],['family','某个模型系列'],['balanced','兼顾能力和费用'],['top','能力更强的头部模型'],['any','没有指定模型']]);
      if(answers.modelKind==='exact')html+=`<label class="guide-search">搜索型号<input type="search" data-model-search aria-label="搜索型号" placeholder="输入模型名称"></label><div class="guide-model-list">${Flow.textModels(c).map(model=>`<label data-model-name="${esc(model.name.toLowerCase())}"><input type="checkbox" data-exact="${esc(model.slug)}" ${answers.exact.includes(model.slug)?'checked':''}>${esc(model.name)}${root.EntityData.supportsImageInput(model)?' · 可理解图片':''}</label>`).join('')}</div>`+(answers.exact.length>1?buttons('match',[['any','支持其中任意一个即可'],['all','同一套餐需要支持全部型号']]):'');
      else {
        if(answers.modelKind==='family')html+=select('family','模型系列',Flow.availableFamilies(c).map(([key,label])=>[key,label]));
        html+='<p>需要模型理解图片或截图吗？</p>'+buttons('image',[['yes','需要'],['any','没有这方面的要求']]);
      }
      return html;
    }
    if(step==='access')return buttons('domestic',[['required','仅考虑境内网络和支付均可用的平台'],['any','不限，可以使用境外条件']]);
    if(step==='budget'){
      const plan=c.planBySlug.get(answers.plan),cost=root.CodingPlanFilters.firstMonthCost(plan,root.appConfig?.usdToCnyRate);
      return buttons('budgetMode',[['free','先看免费方案'],['limit','每月预算上限'],['any','不确定']])+
        (answers.budgetMode==='limit'?number('budget','每月不超过',answers.budget,'元')+`<div class="guide-options">${[50,100,200,500].map(value=>`<button type="button" data-budget="${value}">${value} 元</button>`).join('')}${cost!==null?`<button type="button" data-budget="${cost}">按原套餐首月：${N.monthlyFee(cost,'¥')}</button>`:''}</div><p class="guide-note">订阅按首月费用判断；按量 API 按月用量估算。</p>`:'');
    }
    if(step==='usage'){
      let html=buttons('usageMode',[['known','知道大概用量，直接填写'],['estimate','不清楚，按使用习惯估算'],['unsure','暂时不确定，先看方案']]);
      if(answers.usageMode==='known')html+=number('tokens','每月大约',answers.tokens==null?null:answers.tokens/N.tokenFactor(unit()),`${N.tokenUnit(unit())} Token`);
      if(answers.usageMode==='estimate'){
        const e=Flow.estimate(answers);
        html+='<p>平时用得多吗？</p>'+buttons('frequency',[['occasional','偶尔用'],['daily','每天用一段时间'],['heavy','每天大部分时间都在用']])+'<p>通常会做到什么程度？</p>'+buttons('size',Flow.sizes[answers.task])+number('estimatedTokens','本次按每月',((answers.estimatedTokens??e.amount)/N.tokenFactor(unit())),`${N.tokenUnit(unit())} Token`)+`<p class="guide-note">粗略参考范围：${amount(e.min)}～${amount(e.max)}／月。可直接修改上面的数值；实际消耗会随模型、上下文和缓存变化。</p>`;
      }
      if(answers.usageMode!=='unsure')html+='<p class="guide-note">右上角的显示设置可以更改 Token 单位。</p>';
      else html+='<p class="guide-note">先不设置用量门槛。按量方案的月支出需要有用量后才能估算。</p>';
      if(answers.pains.includes('fiveHours') && answers.start==='existing')html+='<p class="guide-note">月额度更大不代表不会触及 5 小时限制，结果会另列与原套餐的对比。</p>';
      return html;
    }
    return '<div class="guide-options guide-priorities">'+G.sortOptions.map(option=>root.CodingPlanFilterControls.priorityChoice(option,answers.priorities.indexOf(option.value),true)).join('')+'</div>';
  }
  function render(){
    singleSelects?.destroy();
    host.hidden=!active || !controller;host.dataset.active=String(active);
    if(host.hidden)return;
    const steps=Flow.steps(answers),index=steps.indexOf(step);
    host.innerHTML=`<section class="purchase-guide-panel"><header class="guide-header"><h2>帮你选方案</h2><button type="button" data-action="close">收起</button></header><div class="guide-progress" aria-label="选购进度">${index+1} / ${steps.length} · ${labels[step]}</div><div class="guide-question"><h3 id="guideQuestionTitle" tabindex="-1">${titles[step]}</h3>${content()}</div><p class="guide-error" role="alert" ${notice?'':'hidden'}>${esc(notice)}</p><footer class="guide-step-actions"><button type="button" data-action="prev" ${index===0?'disabled':''}>上一步</button><button type="button" class="guide-primary" data-action="next">${index===steps.length-1?'查看方案':'下一步'}</button></footer></section>`;
    singleSelects=root.CodingPlanSingleSelect.mountAll(host);
  }
  function begin(){
    if(!controller){pending=true;return;}
    root.CodingPlanUpdates?.check('purchase_guide');
    if(!active && !applied && !pending)root.CodingPlanEvents?.track('guide_start');
    pending=false;active=true;render();host.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function validate(){
    if([...host.querySelectorAll('input[type="number"]')].some(input=>!input.checkValidity()))return '请输入不小于 0 的有效数值。';
    if(step==='models' && answers.modelKind==='exact' && !answers.exact.length)return '请选择至少一个具体型号。';
    if(step==='models' && answers.modelKind==='family' && !answers.family)return '请选择模型系列。';
    if(step==='budget' && answers.budgetMode==='limit' && answers.budget==null)return '请填写每月预算上限。';
    if(step==='usage' && answers.usageMode==='known' && answers.tokens==null)return '请填写月用量，或选择暂时不确定。';
    return '';
  }
  function showAppliedSummary(){
    let el=document.getElementById('purchaseGuideApplied');
    if(!el){el=document.createElement('div');el.id='purchaseGuideApplied';el.className='guide-applied';host.after(el);}
    const state=controller.getState(),draft=Flow.compile(controller.context,answers,state);
    const sameUsage=applied && estimateActive && draft.amount===root.CodingPlanFilters.targetTokens(state);
    el.innerHTML=applied?`${sameUsage && answers.usageMode==='estimate'?`月用量按 ${esc(amount(draft.amount))} 估算。 `:''}<button type="button" data-edit-guide>修改引导答案</button>`:'';
    el.hidden=!applied;
    el.querySelector('button')?.addEventListener('click',()=>{step=sameUsage && answers.usageMode==='estimate'?'usage':'start';begin();});
  }
  host.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b || b.matches('[role="option"]'))return;
    notice='';
    if(b.dataset.answer){
      const key=b.dataset.answer,value=b.dataset.value;
      if(Array.isArray(answers[key])){const index=answers[key].indexOf(value);if(index>=0)answers[key].splice(index,1);else answers[key].push(value);}
      else answers[key]=value;
      if(key==='priorities')answers.prioritiesTouched=true;
      if(['task','frequency','size'].includes(key))delete answers.estimatedTokens;
      render();host.querySelector(`[data-answer="${key}"][data-value="${value}"]`)?.focus({preventScroll:true});return;
    }
    if(b.dataset.budget){answers.budget=Number(b.dataset.budget);render();return;}
    const action=b.dataset.action;
    if(action==='close'){active=false;render();return;}
    const steps=Flow.steps(answers),index=steps.indexOf(step);
    if(action==='prev')step=steps[Math.max(0,index-1)];
    if(action==='next'){
      notice=validate();if(notice){render();return;}
      if(step==='baseline' && !answers.prioritiesTouched)answers.priorities=Flow.suggestedPriorities(answers);
      if(index===steps.length-1){
        const result=Flow.compile(controller.context,answers,controller.getState());
        if(result.errors.length){notice=result.errors.join(' ');render();return;}
        root.CodingPlanGuideContext=JSON.parse(JSON.stringify(answers));
        applied=true;estimateActive=answers.usageMode==='estimate';active=false;controller.setState(result.state,'guide');render();showAppliedSummary();
        root.CodingPlanEvents?.track('guide_complete');document.getElementById('purchaseGuideResults').scrollIntoView({behavior:'smooth'});return;
      }
      step=steps[index+1];
    }
    render();host.querySelector('#guideQuestionTitle')?.focus({preventScroll:true});
  });
  host.addEventListener('input',event=>{
    const el=event.target;
    if(el.hasAttribute('data-model-search')){const q=el.value.trim().toLowerCase();host.querySelectorAll('[data-model-name]').forEach(row=>row.hidden=!row.dataset.modelName.includes(q));return;}
    if(!el.dataset.number)return;
    const value=el.value===''?null:Number(el.value);
    if(value!==null && (!Number.isFinite(value) || value<0))return;
    answers[el.dataset.number]=value===null?null:value*(el.dataset.number==='budget'?1:N.tokenFactor(unit()));
  });
  host.addEventListener('change',event=>{
    const el=event.target;
    if(el.dataset.answerSelect){answers[el.dataset.answerSelect]=el.value;if(el.dataset.answerSelect==='plan')answers.baselineModel='';render();root.CodingPlanSingleSelect.mount(document.getElementById(el.id),el.getAttribute('aria-label'),{showLabel:false}).focus();}
    if(el.dataset.exact){answers.exact=el.checked?[...answers.exact,el.dataset.exact]:answers.exact.filter(slug=>slug!==el.dataset.exact);const search=host.querySelector('[data-model-search]').value;render();const field=host.querySelector('[data-model-search]');field.value=search;field.dispatchEvent(new Event('input',{bubbles:true}));}
  });
  root.addEventListener('codingplan:filters-ready',()=>{controller=root.CodingPlanHomeFilters;if(pending)begin();});
  root.addEventListener('codingplan:filters-changed',event=>{
    if(event.detail.full)return;controller=root.CodingPlanHomeFilters;
    if(applied && estimateActive && event.detail.source!=='guide' && root.CodingPlanFilters.targetTokens(event.detail.state)!==Flow.compile(controller.context,answers,event.detail.state).amount)estimateActive=false;
    if(event.detail.source==='display')render();
    if(applied)showAppliedSummary();
  });
  document.querySelectorAll('[data-open-guide]').forEach(link=>link.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();begin();}));
  root.addEventListener('codingplan:guide-restart',()=>{answers=fresh();step='start';applied=false;begin();});
})(globalThis);
