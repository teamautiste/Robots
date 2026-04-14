/* ── STATE ──────────────────────────────────────────────────────────────── */
const state = {
  currentRobot: null,
  jogMode: 'joint',
  jogStep: 1,
  jogSpeed: 10,
  runSpeed: 25,
  selectedRecipe: '',
  teachRecipe: '',
  robots: [],
  recipes: [],
  currentRecipeData: null,
  selectedRobotTab: 0,
  selectedPointRow: -1,
  positionInterval: null,
  robotsInterval: null,
};

const JOINT_AXES = ['J1','J2','J3','J4','J5','J6'];
const CART_AXES  = ['X','Y','Z','Rx','Ry','Rz'];
const JOINT_UNITS = ['°','°','°','°','°','°'];
const CART_UNITS  = ['mm','mm','mm','°','°','°'];

/* ── SOCKET.IO ──────────────────────────────────────────────────────────── */
const socket = io();

socket.on('connect', () => console.log('[WS] Connected'));

socket.on('robot_status', (data) => {
  const robot = state.robots.find(r => r.id === data.robot_id);
  if (robot) {
    robot.status = data.status;
    robot.error  = data.error;
    robot.connected = data.status === 'connected';
  }
  renderMainTable();
  updateHeaderStatus();
  refreshJogRobotSelect();
  if (data.status === 'connected') addLog('ok', `[OK] Robot ${data.robot_id} conectado (${data.ip})`);
  if (data.status === 'error')     addLog('err', `[ERR] Robot ${data.robot_id}: ${data.error}`);
});

socket.on('sequence_progress', (data) => {
  updateSequenceProgress(data.robot_id, data.step, data.total, data.status);
});

socket.on('sequence_done', (data) => {
  setRunning(false);
  addLog('ok', `[OK] Secuencia '${data.recipe}' finalizada`);
});

socket.on('log', (entry) => {
  addLog(entry.level, `${entry.ts} ${entry.message}`);
});

socket.on('ups_alert', (data) => {
  const banner = document.getElementById('ups-banner');
  const indicator = document.getElementById('ups-indicator');
  const upsText   = document.getElementById('ups-text');
  const upsDot    = document.getElementById('ups-dot');
  const upsStatus = document.getElementById('ups-status-text');

  if (data.type === 'lost') {
    document.getElementById('ups-banner-msg').textContent =
      `¡Corte de energía! Batería al ${data.battery}%. Secuencias detenidas.`;
    banner.classList.add('show');
    indicator.classList.add('lost');
    upsText.textContent = `Batería ${data.battery}%`;
    upsDot.style.background = 'var(--danger)';
    upsStatus.textContent = `En batería (${data.battery}%)`;
    setRunning(false);
  } else {
    banner.classList.remove('show');
    indicator.classList.remove('lost');
    indicator.classList.add('restored');
    upsText.textContent = 'UPS OK';
    upsDot.style.background = 'var(--success)';
    upsStatus.textContent = 'Energía AC restaurada';
    setTimeout(() => indicator.classList.remove('restored'), 3000);
  }
});

/* ── API HELPER ─────────────────────────────────────────────────────────── */
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(path, opts);
    return await res.json();
  } catch (e) {
    console.error('[API]', method, path, e);
    return { success: false, error: e.message };
  }
}

/* ── TAB SWITCHING ──────────────────────────────────────────────────────── */
function showTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
  const idx = ['main','jogging','config'].indexOf(name);
  document.querySelectorAll('.tab-btn')[idx].classList.add('active');
  if (name === 'config') { loadConfig(); loadRecipesForConfig(); }
}

/* ── ROBOT LIST POLLING ─────────────────────────────────────────────────── */
async function pollRobots() {
  const data = await api('GET', '/api/robots');
  if (!Array.isArray(data)) return;
  state.robots = data;
  renderMainTable();
  updateHeaderStatus();
  refreshJogRobotSelect();
  updateMainRecipeSelect();
}

