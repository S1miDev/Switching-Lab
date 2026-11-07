// Devices: every node of a lab diagram becomes one device object, built by the factory registered here for the node's type.
// A device owns its configuration, its command line, its Tab keys, its "?" help and its prompt. The console (console.js) and
// the session (session.js) only use this interface, so a new device type is a new file that registers a factory:
//
//   name, type, configurable   the node id, its diagram type, and whether commands can change anything
//   state                      the configuration the lab requirements read through session.config(name) (null on a
//                              display-only device); labs.js relies on these fields, so renaming one fails `npm test`:
//     router  host, cdp, lldp, v6routing, routes [{net, mask, nh, dist}], routes6 [{prefix, iface, nh, dist}], acls {name: {type, entries}},
//             ifs {key: {name, mac, ip, mask, ip6, ll, eui, auto, encap, aclIn, aclOut, helpers, nat, ospf, ospf6, ospfPrio, ospfCost,
//             ospfP2p, hsrp {grp, vip, prio, preempt}, hsrpVer, cdp, shut}},
//             dhcp {name: {net, mask, gw, dns, domain}}, dhcpEx, nat {pat, stat}, svc {ntp, log, dns}, users {name: true},
//             aaa {on, lists {name: methods}}, sec {secret, enc, banner, nolookup, domain, rsa, sshVer},
//             lines {console, vty: {pw, login, local, authList, transport, acIn, sync, timeout}},
//             ospf, ospf6, eigrp, rip: {pid, rid, nets, passive, originate, ver, nosum, refBw}
//     switch  routing, lb, vlans {id: {name}}, stp {mode, prio}, snoop {on, vlans, opt82}, dai {vlans, validate},
//             ports {key: {mode, dtp, noneg, vlan, voice, shut, desc, allowed, native, portfast, bpdu, group, chanMode, psec, psMax,
//             psViolation, psSticky, trust, rate, daiTrust, routed, ip, mask, helpers}}
//     pc      ip, mask, gw, dhcp
//   prompt()                   the console prompt right now
//   run(line, out)             execute one typed line; out(text, cls) takes each line of output
//   complete(line)             Tab: {value, cycle, list}; value is the new input text, cycle the ports to step
//                              through with further Tabs, list a line of options to print
//   help(line, out)            "?": line is what was typed plus the trailing "?" (the session sends "?" and "help" here, not to run)
//   banner()                   the lines shown when its console is opened
//   ports()                    its interfaces or ports (objects with a name, and an ip once addressed)
//
// defineDevice fills in the parts a device can leave out, which other devices use to reach it:
//   gateway(portKey)           the interface a host cabled to that port uses as its gateway, or null
//   routes()                   whether it routes between its interfaces
//   pools()                    the DHCP pools it serves
//   discoverable               whether CDP and LLDP neighbours see it
const DEVICE_TYPES = {}; // node type -> factory(node, session) returning a device

function defineDevice(props) {
  const device = {
    state: null, configurable: false, discoverable: false,
    ports: () => [], gateway: () => null, routes: () => false, pools: () => [],
    banner: () => device.configurable
      ? [`Connected to ${device.name} — type ? or help for available commands.`, 'Press Tab to complete, Up/Down for history.']
      : [`Connected to ${device.name} — this device is not configurable in this lab.`],
    ...props,
  };
  return device;
}

// the port at a device's end of a link. A sandbox link names both ends (pa on a, pb on b). A lab link names one port, the
// router's (port); in every lab the other end of a router link is a switch's Gi0/1 uplink.
function portAt(session, l, name) {
  if (l.pa) return l.a === name ? l.pa : l.pb;
  return session.devices[name]?.type === 'router' ? l.port : 'Gi0/1';
}

// the devices cabled to the one called name, each with the ports that join them: [[device, {mine, theirs}], ...]
const peersOf = (session, name) => session.links.flatMap(l => {
  const other = l.a === name ? l.b : l.b === name ? l.a : null, peer = session.devices[other];
  return peer ? [[peer, {mine: portAt(session, l, name), theirs: portAt(session, l, other)}]] : [];
});
