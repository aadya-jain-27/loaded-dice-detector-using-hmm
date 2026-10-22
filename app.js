// =============================================================
//  app.js  —  Makes the page interactive
// =============================================================
//  Uses the model and algorithms from hmm.js:
//    FAIR, LOADED, rollDie, playCasino, viterbi, chanceLoaded
// =============================================================


// ---------- Small helpers ----------

// Find an element on the page by its id
function $(id) {
  return document.getElementById(id);
}

// 0.734 -> "73%"
function percent(x) {
  return Math.round(x * 100) + '%';
}

// Where the dots go on each face of a die (in a 100 × 100 box)
const DOTS = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]],
};

// Draw a die picture. color can be 'fair' (green), 'loaded' (red) or '' (white)
function drawDie(face, color = '') {
  let svg = `<svg viewBox="0 0 100 100" class="die ${color}">`;
  svg += `<rect x="4" y="4" width="92" height="92" rx="18"/>`;
  for (const [x, y] of DOTS[face]) {
    svg += `<circle cx="${x}" cy="${y}" r="9"/>`;
  }
  return svg + '</svg>';
}

// Find stretches of rolls marked loaded.
// Example: [F, L, L, F, L] -> [[1, 2], [4, 4]]
function findStretches(isLoaded) {
  const stretches = [];
  for (let t = 0; t < isLoaded.length; t++) {
    if (!isLoaded[t]) continue;
    const last = stretches[stretches.length - 1];
    if (last && last[1] === t - 1) {
      last[1] = t;               // continue the current stretch
    } else {
      stretches.push([t, t]);    // start a new stretch
    }
  }
  return stretches;
}

// [[1, 2], [4, 4]] -> "rolls 2–3 and roll 5"  (we count rolls from 1 for people)
function describeStretches(stretches) {
  return stretches
    .map(([a, b]) => (a === b ? `roll ${a + 1}` : `rolls ${a + 1}–${b + 1}`))
    .join(' and ');
}


// =============================================================
//  SECTION 1 — Title dice
// =============================================================
$('titleDice').innerHTML = [6, 3, 6, 6, 1, 6]
  .map(face => `<div style="width:70px">${drawDie(face, face === 6 ? 'loaded' : 'fair')}</div>`)
  .join('');


// =============================================================
//  SECTION 2 — Two dice: roll them and count the faces
// =============================================================
const counts = [
  [0, 0, 0, 0, 0, 0],   // how many 1s, 2s ... 6s the fair die rolled
  [0, 0, 0, 0, 0, 0],   // same for the loaded die
];

function rollMany(die, times) {
  let face = 1;
  for (let i = 0; i < times; i++) {
    face = rollDie(die);
    counts[die][face - 1]++;
  }
  showDie(die, face, true);
  showBars(die);
}

function showDie(die, face, shake) {
  const box = die === FAIR ? $('fairDie') : $('loadedDie');
  box.innerHTML = drawDie(face, die === FAIR ? 'fair' : 'loaded');
  if (shake) {
    box.classList.remove('shake');
    void box.offsetWidth;          // restart the animation
    box.classList.add('shake');
  }
}

function showBars(die) {
  const box = die === FAIR ? $('fairBars') : $('loadedBars');
  const color = die === FAIR ? 'var(--fair)' : 'var(--loaded)';
  const total = counts[die].reduce((a, b) => a + b, 0) || 1;

  let html = '';
  for (let face = 1; face <= 6; face++) {
    const share = counts[die][face - 1] / total;
    const height = Math.min(100, (share / 0.6) * 100);   // 60% fills the chart
    html += `<div class="col">
               <div class="pct">${percent(share)}</div>
               <div class="bar" style="height:${height}%; background:${color}"></div>
               <div class="face">${face}</div>
             </div>`;
  }
  box.innerHTML = html;
}

showDie(FAIR, 3, false);
showDie(LOADED, 6, false);
showBars(FAIR);
showBars(LOADED);


// =============================================================
//  SECTION 3 — Spot it: player vs. HMM
// =============================================================
let hand;            // { dice, rolls, story }  (story = HMM's guess)
let suspects = [];   // roll positions the player tapped
let revealed = false;

