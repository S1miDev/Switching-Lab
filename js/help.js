// "?" help for every mode, shaped like Cisco's: an optional heading, then "  command  description" rows.
// The router lists follow Packet Tracer's router output (user, privileged, config, interface and line were
// copied from real screenshots). The switch lists use the commands Packet Tracer's switch offers per mode,
// with the router's descriptions where the command is the same and standard IOS wording otherwise.

// rows that appear in several lists
const H = {
  session: ['<1-99>', 'Session number to resume'],
  clear: ['clear', 'Reset functions'],
  clock: ['clock', 'Manage the system clock'],
  configure: ['configure', 'Enter configuration mode'],
  connect: ['connect', 'Open a terminal connection'],
  copy: ['copy', 'Copy from one file to another'],
  debug: ['debug', "Debugging functions (see also 'undebug')"],
  del: ['delete', 'Delete a file'],
  dir: ['dir', 'List files on a filesystem'],
  disable: ['disable', 'Turn off privileged commands'],
  disconnect: ['disconnect', 'Disconnect an existing network connection'],
  enable: ['enable', 'Turn on privileged commands'],
  erase: ['erase', 'Erase a filesystem'],
  exit: ['exit', 'Exit from the EXEC'],
  logout: ['logout', 'Exit from the EXEC'],
  more: ['more', 'Display the contents of a file'],
  no: ['no', 'Negate a command or set its defaults'],
  ping: ['ping', 'Send echo messages'],
  reload: ['reload', 'Halt and perform a cold restart'],
  resume: ['resume', 'Resume an active network connection'],
  setup: ['setup', 'Run the SETUP command facility'],
  show: ['show', 'Show running system information'],
  ssh: ['ssh', 'Open a secure shell client connection'],
  telnet: ['telnet', 'Open a telnet connection'],
  terminal: ['terminal', 'Set terminal line parameters'],
  traceroute: ['traceroute', 'Trace route to destination'],
  undebug: ['undebug', "Disable debugging functions (see also 'debug')"],
  vlan: ['vlan', 'Configure VLAN parameters'],
  write: ['write', 'Write running configuration to memory, network, or terminal'],
};
const byName = rows => rows.sort((a, b) => (a[0] < b[0] ? -1 : 1));

const EXEC_USER = [H.session, H.connect, H.disable, H.disconnect, H.enable, H.exit, H.logout, H.ping, H.resume, H.show, H.ssh, H.telnet,
  H.terminal, H.traceroute];
const LINE = {head: 'Virtual Line configuration commands:', rows: [
  ['access-class', 'Filter connections based on an IP access list'],
  ['accounting', 'Accounting parameters'],
  ['databits', 'Set number of data bits per character'],
  ['exec-timeout', 'Set the EXEC timeout'],
  ['exit', 'Exit from line configuration mode'],
  ['flowcontrol', 'Set the flow control'],
  ['history', 'Enable and control the command history function'],
  ['ipv6', 'IPv6 options'],
  ['logging', 'Modify message logging facilities'],
  ['login', 'Enable password checking'],
  ['motd-banner', 'Enable the display of the MOTD banner'],
  H.no,
  ['parity', 'Set terminal parity'],
  ['password', 'Set a password'],
  ['privilege', 'Change privilege level for line'],
  ['session-limit', 'Set maximum number of sessions'],
  ['speed', 'Set the transmit and receive speeds'],
  ['stopbits', 'Set async line stop bits'],
  ['transport', 'Define transport protocols for line'],
]};
const ACL_ROWS = [
  ['default', 'Set a command to its defaults'],
  ['deny', 'Specify packets to reject'],
  ['exit', 'Exit from access-list configuration mode'],
  H.no,
  ['permit', 'Specify packets to forward'],
  ['remark', 'Access list entry comment'],
];
const ROUTING_COMMON = [
  ['default-information', 'Control distribution of default information'],
  ['default-metric', 'Set metric of redistributed routes'],
  ['distance', 'Define an administrative distance'],
  ['distribute-list', 'Filter networks in routing updates'],
  ['exit', 'Exit from routing protocol configuration mode'],
  ['maximum-paths', 'Forward packets over multiple paths'],
  ['neighbor', 'Specify a neighbor router'],
  ['network', 'Enable routing on an IP network'],
  H.no,
  ['passive-interface', 'Suppress routing updates on an interface'],
  ['redistribute', 'Redistribute information from another routing protocol'],
  ['timers', 'Adjust routing timers'],
];

