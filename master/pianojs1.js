const laneKeys = ["a", "s", "d", "f", "g"];

function isKeyDown(laneIndex) {
  return keyState[laneKeys[laneIndex]];
}

const lanes = document.querySelectorAll(".lane");

// map keys to lane indices for quick lookup
const keyToIndex = { a: 0, s: 1, d: 2, f: 3, g: 4 };

const hirono = document.getElementById('hirono');
const speechBubble = document.getElementById('speechBubble');
const speechText = document.getElementById('speechText');

function showFeedback(type) {
  if (!speechBubble) return;
  speechText.innerText = type === 'perfect' ? 'Perfect!' : 'Miss!';
  speechBubble.classList.remove('perfect','miss');
  speechBubble.classList.add(type);
  speechBubble.classList.add('visible');
  setTimeout(() => {
    speechBubble.classList.remove('visible');
  }, 900);
}

// pressed visuals are applied only when a hit is confirmed

const scoreValue = document.getElementById("scoreValue");
const missValue = document.getElementById("missValue");
const gameOverScreen = document.getElementById("gameOverScreen");

let score = 0;
let misses = 0;
const maxMisses = 5;

let gameRunning = false;

const startGameButton = document.getElementById("startGame");
const statusMessage = document.getElementById("message");

// =====================
// KEY STATE (IMPORTANT)
// =====================
const keyState = {
  a: false,
  s: false,
  d: false,
  f: false,
  g: false
};

// =====================
// AUDIO
// =====================
const synth = new Tone.Synth().toDestination();
let audioStarted = false;

// =====================
// NOTES
// =====================
const notes = ["C4", "D4", "E4", "F4", "G4"];

// =====================
// PLAYABLE BEATMAP (SPACED)
// =====================
const melody = [
  { note: 0, lane: 0, length: "short", gap: 900 },
  { note: 1, lane: 1, length: "short", gap: 900 },
  { note: 2, lane: 2, length: "long",  gap: 1600 },
  { note: 3, lane: 3, length: "short", gap: 900 },
  { note: 4, lane: 4, length: "long",  gap: 1600 },
  { note: 2, lane: 2, length: "short", gap: 900 },
  { note: 1, lane: 1, length: "short", gap: 900 },
  { note: 0, lane: 0, length: "long",  gap: 1600 }
];

let songIndex = 0;

// =====================
// START GAME (audio safe)
// =====================
async function startGame() {
  if (audioStarted) return;

  try {
    await Tone.start();
    audioStarted = true;
    gameRunning = true;
    if (startGameButton) startGameButton.disabled = true;
    if (statusMessage) statusMessage.innerText = "Game started";
    playSong();
  } catch (error) {
    console.error(error);
    if (statusMessage) statusMessage.innerText = "Start failed, click again.";
  }
}

startGameButton?.addEventListener("click", startGame);

// =====================
// KEY INPUT
// =====================
document.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
    if (keyState.hasOwnProperty(k)) {
    const wasDown = keyState[k];
    keyState[k] = true;
    if (!wasDown && keyToIndex.hasOwnProperty(k)) {
      const idx = keyToIndex[k];
      lanes[idx].classList.add("active");
      handlePress(idx);
    }
  }
});

document.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  if (keyState.hasOwnProperty(k)) keyState[k] = false;
  if (keyToIndex.hasOwnProperty(k)) {
    const idx = keyToIndex[k];
    lanes[idx].classList.remove("active");
  }
});

