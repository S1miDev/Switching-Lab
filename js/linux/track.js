// The Linux page's track: the shared engine (session.js, lab.js, reference.js, script.js) reads these names, so on
// linux.html they point at the Linux catalogue and labs. Only linux.html loads this file; the landing page loads the
// Linux catalogue next to the Switching one under its own LINUX_ names.
const CATALOGUE = LINUX_CATALOGUE, DOMAINS = LINUX_DOMAINS, REF_GROUPS = LINUX_REF_GROUPS, REF_TEXT = LINUX_REF_TEXT;
const LABS = LINUX_LABS, buildLab = lxLab;
