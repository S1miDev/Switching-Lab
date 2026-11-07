// Shared by the Topology page (topology.js), the lab diagram (lab.js) and the sandbox (sandbox.js): device icons, types and
// naming, and the canvas helpers both editable canvases use. Nothing here touches the page until it is called.

// device icons (24x24), also used by the lab diagram in lab.js and the palette buttons below
const TOPO_ICONS = {
  router: '<rect x="2" y="9" width="20" height="10" rx="2"/><path d="M6 14h.01M10 14h.01M14 14h.01M12 9V5"/>',
  switch: '<rect x="2" y="10" width="20" height="8" rx="2"/><path d="M6 14h.01M10 14h.01M14 14h.01M18 14h.01"/>',
  mls: '<rect x="2" y="10" width="20" height="8" rx="2"/><path d="M6 14h.01M10 14h.01M14 14h.01M18 14h.01M12 6v3M9 7l3-3 3 3"/>',
  dhcp: '<rect x="4" y="3" width="16" height="6" rx="1"/><rect x="4" y="11" width="16" height="6" rx="1"/><path d="M8 6h.01M8 14h.01M12 20v-3"/>',
  pc: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>',
  notebook: '<rect x="5" y="5" width="14" height="10" rx="1"/><path d="M2 19h20"/>',
  printer: '<path d="M7 9V4h10v5"/><rect x="3" y="9" width="18" height="8" rx="2"/><rect x="7" y="14" width="10" height="6"/>',
  ap: '<rect x="4" y="15" width="16" height="5" rx="2"/><path d="M8.5 11a5 5 0 0 1 7 0M5.5 8a9 9 0 0 1 13 0M12 17.5h.01"/>',
  wlc: '<rect x="2" y="11" width="20" height="8" rx="2"/><path d="M6 15h.01M10 15h.01M9 7.5a4.2 4.2 0 0 1 6 0M12 9.5v1"/>',
};
const TOPO_TYPES = {
  router: {prefix: 'R', label: 'router', sub: 'router', ports: ['Gi0/0', 'Gi0/1', 'Gi0/2']},
  switch: {prefix: 'S', label: 'switch', sub: 'switch', ports: ['Fa0/1', 'Fa0/2', 'Fa0/3', 'Fa0/4', 'Fa0/5', 'Fa0/6', 'Fa0/7', 'Fa0/8']},
  pc: {prefix: 'PC', label: 'PC', sub: 'PC', ports: ['NIC']},
  mls: {prefix: 'MLS', label: 'multilayer switch', sub: 'L3 switch', ports: ['Gi1/0/1', 'Gi1/0/2', 'Gi1/0/3', 'Gi1/0/4', 'Gi1/0/5', 'Gi1/0/6']},
  dhcp: {prefix: 'DHCP', label: 'DHCP server', sub: 'server', ports: ['NIC']},
  notebook: {prefix: 'NB', label: 'notebook', sub: 'notebook', ports: ['NIC']},
  printer: {prefix: 'PRN', label: 'printer', sub: 'printer', ports: ['NIC']},
  ap: {prefix: 'AP', label: 'access point', sub: 'access point', ports: ['Gi0']},
  wlc: {prefix: 'WLC', label: 'wireless LAN controller', sub: 'WLC', ports: ['Gi0/0', 'Gi0/1', 'Gi0/2', 'Gi0/3']},
};
// device names are a type prefix plus a number (R1, MLS2), so the name tells the type
const typeOf = name => Object.keys(TOPO_TYPES).find(type => TOPO_TYPES[type].prefix === name.replace(/\d+$/, ''));

// a device's box on a canvas: x, y is its top-left corner
const NODE_W = 120, NODE_H = 44;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const nodeMid = n => ({x: n.x + NODE_W / 2, y: n.y + NODE_H / 2});

// the pointer position in the canvas's (the svg in container) viewBox coordinates
function svgPoint(container, e) {
  const svg = container.querySelector('svg');
  const point = Object.assign(svg.createSVGPoint(), {x: e.clientX, y: e.clientY});
  return point.matrixTransform(svg.getScreenCTM().inverse());
}

// a port label just outside a device's edge, along the cable (d is the cable's direction, length 1)
function portChip(n, d, port) {
  const c = nodeMid(n), k = Math.min(NODE_W / 2 / (Math.abs(d.x) || 1e-9), NODE_H / 2 / (Math.abs(d.y) || 1e-9)) + 16;
  const x = c.x + d.x * k, y = c.y + d.y * k, w = port.length * 6 + 10;
  return `<g class="pchip"><rect x="${x - w / 2}" y="${y - 8}" width="${w}" height="16" rx="4"/><text x="${x}" y="${y + 3.5}">${esc(port)}</text></g>`;
}

// Dragging a palette chip onto a canvas: a label (#topo-ghost) follows the pointer once it has moved, and on release over
// the canvas onDrop(point in canvas coordinates) runs, elsewhere onMiss(). A press that does not move is left to the chip's
// click handler, which can tell the two apart by chip.dragged (true right after a drag).
function dragFromChip(chip, label, canvas, onDrop, onMiss) {
  chip.addEventListener('pointerdown', e => {
    const ghost = document.getElementById('topo-ghost'), sx = e.clientX, sy = e.clientY;
    chip.dragged = false;
    const follow = ev => {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 5) chip.dragged = true;
      ghost.hidden = !chip.dragged;
      ghost.style.left = ev.clientX + 12 + 'px';
      ghost.style.top = ev.clientY + 12 + 'px';
    };
    const stop = () => {
      chip.removeEventListener('pointermove', follow);
      chip.removeEventListener('pointerup', drop);
      chip.removeEventListener('pointercancel', stop);
      ghost.hidden = true;
    };
    const drop = ev => {
      stop();
      if (!chip.dragged) return;
      const r = canvas.getBoundingClientRect();
      if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) onDrop(svgPoint(canvas, ev));
      else onMiss();
    };
    ghost.textContent = label;
    chip.setPointerCapture(e.pointerId);
    chip.addEventListener('pointermove', follow);
    chip.addEventListener('pointerup', drop);
    chip.addEventListener('pointercancel', stop);
  });
}
