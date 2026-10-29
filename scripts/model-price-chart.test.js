const test = require('node:test');
const assert = require('node:assert/strict');
const Chart = require('./model-price-chart.js');
const point = (slug, price, score, extra = {}) => ({slug, modelSlug:slug, modelName:`Model-${slug}-Preview-1017`, platformSlug:'a', platformName:'平台 A', planName:'套餐', billingMode:'subscription', unitPriceCnyPerM:price, scores:{artificialAnalysis:{scoreExact:score}}, ...extra});

test('exact overlap grouping keeps all offers, distinct billing symbols, zero and negative scores', () => {
    const rows = [point('a',0,0),point('b',0,0),point('api',0,0,{billingMode:'payg'}),point('negative',1,-2),point('nearby',1.000000001,-2),point('unknown',null,10),point('missing',1,null)];
    const copy = JSON.stringify(rows);
    const groups = Chart.groupPoints(rows,'artificialAnalysis');
    assert.equal(groups.length,4);
    assert.deepEqual(groups[0].members.map(p=>p.slug),['a','b']);
    assert.equal(groups[0].price,0);
    assert.equal(groups[2].score,-2);
    assert.equal(JSON.stringify(rows),copy);
});

test('Pareto frontier excludes same-price and same-score dominated points without changing source order', () => {
    const rows = [point('expensive',10,5),point('cheap',0,-2),point('winner',1,5),point('samePrice',1,4),point('tie',1,5),point('better',5,8),point('last',8,10)];
    const groups = Chart.groupPoints(rows,'artificialAnalysis');
    const original = [...groups];
    assert.deepEqual(Chart.paretoFrontier(groups).map(g=>[g.price,g.score]),[[0,-2],[1,5],[5,8],[8,10]]);
    assert.deepEqual(groups,original);
    assert.deepEqual(Chart.paretoFrontier([]),[]);
});

test('one cheapest candidate per model uses full names and includes different models at the same coordinate', () => {
    const rows = [point('a',2,5,{modelSlug:'m'}),point('b',1,5,{modelSlug:'m'}),point('c',1,5),point('d',1,5,{modelSlug:'m'})];
    const groups = Chart.groupPoints(rows,'artificialAnalysis');
    const labels = Chart.cheapestModelLabels(groups);
    assert.deepEqual([...labels.values()].flat(),[`${rows[1].modelName}\n平台 A`,`${rows[2].modelName}\n平台 A`]);
    const series = Chart.buildSeries(groups,{benchmark:'artificialAnalysis',colors:{a:'#123456'},colorMode:'vendor',tokenUnit:'yi',compact:false});
    const data=series.filter(s=>s.type==='scatter').flatMap(s=>s.data);
    assert.equal(data.find(d=>d.members.some(p=>p.slug==='b')).value[0],100);
    assert.match(data.find(d=>d.label.show).label.formatter,/Preview-1017/);
    assert.equal(data[0].meta.modelName,rows[0].modelName);
});

test('selection highlights all prices of the selected model, including an overlap member, and hides mobile default labels', () => {
    const rows = [point('a',1,5),point('b',1,5,{modelSlug:'m'}),point('c',2,5,{modelSlug:'m',billingMode:'payg'}),point('d',3,8)];
    const groups = Chart.groupPoints(rows,'artificialAnalysis');
    const options={benchmark:'artificialAnalysis',colors:{a:'#123456'},colorMode:'vendor',tokenUnit:'M',compact:true};
    const plain=Chart.buildSeries(groups,options).flatMap(s=>s.type==='scatter'?s.data:[]);
    assert.equal(plain.some(d=>d.label.show),false);
    const selected=Chart.buildSeries(groups,{...options,selectedSlug:'b'}).flatMap(s=>s.type==='scatter'?s.data:[]);
    assert.equal(selected.find(d=>d.members.some(p=>p.slug==='b')).meta.slug,'b');
    assert.equal(selected.find(d=>d.meta.slug==='b').label.formatter,`${rows[1].modelName}\n平台 A`);
    assert.equal(selected.find(d=>d.meta.slug==='c').itemStyle.opacity,0.86);
    assert.equal(selected.find(d=>d.meta.slug==='d').itemStyle.opacity,0.14);
    assert.equal(selected.find(d=>d.meta.slug==='c').symbol,'diamond');
});

test('overlap labels retain the platforms of each candidate model and selection names the exact platform', () => {
    const rows = [point('a',1,5,{modelSlug:'m'}),point('b',1,5,{modelSlug:'m',platformSlug:'b',platformName:'平台 B'}),point('duplicate',1,5,{modelSlug:'m'}),point('c',1,5,{platformSlug:'c',platformName:'平台 C'})];
    const groups = Chart.groupPoints(rows,'artificialAnalysis');
    assert.deepEqual(Chart.cheapestModelLabels(groups).get(groups[0].key),[`${rows[0].modelName}\n平台 A、平台 B`,`${rows[3].modelName}\n平台 C`]);
    const options = {colors:{a:'#123456',b:'#654321'},colorMode:'vendor',tokenUnit:'M',compact:false};
    const datum = Chart.buildSeries(groups,{...options,selectedSlug:'b'}).find(s=>s.type==='scatter').data[0];
    assert.equal(datum.label.formatter,`${rows[1].modelName}\n平台 B`);
    assert.equal(datum.emphasis.label.formatter,`${rows[1].modelName}\n平台 B`);
});

test('offer details escape model names and notes, preserve every overlap option and show reference pricing semantics', () => {
    const rows = [point('a',1,5,{modelName:'<Preview>',relationLabel:'<Preview> [1M]',note:'<script>bad</script>',planStatus:'restricted'}),point('b',1,5)];
    const html=Chart.detailHtml(Chart.groupPoints(rows,'artificialAnalysis'),'a',{benchmark:'artificialAnalysis',tokenUnit:'yi',tooltipHtml:()=>'<div>价格依据</div>'});
    assert.match(html,/&lt;Preview&gt; \[1M\]/);
    assert.match(html,/&lt;script&gt;bad&lt;\/script&gt;/);
    assert.match(html,/共 2 个方案/);
    assert.match(html,/订阅参考折算/);
    assert.match(html,/购买受限/);
    assert.equal((html.match(/<option /g)||[]).length,2);
    assert.match(Chart.detailHtml([],null,{}),/点击价格点/);
});