function renderMainTable() {
  const tbody = document.getElementById('main-robots-body');
  tbody.innerHTML = state.robots.map(r => {
    const badgeCls = { connected:'badge-connected', disconnected:'badge-disconnected', error:'badge-error', connecting:'badge-connecting' }[r.status] || 'badge-disconnected';
    const dotCls   = { connected:'connected', disconnected:'disconnected', error:'error', connecting:'connecting' }[r.status] || 'disconnected';
    const label    = { connected:'Conectado', disconnected:'Desconectado', error:'Error', connecting:'Conectando...' }[r.status] || 'Desconectado';
    return `<tr>
      <td><span style="display:inline-flex;align-items:center;gap:7px;font-weight:500;">
        <span class="dot ${dotCls}"></span>Robot ${r.id}
      </span></td>
      <td><span class="badge ${badgeCls}">${label}</span></td>
      <td><div id="seq-prog-${r.id}" style="display:none;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="progress-wrap" style="flex:1;"><div class="progress-bar" id="pbar-${r.id}" style="width:0%"></div></div>
          <span id="pstep-${r.id}" style="font-size:10px;color:var(--text-secondary);min-width:40px;text-align:right;">0/0</span>
        </div>
      </div></td>
      <td style="font-size:11px;color:var(--danger-text);">${r.error || '—'}</td>
    </tr>`;
  }).join('');

  const connected = state.robots.filter(r => r.connected).length;
  const errors    = state.robots.filter(r => r.status === 'error').length;
  document.getElementById('m-connected').textContent = `${connected} / 8`;
  document.getElementById('m-errors').textContent = errors;
}

function updateSequenceProgress(robotId, step, total, status) {
  const wrap = document.getElementById(`seq-prog-${robotId}`);
  const bar  = document.getElementById(`pbar-${robotId}`);
  const lbl  = document.getElementById(`pstep-${robotId}`);
  if (!wrap) return;
  wrap.style.display = 'block';
  const pct = total > 0 ? Math.round((step / total) * 100) : 0;
  bar.style.width = pct + '%';
  bar.style.background = status === 'Error' ? 'var(--danger)' : status === 'Done' ? 'var(--success)' : 'var(--accent)';
  lbl.textContent = `${step}/${total}`;
}

function updateHeaderStatus() {
  const dot  = document.getElementById('header-dot');
  const text = document.getElementById('header-status');
  if (!state.currentRobot) { dot.className = 'dot disconnected'; text.textContent = 'Sin robot seleccionado'; return; }
  const r = state.robots.find(r => r.id === state.currentRobot);
  if (r) {
    dot.className = `dot ${r.status === 'connected' ? 'connected' : r.status === 'error' ? 'error' : 'disconnected'}`;
    text.textContent = `Robot ${r.id} — ${r.status === 'connected' ? 'Conectado' : r.status === 'error' ? 'Error' : 'Desconectado'}`;
  }
}

