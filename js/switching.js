// Switching page wiring on top of script.js: the views and nav tabs only switching.html has.

Object.assign(VIEWS, {
  trouble: {page: 'trouble', nav: 'nav-trouble', seg: 'trouble-seg'},
  sandbox: {page: 'sandbox', nav: 'nav-sandbox', seg: 'sandbox-seg'},
  topo: {page: 'topo-view', nav: 'nav-topo', seg: 'topo-seg'},
  exam: {page: 'exam-view', nav: 'nav-exam'},
  ccna: {page: 'ccna-view', nav: 'nav-ccna'},
});

$('nav-sandbox').addEventListener('click', () => show('sandbox'));
$('sb-go-labs').addEventListener('click', () => show('dash'));
document.querySelectorAll('[data-sb-tab]').forEach(b => b.addEventListener('click', () => {
  $('sb-guided').hidden = b.dataset.sbTab !== 'guided';
  $('sb-mine').hidden = b.dataset.sbTab !== 'mine';
  document.querySelectorAll('[data-sb-tab]').forEach(x => x.classList.toggle('active', x === b));
  moveSeg($('sandbox-seg'));
}));
$('nav-trouble').addEventListener('click', () => show('trouble'));

renderDashboard('trouble-domains', true);
