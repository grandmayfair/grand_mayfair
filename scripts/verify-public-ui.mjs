import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Element {
  constructor(className) {
    this.attrs = new Map();
    this.events = new Map();
    this.styles = new Map();
    this.classes = new Set(className ? [className] : []);
    this.children = [];
    this.dataset = {};
    this.style = {setProperty: (key, value) => this.styles.set(key, value), removeProperty: key => this.styles.delete(key)};
    this.classList = {add: key => this.classes.add(key), contains: key => this.classes.has(key), toggle: (key, on) => on ? this.classes.add(key) : this.classes.delete(key)};
  }
  addEventListener(type, callback) { if (!this.events.has(type)) this.events.set(type, []); this.events.get(type).push(callback); }
  emit(type, event = {}) { for (const callback of this.events.get(type) || []) callback(event); }
  setAttribute(key, value) { this.attrs.set(key, value); }
  hasAttribute(key) { return this.attrs.has(key); }
  matches(selector) { return selector.split(',').some(part => this.classes.has(part.trim().replace(/^main\s+/, '').slice(1))); }
}

const motionSource = fs.readFileSync('public/motion.js', 'utf8');
function motionFixture(reducedInitially = false, observersAvailable = true) {
  const body = new Element(), document = new Element(), window = new Element(), preference = new Element(), top = new Element();
  body.classList.add('public-site');
  preference.matches = reducedInitially;
  document.body = body;
  document.documentElement = {scrollHeight: 3000};
  window.scrollY = 0;
  window.innerHeight = 600;
  window.scrollTo = () => {};
  const photo = new Element();
  photo.rect = {top: -10000, height: 300};
  photo.getBoundingClientRect = () => photo.rect;
  let content = [new Element('section-heading')];
  const setContent = elements => { content = elements; for (const el of content) el.parentElement = {children: content}; };
  setContent(content);
  document.querySelector = () => top;
  document.querySelectorAll = selector => {
    if (selector === '.image-parallax') return [photo];
    if (selector.startsWith('main ')) return content.filter(el => el.matches(selector));
    if (selector.includes('data-reveal')) return content.filter(el => el.hasAttribute('data-reveal') && (!selector.includes(':not') || !el.classList.contains('is-revealed')));
    throw Error(`Unexpected selector: ${selector}`);
  };
  const observers = [], frames = new Map();
  let sequence = 0;
  class Observer {
    constructor(callback) { this.callback = callback; this.observed = new Set(); observers.push(this); }
    observe(el) { this.observed.add(el); }
    unobserve(el) { this.observed.delete(el); }
    disconnect() { this.observed.clear(); }
  }
  vm.runInNewContext(motionSource, {
    document, window, matchMedia: () => preference,
    IntersectionObserver: observersAvailable ? Observer : undefined,
    requestAnimationFrame: callback => { const id = ++sequence; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id)
  });
  const flush = () => { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(); };
  return {body, document, window, preference, photo, top, observers, frames, flush, setContent, get content() { return content; }};
}

const motion = motionFixture();
const [reveals, parallax] = motion.observers;
assert.ok(motion.body.classList.contains('motion-ready'));
assert.ok(reveals.observed.has(motion.content[0]));
reveals.callback([{target: motion.content[0], isIntersecting: true}]);
assert.ok(motion.content[0].classList.contains('is-revealed'));
assert.equal(reveals.observed.size, 0);

for (let rerender = 0; rerender < 2; rerender++) {
  const cards = [new Element('destination-card'), new Element('destination-card')];
  motion.setContent(cards);
  motion.document.emit('mayfair:catalog-rendered');
  assert.ok(cards.every(card => card.hasAttribute('data-reveal') && reveals.observed.has(card)), 'Every late catalogue render must register its new cards');
  assert.equal(cards[1].styles.get('--reveal-delay'), '70ms');
  reveals.callback(cards.map(target => ({target, isIntersecting: true})));
  assert.ok(cards.every(card => card.classList.contains('is-revealed')));
}

parallax.callback([{target: motion.photo, isIntersecting: true}]);
motion.flush();
assert.equal(Number.parseFloat(motion.photo.styles.get('--parallax')), 13.5, 'A 300px photo must stay within its image overscan');
motion.photo.rect.top = 10000;
motion.window.emit('scroll');
motion.flush();
assert.equal(Number.parseFloat(motion.photo.styles.get('--parallax')), -13.5);

const pending = new Element('section-heading');
motion.setContent([pending]);
motion.document.emit('mayfair:catalog-rendered');
motion.preference.matches = true;
motion.preference.emit('change');
motion.flush();
assert.ok(pending.classList.contains('is-revealed'), 'Changing to reduced motion must reveal pending content');
assert.equal(motion.photo.styles.has('--parallax'), false);
const reducedCard = new Element('destination-card');
motion.setContent([reducedCard]);
motion.document.emit('mayfair:catalog-rendered');
assert.ok(reducedCard.classList.contains('is-revealed'), 'Late cards must remain visible with reduced motion');
for (const fixture of [motionFixture(true), motionFixture(false, false)]) {
  assert.ok(fixture.content[0].classList.contains('is-revealed'), 'Initial reduced motion or missing observers must not hide content');
}

