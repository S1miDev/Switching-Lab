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
    svg += `<g data-dev="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(n.id)}, ${TOPO_TYPES[n.type].label}">` +
      `<rect class="box" x="${n.x}" y="${n.y}" width="${NODE_W}" height="${NODE_H}" rx="12"/>` +
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
  structureChanged();
  labConsole.open(n.id);
  msg(`Added ${n.id}. Drag it to move it; the console is open on it.`);
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
  if (mode === 'cable') {
    if (cabling && cabling.a === id) {
      cabling = null;
      render();
      return msg('Cable cancelled.');
    }
    return openMenu(id);
  }
  labConsole.open(id);
}

function setMode(next) {
  mode = next;
  cabling = null;
  closeMenu();
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === mode));
  render();
  msg({move: 'Drag devices to move them; click one to open its console.', cable: 'Click a device, pick a port, then click the device at the other end.',
    delete: 'Click a device or a cable to delete it.'}[mode]);
}
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

function fillLists() {
  $('sb-preset').replaceChildren(new Option('Start from a preset…', ''), ...SB_PRESETS.map((p, i) => new Option(p.name, i)));
  $('sb-saved').replaceChildren(new Option('Saved sandboxes…', ''), ...savedList().map(s => new Option(s.name, s.name)));
}

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

$('sb-preset').addEventListener('change', e => {
  const p = SB_PRESETS[e.target.value];
  e.target.value = '';
  if (p) openData(p.data, `${p.name}: ${p.desc}`);
});
$('sb-open').addEventListener('click', () => {
  const s = savedList().find(x => x.name === $('sb-saved').value);
  if (s) openData(s.data, `Opened "${s.name}".`);
  else msg('Pick a saved sandbox first.');
});
$('sb-delete').addEventListener('click', () => {
  const name = $('sb-saved').value;
  if (!name) return msg('Pick a saved sandbox first.');
  if (!confirm(`Delete the saved sandbox "${name}"?`)) return;
  store.set(SB_SAVED, savedList().filter(s => s.name !== name));
  fillLists();
  msg(`Deleted "${name}".`);
});
$('sb-save').addEventListener('click', () => {
  const name = $('sb-name').value.trim(), saves = savedList(), at = saves.findIndex(s => s.name === name);
  if (!name) return msg('Type a name first.');
  if (at < 0 && saves.length >= MAX_SAVES) return msg(`You can keep ${MAX_SAVES} saved sandboxes; delete one first.`);
  if (at >= 0) saves[at].data = sb.serialize();
  else saves.push({name, data: sb.serialize()});
  if (!store.set(SB_SAVED, saves)) return msg('The browser would not save it (storage is full or blocked). Use Export instead.');
  fillLists();
  $('sb-saved').value = name;
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