const OSPF_HELP = {head: 'Router configuration commands:', rows: byName([
  ['area', 'OSPF area parameters'],
  ['auto-cost', 'Calculate OSPF interface cost according to bandwidth'],
  ['compatible', 'OSPF router compatibility list'],
  ['log-adjacency-changes', 'Log changes in adjacency state'],
  ['router-id', 'router-id for this OSPF process'],
  ['summary-address', 'Configure IP address summaries'],
  ...ROUTING_COMMON,
])};

const ROUTER_HELP = {
  user: {head: 'Exec commands:', rows: EXEC_USER},
  priv: {head: 'Exec commands:', rows: [
    H.session, ['auto', 'Exec level Automation'], H.clear, H.clock, H.configure, H.connect, H.copy, H.debug, H.del, H.dir, H.disable,
    H.disconnect, H.enable, H.erase, H.exit, H.logout, ['mkdir', 'Create new directory'], H.more, ['no', 'Disable debugging informations'],
    H.ping, H.reload, H.resume, ['rmdir', 'Remove existing directory'], ['send', 'Send a message to other tty lines'], H.setup, H.show,
    H.ssh, H.telnet, H.terminal, H.traceroute, H.undebug, H.vlan, H.write,
  ]},
  config: {head: 'Configure commands:', rows: [
    ['aaa', 'Authentication, Authorization and Accounting.'],
    ['access-list', 'Add an access list entry'],
    ['banner', 'Define a login banner'],
    ['bba-group', 'Configure BBA Group'],
    ['boot', 'Modify system boot parameters'],
    ['cdp', 'Global CDP configuration subcommands'],
    ['class-map', 'Configure Class Map'],
    ['clock', 'Configure time-of-day clock'],
    ['config-register', 'Define the configuration register'],
    ['crypto', 'Encryption module'],
    ['default', 'Set a command to its defaults'],
    ['do', 'To run exec commands in config mode'],
    ['dot11', 'IEEE 802.11 config commands'],
    ['enable', 'Modify enable password parameters'],
    ['end', 'Exit from configure mode'],
    ['exit', 'Exit from configure mode'],
    ['flow', 'Global Flow configuration subcommands'],
    ['hostname', "Set system's network name"],
    ['interface', 'Select an interface to configure'],
    ['ip', 'Global IP configuration subcommands'],
    ['ipv6', 'Global IPv6 configuration commands'],
    ['key', 'Key management'],
    ['license', 'Configure license features'],
    ['line', 'Configure a terminal line'],
    ['lldp', 'Global LLDP configuration subcommands'],
    ['logging', 'Modify message logging facilities'],
    ['login', 'Enable secure login checking'],
    ['mac-address-table', 'Configure the MAC address table'],
    ['no', 'Negate a command or set its defaults'],
    ['ntp', 'Configure NTP'],
    ['parser', 'Configure parser'],
    ['policy-map', 'Configure QoS Policy Map'],
    ['port-channel', 'EtherChannel configuration'],
    ['priority-list', 'Build a priority list'],
    ['privilege', 'Command privilege parameters'],
    ['queue-list', 'Build a custom queue list'],
    ['router', 'Enable a routing process'],
    ['secure', 'Secure image and configuration archival commands'],
    ['security', 'Infra Security CLIs'],
    ['service', 'Modify use of network based services'],
    ['snmp-server', 'Modify SNMP engine parameters'],
    ['spanning-tree', 'Spanning Tree Subsystem'],
    ['tacacs-server', 'Modify TACACS query parameters'],
    ['username', 'Establish User Name Authentication'],
    ['vpdn', 'Virtual Private Dialup Network'],
    ['vpdn-group', 'VPDN group configuration'],
  ]},
  ifc: {head: null, rows: [
    ['arp', 'Set arp type (arpa, probe, snap) or timeout'],
    ['bandwidth', 'Set bandwidth informational parameter'],
    ['cdp', 'CDP interface subcommands'],
    ['channel-group', 'Add this interface to an Etherchannel group'],
    ['crypto', 'Encryption/Decryption commands'],
    ['custom-queue-list', 'Assign a custom queue list to an interface'],
    ['delay', 'Specify interface throughput delay'],
    ['description', 'Interface specific description'],
    ['duplex', 'Configure duplex operation.'],
    ['exit', 'Exit from interface configuration mode'],
    ['fair-queue', 'Enable Fair Queuing on an Interface'],
    ['hold-queue', 'Set hold queue depth'],
    ['ip', 'Interface Internet Protocol config commands'],
    ['ipv6', 'IPv6 interface subcommands'],
    ['lldp', 'LLDP interface subcommands'],
    ['mac-address', 'Manually set interface MAC address'],
    ['mtu', 'Set the interface Maximum Transmission Unit (MTU)'],
    H.no,
    ['pppoe', 'pppoe interface subcommands'],
    ['pppoe-client', 'pppoe client'],
    ['priority-group', 'Assign a priority group to an interface'],
    ['service-policy', 'Configure QoS Service Policy'],
    ['shutdown', 'Shutdown the selected interface'],
    ['speed', 'Configure speed operation.'],
  ]},
  line: LINE,
  // per routing protocol (state.proto)
  router: {
    ospf: OSPF_HELP,
    ospf6: OSPF_HELP,
    eigrp: {head: 'Router configuration commands:', rows: byName([
      ['auto-summary', 'Enable automatic network number summarization'],
      ['eigrp', 'EIGRP specific commands'],
      ['metric', 'Modify EIGRP routing metrics and parameters'],
      ['offset-list', 'Add or subtract offset from EIGRP metrics'],
      ['traffic-share', 'How to compute traffic share over alternate paths'],
      ['variance', 'Control load balancing variance'],
      ...ROUTING_COMMON,
    ])},
    rip: {head: 'Router configuration commands:', rows: byName([
      ['auto-summary', 'Enable automatic network number summarization'],
      ['offset-list', 'Add or subtract offset from RIP metrics'],
      ['validate-update-source', 'Perform sanity checks against source address of routing updates'],
      ['version', 'Set routing protocol version'],
      ...ROUTING_COMMON,
    ])},
  },
  // per ACL type
  nacl: {
    std: {head: 'Standard Access List configuration commands:', rows: [['<1-2147483647>', 'Sequence Number'], ...ACL_ROWS]},
    ext: {head: 'Extended Access List configuration commands:', rows: byName([
      ['<1-2147483647>', 'Sequence Number'], ...ACL_ROWS, ['evaluate', 'Evaluate an access list'],
    ])},
  },
  dhcp: {head: 'DHCP pool configuration commands:', rows: [
    ['default-router', 'Default routers'],
    ['dns-server', 'DNS servers'],
    ['domain-name', 'Domain name'],
    ['exit', 'Exit from DHCP pool configuration mode'],
    ['lease', 'Address lease time'],
    ['netbios-name-server', 'NetBIOS (WINS) name servers'],
    ['network', 'Network number and mask'],
    H.no,
    ['option', 'Raw DHCP options'],
  ]},
};

