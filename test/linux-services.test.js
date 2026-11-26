// systemctl and journalctl on the simulated services.
const test = require('node:test');
const assert = require('node:assert');
const get = require('./linux-load');

const DEVICE_TYPES = get('DEVICE_TYPES'), runOn = get('runOn'), lxFind = get('lxFind');

function host() {
  const session = {typed: {}, devices: {}};
  const init = {
    files: [['/etc/web.conf', 'port = 1\n', {owner: 'root', mode: 0o644}]],
    services: [{name: 'web', config: {path: '/etc/web.conf', line: 'port = 80', error: 'bad port'}}, {name: 'up', active: true, pid: 900, enabled: true}],
  };
  const dev = session.devices.lab = DEVICE_TYPES.linux({id: 'lab', init}, session);
  const run = line => runOn(session, 'lab', line).map(l => l.text);
  const sudo = line => { const out = run('sudo ' + line); return dev.asksPassword() ? run('student') : out; };
  return {st: dev.state, run, sudo};
}

test('status, is-active and is-enabled need no root; changes do', () => {
  const {run} = host();
  assert.ok(run('systemctl status up').includes('   Main PID: 900 (up)'));
  assert.deepEqual(run('systemctl is-active up web; echo $?'), ['active', 'inactive', '3']);
  assert.deepEqual(run('systemctl is-enabled web'), ['disabled']);
  assert.deepEqual(run('systemctl start web'), ['Failed to start web.service: Interactive authentication required.']);
  assert.deepEqual(run('systemctl status nope'), ['Unit nope.service could not be found.']);
  assert.deepEqual(run('systemctl status constructor'), ['Unit constructor.service could not be found.']);
});

test('a start fails until the config is right, and the journal says why', () => {
  const {st, run, sudo} = host();
  assert.match(sudo('systemctl start web')[0], /^Job for web.service failed/);
  assert.deepEqual(run('systemctl is-active web'), ['failed']);
  assert.ok(run('journalctl -u web').includes('-- No entries --'));
  assert.ok(sudo('journalctl -u web.service').some(l => l.endsWith(': bad port')));
  lxFind(st, '/etc/web.conf').content = 'port = 80\n';
  assert.deepEqual(sudo('systemctl restart web'), []);
  assert.deepEqual(run('systemctl is-active web'), ['active']);
  assert.equal(sudo('journalctl -u web -n 1').length, 1);
});

test('enable and disable do not start or stop; killing the process stops the service', () => {
  const {st, run, sudo} = host();
  sudo('systemctl enable web');
  assert.equal(st.services.web.enabled, true);
  assert.deepEqual(run('systemctl is-active web'), ['inactive']);
  sudo('kill 900');
  assert.deepEqual(run('systemctl is-active up'), ['inactive']);
  sudo('systemctl start up');
  sudo('systemctl stop up');
  assert.ok(!st.procs.some(p => p.cmd === '/usr/sbin/up'));
});
