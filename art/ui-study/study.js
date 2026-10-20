/* Visual fixture only. No story variables, predictions, reporting or persistence. */
(() => {
  'use strict';
  const root = document.querySelector('.ui-study');
  const sheet = root.querySelector('.paper-grid');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const status = root.querySelector('#motion-status');
  const drawer = root.querySelector('.drawer');
  const drawerCopy = root.querySelector('.drawer-copy');
  const drawerTitle = root.querySelector('#drawer-title');
  const drawerButtons = [...root.querySelectorAll('[data-drawer]')];
  const movingWords = [...root.querySelectorAll('[data-motion-word]')];
  const longToggle = root.querySelector('.long-toggle');
  const longCopy = root.querySelector('#long-copy');
  let drawerKey = '';
  let drawerOpener = null;
  let timer = 0;
  let stopTimer = 0;
  let motionIndex = 0;
  let long = false;

  // Exact excerpts supplied in the user's UI draft. Repetition is test content.
  const excerpts = {
    pending: {title: 'Pending', lines: ['Fourth time. The first three were fine.', 'Take another look', 'Leave it']},
    reports: {title: 'Reports', lines: ["Someone's out there.", "That's a suit moving.", 'People. Two of them.']},
    diary: {title: 'Diary', lines: []},
    crew: {title: 'Crew log', lines: ['They still talk to me.', "They don't ask anymore.", "Nobody's written."]}
  };
  const repeated = [
    "I'm fine.", 'They still talk to me.', "I'm here.",
    "Someone's out there.", "That's a suit moving.", 'People. Two of them.',
    'Fourth time. The first three were fine.', 'Take another look.', 'Leave it here.',
    "It's been a while.", 'I keep noticing it.', "I'd rather not.",
    'Nobody asked.', 'Quiet.', "They're busy.", 'Still here.'
  ].join(' ');
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('p');
    p.textContent = repeated;
    longCopy.append(p);
  }

  function stopMotion() {
    clearTimeout(timer);
    clearTimeout(stopTimer);
    movingWords.forEach(word => word.classList.remove('is-moving'));
  }
  function mayAnimate() {
    return root.dataset.mode === 'motion' && !media.matches && !document.hidden && !long;
  }
  function scheduleMotion() {
    stopMotion();
    if (!mayAnimate()) return;
    timer = setTimeout(() => {
      if (!mayAnimate()) return;
      const active = [movingWords[motionIndex % movingWords.length], movingWords[(motionIndex + 1) % movingWords.length]];
      motionIndex++;
      active.forEach(word => word.classList.add('is-moving'));
      stopTimer = setTimeout(() => {
        active.forEach(word => word.classList.remove('is-moving'));
        scheduleMotion();
      }, 300);
    }, 4200 + (motionIndex % 3) * 700);
  }
  function updateStatus() {
    const mode = root.dataset.mode;
    status.textContent = mode === 'clean' ? 'Clean text' : mode === 'ink' ? 'Static ink' : media.matches ? 'Motion reduced · static ink' : long ? 'Long text · motion paused' : 'Local motion';
    scheduleMotion();
  }
  root.querySelectorAll('[data-mode-choice]').forEach(button => {
    button.addEventListener('click', () => {
      root.dataset.mode = button.dataset.modeChoice;
      root.querySelectorAll('[data-mode-choice]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      updateStatus();
    });
  });
  root.querySelectorAll('.word-control').forEach(button => {
    button.addEventListener('click', () => {
      button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
    });
  });
  function closeDrawer(returnFocus = false) {
    drawer.hidden = true;
    drawerKey = '';
    sheet.classList.remove('has-drawer');
    drawerButtons.forEach(button => button.setAttribute('aria-expanded', 'false'));
    if (returnFocus && drawerOpener) drawerOpener.focus();
  }
  drawerButtons.forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.drawer;
      if (drawerKey === key) {
        closeDrawer();
        return;
      }
      drawerKey = key;
      drawerOpener = button;
      const excerpt = excerpts[key];
      drawerTitle.textContent = excerpt.title;
      drawerCopy.replaceChildren();
      excerpt.lines.forEach(line => {
        const p = document.createElement('p');
        p.textContent = line;
        drawerCopy.append(p);
      });
      drawerCopy.scrollTop = 0;
      drawer.hidden = false;
      sheet.classList.add('has-drawer');
      drawerButtons.forEach(b => b.setAttribute('aria-expanded', String(b === button)));
    });
  });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && drawerKey) {
      event.preventDefault();
      closeDrawer(true);
    }
  });
  longToggle.addEventListener('click', () => {
    long = !long;
    root.querySelector('.short-copy').hidden = long;
    longCopy.hidden = !long;
    longToggle.setAttribute('aria-pressed', String(long));
    root.querySelector('.reading-scroll').scrollTop = 0;
    updateStatus();
  });
  media.addEventListener('change', updateStatus);
  document.addEventListener('visibilitychange', scheduleMotion);
  window.addEventListener('pagehide', stopMotion);
  window.addEventListener('pageshow', scheduleMotion);
  updateStatus();
})();
