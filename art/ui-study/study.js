/* Standalone technical fixture. All state lasts only for this page visit. */
(() => {
  'use strict';
  const root = document.querySelector('.ui-study');
  const sheet = root.querySelector('.paper-grid');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const status = root.querySelector('#motion-status');
  const reader = root.querySelector('.reading-scroll');
  const drawer = root.querySelector('.drawer');
  const drawerCopy = root.querySelector('.drawer-copy');
  const drawerTitle = root.querySelector('#drawer-title');
  const drawerButtons = [...root.querySelectorAll('[data-drawer]')];
  const movingWords = [...root.querySelectorAll('[data-motion-word]')];
  const longToggle = root.querySelector('.long-toggle');
  const longCopy = root.querySelector('#long-copy');
  const composer = root.querySelector('.composer');
  const bank = root.querySelector('.word-bank');
  const selected = root.querySelector('.assembled-words');
  const output = root.querySelector('output');
  const clear = root.querySelector('.clear-sentence');
  const camera = root.querySelector('.camera-view');
  const rail = root.querySelector('.left-rail');
  let drawerKey = '', drawerOpener = null;
  let timer = 0, stopTimer = 0, burstTimer = 0, motionIndex = 0;
  let long = false;
  const sentence = [];
  const tokens = ['They', 'still', 'talk', 'to', 'me.'];

  // Existing author-supplied excerpts, used only as labelled visual fixtures.
  const excerpts = {
    terminal: {title: 'Terminal', lines: []},
    pending: {title: 'Pending', lines: ['Fourth time. The first three were fine.', 'Take another look', 'Leave it']},
    reports: {title: 'Reports', lines: ["Someone's out there.", "That's a suit moving.", 'People. Two of them.']},
    diary: {title: 'Diary', lines: ["I'm here.", 'They still talk to me.', 'Still here.']},
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
  // Reusable masked copies keep each burst bounded, even on rapid clicks.
  movingWords.forEach(word => {
    for (let layer = 0; layer < 3; layer++) {
      const dust = document.createElement('span');
      dust.className = `ink-fragments fragments-${layer}`;
      dust.setAttribute('aria-hidden', 'true');
      dust.textContent = word.querySelector('.glyph').textContent;
      word.append(dust);
    }
  });
  function stopMotion() {
    clearTimeout(timer);
    clearTimeout(stopTimer);
    clearTimeout(burstTimer);
    root.querySelectorAll('.is-moving,.is-scattering').forEach(word => word.classList.remove('is-moving', 'is-scattering'));
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
      stopTimer = setTimeout(scheduleMotion, 300);
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
      if (!button.hasAttribute('data-motion-word') || !mayAnimate()) return;
      stopMotion();
      void button.offsetWidth;
      button.classList.add('is-scattering');
      burstTimer = setTimeout(scheduleMotion, 700);
    });
  });
  function actionButton(text, label, callback) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.setAttribute('aria-label', label);
    button.addEventListener('click', callback);
    return button;
  }
  function renderSentence(focus) {
    bank.replaceChildren();
    selected.replaceChildren();
    tokens.forEach((token, id) => {
      const button = actionButton(token, `Add ${token}`, () => {
        sentence.push(id);
        renderSentence({kind: 'remove', id});
      });
      button.dataset.token = String(id);
      button.disabled = sentence.includes(id);
      bank.append(button);
    });
    sentence.forEach((id, position) => {
      const group = document.createElement('span');
      group.className = 'chosen-token';
      group.dataset.token = String(id);
      const remove = actionButton(tokens[id], `Remove ${tokens[id]}`, () => {
        sentence.splice(position, 1);
        renderSentence({kind: 'bank', id});
      });
      remove.dataset.action = 'remove';
      group.append(remove);
      for (const [direction, delta, symbol] of [['left', -1, '←'], ['right', 1, '→']]) {
        const next = position + delta;
        const move = actionButton(symbol, `Move ${tokens[id]} ${direction}`, () => {
          [sentence[position], sentence[next]] = [sentence[next], sentence[position]];
          renderSentence({kind: 'remove', id});
        });
        move.disabled = next < 0 || next >= sentence.length;
        group.append(move);
      }
      selected.append(group);
    });
    output.textContent = sentence.length ? sentence.map(id => tokens[id]).join(' ') : '…';
    clear.disabled = sentence.length === 0;
    if (focus?.kind === 'bank') bank.querySelector(`[data-token="${focus.id}"]`).focus();
    if (focus?.kind === 'remove') selected.querySelector(`[data-token="${focus.id}"] [data-action="remove"]`).focus();
  }
  clear.addEventListener('click', () => {
    sentence.length = 0;
    renderSentence({kind: 'bank', id: 0});
  });
  renderSentence();
  function closeDrawer(returnFocus = false) {
    drawer.hidden = true;
    drawerKey = '';
    sheet.classList.remove('has-drawer');
    drawerButtons.forEach(button => button.setAttribute('aria-expanded', 'false'));
    if (returnFocus && drawerOpener) drawerOpener.focus({preventScroll: true});
  }
  drawerButtons.forEach(button => {
    button.addEventListener('click', () => {
      if (drawerKey === button.dataset.drawer) { closeDrawer(); return; }
      drawerKey = button.dataset.drawer;
      drawerOpener = button;
      const excerpt = excerpts[drawerKey];
      drawer.dataset.kind = drawerKey;
      drawerTitle.textContent = excerpt.title;
      drawerCopy.replaceChildren();
      excerpt.lines.forEach(line => {
        const p = document.createElement('p');
        p.textContent = line;
        drawerCopy.append(p);
      });
      drawerCopy.hidden = drawerKey === 'terminal';
      composer.hidden = drawerKey !== 'terminal';
      drawer.querySelector('.drawer-note').textContent = drawerKey === 'diary' ? 'FONT TEST EXCERPT' : drawerKey === 'terminal' ? 'WORD ASSEMBLY TEST' : 'TEST EXCERPT';
      drawerCopy.scrollTop = 0;
      drawer.hidden = false;
      sheet.classList.add('has-drawer');
      drawerButtons.forEach(b => b.setAttribute('aria-expanded', String(b === button)));
    });
  });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && drawerKey) { event.preventDefault(); closeDrawer(true); }
  });
  // The same reader survives hash navigation; native history works offline.
  function showView(focus = false) {
    const scrollTop = reader.scrollTop;
    const cameraOpen = location.hash === '#camera';
    sheet.classList.toggle('camera-open', cameraOpen);
    camera.hidden = !cameraOpen;
    rail.hidden = cameraOpen;
    reader.scrollTop = scrollTop;
    window.scrollTo(0, 0);
    if (focus) {
      const target = cameraOpen ? root.querySelector('#camera-view-title') : root.querySelector('a[href="#camera"]');
      target.focus({preventScroll: true});
    }
  }
  window.addEventListener('hashchange', () => showView(true));
  root.querySelectorAll('.camera-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      root.querySelectorAll('.camera-tile').forEach(t => t.setAttribute('aria-pressed', String(t === tile)));
    });
  });
  longToggle.addEventListener('click', () => {
    long = !long;
    root.querySelector('.short-copy').hidden = long;
    longCopy.hidden = !long;
    longToggle.setAttribute('aria-pressed', String(long));
    reader.scrollTop = 0;
    updateStatus();
  });
  media.addEventListener('change', updateStatus);
  document.addEventListener('visibilitychange', scheduleMotion);
  window.addEventListener('pagehide', stopMotion);
  window.addEventListener('pageshow', scheduleMotion);
  showView();
  updateStatus();
})();
