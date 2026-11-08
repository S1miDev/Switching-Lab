// Sandbox page: draws the network of sandbox-model.js, handles adding, moving and cabling devices, the packet test and the
// save/open/export/import buttons. The model and the devices do the real work; the console (console.js) is the same one the labs use.

const MAX_SAVES = 20;
// localStorage keys: the sandbox being worked on, the named saves [{name, data}], and a last sandbox that would not open
const SB_CURRENT = 'sandbox-current', SB_SAVED = 'sandbox-saves', SB_BROKEN = 'sandbox-broken';
const EMPTY = {v: 2, pos: {}, log: []};

let sb = createSandbox();
let mode = 'move';  // 'move' (click a device to open its console), 'cable' or 'delete'
let cabling = null; // {a, pa}: the first end of the cable being made
let drag = null;    // {id, dx, dy, startX, startY, moved}
let savedSteps = 0; // the length of the history when it was last saved
let arrived = null; // the device just added: drawn with a short fade-in (css, off with reduced motion)
const canvas = $('topo'), menu = $('sb-menu');

const msg = text => { $('sb-msg').textContent = text; };

// localStorage may be blocked or full: every use goes through here
const store = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } },
};

// ---- drawing ----

function render() {
  let svg = `<svg viewBox="0 0 ${SB_W} ${SB_H}" role="img" aria-label="Network canvas. Drag devices to move them.">`;
  if (!sb.nodes.length) {
    svg += `<rect class="empty" x="60" y="60" width="${SB_W - 120}" height="${SB_H - 120}" rx="14"/>` +
      `<text class="empty-t" x="${SB_W / 2}" y="${SB_H / 2 - 4}">An empty network</text>` +
      `<text class="empty-s" x="${SB_W / 2}" y="${SB_H / 2 + 18}">Click a device above to add it, or pick a preset</text>`;
  }
  let labels = ''; // drawn last, on top of the devices
  sb.links.forEach((l, i) => {
    const a = nodeMid(sb.nodeOf(l.a)), b = nodeMid(sb.nodeOf(l.b)), ends = `x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"`;
    const up = sb.linkUp(l);
    svg += `<line class="link${up ? '' : ' down'}" ${ends}/>` +
      `<line class="hit" data-cable="${i}" ${ends}><title>${esc(l.a)} ${esc(l.pa)} to ${esc(l.b)} ${esc(l.pb)}${up ? '' : ' (shut down)'}. Delete mode: click to remove.</title></line>`;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1) return;
    const d = {x: (b.x - a.x) / len, y: (b.y - a.y) / len};
    labels += portChip(sb.nodeOf(l.a), d, l.pa) + portChip(sb.nodeOf(l.b), {x: -d.x, y: -d.y}, l.pb);
  });
  for (const n of sb.nodes) {
    // lamp: green when the device has a cable that is up, grey when it has none or only dead ones
    const lit = sb.links.some(l => (l.a === n.id || l.b === n.id) && sb.linkUp(l));
    svg += `<g data-dev="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(n.id)}, ${TOPO_TYPES[n.type].label}"${n.id === arrived ? ' class="arrive"' : ''}>` +
      `<rect class="box" x="${n.x}" y="${n.y}" width="${NODE_W}" height="${NODE_H}" rx="12"/>` +
      `<circle class="lamp${lit ? ' on' : ''}" cx="${n.x + NODE_W - 12}" cy="${n.y + 12}" r="4"><title>${lit ? 'Has a cable that is up' : 'No working cable'}</title></circle>` +
      `<circle class="ico-bg" cx="${n.x + 22}" cy="${n.y + 22}" r="16"/>` +
      `<g class="icon" transform="translate(${n.x + 13} ${n.y + 13}) scale(0.75)">${TOPO_ICONS[n.type]}</g>` +
      `<text class="name" x="${n.x + 44}" y="${n.y + 19}">${esc(n.id)}</text>` +
      `<text class="sub" x="${n.x + 44}" y="${n.y + 33}">${TOPO_TYPES[n.type].sub}</text></g>`;
  }
  canvas.innerHTML = svg + labels + '</svg>';
  const open = document.querySelector('.tab.active')?.dataset.dev; // the device whose console is open
  if (open) canvas.querySelector(`[data-dev="${open}"]`)?.classList.add('sel');
  if (cabling) canvas.querySelector(`[data-dev="${cabling.a}"]`)?.classList.add('pend');
}