/* ── JOG MODE & CONTROLS ────────────────────────────────────────────────── */
function setJogMode(mode, btn) {
  state.jogMode = mode;
  document.querySelectorAll('#jog-mode-pills .pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('jog-axis-label').textContent = mode === 'joint' ? 'Ejes de junta' : 'Ejes cartesianos';
  renderJogButtons();
  renderPosTable();
}

function setStep(val, btn) {
  state.jogStep = val;
  document.querySelectorAll('#step-pills .pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
}

function renderJogButtons() {
  const axes = state.jogMode === 'joint' ? JOINT_AXES : CART_AXES;
  const container = document.getElementById('jog-buttons');
  const disabled = !state.currentRobot;
  container.innerHTML = axes.map(ax => `
    <button class="jog-btn minus" onclick="doJog('${ax}',-1)" ${disabled?'disabled':''}>
      <span class="axis-label">${ax}</span>−
    </button>
    <button class="jog-btn plus" onclick="doJog('${ax}',1)" ${disabled?'disabled':''}>
      <span class="axis-label">${ax}</span>+
    </button>
  `).join('');
}

async function doJog(axis, direction) {
  if (!state.currentRobot) return;
  const speed = parseInt(document.getElementById('jog-speed-slider').value);
  await api('POST', `/api/robots/${state.currentRobot}/jog`, {
    mode: state.jogMode, axis, direction,
    step: state.jogStep, speed,
  });
}

function onJogRobotChange() {
  const sel = document.getElementById('jog-robot-select').value;
  state.currentRobot = sel ? parseInt(sel) : null;
  updateHeaderStatus();
  renderJogButtons();

  const dot  = document.getElementById('jog-dot');
  const text = document.getElementById('jog-status-text');
  const lbl  = document.getElementById('pos-robot-label');

  if (state.currentRobot) {
    const r = state.robots.find(r => r.id === state.currentRobot);
    dot.className  = `dot ${r && r.connected ? 'connected' : 'disconnected'}`;
    text.textContent = r && r.connected ? `Listo — Robot ${state.currentRobot} conectado` : `Robot ${state.currentRobot} no conectado`;
    lbl.textContent = `Robot ${state.currentRobot}`;
    startPositionPolling();
  } else {
    dot.className  = 'dot disconnected';
    text.textContent = 'Sin robot conectado';
    lbl.textContent = '—';
    stopPositionPolling();
    clearPosTable();
  }
}

function refreshJogRobotSelect() {
  const sel = document.getElementById('jog-robot-select');
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Ninguno —</option>' +
    state.robots.filter(r => r.connected).map(r => `<option value="${r.id}">Robot ${r.id}</option>`).join('');
  if (cur) sel.value = cur;
}

/* ── POSITION POLLING ───────────────────────────────────────────────────── */
function startPositionPolling() {
  stopPositionPolling();
  state.positionInterval = setInterval(updatePosition, 250);
}

function stopPositionPolling() {
  if (state.positionInterval) { clearInterval(state.positionInterval); state.positionInterval = null; }
}

async function updatePosition() {
  if (!state.currentRobot) return;
  const data = await api('GET', `/api/robots/${state.currentRobot}/position`);
  if (data.connected) renderPosTable(data.angles, data.coords);
}

function renderPosTable(angles, coords) {
  const axes  = state.jogMode === 'joint' ? JOINT_AXES : CART_AXES;
  const units = state.jogMode === 'joint' ? JOINT_UNITS : CART_UNITS;
  const vals  = state.jogMode === 'joint' ? (angles || new Array(6).fill(0)) : (coords || new Array(6).fill(0));
  const tbody = document.getElementById('pos-tbody');
  tbody.innerHTML = axes.map((ax, i) => `
    <tr>
      <td>${ax}</td>
      <td class="pval">${(vals[i] || 0).toFixed(2)}</td>
      <td style="color:var(--text-secondary);text-align:right;">${units[i]}</td>
    </tr>`).join('');
}

function clearPosTable() {
  document.getElementById('pos-tbody').innerHTML = '';
}

/* ── SERVO CONTROL ──────────────────────────────────────────────────────── */
async function releaseServos() {
  if (!state.currentRobot) return alert('Selecciona un robot primero');
  await api('POST', `/api/robots/${state.currentRobot}/release`);
}

async function focusServos() {
  if (!state.currentRobot) return alert('Selecciona un robot primero');
  await api('POST', `/api/robots/${state.currentRobot}/focus`);
}

/* ── TEACH & GOTO ───────────────────────────────────────────────────────── */
async function onTeachRecipeChange() {
  state.teachRecipe = document.getElementById('teach-recipe-select').value;
  const sel = document.getElementById('teach-point-select');
  sel.innerHTML = '<option value="__new__">Punto nuevo</option>';
  if (!state.teachRecipe) return;
  const recipe = await api('GET', `/api/recipes/${encodeURIComponent(state.teachRecipe)}`);
  if (recipe && state.currentRobot) {
    const points = recipe[`Robot ${state.currentRobot}`] || [];
    points.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.name; opt.textContent = p.name;
      sel.appendChild(opt);
    });
  }
}

async function teachPoint() {
  if (!state.currentRobot) return feedback('Selecciona un robot', 'err');
  if (!state.teachRecipe) return feedback('Selecciona una receta', 'err');
  const sel = document.getElementById('teach-point-select');
  let pointName = sel.value;
  if (pointName === '__new__') {
    pointName = `Punto ${Date.now()}`;
    const inp = prompt('Nombre del nuevo punto:', `Punto ${document.getElementById('teach-point-select').options.length}`);
    if (!inp) return;
    pointName = inp.trim();
  }
  const res = await api('POST', `/api/robots/${state.currentRobot}/teach`, {
    recipe: state.teachRecipe, point: pointName,
  });
  if (res.success) {
    feedback(`✓ '${pointName}' guardado: [${(res.angles||[]).map(v=>v.toFixed(1)).join(', ')}]`, 'ok');
    onTeachRecipeChange();
  } else {
    feedback(`Error: ${res.error}`, 'err');
  }
}

