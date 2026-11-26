// Linux track: services (systemctl, journalctl) on st.services (set up by lxState from init.services).
// A service is active while its process is in st.procs, so killing the process stops it too.
// shortcut: a start fails for one reason only (its config file lacks the required line); no unit files, dependencies
// or restart policies. Add what a lab needs when one needs it.

const lxActive = (st, svc) => st.procs.some(p => p.pid === svc.pid);
const lxSvcState = (st, svc) => (lxActive(st, svc) ? 'active' : svc.failed ? 'failed' : 'inactive');
const lxStamp = () => `Nov 24 ${new Date().toTimeString().slice(0, 8)} lab`;

function lxStop(st, name) {
  const svc = st.services[name];
  if (lxActive(st, svc)) svc.log.push(`${lxStamp()} systemd[1]: Stopped ${name}.service - ${svc.desc}.`);
  st.procs = st.procs.filter(p => p.pid !== svc.pid);
  svc.pid = null;
  svc.failed = false;
}

// start a service: true, or false after writing why into its journal
function lxStart(st, name) {
  const svc = st.services[name], {config} = svc;
  if (lxActive(st, svc)) return true;
  if (config) {
    const node = lxFind(st, config.path);
    if (!node || !lxLines(lxContent(st, node)).some(l => l.trim() === config.line)) {
      svc.pid = null;
      svc.failed = true;
      svc.log.push(`${lxStamp()} ${name}[${st.nextPid++}]: ${config.error}`, `${lxStamp()} systemd[1]: ${name}.service: Failed with result 'exit-code'.`);
      return false;
    }
  }
  svc.pid = st.nextPid++;
  svc.failed = false;
  st.procs.push({pid: svc.pid, user: svc.user, cmd: svc.cmd, cpu: 0, mem: 0.5, tty: '?', stat: 'Ss', start: lxClock()});
  svc.log.push(`${lxStamp()} systemd[1]: Started ${name}.service - ${svc.desc}.`);
  return true;
}

function lxStatus(ctx, name) {
  const {st} = ctx, svc = st.services[name], state = lxSvcState(st, svc);
  ctx.out(`${{active: '●', inactive: '○', failed: '×'}[state]} ${name}.service - ${svc.desc}`);
  ctx.out(`     Loaded: loaded (/usr/lib/systemd/system/${name}.service; ${svc.enabled ? 'enabled' : 'disabled'}; preset: enabled)`);
  ctx.out(`     Active: ${{active: 'active (running)', inactive: 'inactive (dead)', failed: 'failed (Result: exit-code)'}[state]}`);
  if (state === 'active') ctx.out(`   Main PID: ${svc.pid} (${lxBase(svc.cmd.split(' ')[0])})`);
  return state === 'active' ? 0 : 3;
}

const LX_SYSTEMCTL = new Set(['status', 'start', 'stop', 'restart', 'enable', 'disable', 'is-active', 'is-enabled']);

LINUX_CMDS.systemctl = {
  synopsis: 'systemctl status|start|stop|restart|enable|disable|is-active|is-enabled SERVICE',
  run(ctx) {
    const p = lxOpts(ctx, ctx.args, '', '', {'no-pager': 'P'});
    if (!p) return 1;
    const [verb, ...units] = p.rest, {st} = ctx;
    if (!LX_SYSTEMCTL.has(verb)) return lxErr(ctx, `systemctl: ${verb ? `'${verb}'` : 'listing units'} is not available in this lab (${[...LX_SYSTEMCTL].join(', ')})`);
    if (!units.length) return lxErr(ctx, 'Too few arguments.');
    let code = 0;
    for (const unit of units) {
      const name = unit.replace(/\.service$/, ''), svc = Object.hasOwn(st.services, name) ? st.services[name] : null;
      const reading = verb === 'status' || verb.startsWith('is-');
      if (!reading && ctx.user !== 'root') { code = lxErr(ctx, `Failed to ${verb} ${name}.service: Interactive authentication required.`); continue; }
      if (!svc) {
        if (verb === 'status') { ctx.err(`Unit ${name}.service could not be found.`); code = 4; }
        else if (verb === 'is-active') { ctx.out('inactive'); code = 3; }
        else code = lxErr(ctx, `Failed to ${verb} ${name}.service: Unit ${name}.service not found.`);
        continue;
      }
      if (verb === 'status') code = lxStatus(ctx, name) || code;
      else if (verb === 'is-active') { ctx.out(lxSvcState(st, svc)); if (!lxActive(st, svc)) code = 3; }
      else if (verb === 'is-enabled') { ctx.out(svc.enabled ? 'enabled' : 'disabled'); if (!svc.enabled) code = 1; }
      else if (verb === 'enable' || verb === 'disable') {
        const on = verb === 'enable', link = `/etc/systemd/system/multi-user.target.wants/${name}.service`;
        if (svc.enabled !== on) ctx.note(on ? `Created symlink ${link} → /usr/lib/systemd/system/${name}.service.` : `Removed "${link}".`);
        svc.enabled = on;
      } else {
        if (verb !== 'start') lxStop(st, name);
        if (verb !== 'stop' && !lxStart(st, name)) {
          ctx.err(`Job for ${name}.service failed because the control process exited with error code.`);
          code = lxErr(ctx, `See "systemctl status ${name}.service" and "journalctl -xeu ${name}.service" for details.`);
        }
      }
    }
    return code;
  },
};

LINUX_CMDS.journalctl = {
  synopsis: 'journalctl -u SERVICE [-n LINES]',
  run(ctx) {
    const p = lxOpts(ctx, ctx.args, '', 'un', {'no-pager': 'P', unit: 'u', lines: 'n'});
    if (!p) return 1;
    const {o, rest} = p, {st} = ctx;
    if (!o.u || rest.length) return lxErr(ctx, 'journalctl: only journalctl -u SERVICE [-n LINES] is available in this lab');
    if (o.n !== undefined && !/^\d+$/.test(o.n)) return lxErr(ctx, `Failed to parse lines '${o.n}'`);
    // like Ubuntu: only root and the group adm see the system journal
    if (ctx.user !== 'root' && !lxInGroup(st, ctx.user, 'adm')) {
      ctx.err('Hint: You are currently not seeing messages from other users and the system.');
      ctx.out('-- No entries --');
      return 0;
    }
    const name = String(o.u).replace(/\.service$/, ''), log = Object.hasOwn(st.services, name) ? st.services[name].log : [];
    const lines = o.n === undefined ? log : log.slice(log.length - Math.min(+o.n, log.length));
    if (!lines.length) ctx.out('-- No entries --');
    lines.forEach(l => ctx.out(l));
    return 0;
  },
};
