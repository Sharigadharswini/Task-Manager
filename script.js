
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
function uid(){ return 't_'+Math.random().toString(36).slice(2,9); }

function format12FromParts(hour12, min, ampm){
  let hh = hour12 % 12;
  if(ampm === 'PM') hh += 12;
  const d = new Date();
  d.setHours(hh, min, 0, 0);
  return d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit', hour12:true});
}
function format12(iso){
  if(!iso) return '—';
  const d = new Date(iso); if(isNaN(d)) return '—';
  return d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit', hour12:true});
}
function formatDateFriendly(iso){
  if(!iso) return '—';
  const d = new Date(iso); return d.toLocaleDateString([], {month:'short', day:'numeric', year:'numeric'});
}


let tasks = [];
function load(){ try{ const raw = localStorage.getItem('taskflow_tasks'); tasks = raw ? JSON.parse(raw) : []; }catch(e){ tasks = []; } }
function save(){ try{ localStorage.setItem('taskflow_tasks', JSON.stringify(tasks)); }catch(e){} render(); updateStats(); }

const taskListEl = $('#taskList');
const addBtn = $('#addBtn'), clearBtn = $('#clearBtn'), setTimeBtn = $('#setTimeBtn');
const titleEl = $('#title'), descEl = $('#desc'), dueDateEl = $('#dueDate');
const assigneeEl = $('#assignee'); 
const selectedTimeDisplay = $('#selectedTimeDisplay');
const chips = $$('.chip');
const statTotal = $('#statTotal'), statCompleted = $('#statCompleted'), progressText = $('#progressText');


const reminderChk = document.getElementById('reminderChk');

const clockPopup = $('#clockPopup');
const clockHour = $('#clockHour'), clockMin = $('#clockMin'), ampmAM = $('#ampmAM'), ampmPM = $('#ampmPM'), clockSave = $('#clockSave'), clockCancel = $('#clockCancel');

let clockMode = null; 
let currentEditingTaskId = null;


let tempSelected = null; 
function placePopupNearRect(rect, popupEl){
  const pad = 12;
  const popupW = Math.max(popupEl.offsetWidth || 320, 300);
  const popupH = Math.max(popupEl.offsetHeight || 180);
  let left = rect.left;
  if(left + popupW > window.innerWidth - pad) left = window.innerWidth - popupW - pad;
  if(left < pad) left = pad;
  let top = rect.bottom + 8;
  if(top + popupH > window.innerHeight - pad){
    top = rect.top - popupH - 8;
    if(top < pad) top = pad;
  }
  popupEl.style.left = left + 'px';
  popupEl.style.top = top + 'px';
}


function openClock(mode, anchorEl=null, task=null){
  clockMode = mode;
  currentEditingTaskId = task ? task.id : null;
  clockPopup.style.display = 'flex';
  clockPopup.style.left = '0px'; clockPopup.style.top = '0px';
  clockPopup.setAttribute('aria-hidden','false');
  const anchor = anchorEl || setTimeBtn;
  placePopupNearRect(anchor.getBoundingClientRect(), clockPopup);
  let base;
  if(mode === 'edit' && task && task.due) base = new Date(task.due);
  else if(mode === 'add' && tempSelected){
    let hh = tempSelected.hour % 12; if(tempSelected.ampm === 'PM') hh += 12;
    base = new Date(); base.setHours(hh, tempSelected.min, 0, 0);
  } else base = new Date();
  let hr = base.getHours();
  const ampm = hr >= 12 ? 'PM' : 'AM';
  let hh = hr % 12; if(hh === 0) hh = 12;
  clockHour.value = String(hh);
  clockMin.value = String(base.getMinutes()).padStart(2,'0');
  setAMPMVisual(ampm);
}

function closeClock(){ clockPopup.style.display = 'none'; clockPopup.setAttribute('aria-hidden','true'); clockMode = null; currentEditingTaskId = null; }

function setAMPMVisual(which){
  if(which === 'AM'){ ampmAM.classList.add('active'); ampmPM.classList.remove('active'); }
  else { ampmPM.classList.add('active'); ampmAM.classList.remove('active'); }
}
if(ampmAM) ampmAM.addEventListener('click', ()=> setAMPMVisual('AM'));
if(ampmPM) ampmPM.addEventListener('click', ()=> setAMPMVisual('PM'));
if(clockCancel) clockCancel.addEventListener('click', ()=> closeClock());

