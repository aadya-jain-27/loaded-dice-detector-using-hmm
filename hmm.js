// =============================================================
//  hmm.js  —  The Hidden Markov Model (the "brain" of the project)
// =============================================================
//  Everything about the dice and the two algorithms lives here.
//  The page code (app.js) only calls these functions.
// =============================================================


// ---------- 1. The two hidden states ----------
const FAIR = 0;
const LOADED = 1;


// ---------- 2. Start chances ----------
// At the very first roll, both dice are equally likely.
const START = [0.5, 0.5];


// ---------- 3. Switching chances (transition probabilities) ----------
// SWITCH[from][to] = chance the dealer goes from one die to the other.
const SWITCH = [
  [0.95, 0.05],   // from FAIR:   stay fair 95%,      switch to loaded 5%
  [0.10, 0.90],   // from LOADED: switch to fair 10%, stay loaded 90%
];


// ---------- 4. Number chances (emission probabilities) ----------
// NUMBER_CHANCE[die][face - 1] = chance of rolling that face.
//                 1     2     3     4     5     6
const NUMBER_CHANCE = [
  [1/6,  1/6,  1/6,  1/6,  1/6,  1/6],   // fair die: all equal
  [0.1,  0.1,  0.1,  0.1,  0.1,  0.5],   // loaded die: 6 comes up half the time
];

// Small helper: chance that `die` rolls `face`
function chanceOf(die, face) {
  return NUMBER_CHANCE[die][face - 1];
}


// =============================================================
//  PART A — Making fake casino data (simulation)
// =============================================================

// Pick a position at random, using a list of chances.
// Example: pickRandom([0.95, 0.05]) gives 0 most of the time, 1 sometimes.
function pickRandom(chances) {
  let r = Math.random();
  for (let i = 0; i < chances.length; i++) {
    r = r - chances[i];
    if (r < 0) return i;
  }
  return chances.length - 1;
}

// Roll one die. Gives back a number from 1 to 6.
function rollDie(die) {
  return pickRandom(NUMBER_CHANCE[die]) + 1;
}

// Play the casino for `count` rolls.
// Gives back the real dice used (hidden!) and the numbers we can see.
function playCasino(count) {
  const dice = [];
  const rolls = [];
  let die = pickRandom(START);

  for (let i = 0; i < count; i++) {
    dice.push(die);
    rolls.push(rollDie(die));
    die = pickRandom(SWITCH[die]);   // maybe the dealer switches
  }
  return { dice, rolls };
}


// =============================================================
//  PART B — Viterbi: "What is the most likely story of dice?"
// =============================================================
//  For every roll and every die we keep:
//    best[t][die] = chance of the BEST story that ends with this die at roll t
//    from[t][die] = which die came just before, on that best story
//  At the end we follow `from` backwards to read the story.
// =============================================================
function viterbi(rolls) {
  const n = rolls.length;
  const best = [];
  const from = [];

  // First roll: start chance × chance of this number
  best[0] = [
    START[FAIR] * chanceOf(FAIR, rolls[0]),
    START[LOADED] * chanceOf(LOADED, rolls[0]),
  ];
  from[0] = [null, null];

  // Every next roll
  for (let t = 1; t < n; t++) {
    best[t] = [];
    from[t] = [];

    for (const die of [FAIR, LOADED]) {
      // Two ways to arrive at this die: coming from FAIR or from LOADED
      const viaFair = best[t - 1][FAIR] * SWITCH[FAIR][die];
      const viaLoaded = best[t - 1][LOADED] * SWITCH[LOADED][die];

      // Keep only the better way
      if (viaFair >= viaLoaded) {
        best[t][die] = viaFair;
        from[t][die] = FAIR;
      } else {
        best[t][die] = viaLoaded;
        from[t][die] = LOADED;
      }

      // Multiply by the chance this die rolls the number we saw
      best[t][die] = best[t][die] * chanceOf(die, rolls[t]);
    }
  }

  // Trace back: start at the stronger die on the last roll, follow `from`
  const story = [];
  story[n - 1] = best[n - 1][FAIR] >= best[n - 1][LOADED] ? FAIR : LOADED;
  for (let t = n - 1; t > 0; t--) {
    story[t - 1] = from[t][story[t]];
  }

  return { story, best, from };
}


// =============================================================
//  PART C — Forward–Backward: "How sure are we about each roll?"
// =============================================================
//  forward[t][die]  = chance of all rolls up to t, AND being on this die
//  backward[t][die] = chance of all rolls after t, IF we are on this die
//  forward × backward tells us how likely each die is at roll t.
//  Gives back a list: chance (0 to 1) that each roll used the LOADED die.
// =============================================================
function chanceLoaded(rolls) {
  const n = rolls.length;
  const forward = [];
  const backward = [];

  // Forward pass: go left to right
  for (let t = 0; t < n; t++) {
    forward[t] = [];
    for (const die of [FAIR, LOADED]) {
      let before;
      if (t === 0) {
        before = START[die];
      } else {
        before = forward[t - 1][FAIR] * SWITCH[FAIR][die] +
                 forward[t - 1][LOADED] * SWITCH[LOADED][die];
      }
      forward[t][die] = before * chanceOf(die, rolls[t]);
    }
  }

  // Backward pass: go right to left
  backward[n - 1] = [1, 1];
  for (let t = n - 2; t >= 0; t--) {
    backward[t] = [];
    for (const die of [FAIR, LOADED]) {
      backward[t][die] =
        SWITCH[die][FAIR] * chanceOf(FAIR, rolls[t + 1]) * backward[t + 1][FAIR] +
        SWITCH[die][LOADED] * chanceOf(LOADED, rolls[t + 1]) * backward[t + 1][LOADED];
    }
  }

  // Combine both directions
  const result = [];
  for (let t = 0; t < n; t++) {
    const fair = forward[t][FAIR] * backward[t][FAIR];
    const loaded = forward[t][LOADED] * backward[t][LOADED];
    result.push(loaded / (fair + loaded));
  }
  return result;
}

// Note: these functions multiply many small numbers together.
// That is fine for up to about 100 rolls (this page uses fewer).
// For thousands of rolls, real programs add logarithms instead.