// =====================
// TILE CREATION
// =====================
function createTile(laneIndex, noteLength, holdTime) {

  const tile = document.createElement("div");
  tile.classList.add("tile");

  const height = noteLength === "long" ? 260 : 120;

  if (noteLength === "long") {
    tile.classList.add("longTile");
  }

  tile.style.height = height + "px";

  let position = -height;
  tile.style.top = position + "px";

  lanes[laneIndex].appendChild(tile);

  // =========================
  // FIXED HOLD STATE (STABLE)
  // =========================
  let holdStarted = false;
  let holdStartTime = 0;
  let holdPassed = false;
  let consumed = false;

  const HOLD_REQUIRE = holdTime || 600;

  const fall = setInterval(() => {

    if (!gameRunning) {
      clearInterval(fall);
      return;
    }

    position += 2;
    tile.style.top = position + "px";
    tile.dataset.position = position;

    const inWindow = position >= 430 && position <= 580;
    const keyDown = isKeyDown(laneIndex);

    // =====================
    // SHORT NOTES (UNCHANGED)
    // =====================
    if (
      noteLength !== "long" &&
      tile.dataset.hit !== "true" &&
      keyDown &&
      inWindow
    ) {
      tile.dataset.hit = "true";
      handlePress(laneIndex);
    }

    // =====================
    // LONG NOTES (FIXED LOGIC)
    // =====================
    if (noteLength === "long") {

      // start hold ONLY when first entering window
      if (keyDown && inWindow && !holdStarted) {
        holdStarted = true;
        holdStartTime = Date.now();
        tile.classList.add("held");
      }

      // check hold duration
      if (holdStarted && keyDown) {
        const held = Date.now() - holdStartTime;
        if (held >= HOLD_REQUIRE) {
          holdPassed = true;
        }
      }

      // released too early → fail immediately
      if (holdStarted && !keyDown && !holdPassed && !consumed) {
        consumed = true;
        clearInterval(fall);

        misses++;
        missValue.innerText = misses;
        showFeedback("miss");

        tile.remove();
        return;
      }

      // successful hold ONLY when leaving window
      if (!consumed && holdPassed && position > 580) {
        consumed = true;
        clearInterval(fall);

        tile.classList.add("hit");

        score++;
        scoreValue.innerText = score;
        showFeedback("perfect");

        setTimeout(() => {
          if (tile.parentElement) tile.remove();
        }, 60);

        return;
      }
    }

    // =====================
    // MISS CLEANUP
    // =====================
    if (position > 600 && !consumed) {
      clearInterval(fall);

      if (noteLength === "long") {
        if (!holdPassed) {
          misses++;
          missValue.innerText = misses;
          showFeedback("miss");
        }
      } else {
        if (tile.dataset.hit !== "true") {
          misses++;
          missValue.innerText = misses;
          showFeedback("miss");
        }
      }

      tile.remove();
    }

  }, 10);
}

// =====================
// GAME LOOP
// =====================
function playSong() {

  if (!gameRunning) return;

  const n = melody[songIndex];

  createTile(n.lane, n.length, n.length === "long" ? 600 : 0);

  synth.triggerAttackRelease(
    notes[n.note],
    n.length === "long" ? "2n" : "8n"
  );

  songIndex++;
  if (songIndex >= melody.length) songIndex = 0;

  setTimeout(playSong, n.gap);
}

// =====================
// PRESS LOGIC (SHORT NOTES ONLY)
// =====================
function handlePress(laneIndex) {

  const lane = lanes[laneIndex];
  const tiles = lane.querySelectorAll(".tile");

  let hit = false;

  tiles.forEach(tile => {

    const pos = Number(tile.dataset.position);

    // Only handle SHORT notes (skip long notes - they're handled in createTile)
    if (
      tile.dataset.hit !== "true" &&
      !tile.classList.contains("longTile") &&
      pos >= 430 &&
      pos <= 580
    ) {
      tile.dataset.hit = "true";
      // show brief pressed (white) feedback, then transition to hit (dark) and remove
      tile.classList.add('pressed');
      setTimeout(() => {
        if (!tile.parentElement) return;
        tile.classList.remove('pressed');
        tile.classList.add('hit');
        score++;
        scoreValue.innerText = score;
        showFeedback('perfect');
        setTimeout(() => { if (tile.parentElement) tile.remove(); }, 80);
      }, 70);
      hit = true;
    }

  });

  if (hit) {
    score++;
    scoreValue.innerText = score;
    showFeedback('perfect');
  }
}

// =====================
// GAME OVER
// =====================
function endGame() {
  gameRunning = false;
  gameOverScreen.style.display = "flex";
}