async function goToPoint() {
  if (!state.currentRobot) return feedback('Selecciona un robot', 'err');
  if (!state.teachRecipe) return feedback('Selecciona una receta', 'err');
  const sel = document.getElementById('teach-point-select');
  const pointName = sel.value;
  if (pointName === '__new__') return feedback('Selecciona un punto guardado', 'err');
  const speed = parseInt(document.getElementById('jog-speed-slider').value);
  const res = await api('POST', `/api/robots/${state.currentRobot}/goto`, {
    recipe: state.teachRecipe, point: pointName, speed,
  });
  if (res.success) feedback(`→ Moviendo a '${pointName}'...`, 'ok');
  else feedback(`Error: ${res.error}`, 'err');
}

function addNewPoint() {
  const inp = prompt('Nombre del nuevo punto:');
  if (!inp) return;
  const sel = document.getElementById('teach-point-select');
  const opt = document.createElement('option');
  opt.value = inp.trim(); opt.textContent = inp.trim();
  sel.appendChild(opt); sel.value = inp.trim();
}

function feedback(msg, level) {
  const el = document.getElementById('teach-feedback');
  el.textContent = msg;
  el.style.color = level === 'err' ? 'var(--danger-text)' : level === 'ok' ? 'var(--success-text)' : 'var(--text-secondary)';
}

/* ── SEQUENCE ───────────────────────────────────────────────────────────── */
async function startSequence() {
  const recipe = document.getElementById('main-recipe-select').value;
  if (!recipe) return alert('Selecciona una receta primero');
  const speed = parseInt(document.getElementById('run-speed-slider').value);
  const res = await api('POST', '/api/sequence/start', { recipe, speed });
  if (res.success) { setRunning(true); addLog('ok', `[SEQ] Iniciando '${recipe}' a ${speed}%`); }
  else alert(`Error: ${res.error}`);
}

async function stopSequence() {
  await api('POST', '/api/sequence/stop');
  setRunning(false);
}

function setRunning(running) {
  document.getElementById('run-btn').disabled  = running;
  document.getElementById('stop-btn').disabled = !running;
  if (!running) {
    state.robots.forEach(r => {
      const wrap = document.getElementById(`seq-prog-${r.id}`);
      if (wrap) wrap.style.display = 'none';
    });
  }
}

/* ── MAIN RECIPE SELECT ─────────────────────────────────────────────────── */
function onMainRecipeChange() {
  state.selectedRecipe = document.getElementById('main-recipe-select').value;
}

function updateMainRecipeSelect() {
  const sel = document.getElementById('main-recipe-select');
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Seleccionar —</option>' +
    state.recipes.map(r => `<option value="${r}">${r}</option>`).join('');
  if (cur) sel.value = cur;
}

/* ── CONFIG TAB ─────────────────────────────────────────────────────────── */
async function loadConfig() {
  const data = await api('GET', '/api/config');
  const tbody = document.getElementById('ip-table');
  tbody.innerHTML = Array.from({ length: 8 }, (_, i) => {
    const key = `Robot_${i + 1}`;
    const ip  = data[key] || `192.168.1.${i + 1}`;
    const robot = state.robots.find(r => r.id === i + 1);
    const status = robot ? robot.status : 'disconnected';
    const badgeCls = { connected:'badge-connected', disconnected:'badge-disconnected', error:'badge-error', connecting:'badge-connecting' }[status] || 'badge-disconnected';
    const label    = { connected:'Conectado', disconnected:'Desconectado', error:'Error', connecting:'Conectando...' }[status] || 'Desconectado';
    return `<tr>
      <td style="font-weight:600;width:72px;font-size:12px;">Robot ${i+1}</td>
      <td><input type="text" class="input" id="ip-robot-${i+1}" value="${ip}" style="width:150px;height:28px;font-size:11px;"></td>
      <td><button class="btn btn-sm" onclick="connectRobot(${i+1})">Conectar</button></td>
      <td><span class="badge ${badgeCls}">${label}</span></td>
    </tr>`;
  }).join('');
}

