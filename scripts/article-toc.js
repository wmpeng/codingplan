(function () {
  'use strict';
  function init() {
    const links=[...document.querySelectorAll('.article-page .doc-toc a[href^="#"]')];
    const sections=[...new Set(links.map(link=>document.getElementById(decodeURIComponent(link.hash.slice(1)))).filter(Boolean))];
    if(!sections.length)return;
    let pending=false;
    function update() {
      pending=false;
      const edge=Math.max(113,(document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0)+48);
      let current=null;
      sections.forEach(section=>{if(section.getBoundingClientRect().top<=edge)current=section.id;});
      links.forEach(link=>{
        if(decodeURIComponent(link.hash.slice(1))===current)link.setAttribute('aria-current','location');
        else link.removeAttribute('aria-current');
      });
    }
    addEventListener('scroll',()=>{if(!pending){pending=true;requestAnimationFrame(update);}},{passive:true});
    addEventListener('resize',update);
    addEventListener('hashchange',update);
    links.forEach(link=>link.addEventListener('click',()=>{
      links.forEach(other=>{
        if(other.hash===link.hash)other.setAttribute('aria-current','location');
        else other.removeAttribute('aria-current');
      });
      const disclosure=link.closest('.article-toc-disclosure');
      if(disclosure){
        disclosure.open=false;
        const target=document.getElementById(decodeURIComponent(link.hash.slice(1)));
        if(target){
          if(!target.hasAttribute('tabindex')){
            target.setAttribute('tabindex','-1');
            target.addEventListener('blur',()=>target.removeAttribute('tabindex'),{once:true});
          }
          requestAnimationFrame(()=>target.focus({preventScroll:true}));
        }
      }
    }));
    update();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
