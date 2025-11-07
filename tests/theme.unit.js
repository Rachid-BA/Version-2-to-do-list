function assert(name, cond) {
  const el = document.getElementById('test-output');
  const line = document.createElement('div');
  line.textContent = `${cond ? '✅' : '❌'} ${name}`;
  line.style.color = cond ? 'green' : 'red';
  el.appendChild(line);
}

function reset() {
  localStorage.removeItem('themeMode');
  localStorage.removeItem('themeLast');
}

async function runUnitTests() {
  reset();

  // Manual override wins
  window.Theme.setMode('night');
  assert('Manual night sets theme-night', document.documentElement.classList.contains('theme-night'));
  window.Theme.setMode('day');
  assert('Manual day sets theme-day', document.documentElement.classList.contains('theme-day'));

  // Auto with default times (06–18): emulate time 07:00 as day
  window.Theme.setMode('auto');
  const morning = new Date(); morning.setHours(7, 0, 0, 0);
  assert('Auto default 07:00 is day', window.Theme.isNight(morning) === false);
  const late = new Date(); late.setHours(22, 0, 0, 0);
  assert('Auto default 22:00 is night', window.Theme.isNight(late) === true);

  // Auto with "geo": Quick synthetic sunTimes by location
  // We cannot inject internal sunTimes; we rely on isNight fallback.
  // The computeSunTimes is used by Theme internally; here we just spot-check.
  const sydney = computeSunTimes(-33.8688, 151.2093, new Date());
  assert('computeSunTimes returns sunrise', sydney.sunrise instanceof Date);
  assert('computeSunTimes returns sunset', sydney.sunset instanceof Date);
}

document.addEventListener('DOMContentLoaded', runUnitTests);