// Landing page: the track cards, or the Profile view when the address ends in #profile (the account button goes there).
function showLanding() {
  const profile = location.hash === '#profile';
  $('home').hidden = profile;
  $('profile').hidden = !profile;
  window.scrollTo(0, 0);
}
addEventListener('hashchange', showLanding);
showLanding();
