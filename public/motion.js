(() => {
 const body=document.body;
 if(!body.classList.contains('public-site'))return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),photos=new Set();
 const targets='.section-heading,.intro-editorial-copy,.intro-editorial-photo,.mood-card,.service-editorial,.membership-copy,.membership-window,.idea-card,.process-grid article,.faq>div,.closing,.information-grid article,.access-grid article,.experience-story-photo,.experience-story-copy,.plan-rows article,.planning-note,.member-account-band,.contact-form-panel,.contact-layout aside,.policy-copy section,.destination-card,.hotel-card,.place-card,.hospitality-photo,.hospitality-copy,.activity-tiles a,.activity-entry,.room-options article,.season-grid article,.newsletter-layout>div,#travel-updates';
 let frame=0,active=true;
 const revealObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('is-revealed');revealObserver.unobserve(entry.target);}},{threshold:.08,rootMargin:'0px 0px -25px 0px'}):null;
 const photoObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting)photos.add(entry.target);else photos.delete(entry.target);}schedule();},{rootMargin:'100px'}):null;
 function observeContent(){
  const elements=[...document.querySelectorAll(`main ${targets.split(',').join(',main ')}`)];
  for(const el of elements){if(el.hasAttribute('data-reveal'))continue;el.setAttribute('data-reveal','');const siblings=[...el.parentElement.children].filter(child=>child.matches(targets));el.style.setProperty('--reveal-delay',`${Math.min(siblings.indexOf(el)*70,210)}ms`);if(reduced.matches||!revealObserver)el.classList.add('is-revealed');else revealObserver.observe(el);}
  document.querySelectorAll('.image-parallax').forEach(el=>{if(!el.hasAttribute('data-parallax-ready')){el.setAttribute('data-parallax-ready','');photoObserver?.observe(el);}});
 }
 function update(){
  frame=0;if(!active)return;
  const y=window.scrollY,height=window.innerHeight,range=document.documentElement.scrollHeight-height;
  const positions=reduced.matches?[]:[...photos].map(el=>({el,rect:el.getBoundingClientRect()}));
  body.style.setProperty('--reading-progress',String(range>0?Math.min(1,Math.max(0,y/range)):0));
  body.classList.toggle('is-scrolled',y>30);
  const top=document.querySelector('.back-to-top');if(top)top.hidden=y<600;
  for(const {el,rect}of positions){const limit=Math.min(22,rect.height*.045),offset=Math.max(-limit,Math.min(limit,(height/2-rect.top-rect.height/2)*.055));el.style.setProperty('--parallax',`${offset.toFixed(1)}px`);}
 }
 function schedule(){if(active&&!frame)frame=requestAnimationFrame(update);}
 observeContent();body.classList.add('motion-ready');schedule();
 window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule,{passive:true});
 document.addEventListener('mayfair:catalog-rendered',()=>{observeContent();schedule();});
 document.querySelector('.back-to-top')?.addEventListener('click',()=>{window.scrollTo({top:0,behavior:reduced.matches?'auto':'smooth'});});
 reduced.addEventListener('change',()=>{if(reduced.matches){document.querySelectorAll('[data-reveal]').forEach(el=>el.classList.add('is-revealed'));document.querySelectorAll('.image-parallax').forEach(el=>el.style.removeProperty('--parallax'));}schedule();});
 window.addEventListener('pagehide',()=>{active=false;cancelAnimationFrame(frame);frame=0;revealObserver?.disconnect();photoObserver?.disconnect();photos.clear();});
 window.addEventListener('pageshow',event=>{if(event.persisted){active=true;document.querySelectorAll('[data-reveal]:not(.is-revealed)').forEach(el=>revealObserver?.observe(el));document.querySelectorAll('.image-parallax').forEach(el=>photoObserver?.observe(el));schedule();}});
})();
