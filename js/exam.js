// Mock exam: 10 random multiple-choice CCNA questions against a timer, scored with a review.
const EXAM_Q = [
  {q:'Which command shows a brief summary of IPv4 interface addresses and status on a router?', c:['show ip interface brief', 'show interfaces trunk', 'show ip route summary', 'show vlan brief'], a:0, why:'show ip interface brief lists each interface with its IP address and status.'},
  {q:'How many usable host addresses are in a /26 subnet?', c:['30', '62', '64', '126'], a:1, why:'A /26 leaves 6 host bits: 2^6 - 2 = 62 usable hosts.'},
  {q:'What is the default native VLAN on a Cisco 802.1Q trunk?', c:['VLAN 0', 'VLAN 1', 'VLAN 10', 'VLAN 99'], a:1, why:'Untagged traffic on an 802.1Q trunk belongs to VLAN 1 unless you change the native VLAN.'},
  {q:'Which spanning tree port state forwards frames and learns MAC addresses?', c:['Blocking', 'Listening', 'Learning', 'Forwarding'], a:3, why:'Only a forwarding port both sends user traffic and learns MAC addresses. A learning port learns but does not forward.'},
  {q:'Which protocol is the open standard (IEEE 802.3ad) for building an EtherChannel?', c:['PAgP', 'LACP', 'VTP', 'STP'], a:1, why:'LACP is the open standard. PAgP is Cisco-proprietary.'},
  {q:'What does a router do with a packet when no route matches and there is no default route?', c:['Floods it out all interfaces', 'Drops it', 'Sends it to the DHCP server', 'Forwards it out the first interface'], a:1, why:'With no matching route and no gateway of last resort, the router discards the packet.'},
  {q:'What is the default administrative distance of a static route?', c:['0', '1', '90', '110'], a:1, why:'A static route has an administrative distance of 1. Connected networks are 0, EIGRP 90, OSPF 110.'},
  {q:'Which prefix do IPv6 link-local addresses use?', c:['2001:db8::/32', 'FE80::/10', 'FF02::/16', 'FC00::/7'], a:1, why:'Link-local addresses are in FE80::/10 and are only valid on the local link.'},
  {q:'Which DHCP message does a client broadcast first when it looks for a server?', c:['Offer', 'Request', 'Discover', 'Acknowledge'], a:2, why:'The DORA order is Discover, Offer, Request, Acknowledge.'},
  {q:'NAT overload is also known as what?', c:['Static NAT', 'PAT', 'Dynamic NAT', 'NAT64'], a:1, why:'Port Address Translation shares one address between many hosts by using different port numbers.'},
  {q:'Which port security violation mode shuts the port down (err-disabled)?', c:['protect', 'restrict', 'shutdown', 'drop'], a:2, why:'Shutdown is the default mode. Protect and restrict keep the port up and drop offending frames.'},
  {q:'Which device forwards frames based on the destination MAC address?', c:['Hub', 'Switch', 'Repeater', 'Modem'], a:1, why:'A switch learns MAC addresses and forwards each frame only out the right port.'},
  {q:'Which ACL type can filter on both source and destination address and on port numbers?', c:['Standard', 'Extended', 'Reflexive only', 'Dynamic only'], a:1, why:'Standard ACLs match source addresses only. Extended ACLs match source, destination, protocol and ports.'},
  {q:'Which protocol and port does a router use to send syslog messages to a server?', c:['NTP, UDP 123', 'Syslog, UDP 514', 'DNS, UDP 53', 'SNMP, UDP 161'], a:1, why:'Syslog uses UDP port 514.'},
  {q:'Which neighbor discovery protocol is Cisco-proprietary?', c:['LLDP', 'CDP', 'ARP', 'ICMP'], a:1, why:'CDP is Cisco-proprietary. LLDP is the open IEEE 802.1AB equivalent.'},
  {q:'What is the dotted-decimal mask for a /27?', c:['255.255.255.192', '255.255.255.224', '255.255.255.240', '255.255.254.0'], a:1, why:'A /27 has 27 network bits, which gives 255.255.255.224.'},
  {q:'Which VLAN range is the normal range on a Cisco switch?', c:['1 - 1005', '1006 - 4094', '0 - 4095', '1 - 255'], a:0, why:'VLANs 1 to 1005 are the normal range. 1006 to 4094 are the extended range.'},
  {q:'Which command makes an interface an 802.1Q trunk?', c:['switchport mode access', 'switchport mode trunk', 'switchport trunk native', 'spanning-tree portfast'], a:1, why:'switchport mode trunk forces the port into trunking mode.'},
  {q:'What is the first usable host address in 192.168.10.64/26?', c:['192.168.10.64', '192.168.10.65', '192.168.10.66', '192.168.10.1'], a:1, why:'The network address is .64, so the first usable host is .65.'},
  {q:'Which switch becomes the spanning tree root bridge?', c:['The one with the highest bridge ID', 'The one with the lowest bridge ID', 'The one with the most ports', 'The oldest switch'], a:1, why:'The lowest bridge ID (priority, then MAC address) wins the root election.'},
  {q:'Which protocol resolves an IPv4 address to a MAC address on a LAN?', c:['DNS', 'DHCP', 'ARP', 'ICMP'], a:2, why:'ARP asks "who has this IP address?" and learns the MAC address from the reply.'},
  {q:'How does router-on-a-stick route between VLANs?', c:['One physical interface per VLAN', 'Subinterfaces with 802.1Q encapsulation on one trunk link', 'A hub between the VLANs', 'Spanning tree between the VLANs'], a:1, why:'One physical link carries all VLANs as a trunk, and the router uses one dot1q subinterface per VLAN.'},
  {q:'What is the default OSPF hello interval on a broadcast network?', c:['5 seconds', '10 seconds', '30 seconds', '40 seconds'], a:1, why:'The hello interval is 10 seconds on broadcast and point-to-point networks, with a dead interval of 40.'}
];
const EXAM_COUNT = 10, EXAM_SECONDS = 600;
let examQs = [], examAns = {}, examEnd = 0, examTimer = null, examDone = false;
const examCard = document.getElementById('exam-card');
function examFmt(s){ return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function examStart(){
  examQs = EXAM_Q.map(q => [Math.random(), q]).sort((x, y) => x[0] - y[0]).slice(0, EXAM_COUNT).map(x => x[1]);
  examAns = {}; examDone = false; examEnd = Date.now() + EXAM_SECONDS * 1000;
  clearInterval(examTimer); examTimer = setInterval(examTick, 1000);
  examRender();
}
function examTick(){
  const left = Math.max(0, Math.round((examEnd - Date.now()) / 1000));
  const el = document.getElementById('exam-time');
  if (el) el.textContent = examFmt(left);
  if (!left) examFinish();
}
function examFinish(){ clearInterval(examTimer); examDone = true; examRender(); }
function examRender(){
  if (!examQs.length) {
    examCard.innerHTML = `<h2>Ready?</h2><p class="note">${EXAM_COUNT} random multiple-choice questions on switching, routing and IP services. You have ${EXAM_SECONDS / 60} minutes. Unanswered questions score zero.</p><button data-act="start">Start exam</button>`;
    return;
  }
  const score = examQs.filter((q, i) => examAns[i] === q.a).length;
  let h = examDone
    ? `<div class="req-head"><h2>Result: ${score}/${examQs.length}</h2><span>${Math.round(100 * score / examQs.length)}%</span></div>`
    : `<div class="req-head"><h2>Time left <span id="exam-time">${examFmt(Math.max(0, Math.round((examEnd - Date.now()) / 1000)))}</span></h2><span>${Object.keys(examAns).length}/${examQs.length} answered</span></div>`;
  examQs.forEach((q, i) => {
    const cls = examDone ? (examAns[i] === q.a ? ' ok' : ' bad') : '';
    h += `<fieldset class="exam-q${cls}"><legend>${i + 1}. ${esc(q.q)}</legend>` + q.c.map((c, j) => {
      const mark = examDone && j === q.a ? ' right' : '';
      return `<label class="exam-opt${mark}"><input type="radio" name="q${i}" value="${j}"${examAns[i] === j ? ' checked' : ''}${examDone ? ' disabled' : ''}> ${esc(c)}</label>`;
    }).join('') + (examDone ? `<p class="note">${esc(q.why)}</p>` : '') + '</fieldset>';
  });
  h += examDone ? '<button data-act="start">Try another exam</button>' : '<button data-act="submit">Submit exam</button>';
  examCard.innerHTML = h;
}
examCard.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  if (b.dataset.act === 'start') examStart();
  else if (b.dataset.act === 'submit') examFinish();
  if (b.dataset.act === 'start') window.scrollTo(0, 0);
});
examCard.addEventListener('change', e => { if (e.target.name && e.target.name.startsWith('q')) { examAns[Number(e.target.name.slice(1))] = Number(e.target.value); const n = examCard.querySelector('.req-head span:last-child'); if (n && !examDone) n.textContent = `${Object.keys(examAns).length}/${examQs.length} answered`; } });
document.getElementById('nav-exam').addEventListener('click', () => { show('exam'); if (!examCard.innerHTML) examRender(); });
