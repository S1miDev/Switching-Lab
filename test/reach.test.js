// Which PCs and gateways a frame reaches across switches (l2Reach in devices/switch.js, canReach in devices/pc.js)
const test = require('node:test');
const assert = require('node:assert');
const get = require('./load');

const createSandbox = get('createSandbox');

// PC1 - S1 =Gi0/1= S2 - PC2, both PCs in VLAN 10 on Fa0/1, same subnet, no gateway; the link is left unconfigured
function twoSwitches() {
  const sb = createSandbox();
  for (const [id, type] of [['S1', 'switch'], ['S2', 'switch'], ['PC1', 'pc'], ['PC2', 'pc']]) sb.add(id, type, 0, 0);
  sb.connect('S1', 'Gi0/1', 'S2', 'Gi0/1');
  sb.connect('S1', 'Fa0/1', 'PC1', 'NIC');
  sb.connect('S2', 'Fa0/1', 'PC2', 'NIC');
  for (const s of ['S1', 'S2']) {
    conf(sb, s, 'int fa0/1', 'switchport mode access', 'switchport access vlan 10', 'no shutdown', 'int gi0/1', 'no shutdown');
  }
  sb.run('PC1', 'ip 192.168.10.1 255.255.255.0');
  sb.run('PC2', 'ip 192.168.10.2 255.255.255.0');
  return sb;
}
const conf = (sb, name, ...lines) => {
  for (const l of ['enable', 'conf t', ...lines, 'end']) sb.run(name, l);
};
const link = (sb, name, ...lines) => conf(sb, name, 'int gi0/1', ...lines);
const pings = sb => sb.devices.PC1.canReach('192.168.10.2');
// configure each end of the link, then ping
const over = (s1, s2) => {
  const sb = twoSwitches();
  link(sb, 'S1', ...s1);
  link(sb, 'S2', ...s2);
  return pings(sb);
};
const TRUNK = ['switchport mode trunk'];

test('same-VLAN PCs ping across a trunk without any gateway', () => {
  assert.ok(over(TRUNK, TRUNK));
});

test('DTP decides whether the link carries tagged VLANs', () => {
  const desirable = ['switchport mode dynamic desirable'], auto = ['switchport mode dynamic auto'];
  assert.ok(over(TRUNK, auto), 'trunk + auto');
  assert.ok(over(desirable, auto), 'desirable + auto');
  assert.ok(!over(auto, auto), 'auto + auto stays access in VLAN 1');
  assert.ok(!over([...TRUNK, 'switchport nonegotiate'], auto), 'nonegotiate sends no DTP');
  assert.ok(!over(TRUNK, ['switchport mode access']), 'trunk against access');
  const access10 = ['switchport mode access', 'switchport access vlan 10'];
  assert.ok(over(access10, access10), 'an access link in the right VLAN');
});

test('allowed list, access VLAN and shutdown each stop the ping', () => {
  assert.ok(!over(TRUNK, [...TRUNK, 'switchport trunk allowed vlan 20']), 'VLAN 10 not allowed');
  const sb = twoSwitches();
  link(sb, 'S1', ...TRUNK);
  link(sb, 'S2', ...TRUNK);
  conf(sb, 'S2', 'int fa0/1', 'switchport access vlan 20');
  assert.ok(!pings(sb), 'wrong access VLAN');
  conf(sb, 'S2', 'int fa0/1', 'switchport access vlan 10', 'shutdown');
  assert.ok(!pings(sb), 'shut PC port');
  conf(sb, 'S2', 'int fa0/1', 'no shutdown');
  assert.ok(pings(sb));
  link(sb, 'S1', 'shutdown');
  assert.ok(!pings(sb), 'shut uplink');
});

test('a native VLAN mismatch moves only the untagged VLAN', () => {
  const native10 = [...TRUNK, 'switchport trunk native vlan 10'];
  assert.ok(over([...TRUNK, 'switchport trunk native vlan 99'], TRUNK), 'VLAN 10 stays tagged');
  assert.ok(over(native10, native10), 'VLAN 10 untagged on both ends');
  assert.ok(!over(native10, TRUNK), 'untagged VLAN 10 lands in VLAN 1');
  // S1 sends VLAN 10 untagged into S2's VLAN 20, and PC2 sits there: still one VLAN end to end, in both directions
  const sb = twoSwitches();
  link(sb, 'S1', ...native10);
  link(sb, 'S2', ...TRUNK, 'switchport trunk native vlan 20');
  conf(sb, 'S2', 'int fa0/1', 'switchport access vlan 20');
  assert.ok(pings(sb), 'VLANs leak into each other, as on real switches');
});

test('PCs on different subnets do not reach each other without a router', () => {
  const sb = twoSwitches();
  link(sb, 'S1', ...TRUNK);
  link(sb, 'S2', ...TRUNK);
  sb.run('PC2', 'ip 192.168.20.2 255.255.255.0');
  assert.ok(!sb.devices.PC1.canReach('192.168.20.2'));
});

test('a router behind two switches is the gateway, and DHCP reaches it', () => {
  const sb = twoSwitches();
  sb.add('R1', 'router', 0, 0);
  sb.connect('S2', 'Fa0/2', 'R1', 'Gi0/0');
  link(sb, 'S1', ...TRUNK);
  link(sb, 'S2', ...TRUNK);
  conf(sb, 'S2', 'int fa0/2', 'switchport mode trunk', 'no shutdown');
  conf(sb, 'R1', 'int gi0/0', 'no shutdown', 'int gi0/0.10', 'encapsulation dot1Q 10', 'ip address 192.168.10.254 255.255.255.0',
    'no shutdown', 'exit', 'ip dhcp pool A', 'network 192.168.10.0 255.255.255.0');
  sb.run('PC1', 'ip 192.168.10.1 255.255.255.0 192.168.10.254');
  assert.ok(sb.devices.PC1.canReach('192.168.10.254'));
  sb.run('PC1', 'dhcp');
  assert.ok(sb.devices.PC1.state.dhcp);
});

test('the preset PCs of the two-switch labs ping once the lab is fixed', () => {
  for (const level of ['beginner', 'expert']) {
    const session = get('createSession')({topic: 'trunkfix', level, net: 5});
    const can = () => session.devices.PC1.canReach(session.config('PC2').ip);
    assert.ok(!can(), `${level} starts broken`);
    for (const [name, lines] of session.solution) lines.forEach(l => session.run(name, l));
    assert.ok(can(), `${level} fixed`);
  }
});
