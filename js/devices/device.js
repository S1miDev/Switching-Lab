// Devices: every node of a lab diagram becomes one device object, built by the factory registered here for the node's type.
// A device owns its configuration, its command line, its Tab keys, its "?" help and its prompt. The console (script.js) and
// the session (session.js) only use this interface, so a new device type is a new file that registers a factory:
//
//   name, type, configurable   the node id, its diagram type, and whether commands can change anything
//   state                      the configuration the lab requirements read (null on a display-only device)
//   prompt()                   the console prompt right now
//   run(line, out)             execute one typed line; out(text, cls) takes each line of output
//   complete(line)             Tab: {value, cycle, list}; value is the new input text, cycle the ports to step
//                              through with further Tabs, list a line of options to print
//   help(line, out)            "?": line is what was typed plus the trailing "?"
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

// the devices cabled to the one called name, each with the lab link that joins them: [[device, link], ...]
const peersOf = (session, name) => session.links.flatMap(l => {
  const peer = session.devices[l.a === name ? l.b : l.b === name ? l.a : null];
  return peer ? [[peer, l]] : [];
});
