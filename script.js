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

// ✅ Request Notification permission on page load
if ("Notification" in window && Notification.permission !== "granted") {
    Notification.requestPermission().then(permission => {
        console.log("Notification permission:", permission);
    });
}

let tasks = [];
function load(){ 
  try{ const raw = localStorage.getItem('taskflow_tasks'); tasks = raw ? JSON.parse(raw) : []; } 
  catch(e){ tasks = []; } 
}
function save(){ 
  try{ localStorage.setItem('taskflow_tasks', JSON.stringify(tasks)); } 
  catch(e){} 
  render(); 
  updateStats(); 
}

const taskListEl = $('#taskList');
const addBtn = $('#addBtn'), clearBtn = $('#clearBtn'), setTimeBtn = $('#setTimeBtn');
const titleEl = $('#title'), descEl = $('#desc'), dueDateEl = $('#dueDate');
const assigneeEl = $('#assignee'); 
const selectedTimeDisplay = $('#selectedTimeDisplay');
const chips = $$('.chip');
const statTotal = $('#statTotal'), statCompleted = $('#statCompleted'), progressText = $('#progressText');
const reminderChk = $('#reminderChk');
const reminderMinutesEl = $('#reminderMinutes');

const clockPopup = $('#clockPopup');
const clockHour = $('#clockHour'), clockMin = $('#clockMin'), ampmAM = $('#ampmAM'), ampmPM = $('#ampmPM'), clockSave = $('#clockSave'), clockCancel = $('#clockCancel');

let clockMode = null; 
let currentEditingTaskId = null;
let tempSelected = null; 
let activeFilter = 'all';

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

document.addEventListener('click', (e)=>{ if(!clockPopup.contains(e.target) && e.target !== setTimeBtn && !e.target.classList.contains('due-label')) closeClock(); });

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

  const top = document.createElement('div');
  top.className = 'header-row';

  const title = document.createElement('div');
  title.className = 'task-title';
  title.textContent = t.title;
  top.appendChild(title); 

  if(!t.completed){
    if(t.reminder){
      const badge = document.createElement('div');
      badge.className = 'badge badge-reminder';
      badge.textContent = 'REMINDER';
      top.appendChild(badge);
    } else {
      const badge = document.createElement('div');
      badge.className = 'badge badge-open';
      badge.textContent = 'OPEN';
      top.appendChild(badge);
    }
  }

  content.appendChild(top);

  if (t.desc) {
    const desc = document.createElement('div');
    desc.className = 'task-desc';
    desc.textContent = t.desc;
    content.appendChild(desc);
  }

  if (t.assignee) {
    const assigneeDiv = document.createElement('div');
    assigneeDiv.className = 'task-assignee';
    assigneeDiv.textContent = 'Assignee: ' + t.assignee;
    content.appendChild(assigneeDiv);
  }

  const meta = document.createElement('div');
  meta.className = 'task-meta';

  const dueLabel = document.createElement('span');
  dueLabel.className = 'due-label';
  dueLabel.textContent = 'Due: ' + format12(t.due);
  dueLabel.addEventListener('click', ()=>openClock('edit', dueLabel, t));
  meta.appendChild(dueLabel);

  content.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const btnCheck = document.createElement('button'); btnCheck.title='Complete';
  btnCheck.appendChild(createIcon(ICONS.check));
  btnCheck.addEventListener('click', ()=>{ t.completed = !t.completed; save(); });
  actions.appendChild(btnCheck);

  const btnEdit = document.createElement('button'); btnEdit.title='Edit';
  btnEdit.appendChild(createIcon(ICONS.edit));
  btnEdit.addEventListener('click', ()=> startEdit(t.id));
  actions.appendChild(btnEdit);

  const btnDelete = document.createElement('button'); btnDelete.title='Delete';
  btnDelete.appendChild(createIcon(ICONS.trash));
  btnDelete.addEventListener('click', ()=> { if(confirm('Delete task?')) { tasks = tasks.filter(x=>x.id!==t.id); save(); } });
  actions.appendChild(btnDelete);

  el.appendChild(content);
  el.appendChild(actions);
  return el;
}

function render(){
  taskListEl.innerHTML = '';
  const filtered = tasks.filter(t=>{
    if(activeFilter==='all') return true;
    if(activeFilter==='pending') return !t.completed;
    if(activeFilter==='completed') return t.completed;
    return true;
  });
  filtered.forEach(t=>{
    const card = createTaskCard(t);
    taskListEl.appendChild(card);
  });
}

function startEdit(id){
  const t = tasks.find(x=>x.id===id); if(!t) return;
  titleEl.value = t.title; descEl.value = t.desc; assigneeEl.value = t.assignee;
  if(t.due) selectedTimeDisplay.textContent = format12(t.due);
  reminderChk.checked = t.reminder;
  reminderMinutesEl.value = t.reminderMinutes || 5;
  currentEditingTaskId = id;
  addBtn.textContent = 'Save';
}

addBtn.addEventListener('click', ()=>{
  const title = titleEl.value.trim();
  const desc = descEl.value.trim();
  const assignee = assigneeEl.value.trim();
  if(!title){ alert('Title required'); return; }

  let due = null;
  if(tempSelected && dueDateEl.value){
    let [year,month,day] = dueDateEl.value.split('-');
    month = parseInt(month)-1;
    let h = tempSelected.hour % 12; if(tempSelected.ampm==='PM') h+=12;
    due = new Date(year,month,day,h,tempSelected.min,0,0).toISOString();
  }

  const reminder = reminderChk.checked;
  const reminderMinutes = parseInt(reminderMinutesEl.value) || 5;

  if(currentEditingTaskId){
    const t = tasks.find(x=>x.id===currentEditingTaskId);
    if(!t) return;
    t.title=title; t.desc=desc; t.assignee=assignee;
    t.due=due; t.reminder=reminder; t.reminderMinutes=reminderMinutes;
    currentEditingTaskId=null; addBtn.textContent='Add Task';
  } else {
    tasks.push({id: uid(), title, desc, assignee, due, reminder, reminderMinutes, completed:false, reminderShown:false});
  }

  titleEl.value=''; descEl.value=''; assigneeEl.value=''; dueDateEl.value=''; tempSelected=null; selectedTimeDisplay.textContent='';
  reminderChk.checked=false; reminderMinutesEl.value=5;
  save();
});

clearBtn.addEventListener('click', ()=>{ if(confirm('Clear all tasks?')){ tasks=[]; save(); } });

chips.forEach(ch=>{
  ch.addEventListener('click', ()=>{
    activeFilter = ch.dataset.filter || 'all';
    chips.forEach(c=>c.classList.remove('active'));
    ch.classList.add('active');
    render();
  });
});

// ✅ Fixed checkReminders function
function checkReminders(){
    const now = new Date();
    tasks.forEach(t=>{
        if(!t.reminder || t.completed || !t.due || t.reminderShown) return;

        const due = new Date(t.due);
        const remindBefore = (t.reminderMinutes || 0) * 60000;
        if(now >= (due - remindBefore)){
            showNotification(t);
            t.reminderShown = true;
            save();
        }
    });
}

function showNotification(task){
    if("Notification" in window && Notification.permission === "granted"){
        new Notification('Task Reminder', {body: task.title, tag: task.id});
    } else {
        alert('Reminder: ' + task.title);
    }
}

// Check reminders every 10 seconds
setInterval(checkReminders, 10000);

load(); render();