motion.preference.matches = false;
motion.preference.emit('change');
const restoredCard = new Element('destination-card');
motion.setContent([restoredCard]);
motion.document.emit('mayfair:catalog-rendered');
motion.window.emit('pagehide');
assert.equal(motion.frames.size, 0);
assert.equal(reveals.observed.size, 0);
assert.equal(parallax.observed.size, 0);
motion.window.emit('scroll');
assert.equal(motion.frames.size, 0, 'A suspended page must not schedule animation frames');
motion.window.emit('pageshow', {persisted: true});
assert.ok(reveals.observed.has(restoredCard), 'BF-cache restoration must reobserve pending content');
assert.ok(parallax.observed.has(motion.photo));
parallax.callback([{target: motion.photo, isIntersecting: true}]);
motion.flush();
assert.equal(Number.parseFloat(motion.photo.styles.get('--parallax')), -13.5);

function formFixture() {
  const form = new Element();
  form.elements = {};
  for (const name of ['name', 'email', 'phone', 'interest', 'destination', 'checkin', 'checkout', 'guests', 'style', 'notes']) {
    const field = new Element();
    field.defaultValue = name === 'guests' ? '2' : name === 'interest' ? 'Holiday' : name === 'style' ? 'Relaxed and unhurried' : '';
    field.value = field.defaultValue;
    field.validationMessage = '';
    field.setCustomValidity = message => field.validationMessage = message;
    form.elements[name] = field;
  }
  form.elements.interest.options = ['Holiday', 'Membership', 'Stays', 'Tailored holiday', 'Travel assistance', 'Booking request', 'Member support'].map(value => ({value}));
  form.reset = () => { for (const field of Object.values(form.elements)) field.value = field.defaultValue; };
  form.querySelector = selector => selector === '.form-status' ? form.status : selector.includes('checkin') ? form.elements.checkin : selector.includes('checkout') ? form.elements.checkout : null;
  form.status = new Element();
  form.reportValidity = () => Object.values(form.elements).every(field => !field.validationMessage && (!field.value || !field.min || field.value >= field.min));
  return form;
}

const appSource = fs.readFileSync('public/app.js', 'utf8');
const start = appSource.indexOf('const dateISO='), end = appSource.indexOf("$$('[data-enquiry-form]')");
assert.ok(start >= 0 && end > start, 'Planner source boundaries must exist');
const planner = formFixture(), search = formFixture(), contact = formFixture(), dialog = new Element(), success = new Element(), document = new Element();
dialog.querySelector = selector => selector === 'form' ? planner : success;
dialog.showModal = () => dialog.open = true;
const selectors = {'#planner-dialog': dialog, '#holiday-search': search, '#enquiry [data-enquiry-form]': contact};
const context = vm.createContext({document, account: {name: 'Traveller', email: 'traveller@example.test', phone: '12345'}, selectedDestination: null, $: selector => selectors[selector] || null});
vm.runInContext(appSource.slice(start, end) + '\nglobalThis.ui={setupDates,openPlanner,dateSyncs};', context);
context.ui.dateSyncs.set(planner, context.ui.setupDates(planner));

planner.elements.checkin.value = search.elements.checkin.value;
planner.elements.checkin.emit('change');
assert.notEqual(planner.elements.checkout.validationMessage, '');
context.ui.openPlanner();
assert.equal(planner.elements.checkin.value, '');
assert.equal(planner.elements.checkout.value, '');
assert.equal(planner.elements.checkout.validationMessage, '', 'Planner reset must clear stale date validity');
assert.ok(planner.reportValidity());
assert.equal(planner.elements.name.value, 'Traveller');

function click(dataset) {
  const target = {dataset, closest: selector => selector.split(',').some(part => {
    const key = part.slice(6, -1).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    return key in dataset;
  }) ? target : null};
  document.emit('click', {target});
}
click({plan: 'Tailored holiday', place: 'Maldives', style: 'Culture and discovery'});
assert.equal(planner.elements.interest.value, 'Tailored holiday');
assert.equal(planner.elements.destination.value, 'Maldives');
assert.equal(planner.elements.style.value, 'Culture and discovery');
click({formInterest: 'Membership'});
assert.equal(contact.elements.interest.value, 'Membership');

search.elements.destination.value = 'Gulmarg';
search.elements.guests.value = '4';
const expectedDates = [search.elements.checkin.value, search.elements.checkout.value];
search.emit('submit', {preventDefault() {}});
assert.equal(planner.elements.destination.value, 'Gulmarg');
assert.equal(planner.elements.guests.value, '4', 'Search travellers must survive planner prefill');
assert.deepEqual([planner.elements.checkin.value, planner.elements.checkout.value], expectedDates);
assert.equal(planner.elements.checkout.validationMessage, '');

click({plan: 'Booking request', place: 'Dubai', property: 'Raffles Dubai'});
assert.equal(planner.elements.interest.value, 'Booking request');
assert.equal(planner.elements.destination.value, 'Dubai');
assert.equal(planner.elements.notes.value, 'Preferred property: Raffles Dubai', 'Property enquiries must retain the selected hotel');

console.log('Public UI verified: late catalogue reveals, reduced motion, 300px parallax cap, BF-cache recovery, date reset, and property/place/style/guest prefills.');