const SWITCH_HELP = {
  user: {head: 'Exec commands:', rows: EXEC_USER},
  priv: {head: 'Exec commands:', rows: [
    H.session, H.clear, H.clock, H.configure, H.connect, H.copy, H.debug, H.del, H.dir, H.disable, H.disconnect, H.enable, H.erase, H.exit,
    H.logout, H.more, ['no', 'Disable debugging informations'], H.ping, H.reload, H.resume, H.setup, H.show, H.ssh, H.telnet, H.terminal,
    H.traceroute, H.undebug, H.vlan, H.write,
  ]},
  config: {head: 'Configure commands:', rows: [
    ['access-list', 'Add an access list entry'],
    ['banner', 'Define a login banner'],
    ['boot', 'Modify system boot parameters'],
    ['cdp', 'Global CDP configuration subcommands'],
    ['clock', 'Configure time-of-day clock'],
    ['do', 'To run exec commands in config mode'],
    ['enable', 'Modify enable password parameters'],
    ['end', 'Exit from configure mode'],
    ['exit', 'Exit from configure mode'],
    ['hostname', "Set system's network name"],
    ['interface', 'Select an interface to configure'],
    ['ip', 'Global IP configuration subcommands'],
    ['line', 'Configure a terminal line'],
    ['logging', 'Modify message logging facilities'],
    ['mac-address-table', 'Configure the MAC address table'],
    H.no,
    ['port-channel', 'EtherChannel configuration'],
    ['privilege', 'Command privilege parameters'],
    ['service', 'Modify use of network based services'],
    ['snmp-server', 'Modify SNMP engine parameters'],
    ['spanning-tree', 'Spanning Tree Subsystem'],
    ['username', 'Establish User Name Authentication'],
    H.vlan,
    ['vtp', 'Configure global VTP state'],
  ]},
  ifc: {head: null, rows: [
    ['cdp', 'CDP interface subcommands'],
    ['channel-group', 'Etherchannel/port bundling configuration'],
    ['channel-protocol', 'Select the channel protocol (LACP, PAgP)'],
    ['description', 'Interface specific description'],
    ['duplex', 'Configure duplex operation.'],
    ['exit', 'Exit from interface configuration mode'],
    ['mac-address', 'Manually set interface MAC address'],
    ['mdix', 'Set Media Dependent Interface with Crossover'],
    ['mls', 'mls interface commands'],
    H.no,
    ['shutdown', 'Shutdown the selected interface'],
    ['spanning-tree', 'Spanning Tree Subsystem'],
    ['speed', 'Configure speed operation.'],
    ['storm-control', 'Storm control command'],
    ['switchport', 'Set switching mode characteristics'],
    ['tx-ring-limit', 'Configure PA level transmit ring limit'],
  ]},
  vlan: {head: 'VLAN configuration commands:', rows: [
    ['exit', 'Apply changes, bump revision number, and exit mode'],
    ['name', 'Ascii name of the VLAN'],
    H.no,
  ]},
  line: LINE,
};