function newHand() {
  // Keep dealing until the hand has one clear loaded stretch,
  // so there is something to find (5000 tries is instant).
  for (let i = 0; i < 5000; i++) {
    hand = playCasino(16);
    hand.story = viterbi(hand.rolls).story;

    let loaded = 0, caught = 0, falseAlarms = 0;
    for (let t = 0; t < 16; t++) {
      if (hand.dice[t] === LOADED) loaded++;
      if (hand.dice[t] === LOADED && hand.story[t] === LOADED) caught++;
      if (hand.dice[t] === FAIR && hand.story[t] === LOADED) falseAlarms++;
    }
    if (loaded >= 5 && loaded <= 10 && caught >= loaded * 0.75 && falseAlarms <= 1) break;
  }

  suspects = [];
  revealed = false;
  $('handResult').innerHTML = '<p class="muted small">Tip: the loaded die loves 6. Look for 6s that come close together.</p>';
  showHand();
}

function showHand() {
  let html = '';
  for (let t = 0; t < hand.rolls.length; t++) {
    const isSuspect = suspects.includes(t);
    const realDie = hand.dice[t];
    let label;
    let color = '';

    if (revealed) {
      color = realDie === LOADED ? 'loaded' : 'fair';
      label = realDie === LOADED ? '<span class="loaded-text">Loaded</span>' : '<span class="fair-text">Fair</span>';
      label += `<span class="hmm">HMM: ${hand.story[t] === LOADED ? '<span class="loaded-text">Loaded</span>' : 'Fair'}</span>`;
    } else {
      label = isSuspect ? '🚨 suspect' : '?';
    }

    html += `<div class="cell ${isSuspect ? 'suspect' : ''}" onclick="tapCell(${t})">
               ${drawDie(hand.rolls[t], color)}${label}
             </div>`;
  }
  $('hand').innerHTML = html;
}

function tapCell(t) {
  if (revealed) return;
  if (suspects.includes(t)) {
    suspects = suspects.filter(x => x !== t);   // un-tap
  } else {
    suspects.push(t);
  }
  showHand();
}

function revealHand() {
  revealed = true;
  showHand();

  // Score: cheats caught and false alarms, for the player and for the HMM
  let total = 0, youCaught = 0, youWrong = 0, hmmCaught = 0, hmmWrong = 0;
  for (let t = 0; t < hand.rolls.length; t++) {
    const realLoaded = hand.dice[t] === LOADED;
    const youSaid = suspects.includes(t);
    const hmmSaid = hand.story[t] === LOADED;
    if (realLoaded) total++;
    if (realLoaded && youSaid) youCaught++;
    if (!realLoaded && youSaid) youWrong++;
    if (realLoaded && hmmSaid) hmmCaught++;
    if (!realLoaded && hmmSaid) hmmWrong++;
  }

  // Explain how the HMM found the cheating
  const stretches = findStretches(hand.story.map(d => d === LOADED));
  let sixes = 0, rollsInside = 0;
  for (const [a, b] of stretches) {
    for (let t = a; t <= b; t++) {
      rollsInside++;
      if (hand.rolls[t] === 6) sixes++;
    }
  }

  let why;
  if (stretches.length > 0) {
    why = `<ol class="steps-list">
      <li><b>It looks at the 6s.</b> A fair die rolls a 6 only 1 time in 6. The loaded die rolls a 6 every 2nd time.</li>
      <li><b>It finds where 6s bunch up.</b> In ${describeStretches(stretches)} there are <b>${sixes} sixes in ${rollsInside} rolls</b>. That is too many for a fair die.</li>
      <li><b>It knows the dealer rarely switches.</b> So it marks that <b>whole stretch</b> as loaded, even the rolls in it that are not 6.</li>
      <li><b>Everywhere else</b> the numbers look normal, so it says fair.</li>
    </ol>`;
  } else {
    why = '<p>The HMM did not see enough 6s close together, so it said <b>fair</b> everywhere.</p>';
  }

  $('handResult').innerHTML = `
    <div class="card">
      <table class="score">
        <tr><th></th><th>Cheats caught</th><th>False alarms</th></tr>
        <tr><td>You</td><td>${youCaught} / ${total}</td><td>${youWrong}</td></tr>
        <tr><td>HMM</td><td>${hmmCaught} / ${total}</td><td>${hmmWrong}</td></tr>
      </table>
      <p class="muted small" style="margin-top:.6em">
        <b>Cheats caught</b> = loaded rolls you marked. <b>False alarms</b> = fair rolls you wrongly marked.
      </p>
    </div>
    <div class="card blue"><h3>How did the HMM find it?</h3>${why}</div>`;
}