// ---- changes ----

// something about the network or a device changed: redraw, refresh the PC list and keep the work in the browser
function changed() {
  render();
  const src = $('sb-src'), keep = src.value, pcs = sb.nodes.filter(n => n.type === 'pc').map(n => n.id);
  src.replaceChildren(...pcs.map(id => new Option(id, id)));
  if (pcs.includes(keep)) src.value = keep;
  store.set(SB_CURRENT, sb.serialize());
  savedSteps = sb.log.length;
}

// after each console command: only a command that changed a device (and so went into the history) needs a redraw and a save
function afterCommand() {
  if (sb.log.length !== savedSteps) changed();
}

// devices were added or removed: the console needs new tabs too
function structureChanged() {
  labConsole.sync();
  changed();
}

// replace the whole network (a preset, a saved sandbox, an imported file or a new one)
function setSandbox(next, text) {
  sb = next;
  cabling = null;
  closeMenu();
  labConsole.show(sb, afterCommand);
  changed();
  msg(text);
}

function addDevice(type, x, y) {
  const n = sb.addNode(type, x, y);
  if (typeof n === 'string') return msg(n);
  arrived = n.id;
  structureChanged();
  arrived = null;
  showDock(true);
  labConsole.open(n.id);
  msg(`Added ${n.id}. Drag it to move it; the console is open on it.`);
}

// Undo the last step: the history is a replay, so loading it one step shorter is exact. Positions are kept.
function undo() {
  if (!sb.log.length) return msg('Nothing to undo.');
  try {
    setSandbox(loadSandbox(sb.undoData()), 'Undid the last step.');
  } catch (err) {
    msg(err.message);
  }
}

function removeDevice(id) {
  if (!confirm(`Delete ${id}, its cables and its configuration?`)) return;
  const why = sb.removeNode(id);
  if (why) return msg(why);
  structureChanged();
  msg(`Deleted ${id}.`);
}

// ---- cabling: pick a free port on each end from a small menu next to the device ----

function closeMenu() { menu.hidden = true; }

function openMenu(id) {
  const n = sb.nodeOf(id), free = sbPorts(n.type).filter(p => !sb.cableOn(id, p));
  if (!free.length) return msg(`${id} has no free port.`);
  const buttons = free.map(port => {
    const b = el('button', 'ghost', port);
    b.type = 'button';
    b.dataset.port = port;
    return b;
  });
  menu.replaceChildren(el('p', 'note', cabling ? `Cable ${cabling.a} ${cabling.pa} to ${id}, port:` : `Cable from ${id}, port:`), ...buttons);
  const r = canvas.querySelector('svg').getBoundingClientRect(), w = canvas.parentElement.getBoundingClientRect(), scale = r.width / SB_W;
  menu.style.left = clamp(r.left - w.left + (n.x + NODE_W) * scale, 0, Math.max(0, w.width - 180)) + 'px';
  menu.style.top = clamp(r.top - w.top + n.y * scale, 0, Math.max(0, w.height - 120)) + 'px';
  menu.hidden = false;
  menu.dataset.owner = id;
  buttons[0].focus();
}

menu.addEventListener('click', e => {
  const port = e.target.closest('[data-port]')?.dataset.port, id = menu.dataset.owner;
  if (!port) return;
  closeMenu();
  if (!cabling) {
    cabling = {a: id, pa: port};
    msg(`Now click the device to cable ${id} ${port} to (click ${id} again to cancel).`);
    return render();
  }
  const first = cabling;
  cabling = null;
  const why = sb.connect(first.a, first.pa, id, port);
  msg(why || `Cabled ${first.a} ${first.pa} to ${id} ${port}.`);
  changed();
});

