'use strict';
const menuButton = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('#main-nav');
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  mainNav.classList.toggle('open', open);
});
mainNav.addEventListener('click', (event) => {
  const targetLink = event.target.closest('a');
  if (!targetLink) return;
  mainNav.querySelectorAll('a').forEach(link => link.classList.toggle('active', link === targetLink));
  mainNav.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open navigation');
});

const destinations = {
  Maldives: {title:'Maldives',category:'ISLAND ESCAPES · INDIAN OCEAN',image:'assets/island.jpg',alt:'Overwater villas in the Maldives',region:'international',duration:'Suggested pace · 4–6 nights',style:'Relaxation · Ocean experiences',description:'Trade a full calendar for an open horizon. Think mornings over the lagoon, quiet afternoons on the sand, and time to enjoy the ocean at your own pace.',highlights:['A stay by the lagoon, with time to slow down','Snorkelling and ocean experiences to discuss with your advisor','A sunset evening and a little space for doing nothing']},
  Himalayas: {title:'The Himalayas',category:'MOUNTAIN RETREATS · HIMACHAL PRADESH',image:'assets/mountains.jpg',alt:'Forest and layered mountains in Fagu, Himachal Pradesh',region:'india',duration:'Suggested pace · 3–5 nights',style:'Nature · Gentle exploration',description:'Wake up to mountain air and layers of green. Build a slower holiday around forest paths, local flavours, and a view that makes you linger a little longer.',highlights:['A peaceful mountain base in Himachal Pradesh','Time for walks, viewpoints, and local discoveries','Unhurried mornings and a flexible itinerary']},
  Jaipur: {title:'Jaipur',category:'HERITAGE JOURNEYS · RAJASTHAN',image:'assets/jaipur.jpg',alt:'Hawa Mahal in Jaipur',region:'india',duration:'Suggested pace · 2–4 nights',style:'Heritage · Culture · Cuisine',description:'A city of intricate façades, colourful markets, and stories around every corner. Let Jaipur’s architecture and living traditions set the pace of your escape.',highlights:['Architecture and heritage around the Pink City','Local markets, craft, and regional flavours','A relaxed city itinerary with room for discovery']}
};
let selectedDestination = 'Maldives';
let briefText = '';
const searchForm = document.querySelector('#holiday-search');
const plannerDialog = document.querySelector('#planner-dialog');
const plannerForm = document.querySelector('#planner-form');
const detailDialog = document.querySelector('#destination-dialog');
const briefResult = document.querySelector('#brief-result');
const interestSelect = document.querySelector('#plan-interest');
const placeInput = document.querySelector('#plan-place');
const localISO = date => [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
const addDays = (iso, days) => {const [year,month,day]=iso.split('-').map(Number);return localISO(new Date(year,month-1,day+days));};
const today = localISO(new Date());
const proposedStart = addDays(today,14);

function dateError(start, end) {
  if (!start || !end) return 'Choose your check-in and check-out dates.';
  if (start < today) return 'Choose a check-in date from today onwards.';
  if (end <= start) return 'Check-out must be after check-in.';
  return '';
}
function wireDates(start, end) {
  start.min=today;
  start.value=proposedStart;
  end.value=addDays(proposedStart,5);
  function sync() {end.min=addDays(start.value || today,1);end.setCustomValidity(dateError(start.value,end.value));}
  start.addEventListener('input',sync);
  end.addEventListener('input',sync);
  sync();
}
wireDates(document.querySelector('#search-checkin'),document.querySelector('#search-checkout'));
wireDates(document.querySelector('#plan-checkin'),document.querySelector('#plan-checkout'));

document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event => {if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
});
function filterDestinations(region) {
  if (!['all','india','international'].includes(region)) throw new Error('Choose all, india, or international.');
  document.querySelectorAll('[data-filter]').forEach(button=>{const active=button.dataset.filter===region;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));});
  let count=0;
  document.querySelectorAll('.destination-card').forEach(card=>{card.hidden=region!=='all'&&card.dataset.region!==region;if(!card.hidden)count++;});
  document.querySelector('#destination-count').textContent=`${count} ${count===1?'place':'places'} to inspire you`;
  return {region,destinations:Object.entries(destinations).filter(([,d])=>region==='all'||d.region===region).map(([name])=>name)};
}
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>filterDestinations(button.dataset.filter)));