if(clockSave) clockSave.addEventListener('click', ()=>{
  const h = parseInt(clockHour.value||'0'), m = parseInt(clockMin.value||'0');
  if(isNaN(h) || isNaN(m) || h < 1 || h > 12 || m < 0 || m > 59){ alert('Enter valid 12-hour time'); return; }
  const ampm = ampmAM.classList.contains('active') ? 'AM' : 'PM';

  if(clockMode === 'add'){
    tempSelected = { hour: h, min: m, ampm };
    const display = format12FromParts(h, m, ampm);
    const dateVal = dueDateEl.value;
    selectedTimeDisplay.textContent = dateVal ? (display + ' • ' + new Date(dateVal).toLocaleDateString()) : (display + ' • no date');
    try{
      if(dueDateEl && typeof dueDateEl.showPicker === 'function'){ dueDateEl.showPicker(); }
      else if(dueDateEl){ dueDateEl.focus(); }
    }catch(e){ if(dueDateEl) dueDateEl.focus(); }
    closeClock();
    return;
  }

  if(clockMode === 'edit' && currentEditingTaskId){
    const task = tasks.find(t=>t.id === currentEditingTaskId);
    if(!task){ closeClock(); return; }
    const base = task.due ? new Date(task.due) : new Date();
    let hh24 = h % 12; if(ampm === 'PM') hh24 += 12;
    const newDt = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hh24, m, 0);
    task.due = newDt.toISOString();
    save();
    closeClock();
    return;
  }
  closeClock();
});

document.addEventListener('click', (e)=>{
  if(!clockPopup.contains(e.target) && e.target !== setTimeBtn && !e.target.classList.contains('due-label')) closeClock();
});


function updateStats(){
  statTotal.innerHTML = `${tasks.length}<br><small style="font-weight:400">Total</small>`;
  const done = tasks.filter(t=>t.completed).length;
  statCompleted.innerHTML = `${done}<br><small style="font-weight:400">Completed</small>`;
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  progressText.textContent = pct + '% done';

  updateFilterCounts();
}

function updateFilterCounts(){
  const total = tasks.length;
  const pending = tasks.filter(t=>!t.completed).length;
  const completed = tasks.filter(t=>t.completed).length;

  chips.forEach(ch=>{
    const f = ch.dataset.filter;
    if(!f) return;
    if(f === 'all') ch.innerHTML = `All <span class="count">(${total})</span>`;
    else if(f === 'pending') ch.innerHTML = `Pending <span class="count">(${pending})</span>`;
    else if(f === 'completed') ch.innerHTML = `Completed <span class="count">(${completed})</span>`;
  });
}

function createIcon(svgPath){
  const ns='http://www.w3.org/2000/svg';
  const s=document.createElementNS(ns,'svg');
  s.setAttribute('viewBox','0 0 24 24');
  s.setAttribute('width','18'); s.setAttribute('height','18');
  s.innerHTML = svgPath;
  return s;
}
const ICONS = {
  check: '<path d="M9 16.2l-3.5-3.5 1.4-1.4L9 13.4l7.1-7.1 1.4 1.4z"/>',
  edit: '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>',
  trash: '<path d="M6 19c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>'
};

