// Loads the app's lab code (no page, no DOM) into one shared context, in the order index.html loads it.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const FILES = ['i18n.js', 'topics.js', 'devices/device.js', 'devices/ios.js', 'help.js', 'devices/router.js', 'devices/switch.js',
  'devices/mls.js', 'devices/pc.js', 'devices/readonly.js', 'labs.js', 'labs-fix.js', 'session.js', 'topo-data.js', 'sandbox-model.js'];

// a getter for the code loaded in one language ('en' or 'cs', as if saved in localStorage)
function load(lang) {
  const ctx = vm.createContext({console, localStorage: {getItem: k => (k === 'lang' ? lang : null)}});
  for (const f of FILES) {
    const file = path.join(__dirname, '..', 'js', f);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, {filename: file});
  }
  // a global of the app by name, e.g. get('createSession')
  return name => vm.runInContext(name, ctx);
}

module.exports = load('en');
module.exports.load = load;