// "<command> ?" lists what can follow, like IOS. Keys are the words typed so far ('*' stands for any value).
// Rows are [next word, description, device ('r' = R1 only, 's' = S1 only), isValue]; isValue marks a value
// to type (an address, a number) rather than a keyword. Only the commands the labs use are covered.
const arg = (name, desc) => [name, desc, undefined, true];
const IP_ARG = arg('A.B.C.D', 'IP address');
const NEXT = {
  exec: {
    'show': [
      ['running-config', 'Current operating configuration'],
      ['startup-config', 'Contents of startup configuration'],
      ['version', 'System hardware and software status'],
      ['ip', 'IP information'],
      ['ipv6', 'IPv6 information'],
      ['cdp', 'CDP information'],
      ['lldp', 'LLDP information'],
      ['interfaces', 'Interface status and configuration'],
      ['vlan', 'VTP VLAN status', 's'],
      ['spanning-tree', 'Spanning tree topology', 's'],
      ['etherchannel', 'EtherChannel information', 's'],
      ['port-security', 'Show secure port information', 's'],
      ['access-lists', 'List access lists', 'r'],
      ['ntp', 'Network time protocol', 'r'],
    ],
    'show ip': [
      ['interface', 'IP interface status and configuration'],
      ['route', 'IP routing table', 'r'],
      ['dhcp', 'Show items in the DHCP database', 'r'],
      ['nat', 'IP NAT information', 'r'],
      ['access-lists', 'List IP access lists', 'r'],
    ],
    'show ip interface': [['brief', 'Brief summary of IP status and configuration']],
    'show ipv6': [['interface', 'IPv6 interface status and configuration']],
    'show ipv6 interface': [['brief', 'Brief summary of IPv6 status and configuration']],
    'show cdp': [['neighbors', 'CDP neighbor entries']],
    'show lldp': [['neighbors', 'LLDP neighbor information']],
    'show interfaces': [['status', 'Show interface line status', 's'], ['trunk', 'Show interface trunk information', 's']],
    'show vlan': [['brief', 'VTP all VLAN status in brief']],
    'ping': [arg('WORD', 'Ping destination address or hostname'), IP_ARG],
    'copy': [['running-config', 'Copy from current system configuration']],
    'copy running-config': [['startup-config', 'Copy to startup configuration']],
    'terminal': [['length', 'Set number of lines on a screen']],
    'terminal length': [arg('<0-512>', 'Number of lines on screen (0 for no pausing)')],
    'write': [['memory', 'Write to NV memory']],
    'configure': [['terminal', 'Configure from the terminal']],
  },
  config: {
    'interface': [
      ['FastEthernet', 'FastEthernet IEEE 802.3'],
      ['GigabitEthernet', 'GigabitEthernet IEEE 802.3z'],
      ['Loopback', 'Loopback interface', 'r'],
      ['Port-channel', 'Ethernet Channel of interfaces', 's'],
      ['Vlan', 'Catalyst Vlans', 's'],
      ['range', 'interface range command', 's'],
    ],
    'interface *': [],
    'interface GigabitEthernet': [arg('<0-0>/<0-3>', 'GigabitEthernet interface number')],
    'interface FastEthernet': [arg('<0-0>/<0-24>', 'FastEthernet interface number')],
    'hostname': [arg('WORD', "This system's network name")],
    'vlan': [arg('<1-4094>', 'ISL VLAN IDs 1-4094')],
    'vlan *': [],
    'ip': [
      ['route', 'Establish static routes', 'r'],
      ['access-list', 'Named access list', 'r'],
      ['dhcp', 'Configure DHCP server and relay parameters', 'r'],
      ['nat', 'Configure NAT', 'r'],
      ['name-server', 'Specify address of name server to use', 'r'],
      ['default-gateway', 'Specify default gateway (if not routing IP)', 's'],
    ],
    'ip route': [arg('A.B.C.D', 'Destination prefix')],
    'ip route *': [arg('A.B.C.D', 'Destination prefix mask')],
    'ip route * *': [arg('A.B.C.D', "Forwarding router's address"), arg('GigabitEthernet', 'GigabitEthernet IEEE 802.3z')],
    'ip access-list': [['standard', 'Standard Access List'], ['extended', 'Extended Access List']],
    'ip dhcp': [['pool', 'Configure DHCP address pools'], ['excluded-address', 'Prevent DHCP from assigning certain addresses']],
    'ip dhcp pool': [arg('WORD', 'Pool name')],
    'ip dhcp excluded-address': [IP_ARG],
    'spanning-tree': [['mode', 'Spanning tree operating mode'], ['vlan', 'VLAN Switch Spanning Tree']],
    'spanning-tree mode': [['pvst', 'Per-Vlan spanning tree mode'], ['rapid-pvst', 'Per-Vlan rapid spanning tree mode']],
    'port-channel': [['load-balance', 'Load balancing method']],
    'line': [['console', 'Primary terminal line'], ['vty', 'Virtual terminal']],
    'router': [
      ['ospf', 'Open Shortest Path First (OSPF)'],
      ['eigrp', 'Enhanced Interior Gateway Routing Protocol (EIGRP)'],
      ['rip', 'Routing Information Protocol (RIP)'],
    ],
    'router ospf': [arg('<1-65535>', 'Process ID')],
    'ipv6': [['unicast-routing', 'Enable unicast routing', 'r'], ['router', 'Enable an IPV6 routing process', 'r']],
    'ipv6 router': [['ospf', 'Open Shortest Path First (OSPF)']],
    'ipv6 router ospf': [arg('<1-65535>', 'Process ID')],
    'ntp': [['server', 'Configure NTP server']],
    'logging': [['host', 'Set syslog server IP address and parameters']],
    'no': [
      ['ip', 'Interface Internet Protocol config commands'],
      ['cdp', 'Global CDP configuration subcommands'],
      ['lldp', 'Global LLDP configuration subcommands'],
    ],
    'cdp': [['run', 'Enable CDP']],
    'lldp': [['run', 'Enable LLDP']],
    'access-list': [arg('<1-99>', 'IP standard access list'), arg('<100-199>', 'IP extended access list')],
    'exit': [],
    'end': [],
  },
  ifc: {
    'ip': [
      ['address', 'Set the IP address of an interface'],
      ['access-group', 'Specify access control for packets', 'r'],
      ['helper-address', 'Specify a destination address for UDP broadcasts', 'r'],
      ['nat', 'NAT interface commands', 'r'],
      ['ospf', 'OSPF interface commands', 'r'],
    ],
    'ip ospf': [arg('<1-65535>', 'Process ID')],
    'ip ospf *': [['area', 'Set the OSPF area ID']],
    'ip ospf * area': [arg('<0-4294967295>', 'OSPF area ID as a decimal value'), arg('A.B.C.D', 'OSPF area ID in IP address format')],
    'ipv6 ospf': [arg('<1-65535>', 'Process ID')],
    'ipv6 ospf *': [['area', 'Set the OSPF area ID']],
    'ipv6 ospf * area': [arg('<0-4294967295>', 'OSPF area ID as a decimal value'), arg('A.B.C.D', 'OSPF area ID in IP address format')],
    'ip address': [IP_ARG],
    'ip address *': [arg('A.B.C.D', 'IP subnet mask')],
    'ip access-group': [arg('<1-199>', 'IP access list (standard or extended)'), arg('WORD', 'Access-list name')],
    'ip access-group *': [['in', 'inbound packets'], ['out', 'outbound packets']],
    'ip helper-address': [IP_ARG],
    'ip nat': [['inside', 'Inside interface for address translation'], ['outside', 'Outside interface for address translation']],
    'ipv6': [['address', 'Configure IPv6 address on interface'], ['ospf', 'OSPF interface commands', 'r']],
    'ipv6 address': [arg('X:X:X:X::X/<0-128>', 'IPv6 prefix'), ['FE80::1', 'Link-local address']],
    'no': [
      ['shutdown', 'Shutdown the selected interface'],
      ['ip', 'Interface Internet Protocol config commands'],
      ['cdp', 'CDP interface subcommands'],
    ],
    'cdp': [['enable', 'Enable CDP on interface']],
    'description': [arg('LINE', 'Up to 240 characters describing this interface')],
    'shutdown': [],
    'encapsulation': [['dot1Q', 'IEEE 802.1Q Virtual LAN']],
    'encapsulation dot1Q': [arg('<1-4094>', 'IEEE 802.1Q VLAN ID')],
    'switchport': [
      ['mode', 'Set trunking mode of the interface', 's'],
      ['access', 'Set access mode characteristics of the interface', 's'],
      ['trunk', 'Set trunking characteristics of the interface', 's'],
      ['port-security', 'Security related command', 's'],
    ],
    'switchport mode': [['access', 'Set trunking mode to ACCESS unconditionally'], ['trunk', 'Set trunking mode to TRUNK unconditionally']],
    'switchport access': [['vlan', 'Set VLAN when interface is in access mode']],
    'switchport access vlan': [arg('<1-4094>', 'VLAN ID of the VLAN when this port is in access mode')],
    'switchport trunk': [
      ['allowed', 'Set allowed VLAN characteristics when interface is in trunking mode'],
      ['native', 'Set trunking native characteristics when interface is in trunking mode'],
    ],
    'switchport trunk allowed': [['vlan', 'Set allowed VLANs when interface is in trunking mode']],
    'switchport trunk native': [['vlan', 'Set native VLAN when interface is in trunking mode']],
    'channel-group': [arg('<1-6>', 'Channel group number')],
    'channel-group *': [['mode', 'Etherchannel Mode of the interface']],
    'channel-group * mode': [
      ['active', 'Enable LACP unconditionally'],
      ['passive', 'Enable LACP only if a LACP device is present'],
      ['on', 'Enable Etherchannel only'],
      ['desirable', 'Enable PAgP unconditionally'],
      ['auto', 'Enable PAgP only if a PAgP device is present'],
    ],
    'spanning-tree': [
      ['portfast', 'Enable an interface to move directly to forwarding on link up'],
      ['bpduguard', "Don't accept BPDUs on this interface"],
    ],
  },
  router: {
    'network': [IP_ARG],
    'network *': [arg('A.B.C.D', 'OSPF wild card bits')],
    'network * *': [['area', 'Set the OSPF area ID']],
    'network * * area': [arg('<0-4294967295>', 'OSPF area ID as a decimal value'), arg('A.B.C.D', 'OSPF area ID in IP address format')],
    'router-id': [arg('A.B.C.D', 'OSPF router-id in IP address format')],
    'passive-interface': [['GigabitEthernet', 'GigabitEthernet IEEE 802.3z']],
    'passive-interface *': [],
    'passive-interface GigabitEthernet': [arg('<0-0>/<0-3>', 'GigabitEthernet interface number')],
    'default-information': [['originate', 'Distribute a default route']],
    'version': [arg('<1-2>', 'version')],
    'eigrp': [['router-id', 'router-id for this EIGRP process']],
    'eigrp router-id': [arg('A.B.C.D', 'EIGRP router-id in IP address format')],
    'no': [['auto-summary', 'Enable automatic network number summarization'], ['passive-interface', 'Suppress routing updates on an interface']],
    'no passive-interface': [['GigabitEthernet', 'GigabitEthernet IEEE 802.3z']],
    'no passive-interface *': [],
    'no passive-interface GigabitEthernet': [arg('<0-0>/<0-3>', 'GigabitEthernet interface number')],
    'exit': [],
    'end': [],
  },
};

