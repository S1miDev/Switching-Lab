// CCNA tab: question exams (multiple choice) to choose from. Each exam is a pool of questions, from which `count` are drawn at random.
// A question is [text, options, correct option indexes, optional exhibit picture in img/ccna/];it is right only when exactly the correct options are ticked.
// A matching/ordering question is {q, rows: [[prompt, answer], ...], extra: [unused answers], img}; each prompt gets a dropdown, right only when every row is correct.
// Needs EXAM_PASS, BOX, TILE (exam.js), esc, cap (dom.js / exam.js) and show (script.js, only called on a click).
const CCNA_EXAMS = [{
  id: 'srwe-1-4',
  title: 'CCNA 2 v7 (SRWE) Modules 1-4 Checkpoint Exam',
  desc: 'Switching concepts, VLANs and inter-VLAN routing.',
  count: 33,
  questions: [
    ['Which tasks can be accomplished by using the command history feature? (Choose two.)', ['View a list of commands entered in a previous session.', 'Recall up to 15 command lines by default.', 'Set the command history buffer size.', 'Recall previously entered commands.', 'Save command lines in a log file for future reference.'], [2, 3]],
    ['What is the first action in the boot sequence when a switch is powered on?', ['load the default Cisco IOS software', 'load boot loader software', 'low-level CPU initialization', 'load a power-on self-test program'], [3]],
    ['What must an administrator have in order to reset a lost password on a router?', ['a TFTP server', 'a crossover cable', 'access to another router', 'physical access to the router'], [3]],
    ['When configuring a switch for SSH access, what other command that is associated with the login local command is required to be entered on the switch?', ['enable secret password', 'password password', 'username username secret secret', 'login block-for seconds attempts number within seconds'], [2]],
    ['Which command displays information about the auto-MDIX setting for a specific interface?', ['show interfaces', 'show controllers', 'show processes', 'show running-config'], [1]],
    ['If one end of an Ethernet connection is configured for full duplex and the other end of the connection is configured for half duplex, where would late collisions be observed?', ['on both ends of the connection', 'on the full-duplex end of the connection', 'only on serial interfaces', 'on the half-duplex end of the connection'], [3]],
    ['Which command is used to set the BOOT environment variable that defines where to find the IOS image file on a switch?', ['config-register', 'boot system', 'boot loader', 'confreg'], [1]],
    ['What does a switch use to locate and load the IOS image?', ['BOOT environment variable', 'IOS image file', 'POST', 'startup-config', 'NVRAM'], [0]],
    ['Which protocol adds security to remote connections?', ['FTP', 'HTTP', 'NetBEUI', 'POP', 'SSH'], [4]],
    ['What is a characteristic of an IPv4 loopback interface on a Cisco IOS router?', ['The no shutdown command is required to place this interface in an UP state.', 'It is a logical interface internal to the router.', 'Only one loopback interface can be enabled on a router.', 'It is assigned to a physical port and can be connected to other devices.'], [1]],
    ['What is the minimum Ethernet frame size that will not be discarded by the receiver as a runt frame?', ['64 bytes', '512 bytes', '1024 bytes', '1500 bytes'], [0]],
    ['After which step of the switch bootup sequence is the boot loader executed?', ['after CPU initialization', 'after IOS localization', 'after flash file system initialization', 'after POST execution'], [3]],
    ['Which impact does adding a Layer 2 switch have on a network?', ['an increase in the number of dropped frames', 'an increase in the size of the broadcast domain', 'an increase in the number of network collisions', 'an increase in the size of the collision domain'], [1]],
    ['Which characteristic describes cut-through switching?', ['Error-free fragments are forwarded, so switching occurs with lower latency.', 'Frames are forwarded without any error checking.', 'Only outgoing frames are checked for errors.', 'Buffering is used to support different Ethernet speeds.'], [1]],
    ['What is the significant difference between a hub and a Layer 2 LAN switch?', ['A hub extends a collision domain, and a switch divides collision domains.', 'A hub divides collision domains, and a switch divides broadcast domains.', 'Each port of a hub is a collision domain, and each port of a switch is a broadcast domain.', 'A hub forwards frames, and a switch forwards only packets.'], [0]],
    ['Which statement is correct about Ethernet switch frame forwarding decisions?', ['Frame forwarding decisions are based on MAC address and port mappings in the CAM table.', 'Cut-through frame forwarding ensures that invalid frames are always dropped.', 'Only frames with a broadcast destination address are forwarded out all active switch ports.', 'Unicast frames are always forwarded regardless of the destination MAC address.'], [0]],
    ['How do switch buffers affect network performance?', ['They provide error checking on the data received.', 'They store frames received, thus preventing premature frame discarding when network congestion occurs.', 'They provide extra memory for a particular port if autonegotiation of speed or duplex fails.', 'They hold data temporarily when a collision occurs until normal data transmission resumes.'], [1]],
    ['Which switch characteristic helps keep traffic local and alleviates network congestion?', ['high port density', 'fast port speed', 'large frame buffers', 'fast internal switching'], [0]],
    ['Which switch component reduces the amount of packet handling time inside the switch?', ['ASIC', 'dual processors', 'large buffer size', 'store-and-forward RAM'], [0]],
    ['What information is added to the switch table from incoming frames?', ['source MAC address and incoming port number', 'destination MAC address and incoming port number', 'source IP address and incoming port number', 'destination IP address and incoming port number'], [0]],
    ['Which switching method ensures that the incoming frame is error-free before forwarding?', ['cut-through', 'FCS', 'fragment free', 'store-and-forward'], [3]],
    ['Under which two occasions should an administrator disable DTP while managing a local area network? (Choose two.)', ['when connecting a Cisco switch to a non-Cisco switch', 'when a neighbor switch uses a DTP mode of dynamic auto', 'when a neighbor switch uses a DTP mode of dynamic desirable', 'on links that should not be trunking', 'on links that should dynamically attempt trunking'], [0, 3]],
    ['Which two characteristics describe the native VLAN? (Choose two.)', ['Designed to carry traffic that is generated by users, this type of VLAN is also known as the default VLAN.', 'The native VLAN traffic will be untagged across the trunk link.', 'This VLAN is necessary for remote management of a switch.', 'High priority traffic, such as voice traffic, uses the native VLAN.', 'The native VLAN provides a common identifier to both ends of a trunk.'], [1, 4]],
    ['On a switch that is configured with multiple VLANs, which command will remove only VLAN 100 from the switch?', ['Switch# delete flash:vlan.dat', 'Switch(config-if)# no switchport access vlan 100', 'Switch(config-if)# no switchport trunk allowed vlan 100', 'Switch(config)# no vlan 100'], [3]],
    ['A network contains multiple VLANs spanning multiple switches. What happens when a device in VLAN 20 sends a broadcast Ethernet frame?', ['All devices in all VLANs see the frame.', 'Devices in VLAN 20 and the management VLAN see the frame.', 'Only devices in VLAN 20 see the frame.', 'Only devices that are connected to the local switch see the frame.'], [2]],
    ['What happens to switch ports after the VLAN to which they are assigned is deleted?', ['The ports are disabled.', 'The ports are placed in trunk mode.', 'The ports are assigned to VLAN1, the default VLAN.', 'The ports stop communicating with the attached devices.'], [3]],
    ['Port Fa0/11 on a switch is assigned to VLAN 30. If the command no switchport access vlan 30 is entered on the Fa0/11 interface, what will happen?', ['Port Fa0/11 will be shutdown.', 'An error message would be displayed.', 'Port Fa0/11 will be returned to VLAN 1.', 'VLAN 30 will be deleted.'], [2]],
    ['Which command displays the encapsulation type, the voice VLAN ID, and the access mode VLAN for the Fa0/1 interface?', ['show vlan brief', 'show interfaces Fa0/1 switchport', 'show mac address-table interface Fa0/1', 'show interfaces trunk'], [1]],
    ['Which four steps are needed to configure a voice VLAN on a switch port? (Choose four).', ['Configure the interface as an IEEE 802.1Q trunk.', 'Assign the voice VLAN to the switch port.', 'Activate spanning-tree PortFast on the interface.', 'Ensure that voice traffic is trusted and tagged with a CoS priority value.', 'Add a voice VLAN.', 'Configure the switch port interface with subinterfaces.', 'Assign a data VLAN to the switch port.', 'Configure the switch port in access mode.'], [1, 3, 4, 7]],
    ['A high school uses VLAN15 for the laboratory network and VLAN30 for the faculty network. What is required to enable communication between these two VLANs while using the router-on-a-stick approach?', ['A multilayer switch is needed.', 'A router with at least two LAN interfaces is needed.', 'Two groups of switches are needed, each with ports that are configured for one VLAN.', 'A switch with a port that is configured as a trunk is needed when connecting to the router.'], [3]],
    ['When routing a large number of VLANs, what are two disadvantages of using the router-on-a-stick inter-VLAN routing method rather than the multilayer switch inter-VLAN routing method? (Choose two.)', ['Multiple SVIs are needed.', 'A dedicated router is required.', 'Router-on-a-stick requires subinterfaces to be configured on the same subnets.', 'Router-on-a-stick requires multiple physical interfaces on a router.', 'Multiple subinterfaces may impact the traffic flow speed.'], [1, 4]],
    ['What is a characteristic of a routed port on a Layer 3 switch?', ['It supports trunking.', 'It is not assigned to a VLAN.', 'It is commonly used as a WAN link.', 'It cannot have an IP address assigned to it.'], [1]],
    ['A technician is configuring a new Cisco 2960 switch. What is the effect of issuing the BranchSw(config-if)# mdix auto command?', ['It automatically adjusts the port to allow device connections to use either a straight-through or a crossover cable.', 'It applies an IPv4 address to the virtual interface.', 'It applies an IPv6 address to the virtual interface.', 'It permits an IPv6 address to be configured on a switch physical interface.', 'It updates the MAC address table for the associated port.'], [0]],
    ['A technician is configuring a new Cisco 2960 switch. What is the effect of issuing the BranchSw(config-if)# ip address 172.18.33.88 255.255.255.0 command?', ['It applies an IPv4 address to the virtual interface.', 'It applies an IPv6 address to the virtual interface.', 'It activates a virtual or physical switch interface.', 'It permits an IPv6 address to be configured on a switch physical interface.', 'It updates the MAC address table for the associated port.'], [0]],
    ['A technician is configuring a new Cisco 2960 switch. What is the effect of issuing the BranchSw# configure terminal command?', ['It enters the global configuration mode.', 'It enters configuration mode for a switch virtual interface.', 'It applies an IPv4 address to the virtual interface.', 'It updates the MAC address table for the associated port.', 'It permits an IPv6 address to be configured on a switch physical interface.'], [0]],
    ['A technician is configuring a new Cisco 2960 switch. What is the effect of issuing the BranchSw(config-if)# shutdown command?', ['It disables a virtual or physical switch interface.', 'It saves the running configuration to NVRAM.', 'It activates a virtual or physical switch interface.', 'It updates the MAC address table for the associated port.', 'It saves the startup configuration to the running configuration.'], [0]],
    ['A technician is configuring a new Cisco 2960 switch. What is the effect of issuing the BranchSw(config-if)# ipv6 address 2001:db8:a2b4:88::1/64 command?', ['It applies an IPv6 address to the virtual interface.', 'It activates a virtual or physical switch interface.', 'It applies an IPv4 address to the virtual interface.', 'It permits an IPv6 address to be configured on a switch physical interface.', 'It updates the MAC address table for the associated port.'], [0]],
    ['A technician is configuring a new Cisco 2960 switch. What is the effect of issuing the BranchSw(config-if)# exit command?', ['It returns to global configuration mode.', 'It returns to privileged mode.', 'It configures the default gateway for the switch.', 'It enters user mode.', 'It saves the startup configuration to the running configuration.'], [0]],
    ['A technician is configuring a new Cisco 2960 switch. What is the effect of issuing the BranchSw> enable command?', ['It enters privileged mode.', 'It enters the global configuration mode.', 'It enters configuration mode for a switch virtual interface.', 'It updates the MAC address table for the associated port.', 'It permits an IPv6 address to be configured on a switch physical interface.'], [0]],
    ['A technician is configuring a new Cisco 2960 switch. What is the effect of issuing the BranchSw(config-if)# duplex full command?', ['It allows data to flow in both directions at the same time on the interface.', 'It allows data to flow in only one direction at a time on the interface', 'It automatically adjusts the port to allow device connections to use either a straight-through or a crossover cable.', 'It configures the switch as the default gateway.', 'It encrypts user-mode passwords when users connect remotely.'], [0]],
    ['What type of VLAN should not carry voice and network management traffic?', ['data VLAN', 'voice VLAN', 'management VLAN', 'security VLAN'], [0]],
    ['What type of VLAN is designed to reserve bandwidth to ensure IP Phone quality?', ['voice VLAN', 'trunk VLAN', 'security VLAN', 'management VLAN'], [0]],
    ['What type of VLAN is initially the management VLAN?', ['default VLAN', 'native VLAN', 'data VLAN', 'management VLAN'], [0]],
    ['What type of VLAN is designed to have a delay of less than 150 ms across the network?', ['voice VLAN', 'desirable VLAN', 'trunk VLAN', 'security VLAN'], [0]],
    ['What type of VLAN is used to separate the network into groups of users or devices?', ['data VLAN', 'management VLAN', 'voice VLAN', 'native VLAN'], [0]],
    ['What type of VLAN is configured specifically for network traffic such as SSH, Telnet, HTTPS, HTTP, and SNMP?', ['management VLAN', 'security VLAN', 'trunk VLAN', 'voice VLAN'], [0]],
    ['What type of VLAN supports untagged traffic?', ['native VLAN', 'voice VLAN', 'security VLAN', 'management VLAN'], [0]],
    ['Which solution would help a college alleviate network congestion due to collisions?', ['a firewall that connects to two Internet providers', 'a high port density switch', 'a router with two Ethernet ports', 'a router with three Ethernet ports'], [1]],
    ['Which two statements are correct with respect to SVI inter-VLAN routing? (Choose two.)', ['Switching packets is faster with SVI.', 'There is no need for a connection to a router.', 'Virtual interfaces support subinterfaces.', 'SVIs can be bundled into EtherChannels.', 'SVIs eliminate the need for a default gateway in the hosts.'], [0, 1]],
    ['Which type of VLAN is used to designate which traffic is untagged when crossing a trunk port?', ['data', 'default', 'native', 'management'], [2]],
    ['A network administrator issues the show vlan brief command while troubleshooting a user support ticket. What output will be displayed?', ['the VLAN assignment and membership for device MAC addresses', 'the VLAN assignment and membership for all switch ports', 'the VLAN assignment and trunking encapsulation', 'the VLAN assignment and native VLAN'], [1]],
    // exhibit questions: the 4th item is the picture in img/ccna/
    ['Refer to the exhibit. How many broadcast domains are displayed?', ['1', '4', '8', '16', '55'], [2], 'q23.png'],
    ['Refer to the exhibit. A network administrator is reviewing port and VLAN assignments on switch S2 and notices that interfaces Gi0/1 and Gi0/2 are not included in the output. Why would the interfaces be missing from the output?', ['There is a native VLAN mismatch between the switches.', 'There is no media connected to the interfaces.', 'They are administratively shut down.', 'They are configured as trunk interfaces.'], [3], 'q27.jpg'],
    ['Refer to the exhibit. All workstations are configured correctly in VLAN 20. Workstations that are connected to switch SW1 are not able to send traffic to workstations on SW2. What could be done to remedy the problem?', ['Allow VLAN 20 on the trunk link.', 'Enable DTP on both ends of the trunk.', 'Configure all workstations on SW1 to be part of the default VLAN.', 'Configure all workstations on SW2 to be part of the native VLAN.'], [0], 'q29.png'],
    ['Refer to the exhibit. In what switch mode should port G0/1 be assigned if Cisco best practices are being used?', ['access', 'trunk', 'native', 'auto'], [1], 'q32.png'],
    ['Refer to the exhibit. A technician is programming switch SW3 to manage voice and data traffic through port Fa0/20. What, if anything, is wrong with the configuration?', ['There is nothing wrong with the configuration.', 'Interface Fa0/20 can only have one VLAN assigned.', 'The mls qos trust cos command should reference VLAN 35.', 'The command used to assign the voice VLAN to the switch port is incorrect.'], [3], 'q36.png'],
    ['Refer to the exhibit. PC1 is unable to communicate with server 1. The network administrator issues the show interfaces trunk command to begin troubleshooting. What conclusion can be made based on the output of this command?', ['Interface G0/2 is not configured as a trunk.', 'VLAN 20 has not been created.', 'The encapsulation on interface G0/1 is incorrect.', 'The DTP mode is incorrectly set to dynamic auto on interface G0/1.'], [0], 'q38.jpg'],
    ['Refer to the exhibit. What is the cause of the error that is displayed in the configuration of inter-VLAN routing on router CiscoVille?', ['The gig0/0 interface does not support inter-VLAN routing.', 'The no shutdown command has not been configured.', 'The IP address on CiscoVille is incorrect.', 'The encapsulation dot1Q 20 command has not been configured.'], [3], 'q39.png'],
    ['Refer to the exhibit. A network administrator has configured router CiscoVille with the above commands to provide inter-VLAN routing. What command will be required on a switch that is connected to the Gi0/0 interface on router CiscoVille to allow inter-VLAN routing?', ['switchport mode access', 'no switchport', 'switchport mode trunk', 'switchport mode dynamic desirable'], [2], 'q40.png'],
    ['Refer to the exhibit. A network administrator is verifying the configuration of inter-VLAN routing. Users complain that PCs on different VLANs cannot communicate. Based on the output, what are two configuration errors on switch interface Gi1/1? (Choose two.)', ['Gi1/1 is in the default VLAN.', 'Voice VLAN is not assigned to Gi1/1.', 'Gi1/1 is configured as trunk mode.', 'Negotiation of trunking is turned on on Gi1/1.', 'The trunking encapsulation protocol is configured wrong.'], [0, 2], 'q43.png'],
    ['Refer to the exhibit. A network administrator is verifying the configuration of inter-VLAN routing. Users complain that PC2 cannot communicate with PC1. Based on the output, what is the possible cause of the problem?', ['Gi0/0 is not configured as a trunk port.', 'The command interface GigabitEthernet0/0.5 was entered incorrectly.', 'There is no IP address configured on the interface Gi0/0.', 'The no shutdown command is not entered on subinterfaces.', 'The encapsulation dot1Q 5 command contains the wrong VLAN.'], [4], 'q44.png'],
    ['Refer to the exhibit. A network administrator has configured router CiscoVille with the above commands to provide inter-VLAN routing. What type of port will be required on a switch that is connected to Gi0/0 on router CiscoVille to allow inter-VLAN routing?', ['routed port', 'access port', 'trunk port', 'SVI'], [2], 'q45.jpg'],
    ['Refer to the exhibit. A network administrator is configuring RT1 for inter-VLAN routing. The switch is configured correctly and is functional. Host1, Host2, and Host3 cannot communicate with each other. Based on the router configuration, what is causing the problem?', ['Interface Fa0/0 is missing IP address configuration information.', 'IP addresses on the subinterfaces are incorrectly matched to the VLANs.', 'Each subinterface of Fa0/0 needs separate no shutdown commands.', 'Routers do not support 802.1Q encapsulation on subinterfaces.'], [1], 'q46.png'],
    ['Refer to the exhibit. A router-on-a-stick configuration was implemented for VLANs 15, 30, and 45, according to the show running-config command output. PCs on VLAN 45 that are using the 172.16.45.0 /24 network are having trouble connecting to PCs on VLAN 30 in the 172.16.30.0 /24 network. Which error is most likely causing this problem?', ['The wrong VLAN has been configured on GigabitEthernet 0/0.45.', 'The command no shutdown is missing on GigabitEthernet 0/0.30.', 'The GigabitEthernet 0/0 interface is missing an IP address.', 'There is an incorrect IP address configured on GigabitEthernet 0/0.30.'], [3], 'q47.png'],
    ['Refer to the exhibit. A network administrator needs to configure router-on-a-stick for the networks that are shown. How many subinterfaces will have to be created on the router if each VLAN that is shown is to be routed and each VLAN has its own subinterface?', ['1', '2', '3', '4', '5'], [3], 'q49.png'],
    ['Refer to the exhibit. A network administrator has configured R1 as shown. When the administrator checks the status of the serial interface, the interface is shown as being administratively down. What additional command must be entered on the serial interface of R1 to bring the interface up?', ['IPv6 enable', 'clockrate 128000', 'end', 'no shutdown'], [3], 'q70.jpg'],
    ['Refer to the exhibit. The network administrator wants to configure Switch1 to allow SSH connections and prohibit Telnet connections. How should the network administrator change the displayed configuration to satisfy the requirement?', ['Use SSH version 1.', 'Reconfigure the RSA key.', 'Configure SSH on a different line.', 'Modify the transport input command.'], [3], 'q71.jpg'],
    ['Refer to the exhibit. A network administrator is configuring inter-VLAN routing on a network. For now, only one VLAN is being used, but more will be added soon. What is the missing parameter that is shown as the highlighted question mark in the graphic?', ['It identifies the subinterface.', 'It identifies the VLAN number.', 'It identifies the native VLAN number.', 'It identifies the type of encapsulation that is used.', 'It identifies the number of hosts that are allowed on the interface.'], [1], 'q74.png'],
    ['A technician is configuring a new Cisco 2960 switch. What is the effect of issuing the BranchSw# configure terminal command?', ['It enters the global configuration mode.', 'It saves the running configuration to NVRAM.', 'It disables a virtual or physical switch interface.', 'It updates the MAC address table for the associated port.', 'It saves the startup configuration to the running configuration.'], [0]],
    ['A technician is configuring a new Cisco 2960 switch. What is the effect of issuing the BranchSw(config-if)# shutdown command?', ['It disables a virtual or physical switch interface.', 'It applies an IPv6 address to the virtual interface.', 'It applies an IPv4 address to the virtual interface.', 'It permits an IPv6 address to be configured on a switch physical interface.', 'It updates the MAC address table for the associated port.'], [0]],
    ['Which message is displayed when 10.10.10.1 is entered into the PC1 Web Browser address bar?', ['Local Server', 'Test Server', 'File Server', 'Cisco Server'], [2]],
    {q: 'Refer to the exhibit. A switch receives a Layer 2 frame that contains a source MAC address of 000b.a023.c501 and a destination MAC address of 0050.0fae.75aa. Place the switch steps in the order they occur. (Not all options are used.)', img: 'q20.png',
      rows: [['Occurs first', 'The switch adds the source MAC address to the MAC address table.'], ['Occurs second', 'Because the destination is not known, the switch forwards the frame out all ports except the port through which the frame arrived.']],
      extra: ['The switch drops the frame.', 'The switch adds the destination MAC address to the MAC address table.', 'Because the source MAC address is not known, the switch broadcasts the frame out all ports except the port through which the frame arrived.']},
    {q: 'Match the IEEE 802.1Q standard VLAN tag field with the description. (Not all options are used.)',
      rows: [['Type', 'a value for the tag protocol ID value'], ['VLAN ID', 'a VLAN number'], ['User Priority', 'a value that supports level or service implementation'], ['Canonical Format Identifier', 'an identifier that enables Token Ring frames to be carried across Ethernet links']],
      extra: ['a value for the application protocol of the user data in the frame']},
    {q: 'Match the DTP mode with its function.',
      rows: [['Nonegotiate', 'Requires manual configuration of trunking or nontrunking'], ['Dynamic desirable', 'Actively attempts to convert the link to a trunk'], ['Trunk', 'Permanent trunking mode'], ['Dynamic auto', 'Passively waits for the neighbor to initiate trunking']]},
    {q: 'Match each DHCP message type with its description. (Not all options are used.)',
      rows: [['a client initiating a message to find a DHCP server', 'DHCPDISCOVER'], ['a DHCP server responding to the initial request by a client', 'DHCPOFFER'], ['the client accepting the IP address provided by the DHCP server', 'DHCPREQUEST'], ['the DHCP server confirming that the address lease has been accepted', 'DHCPACK']],
      extra: ['DHCPNACK']},
  ],
}];

