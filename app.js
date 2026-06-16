/* ============================================================
   TaskFlow — app.js
   Bootstrap 5 + jQuery + SortableJS + Anthropic Claude API
   ============================================================ */

// ---------- STATE ----------
let state = {
  users: JSON.parse(localStorage.getItem('tf_users') || '{}'),
  currentUser: null,
  tasks: [],
  lists: [],
  activeList: 'all',
  viewTaskId: null,
};

const COLORS = ['#4f6ef7','#e03131','#0ca678','#e67700','#9c36b5','#1098ad'];

// ---------- PERSIST ----------
const save = () => {
  if (!state.currentUser) return;
  localStorage.setItem(`tf_tasks_${state.currentUser}`, JSON.stringify(state.tasks));
  localStorage.setItem(`tf_lists_${state.currentUser}`, JSON.stringify(state.lists));
};

const load = () => {
  state.tasks = JSON.parse(localStorage.getItem(`tf_tasks_${state.currentUser}`) || '[]');
  state.lists = JSON.parse(localStorage.getItem(`tf_lists_${state.currentUser}`) || '[]');
  if (!state.lists.length) {
    state.lists = [
      { id: uid(), name: 'Personal', color: '#4f6ef7' },
      { id: uid(), name: 'Work', color: '#e03131' },
    ];
    save();
  }
};

// ---------- HELPERS ----------
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);

const priorityBadge = (p) => `<span class="badge-priority priority-${p}">${p.charAt(0).toUpperCase()+p.slice(1)}</span>`;

const listColor = (id) => {
  const l = state.lists.find(l => l.id === id);
  return l ? l.color : '#aaa';
};
const listName = (id) => {
  const l = state.lists.find(l => l.id === id);
  return l ? l.name : '';
};

// ---------- AUTH ----------
$(document).on('click', '[data-tab]', function () {
  const tab = $(this).data('tab');
  $('[data-tab]').removeClass('active');
  $(this).addClass('active');
  $('#loginForm, #registerForm').addClass('d-none');
  $(`#${tab}Form`).removeClass('d-none');
});

$('#loginBtn').on('click', () => {
  const email = $('#loginEmail').val().trim().toLowerCase();
  const pass  = $('#loginPass').val();
  if (!email || !pass) return showAuthErr('loginError', 'Fill in all fields');
  const user = state.users[email];
  if (!user || user.password !== pass) return showAuthErr('loginError', 'Invalid email or password');
  loginUser(email, user.name);
});

$('#registerBtn').on('click', () => {
  const name  = $('#regName').val().trim();
  const email = $('#regEmail').val().trim().toLowerCase();
  const pass  = $('#regPass').val();
  if (!name || !email || !pass) return showAuthErr('regError', 'Fill in all fields');
  if (pass.length < 6) return showAuthErr('regError', 'Password min 6 characters');
  if (state.users[email]) return showAuthErr('regError', 'Email already registered');
  state.users[email] = { name, password: pass };
  localStorage.setItem('tf_users', JSON.stringify(state.users));
  loginUser(email, name);
});

$('#logoutBtn').on('click', () => {
  state.currentUser = null;
  state.tasks = []; state.lists = []; state.activeList = 'all';
  $('#appPage').addClass('d-none');
  $('#loginPage').removeClass('d-none');
  $('#loginEmail,#loginPass').val('');
});

function showAuthErr(id, msg) { $(`#${id}`).text(msg).removeClass('d-none'); }

function loginUser(email, name) {
  state.currentUser = email;
  load();
  $('#loginPage').addClass('d-none');
  $('#appPage').removeClass('d-none');
  $('#greetUser').text(`Hi, ${name.split(' ')[0]} 👋`);
  $('#loginError,#regError').addClass('d-none');
  renderAll();
}

// ---------- LISTS SIDEBAR ----------
function renderSidebar() {
  const $ul = $('#listSidebar').empty();

  const allActive = state.activeList === 'all';
  $ul.append(`
    <li class="list-group-item list-item ${allActive ? 'active' : ''}" data-list="all">
      <span class="list-dot" style="background:#8a8fa8"></span> All Tasks
      <span class="ms-auto badge bg-light text-muted border">${state.tasks.length}</span>
    </li>`);

  state.lists.forEach(l => {
    const count = state.tasks.filter(t => t.list === l.id).length;
    const active = state.activeList === l.id;
    $ul.append(`
      <li class="list-group-item list-item ${active ? 'active' : ''}" data-list="${l.id}">
        <span class="list-dot" style="background:${l.color}"></span>
        <span>${l.name}</span>
        <span class="ms-auto badge bg-light text-muted border me-1">${count}</span>
        <i class="fa fa-times del-list" data-id="${l.id}"></i>
      </li>`);
  });
}