newHand();


// =============================================================
//  SECTION 4 — Evidence: add rolls, watch the chance change
// =============================================================
let myRolls = [];   // each item: { face: 1..6, realDie: FAIR, LOADED or null (tapped by you) }

// The six tappable dice
let padHtml = '';
for (let face = 1; face <= 6; face++) {
  padHtml += `<button onclick="addRolls([${face}], null)">${drawDie(face)}</button>`;
}
$('pad').innerHTML = padHtml;

function addRolls(faces, realDie) {
  for (const face of faces) myRolls.push({ face, realDie });
  if (myRolls.length > 80) myRolls = myRolls.slice(-80);   // keep the last 80
  showEvidence();
}

function addRandomRolls(die) {
  const faces = [];
  for (let i = 0; i < 10; i++) faces.push(rollDie(die));
  addRolls(faces, die);
}

function undoRoll() {
  myRolls.pop();
  showEvidence();
}

function clearRolls() {
  myRolls = [];
  showEvidence();
}

function showEvidence() {
  if (myRolls.length === 0) {
    $('myRolls').innerHTML = '<span class="muted small">No rolls yet</span>';
    $('lineChart').innerHTML = '';
    $('meter').textContent = '0%';
    $('meter').style.color = 'var(--muted)';
    $('verdict').textContent = '';
    $('history').textContent = 'Add some rolls to start.';
    return;
  }

  // Ask the HMM: chance each roll used the loaded die
  const chances = chanceLoaded(myRolls.map(r => r.face));
  const now = chances[chances.length - 1];

  // Dice strip: die colour = real die, bar under it = HMM's guess
  let html = '';
  myRolls.forEach((roll, t) => {
    const color = roll.realDie === LOADED ? 'loaded' : roll.realDie === FAIR ? 'fair' : '';
    const guess = chances[t] > 0.5 ? 'var(--loaded)' : 'var(--fair)';
    html += `<span class="one">${drawDie(roll.face, color)}<i style="background:${guess}"></i></span>`;
  });
  $('myRolls').innerHTML = html;

  drawLine(chances);

  // Big number for the last roll
  $('meter').textContent = percent(now);
  if (now > 0.7) {
    $('meter').style.color = 'var(--loaded)';
    $('verdict').textContent = '🚨 Loaded die right now!';
  } else if (now > 0.4) {
    $('meter').style.color = 'var(--gold)';
    $('verdict').textContent = '🤔 Suspicious right now…';
  } else {
    $('meter').style.color = 'var(--fair)';
    $('verdict').textContent = '✅ Fair die right now';
  }

  // Where did cheating happen?
  const stretches = findStretches(chances.map(c => c > 0.5));
  if (stretches.length === 0) {
    $('history').innerHTML = '✅ No cheating found in any roll so far.';
  } else {
    $('history').innerHTML = `🚨 <b>Cheating found</b> in ${describeStretches(stretches)}` +
      (now <= 0.5 ? ', then the dealer switched back to the fair die.' : '.');
  }
}

// Draw the blue line chart (0% at the bottom, 100% at the top)
function drawLine(chances) {
  const width = 1000 / chances.length;
  const y = c => 6 + (1 - c) * 188;

  let points = '';
  chances.forEach((c, t) => {
    points += `${t === 0 ? 'M' : 'L'}${(t + 0.5) * width},${y(c)} `;
  });

  $('lineChart').innerHTML = `
    <line x1="0" x2="1000" y1="${y(0.5)}" y2="${y(0.5)}" stroke="var(--muted)" stroke-dasharray="6 6" opacity=".5" vector-effect="non-scaling-stroke"/>
    <path d="${points}" fill="none" stroke="var(--blue)" stroke-width="3" vector-effect="non-scaling-stroke"/>`;
}

showEvidence();


// =============================================================
//  SECTION 5 — How it guesses: Viterbi step by step
// =============================================================
const STEP_ROLLS = [1, 4, 2, 5, 3, 1, 6, 6, 6, 4, 6, 6];
const result = viterbi(STEP_ROLLS);
const N = STEP_ROLLS.length;

