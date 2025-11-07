function getVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function checkPositions() {
  const sun = document.getElementById('sunBadge');
  const moon = document.getElementById('moonBadge');
  const okSun = sun && sun.getBoundingClientRect().left <= 20 && sun.getBoundingClientRect().top <= 24;
  const okMoon = moon && (window.innerWidth - moon.getBoundingClientRect().right) <= 20 && moon.getBoundingClientRect().top <= 24;
  return okSun && okMoon;
}

function checkColors(mode) {
  const start = getVar('--bg-start');
  const end = getVar('--bg-end');
  if (mode === 'day') {
    return start === '#eafff6' && end === '#ffffff';
  } else {
    return start === '#0b1a3a' && end === '#1b2856';
  }
}

function checkAnimation(which) {
  const el = which === 'sun' ? document.getElementById('sunBadge') : document.getElementById('moonBadge');
  const cls = which === 'sun' ? 'animate-sun-rise' : 'animate-moon-rise';
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  const hadClass = el.classList.contains(cls);
  setTimeout(() => el.classList.remove(cls), 700);
  return hadClass;
}

function log(name, ok) {
  const el = document.getElementById('e2e-output');
  const line = document.createElement('div');
  line.textContent = `${ok ? '✅' : '❌'} ${name}`;
  line.style.color = ok ? 'green' : 'red';
  el.appendChild(line);
}

function runE2E() {
  // Day mode
  window.Theme.setMode('day');
  log('Day positions ok', checkPositions());
  log('Day colors ok', checkColors('day'));
  log('Sun animation class toggles', checkAnimation('sun'));

  // Night mode
  window.Theme.setMode('night');
  log('Night positions ok', checkPositions());
  log('Night colors ok', checkColors('night'));
  log('Moon animation class toggles', checkAnimation('moon'));
}

document.addEventListener('DOMContentLoaded', runE2E);