$(document).on('click', '.list-item', function (e) {
  if ($(e.target).hasClass('del-list')) return;
  state.activeList = $(this).data('list');
  renderAll();
});

$(document).on('click', '.del-list', function (e) {
  e.stopPropagation();
  const id = $(this).data('id');
  state.lists = state.lists.filter(l => l.id !== id);
  state.tasks.forEach(t => { if (t.list === id) t.list = null; });
  if (state.activeList === id) state.activeList = 'all';
  save(); renderAll();
});

// ---- New List Modal ----
$('#addListBtn').on('click', () => {
  $('#listNameInput').val('');
  $('#listColorPicker').empty();
  COLORS.forEach((c, i) => {
    $('#listColorPicker').append(
      `<div class="color-chip ${i===0?'selected':''}" data-color="${c}" style="background:${c}"></div>`);
  });
  new bootstrap.Modal('#listModal').show();
});

$(document).on('click', '.color-chip', function () {
  $('.color-chip').removeClass('selected');
  $(this).addClass('selected');
});

$('#saveListBtn').on('click', () => {
  const name = $('#listNameInput').val().trim();
  if (!name) return;
  const color = $('.color-chip.selected').data('color') || COLORS[0];
  state.lists.push({ id: uid(), name, color });
  save();
  bootstrap.Modal.getInstance('#listModal').hide();
  renderAll();
});

// ---------- TASK MODAL ----------
function openTaskModal(task = null) {
  const isEdit = !!task;
  $('#taskModalTitle').text(isEdit ? 'Edit Task' : 'New Task');
  $('#editTaskId').val(isEdit ? task.id : '');
  $('#taskTitle').val(isEdit ? task.title : '');
  $('#taskNotes').val(isEdit ? task.notes : '');
  $('#taskPriority').val(isEdit ? task.priority : 'medium');
  $('#taskDue').val(isEdit ? task.due : '');
  $('#subTaskList').empty();
  if (isEdit && task.subs?.length) {
    task.subs.forEach((s, i) => addSubUI(s.title, s.done, i));
  }
  // Populate list dropdown
  $('#taskList').empty().append('<option value="">None</option>');
  state.lists.forEach(l => {
    const sel = (isEdit && task.list === l.id) || (!isEdit && state.activeList === l.id) ? 'selected' : '';
    $('#taskList').append(`<option value="${l.id}" ${sel}>${l.name}</option>`);
  });
  new bootstrap.Modal('#taskModal').show();
}

$('#openAddTaskBtn').on('click', () => openTaskModal());

// Sub-tasks UI
$('#addSubBtn').on('click', () => {
  $('#subTaskInput').removeClass('d-none').focus();
});

$('#subTaskInput').on('keydown', function (e) {
  if (e.key === 'Enter') {
    const val = $(this).val().trim();
    if (val) { addSubUI(val, false); $(this).val(''); }
  }
  if (e.key === 'Escape') $(this).addClass('d-none').val('');
});

function addSubUI(title, done = false, index = null) {
  const idx = index ?? $('#subTaskList .sub-item').length;
  $('#subTaskList').append(`
    <div class="sub-item" data-idx="${idx}">
      <input type="checkbox" ${done ? 'checked' : ''}/>
      <span>${title}</span>
      <i class="fa fa-times del-sub"></i>
    </div>`);
}

$(document).on('click', '.del-sub', function () { $(this).closest('.sub-item').remove(); });

$('#saveTaskBtn').on('click', () => {
  const title = $('#taskTitle').val().trim();
  if (!title) return $('#taskTitle').addClass('is-invalid').focus();
  $('#taskTitle').removeClass('is-invalid');

  const subs = [];
  $('#subTaskList .sub-item').each(function () {
    subs.push({ title: $(this).find('span').text(), done: $(this).find('input[type=checkbox]').is(':checked') });
  });

  const id = $('#editTaskId').val();
  if (id) {
    const t = state.tasks.find(t => t.id === id);
    Object.assign(t, buildTask(title, subs));
    t.id = id; t.created = t.created;
  } else {
    state.tasks.unshift({ id: uid(), created: Date.now(), done: false, ...buildTask(title, subs) });
  }
  save();
  bootstrap.Modal.getInstance('#taskModal').hide();
  renderAll();
});

function buildTask(title, subs) {
  return {
    title,
    notes: $('#taskNotes').val().trim(),
    priority: $('#taskPriority').val(),
    due: $('#taskDue').val(),
    list: $('#taskList').val() || null,
    subs,
  };
}