// what a click on a device does in the current mode
function activate(id) {
  closeMenu();
  if (mode === 'delete') return removeDevice(id);
  if (mode === 'copy') { // a new device of the same type; its configuration is not copied
    const p = sb.freeSpot(), n = sb.nodeOf(id);
    return addDevice(n.type, p.x, p.y);
  }
  if (mode === 'cable') {
    if (cabling && cabling.a === id) {
      cabling = null;
      render();
      return msg('Cable cancelled.');
    }
    return openMenu(id);
  }
  showDock(true);
  labConsole.open(id);
}

function setMode(next) {
  mode = next;
  cabling = null;
  closeMenu();
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === mode));
  render();
  msg({move: 'Drag devices to move them; click one to open its console.', cable: 'Click a device, pick a port, then click the device at the other end.',
    delete: 'Click a device or a cable to delete it.', copy: 'Click a device to add another of the same type (its configuration is not copied).'}[mode]);
}
$('sb-undo').addEventListener('click', undo);

// the console and packet test sit in a dock under the canvas; it opens when a device is opened
const dock = $('sb-dock'), dockBtn = $('sb-dock-toggle');
function showDock(show) {
  dock.hidden = !show;
  dockBtn.textContent = show ? 'Hide console' : 'Show console';
  dockBtn.setAttribute('aria-expanded', show);
}
dockBtn.addEventListener('click', () => showDock(dock.hidden));
// one letter picks a tool, like the live editor (not while typing in a field)
const KEYS = {v: 'move', l: 'cable', c: 'copy', d: 'delete'};
document.addEventListener('keydown', e => {
  const mode = KEYS[e.key.toLowerCase()];
  if (!mode || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
  setMode(mode);
});
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) {
    e.preventDefault();
    undo();
  }
});
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

// ---- the canvas: drag a device to move it; a press that does not move counts as a click ----

canvas.addEventListener('pointerdown', e => {
  closeMenu();
  const g = e.target.closest('[data-dev]');
  if (!g) return;
  const n = sb.nodeOf(g.dataset.dev), p = svgPoint(canvas, e);
  drag = {id: n.id, dx: p.x - n.x, dy: p.y - n.y, startX: e.clientX, startY: e.clientY, moved: false};
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5) return;
  drag.moved = true;
  const p = svgPoint(canvas, e);
  sbPlace(sb.nodeOf(drag.id), p.x - drag.dx, p.y - drag.dy);
  render();
});
canvas.addEventListener('pointerup', () => {
  const d = drag;
  drag = null;
  if (!d) return;
  if (d.moved) store.set(SB_CURRENT, sb.serialize());
  else activate(d.id);
});
canvas.addEventListener('pointercancel', () => { drag = null; });
canvas.addEventListener('keydown', e => {
  const g = e.target.closest?.('[data-dev]');
  if (g && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    activate(g.dataset.dev);
  }
});
// a cable is removed by clicking it in delete mode
canvas.addEventListener('click', e => {
  const line = e.target.closest('[data-cable]');
  if (!line || mode !== 'delete') return;
  const l = sb.links[Number(line.dataset.cable)];
  msg(sb.disconnect(l.a, l.pa) || 'Cable removed.');
  changed();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || (!cabling && menu.hidden)) return;
  cabling = null;
  closeMenu();
  render();
  msg('Cable cancelled.');
});

// ---- the palette: click a device to add it, or drag it onto the canvas ----

for (const type of SB_TYPES) {
  const chip = el('button', 'topo-chip', TOPO_TYPES[type].label);
  chip.type = 'button';
  chip.insertAdjacentHTML('afterbegin', `<svg class="chip-ico" viewBox="0 0 24 24" aria-hidden="true">${TOPO_ICONS[type]}</svg>`);
  dragFromChip(chip, TOPO_TYPES[type].label, canvas, p => addDevice(type, p.x - NODE_W / 2, p.y - NODE_H / 2),
    () => msg('Drop the device on the canvas.'));
  chip.addEventListener('click', () => {
    if (chip.dragged) return void (chip.dragged = false); // the drag already handled it
    const p = sb.freeSpot();
    addDevice(type, p.x, p.y);
  });
  $('sb-chips').append(chip);
}

