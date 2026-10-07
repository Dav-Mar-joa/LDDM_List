/* ═══════════════════════════════════════════════════════════
   LDDM List — logique de l'application
   ═══════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  // ── Utilitaires ──────────────────────────────────────────
  const PEOPLE = ['Lola', 'David', 'Les 2'];
  const PRIORITIES = { haute: 'Haute', moyenne: 'Moyenne', faible: 'Faible' };
  const AVATAR = { 'Lola': 'a1', 'David': 'a2', 'Les 2': 'a3' };
  const INITIAL = { 'Lola': 'L', 'David': 'D', 'Les 2': '2' };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  const store = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignoré */ } }
  };

  async function api(url, { method = 'GET', body } = {}) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      let msg = 'Une erreur est survenue';
      try { msg = (await res.json()).error || msg; } catch { /* ignoré */ }
      throw new Error(msg);
    }
    return res.json();
  }

  function toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // ── État ─────────────────────────────────────────────────
  const initial = JSON.parse($('#initial-data').textContent || '{"tasks":[],"courses":[]}');
  const state = {
    tasks: initial.tasks,
    courses: initial.courses,
    user: PEOPLE.includes(store.get('lddm_user')) ? store.get('lddm_user') : null,
    filters: { status: 'todo', who: 'all', priority: 'all', q: '', sort: 'asc' },
    editingTaskId: null,
    editingCourseId: null
  };

  // ── Dates ────────────────────────────────────────────────
  const fmtDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtDayYear = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const fmtTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  function dateInfo(value, done) {
    const d = new Date(value);
    const now = new Date();
    const diff = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
    let day;
    if (diff === 0) day = "Aujourd'hui";
    else if (diff === 1) day = 'Demain';
    else if (diff === -1) day = 'Hier';
    else day = (d.getFullYear() === now.getFullYear() ? fmtDay : fmtDayYear).format(d);
    return {
      label: `${day} · ${fmtTime.format(d)}`,
      late: !done && d < now,
      today: !done && diff === 0 && d >= now
    };
  }

  function toLocalInput(value) {
    const d = new Date(value);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function nextHalfHour() {
    const d = new Date();
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
    return d;
  }

  // ── Horloge ──────────────────────────────────────────────
  function tickClock() {
    const now = new Date();
    const date = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
    const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now);
    $('#today').textContent = `${date} · ${time}`;
  }

  // ── Rendu : tâches ───────────────────────────────────────
  function visibleTasks() {
    const f = state.filters;
    const q = f.q.trim().toLowerCase();
    const dir = f.sort === 'desc' ? -1 : 1;
    return state.tasks
      .filter(t => {
        if (f.status === 'todo' && t.done) return false;
        if (f.status === 'done' && !t.done) return false;
        if (f.who !== 'all' && t.qui !== f.who) return false;
        if (f.priority !== 'all' && t.priority !== f.priority) return false;
        if (q && !`${t.name} ${t.description || ''} ${t.qui || ''}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => (!!a.done - !!b.done) || (new Date(a.date) - new Date(b.date)) * dir);
  }

  function taskHTML(t) {
    const prio = PRIORITIES[t.priority] ? t.priority : '';
    const info = dateInfo(t.date, t.done);
    const whenClass = info.late ? 'late' : info.today ? 'today' : '';
    return `
      <article class="card ${t.done ? 'is-done' : ''} ${prio ? 'prio-' + prio : ''}" data-id="${esc(t._id)}">
        <button class="check" type="button" data-action="toggle" aria-pressed="${!!t.done}"
                aria-label="${t.done ? 'Marquer comme à faire' : 'Marquer comme terminée'}">${icon('check')}</button>
        <div class="card-body">
          <h3 class="card-title">${esc(t.name)}</h3>
          ${t.description ? `<p class="card-desc">${esc(t.description)}</p>` : ''}
          <div class="meta">
            <span class="tag ${whenClass}">${icon('clock')}${esc(info.label)}${info.late ? ' · en retard' : ''}</span>
            ${PEOPLE.includes(t.qui) ? `<span class="tag who"><span class="avatar ${AVATAR[t.qui]}">${INITIAL[t.qui]}</span>${esc(t.qui)}</span>` : ''}
            ${prio ? `<span class="tag p-${prio}">${PRIORITIES[prio]}</span>` : ''}
          </div>
        </div>
        <div class="card-actions">
          <button class="icon-btn" type="button" data-action="edit" aria-label="Modifier la tâche" title="Modifier">${icon('edit')}</button>
          <button class="icon-btn danger" type="button" data-action="delete" aria-label="Supprimer la tâche" title="Supprimer">${icon('trash')}</button>
        </div>
      </article>`;
  }

  function renderTasks() {
    const list = visibleTasks();
    const el = $('#task-list');
    if (!list.length) {
      const filtering = state.tasks.length > 0;
      el.innerHTML = `
        <div class="empty">${icon('inbox')}
          <strong>${filtering ? 'Aucune tâche ne correspond' : 'Rien à faire pour le moment'}</strong>
          <span>${filtering ? 'Essaie de modifier les filtres.' : 'Ajoute ta première tâche avec le bouton +.'}</span>
        </div>`;
    } else {
      el.innerHTML = list.map(taskHTML).join('');
    }

    const todo = state.tasks.filter(t => !t.done);
    const late = todo.filter(t => new Date(t.date) < new Date()).length;
    const done = state.tasks.length - todo.length;
    $('#task-stats').textContent =
      `${todo.length} à faire${late ? ` · ${late} en retard` : ''} · ${done} terminée${done > 1 ? 's' : ''}`;
  }

  // ── Rendu : courses ──────────────────────────────────────
  function courseHTML(c) {
    if (state.editingCourseId === c._id) {
      return `
        <div class="item" data-id="${esc(c._id)}">
          <input class="edit-input" type="text" value="${esc(c.name)}" maxlength="200" aria-label="Modifier l'article">
          <button class="icon-btn" type="button" data-action="save" aria-label="Enregistrer" title="Enregistrer">${icon('check')}</button>
          <button class="icon-btn" type="button" data-action="cancel" aria-label="Annuler" title="Annuler">${icon('x')}</button>
        </div>`;
    }
    return `
      <div class="item ${c.checked ? 'is-done' : ''}" data-id="${esc(c._id)}">
        <button class="check" type="button" data-action="toggle" aria-pressed="${!!c.checked}"
                aria-label="${c.checked ? 'Décocher' : 'Cocher'}">${icon('check')}</button>
        <span class="item-name">${esc(c.name)}</span>
        <button class="icon-btn" type="button" data-action="edit" aria-label="Modifier l'article" title="Modifier">${icon('edit')}</button>
        <button class="icon-btn danger" type="button" data-action="delete" aria-label="Supprimer l'article" title="Supprimer">${icon('trash')}</button>
      </div>`;
  }

  function renderCourses() {
    const list = [...state.courses].sort((a, b) => !!a.checked - !!b.checked);
    $('#course-list').innerHTML = list.length
      ? list.map(courseHTML).join('')
      : `<div class="empty">${icon('cart')}<strong>La liste est vide</strong><span>Ajoute ce qu'il faut acheter.</span></div>`;

    const left = state.courses.filter(c => !c.checked).length;
    const checked = state.courses.length - left;
    $('#course-stats').textContent = `${left} à acheter`;
    $('#btn-clear-checked').hidden = checked === 0;

    const input = $('#course-list .edit-input');
    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  }

  function updateBadges() {
    const t = state.tasks.filter(x => !x.done).length;
    const c = state.courses.filter(x => !x.checked).length;
    for (const [id, n] of [['#nav-tasks-count', t], ['#nav-courses-count', c]]) {
      $(id).textContent = n;
      $(id).hidden = n === 0;
    }
    document.title = (t + c) > 0 ? `(${t + c}) LDDM List` : 'LDDM List';
    if ('setAppBadge' in navigator) {
      (t + c) > 0 ? navigator.setAppBadge(t + c).catch(() => {}) : navigator.clearAppBadge().catch(() => {});
    }
  }

  function render() {
    renderTasks();
    renderCourses();
    updateBadges();
  }

  // ── Onglets (mobile / tablette portrait) ─────────────────
  function setTab(tab) {
    document.body.dataset.tab = tab;
    store.set('lddm_tab', tab);
    $$('.bottom-nav button').forEach(b =>
      b.getAttribute('data-tab') === tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  }

  // ── Fenêtres ─────────────────────────────────────────────
  function openDialog(dlg) { if (!dlg.open) dlg.showModal(); }
  $$('dialog').forEach(dlg => {
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    $$('[data-close]', dlg).forEach(b => b.addEventListener('click', () => dlg.close()));
  });

  function confirmDialog(title, text, okLabel = 'Supprimer') {
    return new Promise(resolve => {
      const dlg = $('#confirm-dialog');
      $('#confirm-title').textContent = title;
      $('#confirm-text').textContent = text;
      $('#confirm-ok').textContent = okLabel;
      let result = false;
      const ok = () => { result = true; dlg.close(); };
      const done = () => { $('#confirm-ok').removeEventListener('click', ok); resolve(result); };
      $('#confirm-ok').addEventListener('click', ok);
      dlg.addEventListener('close', done, { once: true });
      openDialog(dlg);
    });
  }

  // ── Tâches : ajout / modification ────────────────────────
  const form = $('#task-form');
  const radio = (name, value) => $(`input[name="${name}"][value="${CSS.escape(value)}"]`, form);

  function openTaskDialog(task = null) {
    state.editingTaskId = task ? task._id : null;
    $('#task-dialog-title').textContent = task ? 'Modifier la tâche' : 'Nouvelle tâche';
    $('#task-submit').textContent = task ? 'Enregistrer' : 'Ajouter';
    $('#form-error').hidden = true;

    $('#f-name').value = task ? task.name : '';
    $('#f-date').value = toLocalInput(task ? task.date : nextHalfHour());
    $('#f-desc').value = task ? (task.description || '') : '';
    (radio('priority', task?.priority || '') || radio('priority', '')).checked = true;
    const who = task ? (task.qui || '') : (state.user || '');
    (radio('qui', who) || radio('qui', '')).checked = true;

    openDialog($('#task-dialog'));
    if (!task) setTimeout(() => $('#f-name').focus(), 50);
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#f-name').value.trim();
    const err = $('#form-error');
    if (!name) {
      err.textContent = 'Le titre est obligatoire.';
      err.hidden = false;
      $('#f-name').focus();
      return;
    }
    const dateValue = $('#f-date').value;
    const payload = {
      name,
      date: dateValue ? new Date(dateValue).toISOString() : undefined,
      description: $('#f-desc').value.trim(),
      priority: $('input[name="priority"]:checked', form).value,
      qui: $('input[name="qui"]:checked', form).value,
      by: state.user || ''
    };

    const btn = $('#task-submit');
    btn.disabled = true;
    try {
      if (state.editingTaskId) {
        const updated = await api(`/api/tasks/${state.editingTaskId}`, { method: 'PUT', body: payload });
        state.tasks = state.tasks.map(t => t._id === updated._id ? updated : t);
        toast('Tâche modifiée');
      } else {
        const created = await api('/api/tasks', { method: 'POST', body: payload });
        state.tasks.push(created);
        toast('Tâche ajoutée');
      }
      $('#task-dialog').close();
      render();
    } catch (error) {
      err.textContent = error.message;
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  // ── Tâches : actions sur la liste ────────────────────────
  $('#task-list').addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const card = btn.closest('.card');
    const task = state.tasks.find(t => t._id === card.dataset.id);
    if (!task) return;

    if (btn.dataset.action === 'edit') return openTaskDialog(task);

    if (btn.dataset.action === 'toggle') {
      const prev = !!task.done;
      task.done = !prev;
      render();
      try {
        await api(`/api/tasks/${task._id}/done`, { method: 'PATCH', body: { done: task.done, by: state.user || '' } });
      } catch (error) {
        task.done = prev; render(); toast(error.message, 'error');
      }
    }

    if (btn.dataset.action === 'delete') {
      const ok = await confirmDialog('Supprimer cette tâche ?', `« ${task.name} » sera définitivement supprimée.`);
      if (!ok) return;
      try {
        await api(`/api/tasks/${task._id}?qui=${encodeURIComponent(state.user || '')}`, { method: 'DELETE' });
        state.tasks = state.tasks.filter(t => t._id !== task._id);
        render();
        toast('Tâche supprimée');
      } catch (error) { toast(error.message, 'error'); }
    }
  });

  // ── Courses ──────────────────────────────────────────────
  $('#course-form').addEventListener('submit', async e => {
    e.preventDefault();
    const input = $('#course-input');
    const name = input.value.trim();
    if (!name) return;
    input.value = '';
    try {
      const created = await api('/api/courses', { method: 'POST', body: { name, by: state.user || '' } });
      state.courses.push(created);
      render();
    } catch (error) { input.value = name; toast(error.message, 'error'); }
    input.focus();
  });

  async function saveCourse(item) {
    const id = item.dataset.id;
    const name = $('.edit-input', item).value.trim();
    const course = state.courses.find(c => c._id === id);
    if (!name || !course) { state.editingCourseId = null; return renderCourses(); }
    try {
      const updated = await api(`/api/courses/${id}`, { method: 'PUT', body: { name, by: state.user || '' } });
      state.courses = state.courses.map(c => c._id === id ? updated : c);
      toast('Article modifié');
    } catch (error) { toast(error.message, 'error'); }
    state.editingCourseId = null;
    render();
  }

  $('#course-list').addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const item = btn.closest('.item');
    const course = state.courses.find(c => c._id === item.dataset.id);
    if (!course) return;

    switch (btn.dataset.action) {
      case 'edit': state.editingCourseId = course._id; renderCourses(); break;
      case 'cancel': state.editingCourseId = null; renderCourses(); break;
      case 'save': saveCourse(item); break;
      case 'toggle': {
        const prev = !!course.checked;
        course.checked = !prev;
        render();
        try {
          await api(`/api/courses/${course._id}/checked`, { method: 'PATCH', body: { checked: course.checked } });
        } catch (error) { course.checked = prev; render(); toast(error.message, 'error'); }
        break;
      }
      case 'delete':
        try {
          await api(`/api/courses/${course._id}?qui=${encodeURIComponent(state.user || '')}`, { method: 'DELETE' });
          state.courses = state.courses.filter(c => c._id !== course._id);
          render();
        } catch (error) { toast(error.message, 'error'); }
        break;
    }
  });

  $('#course-list').addEventListener('keydown', e => {
    if (!e.target.classList.contains('edit-input')) return;
    if (e.key === 'Enter') { e.preventDefault(); saveCourse(e.target.closest('.item')); }
    if (e.key === 'Escape') { state.editingCourseId = null; renderCourses(); }
  });

  $('#btn-clear-checked').addEventListener('click', async () => {
    const n = state.courses.filter(c => c.checked).length;
    const ok = await confirmDialog('Retirer les articles cochés ?', `${n} article${n > 1 ? 's' : ''} sera${n > 1 ? 'ont' : ''} supprimé${n > 1 ? 's' : ''} de la liste.`, 'Retirer');
    if (!ok) return;
    try {
      await api('/api/courses', { method: 'DELETE' });
      state.courses = state.courses.filter(c => !c.checked);
      render();
    } catch (error) { toast(error.message, 'error'); }
  });

  // ── Filtres ──────────────────────────────────────────────
  function bindChips(selector, key) {
    $(selector).addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      state.filters[key] = chip.dataset.value;
      $$('.chip', $(selector)).forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
      renderTasks();
    });
  }
  bindChips('#filter-status', 'status');
  bindChips('#filter-who', 'who');
  $('#filter-priority').addEventListener('change', e => { state.filters.priority = e.target.value; renderTasks(); });
  $('#sort').addEventListener('change', e => { state.filters.sort = e.target.value; renderTasks(); });
  $('#search').addEventListener('input', e => { state.filters.q = e.target.value; renderTasks(); });

  // ── Utilisateur & thème ──────────────────────────────────
  function renderUser() {
    const u = state.user;
    const av = $('#user-avatar');
    av.className = `avatar ${u ? AVATAR[u] : ''}`;
    av.textContent = u ? INITIAL[u] : '?';
    $('#user-name').textContent = u || 'Qui es-tu ?';
  }

  function setUser(name) {
    state.user = name;
    store.set('lddm_user', name);
    renderUser();
    $('#user-dialog').close();
    if (store.get('lddm_push_accepted') === 'true') syncPush();   // met à jour le nom associé à cet appareil
    updateNotifButton();
  }

  $('#btn-user').addEventListener('click', () => openDialog($('#user-dialog')));
  $$('.user-choice').forEach(b => b.addEventListener('click', () => setUser(b.dataset.user)));

  $('#btn-theme').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    store.set('lddm_theme', next);
    $('meta[name="theme-color"]').setAttribute('content', next === 'dark' ? '#0b1020' : '#f3f5fb');
  });
  $('meta[name="theme-color"]').setAttribute('content',
    document.documentElement.getAttribute('data-theme') === 'dark' ? '#0b1020' : '#f3f5fb');

  // ── Notifications push ───────────────────────────────────
  const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  function urlBase64ToUint8Array(b64) {
    const pad = '='.repeat((4 - b64.length % 4) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  function updateNotifButton() {
    const active = pushSupported && store.get('lddm_push_accepted') === 'true' && Notification.permission === 'granted';
    $('#btn-notif').hidden = !pushSupported || active;
  }

  async function syncPush() {
    if (!pushSupported || !state.user || Notification.permission !== 'granted') return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const { key } = await api('/api/vapid-public-key');
      const sub = (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
      await api('/api/subscribe', { method: 'POST', body: { subscription: sub.toJSON(), userName: state.user } });
    } catch (err) { console.error('Synchronisation push :', err); }
  }

  $('#btn-notif').addEventListener('click', async () => {
    if (!state.user) { openDialog($('#user-dialog')); return; }
    const btn = $('#btn-notif');
    btn.disabled = true;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { toast('Permission refusée dans le navigateur', 'error'); return; }
      await syncPush();
      store.set('lddm_push_accepted', 'true');
      toast('Notifications activées ✅');
    } catch (err) {
      console.error(err); toast("Impossible d'activer les notifications", 'error');
    } finally {
      btn.disabled = false;
      updateNotifButton();
    }
  });

  // ── Synchronisation automatique entre appareils ──────────
  let lastSnapshot = JSON.stringify({ t: state.tasks, c: state.courses });

  function isBusy() {
    return state.editingCourseId || $$('dialog').some(d => d.open) ||
      document.activeElement === $('#search') || document.activeElement === $('#course-input');
  }

  async function refresh() {
    if (document.hidden || isBusy()) return;
    try {
      const data = await api('/api/state');
      const snap = JSON.stringify({ t: data.tasks, c: data.courses });
      if (snap !== lastSnapshot) {
        lastSnapshot = snap;
        state.tasks = data.tasks;
        state.courses = data.courses;
        render();
      }
    } catch { /* hors ligne : on réessaiera */ }
  }

  setInterval(refresh, 20000);
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('online', refresh);

  // ── Initialisation ───────────────────────────────────────
  $('#btn-add-task').addEventListener('click', () => openTaskDialog());
  $('#fab').addEventListener('click', () => openTaskDialog());
  $$('.bottom-nav button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  setTab(store.get('lddm_tab') === 'courses' ? 'courses' : 'tasks');

  tickClock();
  setInterval(tickClock, 1000);
  renderUser();
  render();
  updateNotifButton();
  if (!state.user) openDialog($('#user-dialog'));
  else if (store.get('lddm_push_accepted') === 'true') syncPush();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch(err => console.log('Service worker :', err));
    });
  }
})();
