// ? output for every mode, shaped like Cisco's: optional heading, then "  command  description" rows.
// Router lists follow Packet Tracer router output (user, privileged, config, interface and line were copied from
// real screenshots). Switch lists use the command set Packet Tracer's switch supports per mode, with descriptions
// taken from the router output where the command is the same and standard IOS wording otherwise.
const H = {
  enable: ['enable', 'Turn on privileged commands'], disable: ['disable', 'Turn off privileged commands'],
  exit: ['exit', 'Exit from the EXEC'], logout: ['logout', 'Exit from the EXEC'], connect: ['connect', 'Open a terminal connection'],
  disconnect: ['disconnect', 'Disconnect an existing network connection'], resume: ['resume', 'Resume an active network connection'],
  ping: ['ping', 'Send echo messages'], show: ['show', 'Show running system information'], ssh: ['ssh', 'Open a secure shell client connection'],
  telnet: ['telnet', 'Open a telnet connection'], terminal: ['terminal', 'Set terminal line parameters'], traceroute: ['traceroute', 'Trace route to destination'],
  session: ['<1-99>', 'Session number to resume'], no: ['no', 'Negate a command or set its defaults'],
  vlan: ['vlan', 'Configure VLAN parameters'], clear: ['clear', 'Reset functions'], clock: ['clock', 'Manage the system clock'],
  configure: ['configure', 'Enter configuration mode'], copy: ['copy', 'Copy from one file to another'],
  debug: ['debug', "Debugging functions (see also 'undebug')"], undebug: ['undebug', "Disable debugging functions (see also 'debug')"],
  del: ['delete', 'Delete a file'], dir: ['dir', 'List files on a filesystem'], erase: ['erase', 'Erase a filesystem'],
  more: ['more', 'Display the contents of a file'], reload: ['reload', 'Halt and perform a cold restart'],
  setup: ['setup', 'Run the SETUP command facility'], write: ['write', 'Write running configuration to memory, network, or terminal']
};
const rows = (...keys) => keys.map(k => H[k]);
const EXEC_USER = rows('session', 'connect', 'disable', 'disconnect', 'enable', 'exit', 'logout', 'ping', 'resume', 'show', 'ssh', 'telnet', 'terminal', 'traceroute');
const LINE_ROWS = [['access-class', 'Filter connections based on an IP access list'], ['accounting', 'Accounting parameters'], ['databits', 'Set number of data bits per character'], ['exec-timeout', 'Set the EXEC timeout'], ['exit', 'Exit from line configuration mode'], ['flowcontrol', 'Set the flow control'], ['history', 'Enable and control the command history function'], ['ipv6', 'IPv6 options'], ['logging', 'Modify message logging facilities'], ['login', 'Enable password checking'], ['motd-banner', 'Enable the display of the MOTD banner'], H.no, ['parity', 'Set terminal parity'], ['password', 'Set a password'], ['privilege', 'Change privilege level for line'], ['session-limit', 'Set maximum number of sessions'], ['speed', 'Set the transmit and receive speeds'], ['stopbits', 'Set async line stop bits'], ['transport', 'Define transport protocols for line']];
const LINE = {head:'Virtual Line configuration commands:', rows:LINE_ROWS};
const ACL_ROWS = [['default', 'Set a command to its defaults'], ['deny', 'Specify packets to reject'], ['exit', 'Exit from access-list configuration mode'], H.no, ['permit', 'Specify packets to forward'], ['remark', 'Access list entry comment']];
const ROUTING_COMMON = [['default-information', 'Control distribution of default information'], ['default-metric', 'Set metric of redistributed routes'], ['distance', 'Define an administrative distance'], ['distribute-list', 'Filter networks in routing updates'], ['exit', 'Exit from routing protocol configuration mode'], ['maximum-paths', 'Forward packets over multiple paths'], ['neighbor', 'Specify a neighbor router'], ['network', 'Enable routing on an IP network'], H.no, ['passive-interface', 'Suppress routing updates on an interface'], ['redistribute', 'Redistribute information from another routing protocol'], ['timers', 'Adjust routing timers']];
const byName = list => list.sort((a, b) => (a[0] < b[0] ? -1 : 1));
const ROUTER_HELP = {
  user: {head:'Exec commands:', rows:EXEC_USER},
  priv: {head:'Exec commands:', rows:[H.session, ['auto', 'Exec level Automation'], H.clear, H.clock, H.configure, H.connect, H.copy, H.debug, H.del, H.dir, H.disable, H.disconnect, H.enable, H.erase, H.exit, H.logout, ['mkdir', 'Create new directory'], H.more, ['no', 'Disable debugging informations'], H.ping, H.reload, H.resume, ['rmdir', 'Remove existing directory'], ['send', 'Send a message to other tty lines'], H.setup, H.show, H.ssh, H.telnet, H.terminal, H.traceroute, H.undebug, H.vlan, H.write]},
  config: {head:'Configure commands:', rows:[['aaa', 'Authentication, Authorization and Accounting.'], ['access-list', 'Add an access list entry'], ['banner', 'Define a login banner'], ['bba-group', 'Configure BBA Group'], ['boot', 'Modify system boot parameters'], ['cdp', 'Global CDP configuration subcommands'], ['class-map', 'Configure Class Map'], ['clock', 'Configure time-of-day clock'], ['config-register', 'Define the configuration register'], ['crypto', 'Encryption module'], ['default', 'Set a command to its defaults'], ['do', 'To run exec commands in config mode'], ['dot11', 'IEEE 802.11 config commands'], ['enable', 'Modify enable password parameters'], ['end', 'Exit from configure mode'], ['exit', 'Exit from configure mode'], ['flow', 'Global Flow configuration subcommands'], ['hostname', "Set system's network name"], ['interface', 'Select an interface to configure'], ['ip', 'Global IP configuration subcommands'], ['ipv6', 'Global IPv6 configuration commands'], ['key', 'Key management'], ['license', 'Configure license features'], ['line', 'Configure a terminal line'], ['lldp', 'Global LLDP configuration subcommands'], ['logging', 'Modify message logging facilities'], ['login', 'Enable secure login checking'], ['mac-address-table', 'Configure the MAC address table'], ['no', 'Negate a command or set its defaults'], ['ntp', 'Configure NTP'], ['parser', 'Configure parser'], ['policy-map', 'Configure QoS Policy Map'], ['port-channel', 'EtherChannel configuration'], ['priority-list', 'Build a priority list'], ['privilege', 'Command privilege parameters'], ['queue-list', 'Build a custom queue list'], ['router', 'Enable a routing process'], ['secure', 'Secure image and configuration archival commands'], ['security', 'Infra Security CLIs'], ['service', 'Modify use of network based services'], ['snmp-server', 'Modify SNMP engine parameters'], ['spanning-tree', 'Spanning Tree Subsystem'], ['tacacs-server', 'Modify TACACS query parameters'], ['username', 'Establish User Name Authentication'], ['vpdn', 'Virtual Private Dialup Network'], ['vpdn-group', 'VPDN group configuration']]},
  ifc: {head:null, rows:[['arp', 'Set arp type (arpa, probe, snap) or timeout'], ['bandwidth', 'Set bandwidth informational parameter'], ['cdp', 'CDP interface subcommands'], ['channel-group', 'Add this interface to an Etherchannel group'], ['crypto', 'Encryption/Decryption commands'], ['custom-queue-list', 'Assign a custom queue list to an interface'], ['delay', 'Specify interface throughput delay'], ['description', 'Interface specific description'], ['duplex', 'Configure duplex operation.'], ['exit', 'Exit from interface configuration mode'], ['fair-queue', 'Enable Fair Queuing on an Interface'], ['hold-queue', 'Set hold queue depth'], ['ip', 'Interface Internet Protocol config commands'], ['ipv6', 'IPv6 interface subcommands'], ['lldp', 'LLDP interface subcommands'], ['mac-address', 'Manually set interface MAC address'], ['mtu', 'Set the interface Maximum Transmission Unit (MTU)'], H.no, ['pppoe', 'pppoe interface subcommands'], ['pppoe-client', 'pppoe client'], ['priority-group', 'Assign a priority group to an interface'], ['service-policy', 'Configure QoS Service Policy'], ['shutdown', 'Shutdown the selected interface'], ['speed', 'Configure speed operation.']]},
  line: LINE,
  router: {
    ospf: {head:'Router configuration commands:', rows:byName([['area', 'OSPF area parameters'], ['auto-cost', 'Calculate OSPF interface cost according to bandwidth'], ['compatible', 'OSPF router compatibility list'], ['log-adjacency-changes', 'Log changes in adjacency state'], ['router-id', 'router-id for this OSPF process'], ['summary-address', 'Configure IP address summaries'], ...ROUTING_COMMON])},
    eigrp: {head:'Router configuration commands:', rows:byName([['auto-summary', 'Enable automatic network number summarization'], ['eigrp', 'EIGRP specific commands'], ['metric', 'Modify EIGRP routing metrics and parameters'], ['offset-list', 'Add or subtract offset from EIGRP metrics'], ['traffic-share', 'How to compute traffic share over alternate paths'], ['variance', 'Control load balancing variance'], ...ROUTING_COMMON])},
    rip: {head:'Router configuration commands:', rows:byName([['auto-summary', 'Enable automatic network number summarization'], ['offset-list', 'Add or subtract offset from RIP metrics'], ['validate-update-source', 'Perform sanity checks against source address of routing updates'], ['version', 'Set routing protocol version'], ...ROUTING_COMMON])}
  },
  nacl: {std: {head:'Standard Access List configuration commands:', rows:[['<1-2147483647>', 'Sequence Number'], ...ACL_ROWS]}, ext: {head:'Extended Access List configuration commands:', rows:[['<1-2147483647>', 'Sequence Number'], ...ACL_ROWS, ['evaluate', 'Evaluate an access list']].sort((a, b) => (a[0] < b[0] ? -1 : 1))}},
  dhcp: {head:'DHCP pool configuration commands:', rows:[['default-router', 'Default routers'], ['dns-server', 'DNS servers'], ['domain-name', 'Domain name'], ['exit', 'Exit from DHCP pool configuration mode'], ['lease', 'Address lease time'], ['netbios-name-server', 'NetBIOS (WINS) name servers'], ['network', 'Network number and mask'], H.no, ['option', 'Raw DHCP options']]}
};
const SWITCH_HELP = {
  user: {head:'Exec commands:', rows:EXEC_USER},
  priv: {head:'Exec commands:', rows:[H.session, H.clear, H.clock, H.configure, H.connect, H.copy, H.debug, H.del, H.dir, H.disable, H.disconnect, H.enable, H.erase, H.exit, H.logout, H.more, ['no', 'Disable debugging informations'], H.ping, H.reload, H.resume, H.setup, H.show, H.ssh, H.telnet, H.terminal, H.traceroute, H.undebug, H.vlan, H.write]},
  config: {head:'Configure commands:', rows:[['access-list', 'Add an access list entry'], ['banner', 'Define a login banner'], ['boot', 'Modify system boot parameters'], ['cdp', 'Global CDP configuration subcommands'], ['clock', 'Configure time-of-day clock'], ['do', 'To run exec commands in config mode'], ['enable', 'Modify enable password parameters'], ['end', 'Exit from configure mode'], ['exit', 'Exit from configure mode'], ['hostname', "Set system's network name"], ['interface', 'Select an interface to configure'], ['ip', 'Global IP configuration subcommands'], ['line', 'Configure a terminal line'], ['logging', 'Modify message logging facilities'], ['mac-address-table', 'Configure the MAC address table'], H.no, ['port-channel', 'EtherChannel configuration'], ['privilege', 'Command privilege parameters'], ['service', 'Modify use of network based services'], ['snmp-server', 'Modify SNMP engine parameters'], ['spanning-tree', 'Spanning Tree Subsystem'], ['username', 'Establish User Name Authentication'], H.vlan, ['vtp', 'Configure global VTP state']]},
  ifc: {head:null, rows:[['cdp', 'CDP interface subcommands'], ['channel-group', 'Etherchannel/port bundling configuration'], ['channel-protocol', 'Select the channel protocol (LACP, PAgP)'], ['description', 'Interface specific description'], ['duplex', 'Configure duplex operation.'], ['exit', 'Exit from interface configuration mode'], ['mac-address', 'Manually set interface MAC address'], ['mdix', 'Set Media Dependent Interface with Crossover'], ['mls', 'mls interface commands'], H.no, ['shutdown', 'Shutdown the selected interface'], ['spanning-tree', 'Spanning Tree Subsystem'], ['speed', 'Configure speed operation.'], ['storm-control', 'Storm control command'], ['switchport', 'Set switching mode characteristics'], ['tx-ring-limit', 'Configure PA level transmit ring limit']]},
  vlan: {head:'VLAN configuration commands:', rows:[['exit', 'Apply changes, bump revision number, and exit mode'], ['name', 'Ascii name of the VLAN'], H.no]},
  line: LINE
};
function helpEntry(){
  const sw = dev === 'S1', m = sw ? swState.mode : state.mode, set = sw ? SWITCH_HELP : ROUTER_HELP, e = set[m];
  if (m === 'router') return e[state.proto];
  if (m === 'nacl') return e[state.acls[state.aclName].type === 'extended' ? 'ext' : 'std'];
  return e;
}
function help(){
  const e = helpEntry();
  if (!e) return keysNow().forEach(k => print(k));
  const pad = Math.max(12, ...e.rows.map(r => r[0].length + 1)); // Cisco pads the name column to the longest entry
  if (e.head) print(e.head);
  e.rows.forEach(([c, d]) => print('  ' + c.padEnd(pad) + d));
}