// The "?" list for the current device and mode
function helpEntry() {
  const mode = devState().mode;
  const entry = (dev === 'S1' ? SWITCH_HELP : ROUTER_HELP)[mode];
  if (mode === 'router') return entry[state.proto];
  if (mode === 'nacl') return entry[state.acls[state.aclName].type === 'extended' ? 'ext' : 'std'];
  return entry;
}

// Cisco pads the command column to the longest entry
function printRows(rows) {
  const pad = Math.max(12, ...rows.map(r => r[0].length + 1));
  for (const [cmd, desc] of rows) print('  ' + cmd.padEnd(pad) + desc);
}

// "?" on its own
function help() {
  const entry = helpEntry();
  if (entry.head) print(entry.head);
  printRows(entry.rows);
}

// The rows that may follow the words typed so far, or null when a word is not valid there
function nextRows(words, mode) {
  // "interface ..." also works from interface mode, so its help comes from the config table
  if (mode === 'ifc' && words[0]?.length >= 3 && 'interface'.startsWith(words[0])) mode = 'config';
  const table = NEXT[mode === 'user' || mode === 'priv' ? 'exec' : mode];
  if (!table) return null;
  const device = dev === 'S1' ? 's' : 'r';
  const firstWords = [...new Set(Object.keys(table).map(k => k.split(' ')[0]))].map(k => [k, '']);
  const rowsAt = path => (path ? table[path] || [] : firstWords).filter(r => !r[2] || r[2] === device);
  let path = '';
  for (const word of words) {
    const keywords = rowsAt(path).filter(r => !r[3] && r[0].toLowerCase().startsWith(word));
    const exact = keywords.filter(r => r[0].toLowerCase() === word);
    const hits = exact.length ? exact : keywords;
    const anyValue = path ? path + ' *' : '*';
    if (hits.length === 1) path = path ? path + ' ' + hits[0][0] : hits[0][0];
    else if (hits.length === 0 && (rowsAt(path).some(r => r[3]) || table[anyValue])) path = anyValue; // a typed value
    else return null;
  }
  return rowsAt(path);
}

// "show ip ?" lists what can follow "show ip"; "sh?" (no space) lists the commands starting with "sh"
function helpNext(line) {
  const typed = line.slice(0, -1);
  if (!/\s$/.test(typed)) {
    const start = typed.toLowerCase().trim();
    const hits = helpEntry().rows.filter(([cmd]) => cmd.startsWith(start));
    return hits.length ? print(hits.map(([cmd]) => cmd).join('  ')) : print('% Unrecognized command', 'ln-err');
  }
  const rows = nextRows(typed.toLowerCase().trim().split(/\s+/), devState().mode);
  if (rows === null) return print('% Unrecognized command', 'ln-err');
  printRows(rows.length ? rows : [['<cr>', '']]);
}
