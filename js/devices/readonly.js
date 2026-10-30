// Display-only devices (R2, R3, the DHCP server): they are in the diagram and have a console, but nothing can be configured on them.

function createReadonly(node, session) {
  const refuse = (line, out) => out('% Not configurable in this lab', 'ln-err');
  const self = defineDevice({
    name: node.id, type: node.type,
    prompt: () => node.id + '>',
    run: refuse,
    complete: line => ({value: line}),
    help: refuse,
  });
  // the lab's DHCP server also lists the pools it serves
  const heading = self.banner;
  self.banner = () => [...heading(), ...(session.server && node.id === session.server.name ? session.server.pools.map(p =>
    `DHCP pool ${p.name}: ${p.net} ${p.mask}, gateway ${p.gw}, excluded ${p.ex.map(r => r.join(' - ')).join(', ')}`) : [])];
  return self;
}
DEVICE_TYPES.readonly = createReadonly;
DEVICE_TYPES.dhcp = createReadonly; // a DHCP server is never configured in this lab
