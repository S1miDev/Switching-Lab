// Page helpers every UI module uses. Loads first.

const $ = id => document.getElementById(id);

// a new element with an optional class and text
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

// smooth open and close for the collapsible sections (a plain toggle when the user prefers reduced motion)
document.addEventListener('click', e => {
  const summary = e.target.closest('details.domain > summary, details.card > summary');
  if (!summary || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  e.preventDefault();
  const details = summary.parentElement, body = details.querySelector('.rows, .dbody');
  body.anim?.cancel();
  const opening = !details.open || details.classList.contains('closing');
  if (opening) details.open = true;
  const style = getComputedStyle(body), height = body.scrollHeight;
  details.classList.toggle('closing', !opening);
  const shut = {height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0};
  const full = {height: height + 'px', paddingTop: style.paddingTop, paddingBottom: style.paddingBottom, opacity: 1};
  body.style.overflow = 'hidden';
  body.anim = body.animate(opening ? [shut, full] : [full, shut], {duration: 260, easing: 'cubic-bezier(.4,0,.2,1)'});
  body.anim.onfinish = () => {
    body.style.overflow = '';
    body.anim = null;
    details.classList.remove('closing');
    if (!opening) details.open = false;
  };
  body.anim.oncancel = () => { body.style.overflow = ''; };
});

// seconds as m:ss, for the lab and exam timers
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// escapes text for use inside HTML
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