function createTaskCard(t) {
  const el = document.createElement('article');
  el.className = 'task-card' + (t.completed ? ' completed' : '');
  el.dataset.id = t.id;

  const content = document.createElement('div');
  content.className = 'content';

  // --- Top row: title + badge
  const top = document.createElement('div');
  top.className = 'header-row';

  const title = document.createElement('div');
  title.className = 'task-title';
  title.textContent = t.title;

top.appendChild(title); 

if(!t.completed){
  const badge = document.createElement('div');
  badge.className = t.reminder ? 'badge badge-reminder' : 'badge badge-open';
  badge.textContent = t.reminder ? 'REMINDER' : 'OPEN';
  top.appendChild(badge);
}

content.appendChild(top);


  // --- Optional description
  if (t.desc) {
    const desc = document.createElement('div');
    desc.className = 'task-desc';
    desc.textContent = t.desc;
    content.appendChild(desc);
  }

  // --- Optional assignee
  if (t.assignee) {
    const assigneeDiv = document.createElement('div');
    assigneeDiv.className = 'task-assignee';
    assigneeDiv.textContent = 'Assignee: ' + t.assignee;
    content.appendChild(assigneeDiv);
  }

  // --- Meta (due + added date)
  const meta = document.createElement('div');
  meta.className = 'task-meta';

  const dueLabel = document.createElement('span');
  dueLabel.className = 'due-label';
  dueLabel.textContent = 'Due: ' + (t.due ? format12(t.due) + ' • ' + formatDateFriendly(t.due) : '—');

  if (t.isEditing) {
    dueLabel.title = 'Click to edit time';
    dueLabel.style.cursor = 'pointer';
    dueLabel.addEventListener('click', (ev) => {
      ev.stopPropagation();
      openClock('edit', el, t);
    });
  }

  meta.appendChild(dueLabel);

  const added = document.createElement('div');
  added.className = 'added-date';
  added.textContent = 'Added: ' + (t.created ? formatDateFriendly(t.created) : '—');
  meta.appendChild(added);

  content.appendChild(meta);

  // --- Actions
  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const btnCheck = document.createElement('button');
  btnCheck.className = 'action-btn icon-check';
  btnCheck.title = 'Toggle complete';
  btnCheck.appendChild(createIcon(ICONS.check));
  btnCheck.addEventListener('click', (e) => { e.stopPropagation(); toggleComplete(t.id); });

  const btnEdit = document.createElement('button');
  btnEdit.className = 'action-btn icon-edit';
  btnEdit.title = 'Edit task';
  btnEdit.appendChild(createIcon(ICONS.edit));
  btnEdit.addEventListener('click', (e) => { e.stopPropagation(); startEdit(t.id); });

  const btnTrash = document.createElement('button');
  btnTrash.className = 'action-btn icon-trash';
  btnTrash.title = 'Delete';
  btnTrash.appendChild(createIcon(ICONS.trash));
  btnTrash.addEventListener('click', (e) => { e.stopPropagation(); deleteTask(t.id); });

  actions.appendChild(btnCheck);
  actions.appendChild(btnEdit);
  actions.appendChild(btnTrash);

  el.appendChild(content);
  el.appendChild(actions);
if(t.completed){
  const completedBadge = document.createElement('div');
  completedBadge.className = 'badge-completed';
  completedBadge.textContent = 'COMPLETED';
  el.appendChild(completedBadge);
}
  return el;
}

function render(){
  taskListEl.innerHTML = '';
  let visible = tasks.filter(t=>{
    if(activeFilter==='pending' && t.completed) return false;
    if(activeFilter==='completed' && !t.completed) return false;
    return true;
  });
  if(visible.length===0){ taskListEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--muted)">No tasks — add one from left ✨</div>'; updateStats(); return; }
  visible.sort((a,b)=>{
    if(a.completed !== b.completed) return (a.completed?1:0) - (b.completed?1:0);
    const da = a.due? new Date(a.due).getTime(): Infinity;
    const db = b.due? new Date(b.due).getTime(): Infinity;
    return da-db;
  });
  visible.forEach(t=> taskListEl.appendChild(createTaskCard(t)));
  updateStats();
}


function buildDateFromParts(dateString, hour12, min, ampm){
  const parts = dateString.split('-');
  if(parts.length<3) return null;
  let hh = hour12 % 12; if(ampm === 'PM') hh += 12;
  const dt = new Date(parts[0], parts[1]-1, parts[2], hh, min, 0);
  return isNaN(dt.getTime())? null : dt;
}
function buildDateFromPartsFromDate(baseDate, hour12, min, ampm){
  if(!baseDate) baseDate = new Date();
  let hh = hour12 % 12; if(ampm === 'PM') hh += 12;
  const dt = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hh, min, 0);
  return isNaN(dt.getTime())? null : dt;
}


function addTask(){
  const title = titleEl.value.trim(); if(!title){ alert('Please type a task title'); return; }
  const desc = descEl.value.trim();
  const assignee = assigneeEl ? assigneeEl.value.trim() : '';
  const dateVal = dueDateEl.value;
  let due = null;
  const reminder = reminderChk ? !!reminderChk.checked : false;

  if(dateVal && tempSelected){
    const dtTime = buildDateFromParts(dateVal, tempSelected.hour, tempSelected.min, tempSelected.ampm);
    due = dtTime ? dtTime.toISOString() : null;
  } else if(dateVal && !tempSelected){
    const parts = dateVal.split('-');
    const composed = new Date(parts[0], parts[1]-1, parts[2], 0,0,0);
    due = isNaN(composed.getTime())? null : composed.toISOString();
  } else if(!dateVal && tempSelected){
    const today = new Date();
    const dtTime = buildDateFromPartsFromDate(today, tempSelected.hour, tempSelected.min, tempSelected.ampm);
    due = dtTime ? dtTime.toISOString() : null;
  }

  tasks.push({ id: uid(), title, desc, assignee, created: new Date().toISOString(), due, priority:'medium', reminder:reminder, completed:false });
  clearForm(); save();
}