// "<command> ?" lists what can follow, like IOS. Each key is the words typed so far ('*' stands for any value),
// each row [next word, description, optional device 'r'|'s']. Only commands the labs use are covered.
const P = (n, d) => [n, d, undefined, true], IP = P('A.B.C.D', 'IP address');
const NEXT = {
  exec: {
    'show': [['running-config', 'Current operating configuration'], ['startup-config', 'Contents of startup configuration'], ['version', 'System hardware and software status'],
      ['ip', 'IP information'], ['ipv6', 'IPv6 information'], ['cdp', 'CDP information'], ['lldp', 'LLDP information'], ['interfaces', 'Interface status and configuration'],
      ['vlan', 'VTP VLAN status', 's'], ['spanning-tree', 'Spanning tree topology', 's'], ['etherchannel', 'EtherChannel information', 's'], ['port-security', 'Show secure port information', 's'],
      ['access-lists', 'List access lists', 'r'], ['ntp', 'Network time protocol', 'r']],
    'show ip': [['interface', 'IP interface status and configuration'], ['route', 'IP routing table', 'r'], ['dhcp', 'Show items in the DHCP database', 'r'], ['nat', 'IP NAT information', 'r'], ['access-lists', 'List IP access lists', 'r']],
    'show ip interface': [['brief', 'Brief summary of IP status and configuration']],
    'show ipv6': [['interface', 'IPv6 interface status and configuration']],
    'show ipv6 interface': [['brief', 'Brief summary of IPv6 status and configuration']],
    'show cdp': [['neighbors', 'CDP neighbor entries']], 'show lldp': [['neighbors', 'LLDP neighbor information']],
    'show interfaces': [['status', 'Show interface line status', 's'], ['trunk', 'Show interface trunk information', 's']],
    'show vlan': [['brief', 'VTP all VLAN status in brief']],
    'ping': [P('WORD', 'Ping destination address or hostname'), IP],
    'copy': [['running-config', 'Copy from current system configuration']],
    'copy running-config': [['startup-config', 'Copy to startup configuration']],
    'terminal': [['length', 'Set number of lines on a screen']],
    'terminal length': [P('<0-512>', 'Number of lines on screen (0 for no pausing)')],
    'write': [['memory', 'Write to NV memory']],
    'configure': [['terminal', 'Configure from the terminal']]
  },
  config: {
    'interface': [['FastEthernet', 'FastEthernet IEEE 802.3'], ['GigabitEthernet', 'GigabitEthernet IEEE 802.3z'], ['Loopback', 'Loopback interface', 'r'], ['Port-channel', 'Ethernet Channel of interfaces', 's'], ['Vlan', 'Catalyst Vlans', 's'], ['range', 'interface range command', 's']],
    'interface *': [], 'interface GigabitEthernet': [P('<0-0>/<0-3>', 'GigabitEthernet interface number')], 'interface FastEthernet': [P('<0-0>/<0-24>', 'FastEthernet interface number')],
    'hostname': [P('WORD', "This system's network name")],
    'vlan': [P('<1-4094>', 'ISL VLAN IDs 1-4094')], 'vlan *': [],
    'ip': [['route', 'Establish static routes', 'r'], ['access-list', 'Named access list', 'r'], ['dhcp', 'Configure DHCP server and relay parameters', 'r'], ['nat', 'Configure NAT', 'r'], ['name-server', 'Specify address of name server to use', 'r'], ['default-gateway', 'Specify default gateway (if not routing IP)', 's']],
    'ip route': [P('A.B.C.D', 'Destination prefix')], 'ip route *': [P('A.B.C.D', 'Destination prefix mask')], 'ip route * *': [P('A.B.C.D', 'Forwarding router\'s address'), P('GigabitEthernet', 'GigabitEthernet IEEE 802.3z')],
    'ip access-list': [['standard', 'Standard Access List'], ['extended', 'Extended Access List']],
    'ip dhcp': [['pool', 'Configure DHCP address pools'], ['excluded-address', 'Prevent DHCP from assigning certain addresses']],
    'ip dhcp pool': [P('WORD', 'Pool name')],
    'ip dhcp excluded-address': [IP],
    'spanning-tree': [['mode', 'Spanning tree operating mode'], ['vlan', 'VLAN Switch Spanning Tree']],
    'spanning-tree mode': [['pvst', 'Per-Vlan spanning tree mode'], ['rapid-pvst', 'Per-Vlan rapid spanning tree mode']],
    'port-channel': [['load-balance', 'Load balancing method']],
    'line': [['console', 'Primary terminal line'], ['vty', 'Virtual terminal']],
    'router': [['ospf', 'Open Shortest Path First (OSPF)'], ['eigrp', 'Enhanced Interior Gateway Routing Protocol (EIGRP)'], ['rip', 'Routing Information Protocol (RIP)']],
    'ntp': [['server', 'Configure NTP server']], 'logging': [['host', 'Set syslog server IP address and parameters']],
    'no': [['ip', 'Interface Internet Protocol config commands'], ['cdp', 'Global CDP configuration subcommands'], ['lldp', 'Global LLDP configuration subcommands']],
    'cdp': [['run', 'Enable CDP']], 'lldp': [['run', 'Enable LLDP']],
    'access-list': [P('<1-99>', 'IP standard access list'), P('<100-199>', 'IP extended access list')],
    'exit': [], 'end': []
  },
  ifc: {
    'ip': [['address', 'Set the IP address of an interface'], ['access-group', 'Specify access control for packets', 'r'], ['helper-address', 'Specify a destination address for UDP broadcasts', 'r'], ['nat', 'NAT interface commands', 'r']],
    'ip address': [IP], 'ip address *': [P('A.B.C.D', 'IP subnet mask')],
    'ip access-group': [P('<1-199>', 'IP access list (standard or extended)'), P('WORD', 'Access-list name')], 'ip access-group *': [['in', 'inbound packets'], ['out', 'outbound packets']],
    'ip helper-address': [IP], 'ip nat': [['inside', 'Inside interface for address translation'], ['outside', 'Outside interface for address translation']],
    'ipv6': [['address', 'Configure IPv6 address on interface']], 'ipv6 address': [P('X:X:X:X::X/<0-128>', 'IPv6 prefix'), ['FE80::1', 'Link-local address']],
    'no': [['shutdown', 'Shutdown the selected interface'], ['ip', 'Interface Internet Protocol config commands'], ['cdp', 'CDP interface subcommands']],
    'cdp': [['enable', 'Enable CDP on interface']],
    'description': [P('LINE', 'Up to 240 characters describing this interface')],
    'shutdown': [],
    'encapsulation': [['dot1Q', 'IEEE 802.1Q Virtual LAN']], 'encapsulation dot1Q': [P('<1-4094>', 'IEEE 802.1Q VLAN ID')],
    'switchport': [['mode', 'Set trunking mode of the interface', 's'], ['access', 'Set access mode characteristics of the interface', 's'], ['trunk', 'Set trunking characteristics of the interface', 's'], ['port-security', 'Security related command', 's']],
    'switchport mode': [['access', 'Set trunking mode to ACCESS unconditionally'], ['trunk', 'Set trunking mode to TRUNK unconditionally']],
    'switchport access': [['vlan', 'Set VLAN when interface is in access mode']], 'switchport access vlan': [P('<1-4094>', 'VLAN ID of the VLAN when this port is in access mode')],
    'switchport trunk': [['allowed', 'Set allowed VLAN characteristics when interface is in trunking mode'], ['native', 'Set trunking native characteristics when interface is in trunking mode']],
    'switchport trunk allowed': [['vlan', 'Set allowed VLANs when interface is in trunking mode']], 'switchport trunk native': [['vlan', 'Set native VLAN when interface is in trunking mode']],
    'channel-group': [P('<1-6>', 'Channel group number')], 'channel-group *': [['mode', 'Etherchannel Mode of the interface']], 'channel-group * mode': [['active', 'Enable LACP unconditionally'], ['passive', 'Enable LACP only if a LACP device is present'], ['on', 'Enable Etherchannel only'], ['desirable', 'Enable PAgP unconditionally'], ['auto', 'Enable PAgP only if a PAgP device is present']],
    'spanning-tree': [['portfast', 'Enable an interface to move directly to forwarding on link up'], ['bpduguard', 'Don\'t accept BPDUs on this interface']]
  }
};
// the words typed so far -> the rows that may follow (null when a word is not valid here)
function nextRows(words, mode) {
  const sw = dev === 'S1', tab = NEXT[mode === 'user' || mode === 'priv' ? 'exec' : mode];
  if (!tab) return null;
  const roots = [...new Set(Object.keys(tab).map(k => k.split(' ')[0]).filter(k => k !== '*'))].map(k => [k, '']);
  const rows = k => (k ? tab[k] || [] : roots).filter(r => !r[2] || r[2] === (sw ? 's' : 'r'));
  let path = '';
  for (const w of words) {
    const kws = rows(path).filter(r => !r[3] && r[0].toLowerCase().startsWith(w));
    const exact = kws.filter(r => r[0].toLowerCase() === w), hit = exact.length ? exact : kws;
    const star = path ? path + ' *' : '*';
    if (hit.length === 1) path = path ? path + ' ' + hit[0][0] : hit[0][0];
    else if (hit.length === 0 && (rows(path).some(r => r[3]) || tab[star])) path = star;
    else return null;
  }
  return rows(path);
}
function helpNext(line) {
  const sw = dev === 'S1', mode = sw ? swState.mode : state.mode, bare = line.slice(0, -1);
  if (!/\s$/.test(bare)) { // "sh?" lists the commands that start with "sh"
    const word = bare.toLowerCase().trim(), e = helpEntry();
    const hits = e ? e.rows.filter(([c]) => c.startsWith(word)) : [];
    return hits.length ? print(hits.map(([c]) => c).join('  ')) : print('% Unrecognized command', 'ln-err');
  }
  const words = bare.toLowerCase().trim().split(/\s+/), rows = nextRows(words, mode);
  if (rows === null) return print('% Unrecognized command', 'ln-err');
  const list = rows.length ? rows : [['<cr>', '']];
  const pad = Math.max(12, ...list.map(r => r[0].length + 1));
  list.forEach(([c, d]) => print('  ' + c.padEnd(pad) + d));
}
