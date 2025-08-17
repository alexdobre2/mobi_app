/* ================================
   HabitLite — localStorage model
   ================================ */

const els = {
  tabs: {
    today: document.getElementById('tab-today'),
    habits: document.getElementById('tab-habits'),
    settings: document.getElementById('tab-settings'),
  },
  screens: {
    today: document.getElementById('view-today'),
    habits: document.getElementById('view-habits'),
    settings: document.getElementById('view-settings'),
  },
  todayDate: document.getElementById('todayDate'),
  todayList: document.getElementById('todayList'),
  todayEmpty: document.getElementById('todayEmpty'),
  habitsList: document.getElementById('habitsList'),
  habitsEmpty: document.getElementById('habitsEmpty'),
  btnAddHabit: document.getElementById('btnAddHabit'),
  // dialog
  habitDialog: document.getElementById('habitDialog'),
  habitForm: document.getElementById('habitForm'),
  habitDialogTitle: document.getElementById('habitDialogTitle'),
  habitName: document.getElementById('habitName'),
  habitId: document.getElementById('habitId'),
  chips: null, // assigned after dialog open
  // settings
  darkToggle: document.getElementById('darkToggle'),
  btnReset: document.getElementById('btnReset'),
};

const STORAGE_KEY = 'habitlite:v1';

const store = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { habits: [], theme: 'dark' };
      const parsed = JSON.parse(raw);
      if (!parsed.habits) parsed.habits = [];
      if (!parsed.theme) parsed.theme = 'dark';
      return parsed;
    } catch {
      return { habits: [], theme: 'dark' };
    }
  },
  save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },
};

let state = store.load();