let step = 0;          // how many rolls are shown so far
let finished = false;  // true after the trace back
let timer = null;

// Position of each circle on the picture
function colX(t) { return 150 + t * 92; }
function rowY(die) { return die === FAIR ? 185 : 330; }

// Share of the two dice at roll t (so the two circles add up to 100%)
function share(t, die) {
  const b = result.best[t];
  return b[die] / (b[FAIR] + b[LOADED]);
}

function drawSteps() {
  let svg = '';

  // Row names
  svg += `<text x="20" y="62" style="fill:var(--muted);font-size:15px">Roll</text>`;
  svg += `<text x="20" y="${rowY(FAIR) + 6}" style="fill:var(--fair)">Fair</text>`;
  svg += `<text x="20" y="${rowY(LOADED) + 6}" style="fill:var(--loaded)">Loaded</text>`;

  // The rolls along the top
  STEP_ROLLS.forEach((face, t) => {
    const die = drawDie(face, face === 6 ? 'loaded' : '').replace('<svg', '<svg width="60" height="60"');
    svg += `<g transform="translate(${colX(t) - 30},25)">${die}</g>`;
  });

  // Grey lines: where each best story came from
  for (let t = 1; t < step; t++) {
    for (const die of [FAIR, LOADED]) {
      const prev = result.from[t][die];
      svg += `<line class="link" x1="${colX(t - 1) + 32}" y1="${rowY(prev)}" x2="${colX(t) - 32}" y2="${rowY(die)}"/>`;
    }
  }

  // Gold line: the final best story
  if (finished) {
    for (let t = 1; t < N; t++) {
      svg += `<line class="link best" x1="${colX(t - 1)}" y1="${rowY(result.story[t - 1])}" x2="${colX(t)}" y2="${rowY(result.story[t])}"/>`;
    }
  }

  // Circles with percentages
  for (let t = 0; t < N; t++) {
    for (const die of [FAIR, LOADED]) {
      const color = die === FAIR ? 'var(--fair)' : 'var(--loaded)';
      if (t < step) {
        const s = share(t, die);
        const onStory = finished && result.story[t] === die;
        svg += `<circle cx="${colX(t)}" cy="${rowY(die)}" r="32" fill="${color}" fill-opacity="${0.12 + 0.75 * s}"
                  stroke="${onStory ? 'var(--gold)' : color}" stroke-width="${onStory ? 6 : 2}"/>`;
        svg += `<text x="${colX(t)}" y="${rowY(die) + 6}" text-anchor="middle" style="font-size:16px">${percent(s)}</text>`;
      } else {
        svg += `<circle cx="${colX(t)}" cy="${rowY(die)}" r="32" fill="none" stroke="var(--line)" stroke-width="2" stroke-dasharray="5 5"/>`;
      }
    }
  }
  $('steps').innerHTML = svg;

  // The sentence under the picture
  let text;
  if (finished) {
    const letters = result.story.map(d => (d === LOADED ? 'L' : 'F')).join(' ');
    text = `<b>Done!</b> The gold line is the computer's best guess: <b>${letters}</b> (F = fair, L = loaded)`;
  } else if (step === 0) {
    text = 'Press <b>Next step</b> or <b>Play</b> to start.';
  } else {
    const face = STEP_ROLLS[step - 1];
    text = face === 6
      ? `Roll ${step} is a <b>6</b>. That looks more like the <span class="loaded-text">Loaded</span> die.`
      : `Roll ${step} is a <b>${face}</b>. That looks more like the <span class="fair-text">Fair</span> die.`;
    if (step === N) text += ' Press <b>Next step</b> to see the final answer.';
  }
  $('stepText').innerHTML = text;
}

function nextStep() {
  if (step < N) {
    step++;
  } else if (!finished) {
    finished = true;
  } else {
    clearInterval(timer);   // nothing left to show
    return;
  }
  drawSteps();
}

function play() {
  clearInterval(timer);
  if (finished) resetSteps();
  timer = setInterval(nextStep, 650);
}

function resetSteps() {
  clearInterval(timer);
  step = 0;
  finished = false;
  drawSteps();
}

drawSteps();
