// Mock exam: 10 random multiple-choice CCNA questions against a timer, then a scored review.
const EXAM_Q = [
  {
    question: 'Which command shows a brief summary of IPv4 interface addresses and status on a router?',
    choices: ['show ip interface brief', 'show interfaces trunk', 'show ip route summary', 'show vlan brief'],
    answer: 0,
    why: 'show ip interface brief lists each interface with its IP address and status.',
  },
  {
    question: 'How many usable host addresses are in a /26 subnet?',
    choices: ['30', '62', '64', '126'],
    answer: 1,
    why: 'A /26 leaves 6 host bits: 2^6 - 2 = 62 usable hosts.',
  },
  {
    question: 'What is the default native VLAN on a Cisco 802.1Q trunk?',
    choices: ['VLAN 0', 'VLAN 1', 'VLAN 10', 'VLAN 99'],
    answer: 1,
    why: 'Untagged traffic on an 802.1Q trunk belongs to VLAN 1 unless you change the native VLAN.',
  },
  {
    question: 'Which spanning tree port state forwards frames and learns MAC addresses?',
    choices: ['Blocking', 'Listening', 'Learning', 'Forwarding'],
    answer: 3,
    why: 'Only a forwarding port both sends user traffic and learns MAC addresses. A learning port learns but does not forward.',
  },
  {
    question: 'Which protocol is the open standard (IEEE 802.3ad) for building an EtherChannel?',
    choices: ['PAgP', 'LACP', 'VTP', 'STP'],
    answer: 1,
    why: 'LACP is the open standard. PAgP is Cisco-proprietary.',
  },
  {
    question: 'What does a router do with a packet when no route matches and there is no default route?',
    choices: [
      'Floods it out all interfaces',
      'Drops it',
      'Sends it to the DHCP server',
      'Forwards it out the first interface',
    ],
    answer: 1,
    why: 'With no matching route and no gateway of last resort, the router discards the packet.',
  },
  {
    question: 'What is the default administrative distance of a static route?',
    choices: ['0', '1', '90', '110'],
    answer: 1,
    why: 'A static route has an administrative distance of 1. Connected networks are 0, EIGRP 90, OSPF 110.',
  },
  {
    question: 'Which prefix do IPv6 link-local addresses use?',
    choices: ['2001:db8::/32', 'FE80::/10', 'FF02::/16', 'FC00::/7'],
    answer: 1,
    why: 'Link-local addresses are in FE80::/10 and are only valid on the local link.',
  },
  {
    question: 'Which DHCP message does a client broadcast first when it looks for a server?',
    choices: ['Offer', 'Request', 'Discover', 'Acknowledge'],
    answer: 2,
    why: 'The DORA order is Discover, Offer, Request, Acknowledge.',
  },
  {
    question: 'NAT overload is also known as what?',
    choices: ['Static NAT', 'PAT', 'Dynamic NAT', 'NAT64'],
    answer: 1,
    why: 'Port Address Translation shares one address between many hosts by using different port numbers.',
  },
  {
    question: 'Which port security violation mode shuts the port down (err-disabled)?',
    choices: ['protect', 'restrict', 'shutdown', 'drop'],
    answer: 2,
    why: 'Shutdown is the default mode. Protect and restrict keep the port up and drop offending frames.',
  },
  {
    question: 'Which device forwards frames based on the destination MAC address?',
    choices: ['Hub', 'Switch', 'Repeater', 'Modem'],
    answer: 1,
    why: 'A switch learns MAC addresses and forwards each frame only out the right port.',
  },
  {
    question: 'Which ACL type can filter on both source and destination address and on port numbers?',
    choices: ['Standard', 'Extended', 'Reflexive only', 'Dynamic only'],
    answer: 1,
    why: 'Standard ACLs match source addresses only. Extended ACLs match source, destination, protocol and ports.',
  },
  {
    question: 'Which protocol and port does a router use to send syslog messages to a server?',
    choices: ['NTP, UDP 123', 'Syslog, UDP 514', 'DNS, UDP 53', 'SNMP, UDP 161'],
    answer: 1,
    why: 'Syslog uses UDP port 514.',
  },
  {
    question: 'Which neighbor discovery protocol is Cisco-proprietary?',
    choices: ['LLDP', 'CDP', 'ARP', 'ICMP'],
    answer: 1,
    why: 'CDP is Cisco-proprietary. LLDP is the open IEEE 802.1AB equivalent.',
  },
  {
    question: 'What is the dotted-decimal mask for a /27?',
    choices: ['255.255.255.192', '255.255.255.224', '255.255.255.240', '255.255.254.0'],
    answer: 1,
    why: 'A /27 has 27 network bits, which gives 255.255.255.224.',
  },
  {
    question: 'Which VLAN range is the normal range on a Cisco switch?',
    choices: ['1 - 1005', '1006 - 4094', '0 - 4095', '1 - 255'],
    answer: 0,
    why: 'VLANs 1 to 1005 are the normal range. 1006 to 4094 are the extended range.',
  },
  {
    question: 'Which command makes an interface an 802.1Q trunk?',
    choices: ['switchport mode access', 'switchport mode trunk', 'switchport trunk native', 'spanning-tree portfast'],
    answer: 1,
    why: 'switchport mode trunk forces the port into trunking mode.',
  },
  {
    question: 'What is the first usable host address in 192.168.10.64/26?',
    choices: ['192.168.10.64', '192.168.10.65', '192.168.10.66', '192.168.10.1'],
    answer: 1,
    why: 'The network address is .64, so the first usable host is .65.',
  },
  {
    question: 'Which switch becomes the spanning tree root bridge?',
    choices: [
      'The one with the highest bridge ID',
      'The one with the lowest bridge ID',
      'The one with the most ports',
      'The oldest switch',
    ],
    answer: 1,
    why: 'The lowest bridge ID (priority, then MAC address) wins the root election.',
  },
  {
    question: 'Which protocol resolves an IPv4 address to a MAC address on a LAN?',
    choices: ['DNS', 'DHCP', 'ARP', 'ICMP'],
    answer: 2,
    why: 'ARP asks "who has this IP address?" and learns the MAC address from the reply.',
  },
  {
    question: 'How does router-on-a-stick route between VLANs?',
    choices: [
      'One physical interface per VLAN',
      'Subinterfaces with 802.1Q encapsulation on one trunk link',
      'A hub between the VLANs',
      'Spanning tree between the VLANs',
    ],
    answer: 1,
    why: 'One physical link carries all VLANs as a trunk, and the router uses one dot1q subinterface per VLAN.',
  },
  {
    question: 'What is the default OSPF hello interval on a broadcast network?',
    choices: ['5 seconds', '10 seconds', '30 seconds', '40 seconds'],
    answer: 1,
    why: 'The hello interval is 10 seconds on broadcast and point-to-point networks, with a dead interval of 40.',
  },
];

