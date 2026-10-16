const test=require('node:test');
const assert=require('node:assert/strict');
const Offers=require('./offer-results.js');
const Cards=require('./platform-catalog.js');
function offer(overrides={}){
  return {id:'test-offer',platform:{slug:'test-platform',name:'平台',action:'https://example.com/platform',platformStatus:'open',supportsHarnessApi:true},plan:{slug:'test-plan',name:'套餐',action:'https://example.com/plan',billingMode:'subscription',monthlyPrice:20,currency:'$'},models:[{slug:'one',name:'模型一'},{slug:'two',name:'模型二'}],rows:[{slug:'one-tier',modelSlug:'one',usage:{monthlyTokenInM:0,unitPriceCnyPerM:0}},{slug:'two-tier',modelSlug:'two',usage:{monthlyTokenInM:'unknown',unitPriceCnyPerM:null}}],cost:136,reasons:[],cautions:[],...overrides};
}
test('套餐导航遵守购买状态和安全地址，复用平台外链图标',()=>{
  const item=offer(),html=Offers.card(item,{tokenUnit:'yi'});
  assert.ok(html.includes(Cards.EXTERNAL_LINK_ICON));
  assert.match(html,/class="offer-open-link" href="https:\/\/example.com\/plan"/);
  for(const plan of [{...item.plan,planStatus: 'delisted'},{...item.plan,planStatus: 'restricted'},{...item.plan,action:'javascript:alert(1)'}])assert.doesNotMatch(Offers.card({...item,plan},{tokenUnit:'yi'}),/class="offer-open-link" href=/);
  assert.doesNotMatch(Offers.card({...item,platform:{...item.platform,platformStatus:'restricted'}},{tokenUnit:'yi'}),/class="offer-open-link" href=/);
  assert.match(Offers.card({...item,plan:{...item.plan,planStatus:'restricted'}},{tokenUnit:'yi'}),/>购买受限<\/span>/);
  assert.match(Offers.card({...item,plan:{...item.plan,action:null}},{tokenUnit:'yi'}),/class="offer-open-link" href="https:\/\/example.com\/platform"/);
});
test('订阅价格与额度摘要收敛，套餐链接不限定第一个模型',()=>{
  const html=Offers.card(offer(),{tokenUnit:'yi'});
  assert.match(html,/offer-price-line.*¥136.*\/ 月/);
  assert.match(html,/offer-original-price[^>]*>\$20 \/ 月/);
  assert.doesNotMatch(html,/原价 |约等于|≈|查看开通|查看 2 个模型/);
  assert.match(html,/offer-summary-label">月额度 <\/span><span class="offer-summary-value">0 亿/);
  assert.doesNotMatch(html,/月额度参考|部分模型未知/);
  assert.match(html,/额度未知/);assert.match(html,/>¥0.00<\/td>/);assert.match(html,/单价未知/);
  assert.match(html,/\/pricing\/\?platform=test-platform&amp;plan=test-plan/);
  assert.doesNotMatch(html,/&model=|&relation=/);
  assert.match(html,/class="offer-models"><summary/);
});
test('模型标签为纯展示，额外模型默认隐藏并提供真实按钮',()=>{
  const item=offer({models:Array.from({length:5},(_,i)=>({slug:'m'+i,name:'模型'+i}))});
  const html=Offers.card(item,{tokenUnit:'yi'});
  assert.equal((html.match(/data-extra-model hidden/g)||[]).length,2);
  assert.match(html,/<button[^>]+data-toggle-models[^>]+aria-expanded="false"[^>]*>\+2<\/button>/);
  assert.doesNotMatch(html,/<a[^>]*class="model-tag/);
});
test('按量卡片汇总模型档位，价格链接打开整个 API，零与未知保持语义',()=>{
  const item=offer(),api={...item,plan:{...item.plan,billingMode:'payg'}};
  const html=Offers.card(api,{tokenUnit:'B'});
  assert.match(html,/offer-price-note">估算/);assert.doesNotMatch(html,/&relation=|&model=/);
  assert.match(html,/无固定月额度/);assert.doesNotMatch(html,/offer-original-price/);
  assert.match(html,/class="offer-models"><summary class="offer-quota-summary offer-api-summary/);
  assert.doesNotMatch(html,/<details class="offer-models" open/);
  assert.match(html,/offer-summary-label">已知单价/);
  assert.doesNotMatch(html,/>月额度 \/ B<\/th>/);
  const unknown=Offers.card({...api,cost:null},{tokenUnit:'yi'});
  assert.match(unknown,/按量计费/);assert.doesNotMatch(unknown,/offer-price-note/);
  assert.equal(Offers.quota(125,'B',false),'0.125 B');
  assert.equal(Offers.quota(0,'M',false),'0 M');
  assert.equal(Offers.quota('unlimited','yi',false),'不限量');
});

test('API 单价摘要保留零价、范围和未知，亿/M/B 仅转换展示',()=>{
  const api=offer({plan:{slug:'api',name:'按量 API',billingMode:'payg'},cost:null,
    rows:[{slug:'low',modelSlug:'one',usage:{unitPriceCnyPerM:0}},{slug:'high',modelSlug:'two',usage:{unitPriceCnyPerM:2}}]});
  for(const [unit,value] of [['yi','¥0.00～200.00 /亿'],['M','¥0.00～2.00 /M'],['B','¥0.00～2,000.00 /B']]) {
    const html=Offers.card(api,{tokenUnit:unit});
    assert.ok(html.includes(value));assert.match(html,/offer-summary-label">单价/);
  }
  const unknown=Offers.card({...api,rows:api.rows.map(row=>({...row,usage:{unitPriceCnyPerM:null}}))},{tokenUnit:'yi'});
  assert.match(unknown,/offer-api-summary is-unknown/);assert.match(unknown,/offer-summary-value">待确认/);
});

test('按量多档位显示独立月支出和已知范围，不相加或掩盖未知费用',()=>{
  const api=offer({plan:{slug:'api',name:'按量 API',billingMode:'payg'},cost:0,
    apiEstimates:[{relationSlug:'one-tier',cost:0},{relationSlug:'two-tier',cost:250}],
    costRange:{min:0,max:250,hasUnknown:false}});
  const s={tokenUnit:'B',monthlyTokenRange:{min:1000}};
  const html=Offers.card(api,s);
  assert.match(html,/¥0<wbr>～250/);assert.match(html,/估算范围/);
  assert.match(html,/月支出估算/);assert.match(html,/<td>¥0<\/td>/);assert.match(html,/<td>¥250<\/td>/);
  assert.match(html,/独立估算，费用不相加/);
  const partial=Offers.card({...api,apiEstimates:[{relationSlug:'one-tier',cost:0},{relationSlug:'two-tier',cost:null}],costRange:{min:0,max:0,hasUnknown:true}},s);
  assert.match(partial,/已知费用估算/);assert.match(partial,/费用未知/);
  const unknown=Offers.card({...api,cost:null,costRange:null,apiEstimates:api.apiEstimates.map(x=>({...x,cost:null}))},s);
  assert.match(unknown,/按量计费/);assert.match(unknown,/费用未知/);assert.doesNotMatch(unknown,/offer-price-note/);
});
