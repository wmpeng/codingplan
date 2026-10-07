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
home=replace(home,'FEATURED_PLATFORMS',preset.platformSlugs.map(slug=>P.buildPlatformCardHtml(ctx.platformBySlug.get(slug),plans,{supportedModels:E.platformModels(ctx,slug),hasApiPlan:E.buildApiPricingGroups(ctx,slug).length>0,sanitizeUrl:C.url})).join('\n'));
home=replace(home,'FEATURED_MODELS',C.modelGroups(preset,ctx));
home=replace(home,'FEATURED_TABLES','<div class="usage-preset-grid usage-preset-grid--multi">'+preset.groups.map(group=>M.presetComparisonTableHtml(group,C.points(ctx,config),'yi','featured',{platformSlugs:preset.platformSlugs,limit:6})).join('')+'</div>');
const feedback=config.feedback || {}, community=config.community || {};
const group=feedback.group || {};
const groupUrl=esc(C.url(feedback.feedbackEntry?.url));
const qrPath=group.qrImage || community.qrcode || '';
const groupQr=esc(C.url(qrPath.startsWith('assets/') ? '/'+qrPath : qrPath));
const groupAlt=esc(group.qrAlt || community.qrAlt || '飞书群二维码');
const groupTitle=esc(group.title || '飞书讨论群');
const inviteDescription=esc((community.highlights || []).join('，')+'，交流实测体验。');
home=replace(home,'HOME_COMMUNITY',`<aside class="community-invite" aria-label="加入选型交流群"><div><h2>一起选好模型、好套餐</h2><p>${inviteDescription}</p><a class="community-join" href="${groupUrl}" target="_blank" rel="noopener noreferrer">加入飞书群 ↗</a></div><img src="${groupQr}" alt="${groupAlt}" width="96" height="96"></aside>`);
const closeIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
home=replace(home,'COMMUNITY_FLOAT',`<div class="community-float" id="communityFloat" hidden>
  <button type="button" class="community-float-trigger" data-community-open aria-expanded="false" aria-controls="communityDialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 14a4 4 0 0 1-4 4H9l-6 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 8h8M8 12h5"/></svg><span><strong><span class="community-float-desktop">选型交流</span><span class="community-float-mobile">加群交流</span></strong><small>加入飞书群</small></span></button>
  <button type="button" class="community-float-dismiss" data-community-dismiss aria-label="本次浏览不再显示加群入口">${closeIcon}</button>
</div>
<dialog class="community-dialog" id="communityDialog" aria-labelledby="communityDialogTitle" aria-describedby="communityDialogDescription">
  <header><h2 id="communityDialogTitle">${groupTitle}</h2><button type="button" class="community-dialog-close" data-community-close aria-label="关闭加群面板">${closeIcon}</button></header>
  <p id="communityDialogDescription">${inviteDescription}</p>
  <img src="${groupQr}" alt="${groupAlt}" width="180" height="180" loading="lazy">
  <p class="community-qr-hint">扫码加入，或点击下方按钮打开飞书</p>
  <a class="community-join" href="${groupUrl}" target="_blank" rel="noopener noreferrer">打开飞书加入 ↗</a>
</dialog>`);
const meta=`<div class="home-meta"><div><details><summary>收录范围与数据口径 · ${esc(config.header.updateDate)}</summary><p>${esc(E.headerSubtitle(ctx,'').split('<br>')[0])}</p><ul>${(config.notes || []).map(x=>'<li>'+esc(x)+'</li>').join('')}</ul></details><details id="updateHistory"><summary>更新历史</summary><ul>${(config.updates || []).map(x=>'<li><strong>'+esc(x.date)+'</strong><ul>'+x.items.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul></li>').join('')}</ul></details></div><aside class="community-panel" id="communityFooter"><img src="${groupQr}" alt="${groupAlt}" loading="lazy" width="100" height="100"><div><h3>${esc(community.title || '交流与反馈')}</h3><p>${esc(community.description || '')}</p><p><a class="community-join" href="${esc(C.url(feedback.feedbackEntry?.url))}" target="_blank" rel="noopener noreferrer">${esc(feedback.feedbackEntry?.text || '加入讨论群')} ↗</a></p><a href="${esc(C.url(feedback.dataIssue?.url))}" target="_blank" rel="noopener noreferrer">${esc(feedback.dataIssue?.text || '反馈问题')} ↗</a></div></aside></div>`;
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