// ---------- TASK RENDERING ----------
function getFilteredTasks() {
  const q = $('#searchInput').val().toLowerCase();
  const filter = $('#filterStatus').val();
  const sort = $('#sortTasks').val();

  let tasks = state.tasks.filter(t => {
    const inList = state.activeList === 'all' || t.list === state.activeList;
    const matchQ = !q || t.title.toLowerCase().includes(q) || (t.notes||'').toLowerCase().includes(q);
    const matchF = filter === 'all' || (filter === 'done' ? t.done : !t.done);
    return inList && matchQ && matchF;
  });

  if (sort === 'alpha') tasks.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === 'priority') {
    const rank = { high: 0, medium: 1, low: 2 };
    tasks.sort((a, b) => rank[a.priority] - rank[b.priority]);
  } else tasks.sort((a, b) => b.created - a.created);

  return tasks;
}

function renderTasks() {
  const tasks = getFilteredTasks();
  const $board = $('#taskBoard').empty();

  $('#emptyState').toggleClass('d-none', tasks.length > 0);

  // Active list title
  const listTitle = state.activeList === 'all' ? 'All Tasks' : listName(state.activeList);
  $('#activeListTitle').text(listTitle);
  $('#taskCount').text(tasks.length);

  tasks.forEach(t => {
    const subsDone = (t.subs||[]).filter(s=>s.done).length;
    const subsTotal = (t.subs||[]).length;
    const subsBar = subsTotal ? `
      <div class="sub-progress mt-1">
        <div class="sub-progress-bar" style="width:${Math.round(subsDone/subsTotal*100)}%"></div>
      </div>
      <span class="task-due ms-0">${subsDone}/${subsTotal} subtasks</span>` : '';

    const dueStr = t.due ? (() => {
      const cls = t.due < today() && !t.done ? 'overdue' : '';
      return `<span class="task-due ${cls}"><i class="fa fa-calendar-alt me-1 fa-xs"></i>${t.due}</span>`;
    })() : '';

    const listTag = t.list ? `<span class="task-list-tag" style="background:${listColor(t.list)}22;color:${listColor(t.list)}">${listName(t.list)}</span>` : '';

    $board.append(`
      <div class="task-card ${t.done ? 'done' : ''}" data-id="${t.id}">
        <input type="checkbox" class="task-check" ${t.done ? 'checked' : ''}/>
        <div class="task-body">
          <div class="task-title" data-detail="${t.id}">${t.title}</div>
          <div class="task-meta">
            ${priorityBadge(t.priority)}
            ${dueStr}
            ${listTag}
          </div>
          ${subsBar}
        </div>
        <div class="task-actions">
          <button class="edit-btn" data-id="${t.id}" title="Edit"><i class="fa fa-pencil"></i></button>
          <button class="del-btn" data-id="${t.id}" title="Delete"><i class="fa fa-trash"></i></button>
        </div>
      </div>`);
  });

  // SortableJS drag-and-drop
  Sortable.create($board[0], {
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd(evt) {
      const ids = [];
      $board.find('.task-card').each(function () { ids.push($(this).data('id')); });
      const reordered = [];
      ids.forEach(id => { const t = state.tasks.find(t => t.id === id); if (t) reordered.push(t); });
      // keep tasks not in current view
      const notInView = state.tasks.filter(t => !ids.includes(t.id));
      state.tasks = [...reordered, ...notInView];
      save();
    }
  });
}

function renderAll() {
  renderSidebar();
  renderTasks();
}

// ---------- TASK INTERACTIONS ----------
// Toggle done
$(document).on('change', '.task-check', function () {
  const id = $(this).closest('.task-card').data('id');
  const t = state.tasks.find(t => t.id === id);
  if (t) { t.done = $(this).is(':checked'); save(); renderTasks(); }
});

// Edit
$(document).on('click', '.edit-btn', function (e) {
  e.stopPropagation();
  const t = state.tasks.find(t => t.id === $(this).data('id'));
  if (t) openTaskModal(t);
});

// Delete
$(document).on('click', '.del-btn', function (e) {
  e.stopPropagation();
  const id = $(this).data('id');
  state.tasks = state.tasks.filter(t => t.id !== id);
  save(); renderTasks();
});