async function saveConfig() {
  const data = {};
  for (let i = 1; i <= 8; i++) {
    const inp = document.getElementById(`ip-robot-${i}`);
    if (inp) data[`Robot_${i}`] = inp.value;
  }
  const res = await api('POST', '/api/config', data);
  if (res.success) alert('Configuración guardada');
}

async function connectRobot(index) {
  await api('POST', `/api/robots/${index}/connect`);
}

/* ── RECIPE MANAGEMENT ──────────────────────────────────────────────────── */
async function loadRecipesForConfig() {
  state.recipes = await api('GET', '/api/recipes');
  if (!Array.isArray(state.recipes)) state.recipes = [];
  renderRecipeList();
  updateMainRecipeSelect();
  updateTeachRecipeSelect();
}

function renderRecipeList() {
  const el = document.getElementById('recipe-list');
  if (!state.recipes.length) {
    el.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:12px;text-align:center;">Sin recetas. Crea una nueva.</div>';
    return;
  }
  el.innerHTML = state.recipes.map((r, i) => `
    <div class="recipe-item ${state.selectedRecipe === r ? 'active' : ''}" onclick="selectRecipe('${r}')">
      <span>${r}</span>
    </div>`).join('');
}

function selectRecipe(name) {
  state.selectedRecipe = name;
  document.getElementById('points-recipe-label').textContent = name;
  renderRecipeList();
  updateMainRecipeSelect();
  loadRecipePoints(name);
}

async function createRecipe() {
  const name = document.getElementById('new-recipe-name').value.trim();
  if (!name) return alert('Ingresa un nombre para la receta');
  const res = await api('POST', '/api/recipes', { name });
  if (res.success) {
    document.getElementById('new-recipe-name').value = '';
    await loadRecipesForConfig();
    selectRecipe(name);
  } else alert(`Error: ${res.error}`);
}

async function deleteRecipe() {
  if (!state.selectedRecipe) return alert('Selecciona una receta');
  if (!confirm(`¿Eliminar receta '${state.selectedRecipe}'?`)) return;
  await api('DELETE', `/api/recipes/${encodeURIComponent(state.selectedRecipe)}`);
  state.selectedRecipe = '';
  await loadRecipesForConfig();
  document.getElementById('points-tbody').innerHTML = '';
  document.getElementById('points-recipe-label').textContent = 'sin selección';
}

function updateTeachRecipeSelect() {
  const sel = document.getElementById('teach-recipe-select');
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Ninguna —</option>' +
    state.recipes.map(r => `<option value="${r}">${r}</option>`).join('');
  if (cur) sel.value = cur;
}

/* ── POINTS TABLE (CONFIG) ──────────────────────────────────────────────── */
let selectedRobotTabForPoints = 1;

function renderRobotTabs() {
  const el = document.getElementById('robot-tabs');
  el.innerHTML = Array.from({ length: 8 }, (_, i) => `
    <button class="rtab ${i + 1 === selectedRobotTabForPoints ? 'active' : ''}"
      onclick="selectRobotTab(${i + 1})">R${i + 1}</button>`).join('');
}

function selectRobotTab(idx) {
  selectedRobotTabForPoints = idx;
  renderRobotTabs();
  if (state.selectedRecipe) loadRecipePoints(state.selectedRecipe);
}

async function loadRecipePoints(recipeName) {
  const recipe = await api('GET', `/api/recipes/${encodeURIComponent(recipeName)}`);
  if (!recipe || recipe.error) return;
  state.currentRecipeData = recipe;
  state.selectedPointRow = -1;
  renderRobotTabs();
  renderPointsTable(recipe);
}

