// Historical homepage views now open their complete tools; retain explicit entity links.
(function(){const p=new URLSearchParams(location.search),routes={platforms:'/platforms/',usage:'/pricing/',plans:'/plans/',monitor:'/monitor/'};const route=routes[p.get('view')];if(route){p.delete('view');location.replace(route+(p.size?'?'+p.toString():'')+location.hash);}})();
