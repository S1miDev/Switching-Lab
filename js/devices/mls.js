// Multilayer switch: the switch of switch.js with l3 on, so it also routes (ip routing, routed ports, SVIs with addresses).

// the Tab commands of a multilayer switch: the switch's, plus what only it can do
const MLS_KEYS = {...SW_KEYS, config: [...SW_KEYS.config, 'ip routing', 'interface vlan'],
  ifc: [...SW_KEYS.ifc, 'no switchport', 'ip address', 'ip helper-address']};

DEVICE_TYPES.mls = (node, session) => createSwitch(node, session, {l3: true, keys: MLS_KEYS});