// Detail popup
$(document).on('click', '.task-title[data-detail]', function () {
  const id = $(this).data('detail');
  const t = state.tasks.find(t => t.id === id);
  if (!t) return;
  state.viewTaskId = id;

  $('#detailTitle').text(t.title);
  $('#detailNotes').text(t.notes || 'No notes.');
  $('#detailMeta').html(`
    ${priorityBadge(t.priority)}
    ${t.due ? `<span class="task-due"><i class="fa fa-calendar-alt me-1 fa-xs"></i>${t.due}</span>` : ''}
    ${t.list ? `<span class="task-list-tag" style="background:${listColor(t.list)}22;color:${listColor(t.list)}">${listName(t.list)}</span>` : ''}
  `);

  if (t.subs?.length) {
    const $ul = $('#detailSubList').empty();
    t.subs.forEach((s, i) => {
      $ul.append(`
        <li class="list-group-item list-group-item-action d-flex align-items-center gap-2 py-1 px-0">
          <input type="checkbox" class="detail-sub-chk" data-task="${id}" data-idx="${i}" ${s.done?'checked':''}/>
          <span class="${s.done?'text-decoration-line-through text-muted':''}">${s.title}</span>
        </li>`);
    });
    $('#detailSubSection').removeClass('d-none');
  } else {
    $('#detailSubSection').addClass('d-none');
  }

  new bootstrap.Modal('#detailModal').show();
});

$(document).on('change', '.detail-sub-chk', function () {
  const taskId = $(this).data('task');
  const idx = $(this).data('idx');
  const t = state.tasks.find(t => t.id === taskId);
  if (t) { t.subs[idx].done = $(this).is(':checked'); save(); }
});

$('#detailEditBtn').on('click', () => {
  bootstrap.Modal.getInstance('#detailModal').hide();
  setTimeout(() => openTaskModal(state.tasks.find(t => t.id === state.viewTaskId)), 300);
});

$('#detailDeleteBtn').on('click', () => {
  state.tasks = state.tasks.filter(t => t.id !== state.viewTaskId);
  save();
  bootstrap.Modal.getInstance('#detailModal').hide();
  renderAll();
});

// ---------- SEARCH / FILTER / SORT ----------
$('#searchInput, #filterStatus, #sortTasks').on('input change', () => renderTasks());

// ---------- AI TASK CREATOR ----------
const CLAUDE_MODEL = 'claude-sonnet-4-6';

$('#aiBtn').on('click', () => {
  $('#aiPrompt').val('');
  $('#aiResult').addClass('d-none');
  new bootstrap.Modal('#aiModal').show();
});

$('#aiGenerateBtn').on('click', async () => {
  const prompt = $('#aiPrompt').val().trim();
  if (!prompt) return;

  $('#aiSpinner').removeClass('d-none');
  $('#aiGenerateBtn').prop('disabled', true);
  $('#aiResult').addClass('d-none');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `You are a task planning assistant. The user says: "${prompt}"

Return ONLY valid JSON (no markdown, no preamble) in this exact format:
{
  "tasks": [
    {
      "title": "Main task title",
      "priority": "high|medium|low",
      "subtasks": ["Subtask 1", "Subtask 2"]
    }
  ]
}

Create 2-5 tasks with 2-4 subtasks each. Make them specific and actionable.`
        }]
      })
    });

    const data = await res.json();
    const text = data.content?.find(c => c.type === 'text')?.text || '{}';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

    if (!parsed.tasks?.length) throw new Error('No tasks returned');

    const $list = $('#aiPreviewList').empty();
    parsed.tasks.forEach(t => {
      const subs = (t.subtasks||[]).map(s => `<div class="ai-sub">• ${s}</div>`).join('');
      $list.append(`
        <div class="ai-task-item" data-task='${JSON.stringify(t)}'>
          <div class="fw-semibold">${t.title} ${priorityBadge(t.priority||'medium')}</div>
          ${subs}
        </div>`);
    });

    $('#aiResult').removeClass('d-none');
  } catch (err) {
    alert('AI error: ' + (err.message || 'Unknown error'));
  } finally {
    $('#aiSpinner').addClass('d-none');
    $('#aiGenerateBtn').prop('disabled', false);
  }
});

$('#aiAddAllBtn').on('click', () => {
  $('#aiPreviewList .ai-task-item').each(function () {
    const t = JSON.parse($(this).attr('data-task'));
    state.tasks.unshift({
      id: uid(),
      created: Date.now(),
      done: false,
      title: t.title,
      notes: '',
      priority: t.priority || 'medium',
      due: '',
      list: state.activeList !== 'all' ? state.activeList : null,
      subs: (t.subtasks || []).map(s => ({ title: s, done: false }))
    });
  });
  save();
  bootstrap.Modal.getInstance('#aiModal').hide();
  renderAll();
});

// ---------- INIT ----------
$(document).ready(() => {
  // Enter key for auth
  $('#loginPass').on('keydown', e => { if (e.key === 'Enter') $('#loginBtn').click(); });
  $('#regPass').on('keydown', e => { if (e.key === 'Enter') $('#registerBtn').click(); });
});