// ---- packet test ----

function animate(path, ok) {
  if (!path || path.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const svg = canvas.querySelector('svg'), dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('r', 8);
  dot.setAttribute('class', ok ? 'pkt' : 'pkt lost');
  svg.append(dot);
  const pts = path.map(id => nodeMid(sb.nodeOf(id))), HOP = 600, total = HOP * (pts.length - 1), t0 = performance.now();
  (function step(now) {
    // a frame's timestamp can be a hair before t0
    const t = clamp(now - t0, 0, total), i = Math.min(Math.floor(t / HOP), pts.length - 2), f = (t - i * HOP) / HOP;
    dot.setAttribute('cx', pts[i].x + (pts[i + 1].x - pts[i].x) * f);
    dot.setAttribute('cy', pts[i].y + (pts[i + 1].y - pts[i].y) * f);
    if (t < total && dot.isConnected) requestAnimationFrame(step);
    else setTimeout(() => dot.remove(), 400);
  })(t0);
}

$('sb-ping').addEventListener('submit', e => {
  e.preventDefault();
  const src = $('sb-src').value, ip = $('sb-dst').value.trim();
  const list = $('sb-events');
  const say = events => list.replaceChildren(...events.map(ev => el('li', ev.cls, ev.text)));
  if (!src) return say([{text: 'Add a PC and cable it first.', cls: 'err'}]);
  if (!DOTTED.test(ip)) return say([{text: 'Type the destination as an IPv4 address, like 192.168.20.10.', cls: 'err'}]);
  const result = sb.ping(src, ip);
  say(result.events);
  animate(result.path, result.ok);
});

// ---- saving, opening, exporting, importing ----

const savedList = () => { const s = store.get(SB_SAVED); return Array.isArray(s) ? s : []; };

// a small picture of a save: boxes where the devices are and lines for the 'cable' steps (from the data, no replay)
function thumb(data) {
  const pos = data?.pos && typeof data.pos === 'object' ? data.pos : {}, mid = id => (pos[id] || [0, 0]).map((v, i) => (+v || 0) + (i ? NODE_H : NODE_W) / 2);
  const lines = (data?.log || []).filter(e => e[0] === 'cable').map(e => {
    const [x1, y1] = mid(e[1]), [x2, y2] = mid(e[3]);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join('');
  const boxes = Object.keys(pos).map(id => `<rect x="${+pos[id][0] || 0}" y="${+pos[id][1] || 0}" width="${NODE_W}" height="${NODE_H}" rx="12"/>`).join('');
  return `<svg class="sb-thumb" viewBox="0 0 ${SB_W} ${SB_H}" aria-hidden="true">${lines}${boxes}</svg>`;
}

function card(name, desc, data, ...buttons) {
  const c = el('article', 'sb-card');
  c.insertAdjacentHTML('afterbegin', thumb(data));
  c.append(el('h3', '', name), el('p', 'note', desc), ...buttons);
  return c;
}

function fillLists() {
  const q = $('sb-search').value.trim().toLowerCase();
  const presets = SB_PRESETS.filter(p => `${p.name} ${p.desc}`.toLowerCase().includes(q)).map(p => {
    const b = el('button', 'ghost', 'Use this');
    b.type = 'button';
    b.addEventListener('click', () => openData(p.data, `${p.name}: ${p.desc}`));
    return card(p.name, p.desc, p.data, b);
  });
  $('sb-presets').replaceChildren(...(presets.length ? presets : [el('p', 'note', 'No presets match your search.')]));
  const saves = savedList().map(s => {
    const open = el('button', 'ghost', 'Open'), del = el('button', 'ghost', 'Delete');
    open.type = del.type = 'button';
    open.addEventListener('click', () => openData(s.data, `Opened "${s.name}".`));
    del.addEventListener('click', () => {
      if (!confirm(`Delete the saved sandbox "${s.name}"?`)) return;
      store.set(SB_SAVED, savedList().filter(x => x.name !== s.name));
      fillLists();
      msg(`Deleted "${s.name}".`);
    });
    return card(s.name, `${s.data?.pos ? Object.keys(s.data.pos).length : 0} devices`, s.data, open, del);
  });
  $('sb-saves').replaceChildren(...(saves.length ? saves : [el('p', 'note', 'Nothing saved yet. Name your sandbox above and press Save.')]));
}
$('sb-search').addEventListener('input', fillLists);

// hand the browser a file to save
function download(data, name) {
  const a = el('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], {type: 'application/json'}));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// replace the network with data from a preset, a save or a file; says why when the data is not usable
function openData(data, text) {
  if (sb.nodes.length && !confirm('Replace the sandbox you are working on? Anything not saved or exported is lost.')) return;
  try {
    setSandbox(loadSandbox(data), text);
  } catch (err) {
    msg(err.message);
  }
}

$('sb-share').addEventListener('click', async () => {
  const hash = sbShare(sb.serialize());
  if (!hash) return msg('This sandbox is too big for a link. Use Export instead.');
  const url = location.origin + location.pathname + hash;
  try {
    await navigator.clipboard.writeText(url);
    msg('Link copied. Anyone who opens it gets their own copy of this sandbox.');
  } catch {
    prompt('Copy this link:', url);
  }
});
$('sb-save').addEventListener('click', () => {
  const name = $('sb-name').value.trim(), saves = savedList(), at = saves.findIndex(s => s.name === name);
  if (!name) return msg('Type a name first.');
  if (at < 0 && saves.length >= MAX_SAVES) return msg(`You can keep ${MAX_SAVES} saved sandboxes; delete one first.`);
  if (at >= 0) saves[at].data = sb.serialize();
  else saves.push({name, data: sb.serialize()});
  if (!store.set(SB_SAVED, saves)) return msg('The browser would not save it (storage is full or blocked). Use Export instead.');
  fillLists();
  msg(`Saved "${name}".`);
});
$('sb-export').addEventListener('click', () => {
  download(sb.serialize(), ($('sb-name').value.trim().replace(/[^\w-]+/g, '-') || 'sandbox') + '.swlab.json');
  msg('Exported. Import the file to open it again, here or on another device.');
});
$('sb-import').addEventListener('click', () => $('sb-file').click());
$('sb-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 5e6) return msg('That file is too big to be a sandbox.');
  try {
    openData(JSON.parse(await file.text()), `Imported ${file.name}.`);
  } catch {
    msg('That file is not a sandbox (it is not valid JSON).');
  }
});
$('sb-clear').addEventListener('click', () => {
  if (!sb.nodes.length) return msg('The canvas is already empty.');
  openData(EMPTY, 'Cleared the canvas.');
});

// ---- start: pick up where the last visit stopped ----

fillLists();
let first = createSandbox(), failed = null;
const last = store.get(SB_CURRENT);
try {
  if (last) first = loadSandbox(last);
} catch (err) {
  failed = err;
  store.set(SB_BROKEN, last); // kept before the empty sandbox below is saved over it
}
sb = first;
labConsole.show(sb, afterCommand);
changed();
if (failed) {
  msg(`Your last sandbox could not be opened (${failed.message}). A copy is kept in this browser.`);
  const b = el('button', 'ghost', 'Download the copy');
  b.type = 'button';
  b.addEventListener('click', () => { download(store.get(SB_BROKEN), 'sandbox-recovered.swlab.json'); b.remove(); });
  $('sb-msg').after(b);
} else if (sb.nodes.length) {
  msg('Welcome back. Your last sandbox is open.');
}
// a share link: open what it carries (asks first when there is work here), then drop the hash so a reload does not ask again
const shared = sbUnshare(location.hash);
if (shared) {
  history.replaceState(null, '', location.pathname + location.search);
  openData(shared, 'Opened the shared sandbox.');
} else if (location.hash.startsWith('#s=')) {
  msg('That share link is not readable.');
}
