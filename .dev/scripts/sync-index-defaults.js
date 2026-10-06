const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = name => JSON.parse(fs.readFileSync(path.join(root,name+'.json'),'utf8'));
const E = require(path.join(root,'scripts/entity-data.js'));
const C = require(path.join(root,'scripts/featured-catalog.js'));
const M = require(path.join(root,'scripts/model-comparison.js'));
const P = require(path.join(root,'scripts/platform-catalog.js'));
const config = read('config'), preset = read('model-comparison-presets');
const ctx = E.buildContext(read('platforms'),read('plans'),read('models'),read('plan-models'));
C.validate(preset,ctx);
const esc = C.esc;
const check = process.argv.includes('--check');
function replace(html,id,body){
 const re=new RegExp('(<!-- '+id+'_START -->)[\\s\\S]*?(<!-- '+id+'_END -->)');
 if(!re.test(html))throw new Error('缺少生成边界 '+id);
 return html.replace(re,(_,start,end)=>start+'\n'+body+'\n'+end);
}
function write(file,html){html=html.replace(/\r\n/g,'\n').replace(/[ \t]+$/gm,'');const target=path.join(root,file);if(fs.readFileSync(target,'utf8')===html)return;if(check)throw new Error(file+' 需要重新生成');fs.writeFileSync(target,html,'utf8');}
const plans=E.buildPlanCatalog(ctx);
let home=fs.readFileSync(path.join(root,'index.html'),'utf8');
home=home.replace(/(<p id="catalogSummary">)[\s\S]*?(<\/p>)/,(_,a,b)=>a+esc(E.headerSubtitle(ctx,'').split('<br>')[0])+b);
home=replace(home,'FEATURED_PLATFORMS',preset.platformSlugs.map(slug=>P.buildPlatformCardHtml(ctx.platformBySlug.get(slug),plans,{supportedModels:E.platformModels(ctx,slug),hasApiPlan:E.buildApiPricingGroups(ctx,slug).length>0,sanitizeUrl:C.url})).join('\n'));
home=replace(home,'FEATURED_MODELS',C.modelGroups(preset,ctx));
home=replace(home,'FEATURED_TABLES','<div class="usage-preset-grid usage-preset-grid--multi">'+preset.groups.map(group=>M.presetComparisonTableHtml(group,C.points(ctx,config),'yi','featured',{platformSlugs:preset.platformSlugs,limit:6})).join('')+'</div>');
const feedback=config.feedback || {}, community=config.community || {};
const meta=`<div class="home-meta"><div><details><summary>收录范围与数据口径 · ${esc(config.header.updateDate)}</summary><p>${esc(E.headerSubtitle(ctx,'').split('<br>')[0])}</p><ul>${(config.notes || []).map(x=>'<li>'+esc(x)+'</li>').join('')}</ul></details><details><summary>更新记录</summary><ul>${(config.updates || []).map(x=>'<li><strong>'+esc(x.date)+'</strong><ul>'+x.items.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul></li>').join('')}</ul></details></div><aside class="community-panel"><img src="${esc(community.qrcode || '')}" alt="${esc(community.qrAlt || '用户群二维码')}" loading="lazy" width="100" height="100"><div><h3>${esc(community.title || '交流与反馈')}</h3><p>${esc(community.description || '')}</p><p><a href="${esc(C.url(feedback.feedbackEntry?.url))}" target="_blank" rel="noopener noreferrer">${esc(feedback.feedbackEntry?.text || '加入讨论群')} ↗</a></p><a href="${esc(C.url(feedback.dataIssue?.url))}" target="_blank" rel="noopener noreferrer">${esc(feedback.dataIssue?.text || '反馈问题')} ↗</a></div></aside></div>`;
home=replace(home,'HOME_META',meta);
write('index.html',home);
let models=fs.readFileSync(path.join(root,'models/index.html'),'utf8');
models=replace(models,'MODEL_HIGHLIGHTS',C.modelGroups(preset,ctx));
const sorted=[...ctx.models].sort((a,b)=>(C.score(b,'artificialAnalysis')??-Infinity)-(C.score(a,'artificialAnalysis')??-Infinity)||a.name.localeCompare(b.name));
models=replace(models,'MODEL_DIRECTORY',sorted.map(m=>C.modelCard(m,ctx)).join('\n'));
write('models/index.html',models);
const generator=path.resolve(root,'../scripts/codingplan/platform_pages/generate.js');
if(fs.existsSync(generator))require(generator).generate({check});
else throw new Error('请在维护仓库执行完整生成与检查');
console.log('首页精选与模型目录生成'+(check?'检查通过':'完成'));