const ccnaCard = $('ccna-card');
let ccnaRun = null; // {exam, items: [{q, opts: [{text, ok}], multi}]} while an exam is open
const shuffled = a => a.map(x => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map(([, x]) => x);

function ccnaListHtml() {
  return '<div class="grid gap-3">' + CCNA_EXAMS.map(e =>
    `<div class="${BOX} flex flex-wrap items-center justify-between gap-4"><div>` +
    `<p class="m-0 text-lg font-semibold">${esc(e.title)}</p>` +
    `<p class="note !m-0">${esc(e.desc)} ${Math.min(e.count, e.questions.length)} questions, pass mark ${EXAM_PASS}%. Practice and See questions use all ${e.questions.length}.</p></div>` +
    `<div class="flex flex-wrap gap-3"><button data-ccna-start="${e.id}">Start exam →</button>` +
    `<button class="ghost" data-ccna-practice="${e.id}">Practice</button>` +
    `<button class="ghost" data-ccna-browse="${e.id}">See questions</button></div></div>`).join('') + '</div>';
}

// raw question -> {q, img, multi, opts} or {q, img, rows, pool}
const ccnaItem = x => Array.isArray(x)
  ? {q: x[0], img: x[3], multi: x[2].length > 1, opts: shuffled(x[1].map((text, i) => ({text, ok: x[2].includes(i)})))}
  : {q: x.q, img: x.img, rows: x.rows, pool: shuffled([...x.rows.map(r => r[1]), ...(x.extra || [])])};

// one question's fieldset; n is its 0-based number (also the form field name)
function ccnaQuestionHtml(it, n) {
  return `<fieldset class="${BOX} min-w-0"${it.multi ? ` data-max="${it.opts.filter(o => o.ok).length}"` : ''}><legend class="sr-only">Question ${n + 1}</legend>` +
    `<p class="mb-3 mt-0 font-semibold"><span class="font-mono text-[color:var(--success)]">${n + 1}.</span> ${esc(it.q)}</p>` +
    (it.img ? `<img src="img/ccna/${it.img}" alt="Exhibit for question ${n + 1}" class="mb-3 max-w-full rounded-lg bg-white">` : '') +
    (it.rows
      ? `<div class="grid gap-2">${it.rows.map(([p], r) => `<label class="${TILE} flex-col !items-stretch"><span>${esc(p)}</span><select name="q${n}-${r}" class="w-full min-w-0"><option value="">Choose…</option>${it.pool.map((a, i) => `<option value="${i}">${esc(a)}</option>`).join('')}</select></label>`).join('')}</div></fieldset>`
      : `<div class="grid gap-2">${it.opts.map((o, i) => `<label class="${TILE}"><input type="${it.multi ? 'checkbox' : 'radio'}" name="q${n}" value="${i}" class="shrink-0 accent-[color:var(--accent)]"><span>${esc(o.text)}</span></label>`).join('')}</div></fieldset>`);
}

// a question counts only when the ticked options are exactly the correct ones
function ccnaGrade(it, data, n) {
  if (it.rows) { // picked[r] = the answer text chosen for row r ('' if left blank)
    const picked = it.rows.map((_, r) => it.pool[data.get(`q${n}-${r}`)] ?? '');
    return {it, picked, right: it.rows.every(([, a], r) => picked[r] === a)};
  }
  const picked = data.getAll('q' + n).map(Number);
  return {it, picked, right: it.opts.every((o, i) => o.ok === picked.includes(i))};
}

// the correct answers, marking what was picked (picked = null: nothing picked, e.g. when browsing)
function ccnaAnswerHtml(it, picked) {
  return `<ul class="m-0 grid list-none gap-1 p-0 text-sm">${it.rows ? it.rows.map(([p, a], r) => !picked || picked[r] === a
    ? `<li class="text-[color:var(--success)]">${esc(p)} → ${esc(a)} ✓ correct</li>`
    : `<li class="text-[color:var(--bad)]">${esc(p)} → ${esc(a)} ✓ correct <span class="text-[color:var(--muted)]">(your answer: ${esc(picked[r] || 'none')})</span></li>`).join('') : it.opts.map((o, i) => {
    const mine = picked?.includes(i);
    const tag = o.ok ? ' ✓ correct' : mine ? ' ✗ your answer' : '';
    return `<li class="${o.ok ? 'text-[color:var(--success)]' : mine ? 'text-[color:var(--bad)]' : 'text-[color:var(--muted)]'}">${esc(o.text)}${tag}</li>`;
  }).join('')}</ul>`;
}

function ccnaStart(id) {
  const exam = CCNA_EXAMS.find(e => e.id === id);
  const items = shuffled(exam.questions).slice(0, exam.count).map(ccnaItem);
  ccnaRun = {exam, items, mode: 'exam'};
  ccnaCard.innerHTML = '<form id="ccna-form" class="grid gap-4">' +
    `<p class="note !m-0">${esc(exam.title)}. Tick the correct answer(s) for every question.</p>` +
    items.map(ccnaQuestionHtml).join('') +
    '<div class="flex justify-end"><button type="submit" class="!px-6">Finish exam</button></div></form>';
  window.scrollTo(0, 0);
}

function ccnaFinish(form) {
  const data = new FormData(form);
  const marks = ccnaRun.items.map((it, n) => ccnaGrade(it, data, n));
  const right = marks.filter(m => m.right).length, total = marks.length;
  const pass = right * 100 >= EXAM_PASS * total; // exact compare, like the mock exam: 79.6% is not a pass
  const wrong = marks.map((m, n) => ({...m, n})).filter(m => !m.right);
  ccnaCard.innerHTML = '<div class="grid gap-4">' +
    `<div class="${BOX} flex flex-wrap items-center justify-between gap-4"><div>` +
    `<p class="m-0 text-[13px] text-[color:var(--muted)]">${esc(ccnaRun.exam.title)} · pass mark ${EXAM_PASS}%</p>` +
    `<p class="m-0 text-4xl font-semibold">${Math.floor(100 * right / total)}% <span class="font-mono text-base font-normal text-[color:var(--muted)]">${right}/${total} questions</span></p></div>` +
    `<span class="rounded-full px-4 py-1.5 text-sm font-semibold ${pass ? 'bg-[color:var(--success)]' : 'bg-[color:var(--bad)]'} text-[color:var(--accent-ink)]">${pass ? 'PASSED' : 'FAILED'}</span></div>` +
    (wrong.length ? `<p class="note !m-0">Missed questions, with the correct answers:</p>` : '') +
    wrong.map(m => `<div class="${BOX}"><p class="mb-2 mt-0 font-semibold"><span class="font-mono">${m.n + 1}.</span> ${esc(m.it.q)}</p>` +
      (m.it.img ? `<img src="img/ccna/${m.it.img}" alt="Exhibit" class="mb-3 max-w-full rounded-lg bg-white">` : '') +
      ccnaAnswerHtml(m.it, m.picked) + '</div>').join('') +
    '<div class="flex gap-3"><button id="ccna-again">Retake</button><button id="ccna-back" class="ghost">All exams</button></div></div>';
  window.scrollTo(0, 0);
}

// Practice: every question of the exam, one at a time; Check shows the answer, Next moves on
function ccnaPractice(id) {
  const exam = CCNA_EXAMS.find(e => e.id === id);
  ccnaRun = {exam, items: shuffled(exam.questions).map(ccnaItem), mode: 'practice', i: 0, right: 0, checked: false};
  ccnaShowPractice();
}

function ccnaShowPractice() {
  const {exam, items, i, right} = ccnaRun;
  ccnaRun.checked = false;
  ccnaCard.innerHTML = '<form id="ccna-form" class="grid gap-4">' +
    `<p class="note !m-0">${esc(exam.title)} · practice · question ${i + 1} of ${items.length} · ${right} right so far</p>` +
    ccnaQuestionHtml(items[i], i) + '<div id="ccna-feedback"></div>' +
    '<div class="flex gap-3"><button type="submit" id="ccna-check">Check</button><button type="button" id="ccna-back" class="ghost">Quit</button></div></form>';
  window.scrollTo(0, 0);
}

function ccnaCheck(form) {
  const m = ccnaGrade(ccnaRun.items[ccnaRun.i], new FormData(form), ccnaRun.i);
  ccnaRun.checked = true;
  if (m.right) ccnaRun.right++;
  const last = ccnaRun.i === ccnaRun.items.length - 1;
  form.querySelector('fieldset').disabled = true;
  $('ccna-feedback').innerHTML = `<div class="${BOX}"><p class="mb-2 mt-0 font-semibold ${m.right ? 'text-[color:var(--success)]' : 'text-[color:var(--bad)]'}">${m.right ? '✓ Correct' : '✗ Not quite'}</p>${ccnaAnswerHtml(m.it, m.picked)}</div>`;
  $('ccna-check').outerHTML = `<button type="button" id="ccna-next">${last ? 'Finish' : 'Next →'}</button>`;
}

function ccnaPracticeNext() {
  if (++ccnaRun.i < ccnaRun.items.length) return ccnaShowPractice();
  const {exam, items, right} = ccnaRun;
  ccnaCard.innerHTML = `<div class="grid gap-4"><div class="${BOX}"><p class="m-0 text-[13px] text-[color:var(--muted)]">${esc(exam.title)} · practice</p>` +
    `<p class="m-0 text-4xl font-semibold">${right}/${items.length} <span class="font-mono text-base font-normal text-[color:var(--muted)]">right</span></p></div>` +
    `<div class="flex gap-3"><button data-ccna-practice="${exam.id}">Practice again</button><button id="ccna-back" class="ghost">All exams</button></div></div>`;
  window.scrollTo(0, 0);
}

// See questions: the whole pool in file order with the right answers
function ccnaBrowse(id) {
  const exam = CCNA_EXAMS.find(e => e.id === id);
  ccnaRun = null;
  ccnaCard.innerHTML = '<div class="grid gap-4">' +
    `<div class="flex flex-wrap items-center justify-between gap-3"><p class="note !m-0">${esc(exam.title)} · ${exam.questions.length} questions with correct answers</p><button id="ccna-back" class="ghost">← All exams</button></div>` +
    exam.questions.map((x, n) => {
      const it = ccnaItem(x);
      return `<div class="${BOX}"><p class="mb-2 mt-0 font-semibold"><span class="font-mono">${n + 1}.</span> ${esc(it.q)}</p>` +
        (it.img ? `<img src="img/ccna/${it.img}" alt="Exhibit for question ${n + 1}" class="mb-3 max-w-full rounded-lg bg-white">` : '') +
        ccnaAnswerHtml(it, null) + '</div>';
    }).join('') + '</div>';
  window.scrollTo(0, 0);
}

function ccnaHome() {
  ccnaRun = null;
  ccnaCard.innerHTML = ccnaListHtml();
}

ccnaCard.addEventListener('click', e => {
  const d = e.target.dataset;
  if (d.ccnaStart) ccnaStart(d.ccnaStart);
  else if (d.ccnaPractice) ccnaPractice(d.ccnaPractice);
  else if (d.ccnaBrowse) ccnaBrowse(d.ccnaBrowse);
  else if (e.target.id === 'ccna-next') ccnaPracticeNext();
  else if (e.target.id === 'ccna-again') ccnaStart(ccnaRun.exam.id);
  else if (e.target.id === 'ccna-back') ccnaHome();
});
// "Choose two": once that many are ticked, the rest are locked until one is unticked
ccnaCard.addEventListener('change', e => {
  const set = e.target.closest('[data-max]');
  if (!set) return;
  const full = set.querySelectorAll('input:checked').length >= Number(set.dataset.max);
  set.querySelectorAll('input:not(:checked)').forEach(i => { i.disabled = full; });
});
ccnaCard.addEventListener('submit', e => {
  e.preventDefault();
  if (ccnaRun.mode !== 'practice') ccnaFinish(e.target);
  else if (!ccnaRun.checked) ccnaCheck(e.target);
});
$('nav-ccna').addEventListener('click', () => {
  show('ccna');
  if (!ccnaCard.innerHTML) ccnaHome();
});