const EXAM_COUNT = 10, EXAM_SECONDS = 600;
let examQs = [];      // this exam's questions
let examAns = {};     // question number -> chosen option
let examEnd = 0;      // when the time runs out (ms timestamp)
let examTimer = null;
let examDone = false;
const examCard = document.getElementById('exam-card');

const secondsLeft = () => Math.max(0, Math.round((examEnd - Date.now()) / 1000));
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const answeredText = () => `${Object.keys(examAns).length}/${examQs.length} answered`;

function examStart() {
  // shuffle by sorting on random keys, then keep the first EXAM_COUNT
  examQs = EXAM_Q.map(q => [Math.random(), q]).sort((a, b) => a[0] - b[0]).slice(0, EXAM_COUNT).map(([, q]) => q);
  examAns = {};
  examDone = false;
  examEnd = Date.now() + EXAM_SECONDS * 1000;
  clearInterval(examTimer);
  examTimer = setInterval(examTick, 1000);
  examRender();
}

function examTick() {
  const left = secondsLeft();
  const timeEl = document.getElementById('exam-time');
  if (timeEl) timeEl.textContent = clock(left);
  if (!left) examFinish();
}

function examFinish() {
  clearInterval(examTimer);
  examDone = true;
  examRender();
}

function examRender() {
  if (!examQs.length) {
    examCard.innerHTML = '<h2>Ready?</h2>' +
      `<p class="note">${EXAM_COUNT} random multiple-choice questions on switching, routing and IP services. ` +
      `You have ${EXAM_SECONDS / 60} minutes. Unanswered questions score zero.</p>` +
      '<button data-act="start">Start exam</button>';
    return;
  }
  const score = examQs.filter((q, i) => examAns[i] === q.answer).length;
  let html = examDone
    ? `<div class="req-head"><h2>Result: ${score}/${examQs.length}</h2><span>${Math.round(100 * score / examQs.length)}%</span></div>`
    : `<div class="req-head"><h2>Time left <span id="exam-time">${clock(secondsLeft())}</span></h2><span id="exam-answered">${answeredText()}</span></div>`;
  examQs.forEach((q, i) => {
    const options = q.choices.map((choice, j) =>
      `<label class="exam-opt${examDone && j === q.answer ? ' right' : ''}">` +
      `<input type="radio" name="q${i}" value="${j}"${examAns[i] === j ? ' checked' : ''}${examDone ? ' disabled' : ''}> ${esc(choice)}</label>`);
    const result = examDone ? (examAns[i] === q.answer ? ' ok' : ' bad') : '';
    html += `<fieldset class="exam-q${result}"><legend>${i + 1}. ${esc(q.question)}</legend>${options.join('')}` +
      (examDone ? `<p class="note">${esc(q.why)}</p>` : '') + '</fieldset>';
  });
  html += examDone ? '<button data-act="start">Try another exam</button>' : '<button data-act="submit">Submit exam</button>';
  examCard.innerHTML = html;
}

examCard.addEventListener('click', e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'start') {
    examStart();
    window.scrollTo(0, 0);
  } else if (act === 'submit') examFinish();
});
// radio buttons are named q0, q1 ... after their question
examCard.addEventListener('change', e => {
  if (!e.target.name?.startsWith('q')) return;
  examAns[Number(e.target.name.slice(1))] = Number(e.target.value);
  document.getElementById('exam-answered').textContent = answeredText();
});
document.getElementById('nav-exam').addEventListener('click', () => {
  show('exam');
  if (!examCard.innerHTML) examRender();
});