function renderPointsTable(recipe) {
  const robotKey = `Robot ${selectedRobotTabForPoints}`;
  const points   = (recipe && recipe[robotKey]) || [];
  const tbody    = document.getElementById('points-tbody');
  tbody.innerHTML = points.map((p, i) => `
    <tr class="${i === state.selectedPointRow ? 'selected' : ''}" onclick="selectPointRow(${i})">
      <td><input value="${p.name}" onchange="updatePointName(${i}, this.value)"></td>
      ${p.coords.map((v, j) => `<td><input type="number" step="0.01" value="${v.toFixed(2)}" onchange="updatePointCoord(${i},${j},this.value)"></td>`).join('')}
    </tr>`).join('');
}

function selectPointRow(i) {
  state.selectedPointRow = i;
  renderPointsTable(state.currentRecipeData);
}

function updatePointName(rowIdx, val) {
  if (!state.currentRecipeData) return;
  const robotKey = `Robot ${selectedRobotTabForPoints}`;
  if (state.currentRecipeData[robotKey] && state.currentRecipeData[robotKey][rowIdx]) {
    state.currentRecipeData[robotKey][rowIdx].name = val;
  }
}

function updatePointCoord(rowIdx, colIdx, val) {
  if (!state.currentRecipeData) return;
  const robotKey = `Robot ${selectedRobotTabForPoints}`;
  if (state.currentRecipeData[robotKey] && state.currentRecipeData[robotKey][rowIdx]) {
    state.currentRecipeData[robotKey][rowIdx].coords[colIdx] = parseFloat(val) || 0;
  }
}

function addPointRow() {
  if (!state.currentRecipeData) return;
  const robotKey = `Robot ${selectedRobotTabForPoints}`;
  if (!state.currentRecipeData[robotKey]) state.currentRecipeData[robotKey] = [];
  const count = state.currentRecipeData[robotKey].length + 1;
  state.currentRecipeData[robotKey].push({ name: `Punto ${count}`, coords: [0,0,0,0,0,0] });
  renderPointsTable(state.currentRecipeData);
}

function deletePointRow() {
  if (state.selectedPointRow < 0 || !state.currentRecipeData) return;
  const robotKey = `Robot ${selectedRobotTabForPoints}`;
  state.currentRecipeData[robotKey].splice(state.selectedPointRow, 1);
  state.selectedPointRow = Math.max(0, state.selectedPointRow - 1);
  renderPointsTable(state.currentRecipeData);
}

function movePointRow(dir) {
  if (state.selectedPointRow < 0 || !state.currentRecipeData) return;
  const robotKey = `Robot ${selectedRobotTabForPoints}`;
  const pts = state.currentRecipeData[robotKey];
  const ni  = state.selectedPointRow + dir;
  if (ni < 0 || ni >= pts.length) return;
  [pts[state.selectedPointRow], pts[ni]] = [pts[ni], pts[state.selectedPointRow]];
  state.selectedPointRow = ni;
  renderPointsTable(state.currentRecipeData);
}

async function savePoints() {
  if (!state.selectedRecipe || !state.currentRecipeData) return;
  const res = await api('PUT', `/api/recipes/${encodeURIComponent(state.selectedRecipe)}`, state.currentRecipeData);
  if (res.success) {
    const fb = document.createElement('div');
    fb.textContent = '✓ Puntos guardados';
    fb.style.cssText = 'color:var(--success-text);font-size:11px;margin-top:4px;';
    const btns = document.querySelector('#tab-config .points-table + div, #tab-config .card div[style*="margin-top:10px"]');
    document.getElementById('points-tbody').after(fb);
    setTimeout(() => fb.remove(), 2000);
  }
}

/* ── LOG ────────────────────────────────────────────────────────────────── */
function addLog(level, msg) {
  const log = document.getElementById('jog-log');
  if (!log) return;
  const d = document.createElement('div');
  d.className = `log-entry log-${level}`;
  d.textContent = msg;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
  if (log.children.length > 100) log.removeChild(log.firstChild);
}

/* ── UPS BANNER ─────────────────────────────────────────────────────────── */
function dismissUPS() {
  document.getElementById('ups-banner').classList.remove('show');
}

/* ── INIT ───────────────────────────────────────────────────────────────── */
async function init() {
  await pollRobots();
  renderJogButtons();
  renderPosTable();
  renderRobotTabs();
  state.robotsInterval = setInterval(pollRobots, 1500);
}

init();
