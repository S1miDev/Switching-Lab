// Loads the Linux track's code (no page, no DOM) into one shared context, in the order linux.html loads it.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const FILES = ['linux/topics.js', 'devices/device.js', 'linux/fs.js', 'linux/bash.js', 'linux/cmds-files.js', 'linux/cmds-text.js',
  'linux/cmds-system.js', 'devices/linux.js', 'linux/labs.js', 'linux/track.js', 'session.js'];

const ctx = vm.createContext({console, Intl});
for (const f of FILES) {
  const file = path.join(__dirname, '..', 'js', f);
  if (fs.existsSync(file)) vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, {filename: file}); // files of later tasks may not exist yet
}

// a global of the Linux page by name, e.g. get('lxState')
module.exports = name => vm.runInContext(name, ctx);