/* Utilities */
const todayISO = () => new Date().toISOString().slice(0,10);
const fmtDateHuman = (d = new Date()) =>
  d.toLocaleDateString('ro-RO', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

const isoWeekday = (d = new Date()) => {
  const day = d.getDay(); // 0..6; 0=Sun
  return day === 0 ? 7 : day; // ISO: 1..7; 7=Sun
};

function applyTheme(){
  const isLight = state.theme === 'light';
  document.documentElement.classList.toggle('light', isLight);
  els.darkToggle.checked = !isLight;
}

/* Navigation */
function activate(tab){
  for(const [key, btn] of Object.entries(els.tabs)){
    const active = key === tab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  }
  for(const [key, screen] of Object.entries(els.screens)){
    screen.classList.toggle('active', key === tab);
  }
}

/* Rendering */
function render(){
  // Header date
  els.todayDate.textContent = fmtDateHuman();

  // Today list
  const weekday = isoWeekday();
  const today = todayISO();

  const todaysHabits = state.habits.filter(h => h.days.includes(weekday));
  els.todayEmpty.classList.toggle('hidden', todaysHabits.length !== 0);
  els.todayList.innerHTML = todaysHabits.map(h => {
    const done = h.done?.includes(today);
    return `
      <li class="card">
        <div class="habit">
          <div class="left">
            <button class="check ${done ? 'done' : ''}" data-action="toggleDone" data-id="${h.id}" aria-pressed="${done?'true':'false'}">
              ${done ? '✓' : ''}
            </button>
            <div>
              <div class="name">${escapeHtml(h.name)}</div>
              <div class="meta">${progressText(h)}</div>
            </div>
          </div>
          <div class="actions">
            <button class="action" data-action="edit" data-id="${h.id}" title="Editează">✎</button>
            <button class="action" data-action="delete" data-id="${h.id}" title="Șterge">🗑</button>
          </div>
        </div>
      </li>
    `;
  }).join('');

  // Habits list
  els.habitsEmpty.classList.toggle('hidden', state.habits.length !== 0);
  els.habitsList.innerHTML = state.habits.map(h => `
    <li class="card">
      <div class="row between">
        <div>
          <div class="name">${escapeHtml(h.name)}</div>
          <div class="meta">Zile: ${h.days.map(d=>DAY_LABELS[d]).join(', ') || 'neselectat'}</div>
        </div>
        <div class="actions">
          <button class="action" data-action="edit" data-id="${h.id}">Editează</button>
          <button class="action" data-action="delete" data-id="${h.id}">Șterge</button>
        </div>
      </div>
    </li>
  `).join('');
}

function progressText(h){
  const total = h.done?.length || 0;
  const last = h.done?.[h.done.length - 1];
  const lastTxt = last ? `Ultima: ${last}` : 'Încă nimic bifat';
  return `${total} realizări • ${lastTxt}`;
}

/* Actions */
function onClick(e){
  const target = e.target.closest('[data-action]');
  if(!target) return;

  const id = target.getAttribute('data-id');
  const action = target.getAttribute('data-action');

  if(action === 'toggleDone'){
    toggleDone(id);
  } else if(action === 'edit'){
    openDialog(id);
  } else if(action === 'delete'){
    deleteHabit(id);
  }
}

function toggleDone(id){
  const h = state.habits.find(x => x.id === id);
  if(!h) return;
  if(!Array.isArray(h.done)) h.done = [];
  const t = todayISO();
  const exists = h.done.includes(t);
  if(exists){
    h.done = h.done.filter(x => x !== t);
  }else{
    h.done.push(t);
  }
  store.save(state);
  render();
}

function deleteHabit(id){
  if(!confirm('Sigur vrei să ștergi acest obicei?')) return;
  state.habits = state.habits.filter(h => h.id !== id);
  store.save(state);
  render();
}

/* Dialog */
const DAY_LABELS = {1:'Lu',2:'Ma',3:'Mi',4:'Jo',5:'Vi',6:'Sâ',7:'Du'};

function openDialog(id){
  els.habitForm.reset();
  els.habitId.value = id || '';
  els.habitDialogTitle.textContent = id ? 'Editează obicei' : 'Adaugă obicei';

  // Set chips state
  const chipsContainer = els.habitForm.querySelector('.chips');
  chipsContainer.querySelectorAll('.chip').forEach(ch => ch.classList.remove('active'));
  let presetDays = [];
  if(id){
    const h = state.habits.find(x => x.id === id);
    if(h){
      els.habitName.value = h.name;
      presetDays = h.days || [];
    }
  }
  presetDays.forEach(d => chipsContainer.querySelector(`.chip[data-day="${d}"]`)?.classList.add('active'));

  els.habitDialog.showModal();

  if(!els.chips){
    els.chips = chipsContainer.querySelectorAll('.chip');
    els.chips.forEach(chip => {
      chip.addEventListener('click', () => chip.classList.toggle('active'));
    });
  }
}

function serializeDays(){
  return Array.from(els.habitForm.querySelectorAll('.chip.active'))
    .map(ch => Number(ch.dataset.day))
    .sort((a,b)=>a-b);
}

function upsertHabit(e){
  e.preventDefault();
  const id = els.habitId.value || cryptoRandomId();
  const name = els.habitName.value.trim();
  const days = serializeDays();

  if(name.length < 2){
    alert('Te rog adaugă un nume mai lung.');
    return;
  }
  if(days.length === 0){
    alert('Selectează cel puțin o zi.');
    return;
  }

  const idx = state.habits.findIndex(h => h.id === id);
  if(idx === -1){
    state.habits.push({ id, name, days, done: [] });
  }else{
    const existing = state.habits[idx];
    state.habits[idx] = { ...existing, name, days };
  }

  store.save(state);
  els.habitDialog.close();
  render();
}

/* Helpers */
function escapeHtml(s){
  return s.replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

function cryptoRandomId(){
  // Fallback dacă nu e disponibil crypto.getRandomValues
  if(window.crypto && crypto.getRandomValues){
    const arr = new Uint32Array(2);
    crypto.getRandomValues(arr);
    return [...arr].map(x=>x.toString(36)).join('');
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* Event wiring */
function init(){
  // Tabs
  els.tabs.today.addEventListener('click', () => activate('today'));
  els.tabs.habits.addEventListener('click', () => activate('habits'));
  els.tabs.settings.addEventListener('click', () => activate('settings'));

  // Add button
  els.btnAddHabit.addEventListener('click', () => openDialog());

  // Dialog submit/cancel
  els.habitForm.addEventListener('submit', upsertHabit);
  document.getElementById('habitCancel').addEventListener('click', () => els.habitDialog.close());

  // Global click handlers for list actions
  els.todayList.addEventListener('click', onClick);
  els.habitsList.addEventListener('click', onClick);

  // Settings
  els.darkToggle.addEventListener('change', () => {
    state.theme = els.darkToggle.checked ? 'dark' : 'light';
    store.save(state);
    applyTheme();
  });
  els.btnReset.addEventListener('click', () => {
    if(confirm('Sigur vrei să ștergi toate datele?')){
      state = { habits: [], theme: state.theme || 'dark' };
      store.save(state);
      render();
    }
  });

  // Initial UI
  els.todayDate.textContent = fmtDateHuman();
  applyTheme();
  render();
}

document.addEventListener('DOMContentLoaded', init);
