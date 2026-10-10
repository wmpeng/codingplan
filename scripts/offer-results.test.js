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
  assert.match(html,/class="offer-plan" href="https:\/\/example.com\/plan"/);
  for(const plan of [{...item.plan,discontinued:true},{...item.plan,action:'javascript:alert(1)'}])assert.doesNotMatch(Offers.card({...item,plan},{tokenUnit:'yi'}),/class="offer-plan" href=/);
  assert.doesNotMatch(Offers.card({...item,platform:{...item.platform,platformStatus:'paused'}},{tokenUnit:'yi'}),/class="offer-plan" href=/);
  assert.match(Offers.card({...item,plan:{...item.plan,action:null}},{tokenUnit:'yi'}),/class="offer-plan" href="https:\/\/example.com\/platform"/);
});
test('订阅价格与额度摘要收敛，套餐链接不限定第一个模型',()=>{
  const html=Offers.card(offer(),{tokenUnit:'yi'});
  assert.match(html,/offer-price-line.*¥136.*\/ 月/);
  assert.match(html,/offer-original-price[^>]*>\$20 \/ 月/);
  assert.doesNotMatch(html,/原价 |约等于|≈|查看开通|查看 2 个模型/);
  assert.match(html,/offer-summary-label">月额度 <\/span><span class="offer-summary-value">0 亿/);
  assert.doesNotMatch(html,/月额度参考|部分模型未知/);
  assert.match(html,/额度未知/);assert.match(html,/>¥0.00<\/td>/);assert.match(html,/单价未知/);
  assert.match(html,/\/pricing\/\?platform=test-platform&plan=test-plan/);
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
test('按量卡片保留具体关系和估算语义，零、未知与单位转换不混淆',()=>{
  const item=offer(),api={...item,plan:{...item.plan,billingMode:'payg'}};
  const html=Offers.card(api,{tokenUnit:'B'});
  assert.match(html,/offer-price-note">估算/);assert.match(html,/&relation=one-tier/);
  assert.match(html,/无固定额度/);assert.doesNotMatch(html,/class="offer-models"|offer-original-price/);
  const unknown=Offers.card({...api,cost:null},{tokenUnit:'yi'});
  assert.match(unknown,/按量计费/);assert.doesNotMatch(unknown,/offer-price-note/);
  assert.equal(Offers.quota(125,'B',false),'0.125 B');
  assert.equal(Offers.quota(0,'M',false),'0 M');
  assert.equal(Offers.quota('unlimited','yi',false),'不限量');
});