function showDestination(name) {
  const destination=destinations[name];
  if (!destination) throw new Error('Choose a destination from the collection.');
  selectedDestination=name;
  document.querySelector('#destination-title').textContent=destination.title;
  document.querySelector('#detail-category').textContent=destination.category;
  document.querySelector('#detail-description').textContent=destination.description;
  document.querySelector('#detail-image').src=destination.image;
  document.querySelector('#detail-image').alt=destination.alt;
  document.querySelector('#detail-duration').textContent=destination.duration;
  document.querySelector('#detail-style').textContent=destination.style;
  const list=document.querySelector('#detail-highlights');list.replaceChildren();
  destination.highlights.forEach(text=>{const li=document.createElement('li');li.textContent=text;list.append(li);});
  if(!detailDialog.open)detailDialog.showModal();
  return {destination:name,status:'details_open'};
}
document.querySelectorAll('[data-destination]').forEach(button=>button.addEventListener('click',()=>showDestination(button.dataset.destination)));
function openPlanner(options={}) {
  const interest=options.interest || 'Holiday';
  const allowedInterests=Array.from(interestSelect.options,option=>option.value);
  if(!allowedInterests.includes(interest))throw new Error('Choose a supported travel interest.');
  if(detailDialog.open)detailDialog.close();
  interestSelect.value=interest;
  placeInput.value=options.destination ?? document.querySelector('#search-destination').value;
  placeInput.required=interest!=='Membership';
  const start=options.checkin || document.querySelector('#search-checkin').value;
  const end=options.checkout || document.querySelector('#search-checkout').value;
  document.querySelector('#plan-checkin').value=start;
  document.querySelector('#plan-checkout').value=end;
  document.querySelector('#plan-checkout').min=addDays(start||today,1);
  document.querySelector('#plan-checkout').setCustomValidity(dateError(start,end));
  document.querySelector('#plan-guests').value=options.guests || document.querySelector('#search-guests').value;
  plannerForm.hidden=false;briefResult.hidden=true;document.querySelector('.planner-intro').hidden=false;
  document.querySelector('#brief-status').textContent='';
  if(!plannerDialog.open)plannerDialog.showModal();
  return {status:'planner_open',interest,destination:placeInput.value};
}
interestSelect.addEventListener('change',()=>placeInput.required=interestSelect.value!=='Membership');
document.querySelectorAll('[data-plan]').forEach(button=>button.addEventListener('click',()=>openPlanner({interest:button.dataset.plan})));
document.querySelector('#plan-destination').addEventListener('click',()=>openPlanner({destination:selectedDestination}));
searchForm.addEventListener('submit',event=>{event.preventDefault();if(searchForm.reportValidity())openPlanner({destination:document.querySelector('#search-destination').value || 'Open to inspiration'});});
const displayDate = iso => new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${iso}T12:00:00`));
plannerForm.addEventListener('submit',event=>{
  event.preventDefault();
  const data=Object.fromEntries(new FormData(plannerForm));
  const error=dateError(data.checkin,data.checkout);
  document.querySelector('#plan-checkout').setCustomValidity(error);
  if(!plannerForm.reportValidity())return;
  briefText=`GRAND MAYFAIR\nHoliday planning brief\n\nDestination: ${data.destination.trim() || 'Open to inspiration'}\nInterest: ${data.interest}\nDates: ${displayDate(data.checkin)} – ${displayDate(data.checkout)}\nTravellers: ${data.guests==='5'?'5+':data.guests}\nTravel style: ${data.style}${data.notes.trim()?`\n\nMy wishes:\n${data.notes.trim()}`:''}\n\nShare this brief with your travel advisor to discuss stay options, availability, pricing, and booking terms.`;
  document.querySelector('#brief-text').textContent=briefText;
  plannerForm.hidden=true;briefResult.hidden=false;document.querySelector('.planner-intro').hidden=true;
  document.querySelector('#download-brief').focus();
});
document.querySelector('#edit-brief').addEventListener('click',()=>{plannerForm.hidden=false;briefResult.hidden=true;document.querySelector('.planner-intro').hidden=false;placeInput.focus();});
document.querySelector('#download-brief').addEventListener('click',()=>{
  if(!briefText)return;
  const url=URL.createObjectURL(new Blob([briefText],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='Grand-Mayfair-Holiday-Brief.txt';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  document.querySelector('#brief-status').textContent='Your brief is ready to save.';
});
document.querySelector('#copy-brief').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(briefText);document.querySelector('#brief-status').textContent='Copied. Your brief is ready to share.';}
  catch{document.querySelector('#brief-status').textContent='Copy is unavailable in this browser. Download your brief instead.';}
});
document.querySelector('#credits-open').addEventListener('click',()=>document.querySelector('#credits-dialog').showModal());

document.querySelectorAll('[data-slide]').forEach(button=>button.addEventListener('click',()=>{
  const index=Number(button.dataset.slide);const destination=Object.values(destinations)[index];
  const heroImage=document.querySelector('.hero-image');heroImage.src=destination.image;heroImage.alt=destination.alt;
  document.querySelector('.hero-caption strong').textContent=['Maldives, Indian Ocean','Fagu, Himachal Pradesh','Jaipur, Rajasthan'][index];
  document.querySelector('.hero-index').replaceChildren(document.createTextNode(`0${index+1} `),Object.assign(document.createElement('span'),{textContent:'/'}),document.createTextNode(' 03'));
  document.querySelectorAll('[data-slide]').forEach(item=>{const selected=item===button;item.classList.toggle('selected',selected);item.setAttribute('aria-pressed',String(selected));});
}));

// shortcut: the brief stays in this tab; connect the client's enquiry service when contact details are supplied.
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();
  const tools=[
    {name:'filter_destinations',title:'Filter Grand Mayfair destinations',description:'Show India, international, or all destination inspiration in the visible collection.',inputSchema:{type:'object',properties:{region:{type:'string',enum:['all','india','international']}},required:['region'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||Object.keys(input).some(key=>key!=='region'))throw new Error('Provide a destination region only.');return filterDestinations(input.region);}},
    {name:'start_holiday_planning',title:'Start a holiday brief',description:'Open the visible holiday planner for a collection destination. This starts planning; it does not submit an enquiry or create a booking.',inputSchema:{type:'object',properties:{destination:{type:'string',enum:['Maldives','Himalayas','Jaipur']}},required:['destination'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||Object.keys(input).some(key=>key!=='destination')||!Object.hasOwn(destinations,input.destination))throw new Error('Choose Maldives, Himalayas, or Jaipur.');return openPlanner({destination:input.destination});}}
  ];
  tools.forEach(tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}});
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