function deleteTask(id){ if(!confirm('Delete this task?')) return; tasks = tasks.filter(t=>t.id!==id); save(); }
function toggleComplete(id){ const t = tasks.find(x=>x.id===id); if(!t) return; t.completed = !t.completed; save(); }

function startEdit(id){
  const t = tasks.find(x=>x.id===id); if(!t) return;
  titleEl.value = t.title; descEl.value = t.desc || ''; if(assigneeEl) assigneeEl.value = t.assignee || '';
  if(reminderChk) reminderChk.checked = !!t.reminder;
  t.isEditing = true;

  if(t.due){
    const d = new Date(t.due);
    dueDateEl.value = d.toISOString().slice(0,10);
    let hh = d.getHours();
    const ampm = hh >= 12 ? 'PM' : 'AM';
    let hh12 = hh % 12; if(hh12===0) hh12 = 12;
    tempSelected = { hour: hh12, min: d.getMinutes(), ampm };
    selectedTimeDisplay.textContent = format12FromParts(tempSelected.hour, tempSelected.min, tempSelected.ampm) + ' • ' + formatDateFriendly(d.toISOString());
  } else {
    dueDateEl.value=''; tempSelected = null; selectedTimeDisplay.textContent='—';
  }

  addBtn.textContent = 'Save Task'; addBtn.dataset.editId = id;
}

function saveEdit(id){
  const t = tasks.find(x=>x.id===id); if(!t) return;
  t.title = titleEl.value.trim(); t.desc = descEl.value.trim(); t.assignee = assigneeEl ? assigneeEl.value.trim() : t.assignee;
  t.reminder = reminderChk ? !!reminderChk.checked : !!t.reminder;
  const dateVal = dueDateEl.value;
  if(dateVal && tempSelected){
    const dtTime = buildDateFromParts(dateVal, tempSelected.hour, tempSelected.min, tempSelected.ampm);
    t.due = dtTime ? dtTime.toISOString() : null;
  } else if(dateVal && !tempSelected){
    const parts = dateVal.split('-'); const composed = new Date(parts[0], parts[1]-1, parts[2], 0,0,0);
    t.due = isNaN(composed.getTime())? null : composed.toISOString();
  } else if(!dateVal && tempSelected){
    const dt = buildDateFromPartsFromDate(new Date(), tempSelected.hour, tempSelected.min, tempSelected.ampm);
    t.due = dt ? dt.toISOString() : null;
  } else t.due = null;
  t.isEditing = false;
  delete addBtn.dataset.editId; addBtn.textContent = 'Add Task';
  clearForm(); save();
}

function clearForm(){ 
  titleEl.value=''; descEl.value=''; if(assigneeEl) assigneeEl.value=''; 
  dueDateEl.value=''; tempSelected = null; selectedTimeDisplay.textContent = '—'; 
  if(reminderChk) reminderChk.checked = false;
}


function seedIfEmpty(){
  
}

addBtn.addEventListener('click', ()=>{
  if(addBtn.dataset.editId){ saveEdit(addBtn.dataset.editId); return; }
  addTask();
});
clearBtn.addEventListener('click', ()=>{ if(confirm('Clear form?')) clearForm(); });

setTimeBtn.addEventListener('click', (e)=>{ e.stopPropagation(); openClock('add', setTimeBtn, null); });

chips.forEach(ch=>{
  ch.addEventListener('click', ()=>{
    chips.forEach(c=>c.classList.remove('active')); ch.classList.add('active'); activeFilter = ch.dataset.filter; render();
  });
});

let activeFilter = 'all';
load(); seedIfEmpty(); render();

window.toggleComplete = toggleComplete;
window.startEdit = startEdit;
window.deleteTask = deleteTask;

if ('Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission();
}

function showNotification(task) {
    if (Notification.permission === 'granted') {
        new Notification(`Reminder: ${task.title}`, {
            body: `Due at ${format12(task.due)}\n${task.desc || ''}`,
            icon: './multitasking_18254886.png' 
        });
    }
    task.reminderShown = true;
    save(); 
}

function checkReminders() {
    const now = new Date();
    tasks.forEach(task => {
        if (!task.completed && task.due && task.reminder && !task.reminderShown) {
            const due = new Date(task.due);
            if (due - now <= 5 * 60 * 1000 && due - now > 0) {
                showNotification(task);
            }
        }
    });
}
setInterval(checkReminders, 60 * 1000);



