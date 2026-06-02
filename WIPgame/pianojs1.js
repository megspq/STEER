const laneKeys = ["a", "s", "d", "f", "g"];
const keyToIndex = { a: 0, s: 1, d: 2, f: 3, g: 4 };
const lanes = document.querySelectorAll(".lane");

// Helper: check if a key for a specific lane is down
function isKeyDown(laneIndex) {
  return keyState[laneKeys[laneIndex]];
}

const homeScreen = document.getElementById("homeScreen");
const difficultyScreen = document.getElementById("difficultyScreen");
const gameScreen = document.getElementById("gameScreen");
const scoreValue = document.getElementById("scoreValue");
const missValue = document.getElementById("missValue");
const gameOverScreen = document.getElementById("gameOverScreen");
const statusMessage = document.getElementById("message");
const startGameButton = document.getElementById("startGame");
const backHomeButton = document.getElementById("backHome");
const speechBubble = document.getElementById("speechBubble");
const speechText = document.getElementById("speechText");

let score = 0;
let misses = 0;
const maxMisses = 5;

let gameRunning = false;
let selectedDifficulty = null;

let currentBeatmap = [];
let beatIndex = 0;
let startTime = 0;
let currentAudio = null;
let songSynth = null;
let songPart = null;

const keyState = {
  a: false,
  s: false,
  d: false,
  f: false,
  g: false
};

// Generate beatmaps aligned to song beats and scaled by difficulty.
function generateBeatmap({ bpm = 120, lengthSec = 46, lanesCount = 5, difficulty = "easy" } = {}) {
  const beatInterval = 60 / bpm; // seconds per beat
  const beats = Math.ceil(lengthSec / beatInterval);

  // parameters per difficulty (tuned for elderly players: lower density, shorter holds, fewer simultaneous)
  const params = {
    easy:  { holdProb: 0.05, holdBeats: [0.8, 1.2], multiProb: 0.04, maxSimul: 1, adjacencyBias: 0.92, densityBase: 0.45 },
    medium:{ holdProb: 0.08, holdBeats: [0.9, 1.5], multiProb: 0.07, maxSimul: 2, adjacencyBias: 0.78, densityBase: 0.55 },
    hard:  { holdProb: 0.14, holdBeats: [1.1, 1.9], multiProb: 0.12, maxSimul: 2, adjacencyBias: 0.50, densityBase: 0.68 }
  };

  const p = params[difficulty] || params.easy;
  const out = [];

  // helper: choose lane with adjacency bias
  let lastLane = Math.floor(lanesCount / 2);
  function pickLaneAdjacent() {
    if (Math.random() < p.adjacencyBias) {
      // choose from lastLane +/-1 with bounds
      const offsets = [-1, 0, 1];
      const choice = offsets[Math.floor(Math.random() * offsets.length)];
      const candidate = Math.min(Math.max(0, lastLane + choice), lanesCount - 1);
      lastLane = candidate;
      return candidate;
    }
    // pick random non-adjacent
    let candidate;
    let tries = 0;
    do {
      candidate = Math.floor(Math.random() * lanesCount);
      tries++;
    } while (Math.abs(candidate - lastLane) <= 1 && tries < 10);
    lastLane = candidate;
    return candidate;
  }

  const notesLen = (typeof notes !== "undefined") ? notes.length : 8;

  for (let b = 0; b < beats; b++) {
    const t = Number((b * beatInterval).toFixed(3));

    // decide if there's any event on this beat
    if (Math.random() > p.densityBase) continue;

    // decide simultaneous count
    let simul = 1;
    if (Math.random() < p.multiProb) simul = 1 + Math.floor(Math.random() * (p.maxSimul));

    const lanesArr = [];
    const noteIndexes = [];
    for (let s = 0; s < simul; s++) {
      let lane = pickLaneAdjacent();
      // avoid duplicates in same beat
      let tries = 0;
      while (lanesArr.includes(lane) && tries++ < 6) lane = Math.floor(Math.random() * lanesCount);
      lanesArr.push(lane);
      // map lane to a note index across available notes
      const noteIndex = Math.min(Math.floor((lane / (lanesCount - 1 || 1)) * (notesLen - 1)) + Math.floor(Math.random() * 2), notesLen - 1);
      noteIndexes.push(noteIndex);
    }

    // decide holds
    let hold = 0;
    if (Math.random() < p.holdProb) {
      const [minB, maxB] = p.holdBeats;
      const hb = minB + Math.floor(Math.random() * (Math.max(1, maxB - minB + 1)));
      hold = Number((hb * beatInterval).toFixed(3));
    }

    out.push({ t, lanes: lanesArr, notes: noteIndexes, ...(hold > 0 ? { hold } : {}) });
  }

  // ensure sorted by time
  out.sort((a, b) => a.t - b.t);
  return out;
}

// Replace static beatmaps at runtime with generated, beat-aligned maps.
// (Assignments moved below after `songs` is defined.)
const notes = [
  "C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "F5", "G5", "A5", "B5"
];

const hitSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.005, decay: 0.1, sustain: 0.4, release: 0.4 }
}).toDestination();

const songs = {
  easy: { audio: "moonlight.mp3", beatmap: [] },
  medium: { audio: "sweet.mp3", beatmap: [] },
  hard: { audio: "nianyi.mp3", beatmap: [] }
};

// Generate beatmaps on init (elderly-friendly: lower density, shorter holds, fewer simultaneous)
songs.easy.beatmap = generateBeatmap({ bpm: 60, lengthSec: 46, lanesCount: 5, difficulty: "easy" });
songs.medium.beatmap = generateBeatmap({ bpm: 90, lengthSec: 46, lanesCount: 5, difficulty: "medium" });
songs.hard.beatmap = generateBeatmap({ bpm: 140, lengthSec: 46, lanesCount: 5, difficulty: "hard" });

function showFeedback(type) {
  if (!speechBubble || !speechText) return;
  speechText.innerText = type === "perfect" ? "Perfect!" : "Miss!";
  speechBubble.classList.remove("perfect", "miss", "visible");
  speechBubble.classList.add(type, "visible");
  setTimeout(() => {
    speechBubble.classList.remove("visible");
  }, 900);
}

function clearTiles() {
  lanes.forEach(lane => {
    lane.innerHTML = "";
  });
}

function stopSongAudio() {
  if (songPart) {
    songPart.stop();
    songPart.dispose();
    songPart = null;
  }
  if (Tone.Transport.state === "started") {
    Tone.Transport.stop();
    Tone.Transport.cancel();
  }
}

function resetGame() {
  stopSongAudio();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  clearTiles();

  score = 0;
  misses = 0;
  scoreValue.innerText = 0;
  missValue.innerText = 0;

  beatIndex = 0;
  startTime = 0;
  gameRunning = false;
  gameOverScreen.style.display = "none";
  startGameButton.disabled = false;
}

function showDifficultyScreen() {
  homeScreen.style.display = "none";
  difficultyScreen.style.display = "block";
  gameScreen.style.display = "none";
}

function backFromDifficultyScreen() {
  homeScreen.style.display = "flex";
  difficultyScreen.style.display = "none";
  gameScreen.style.display = "none";
}

function selectDifficulty(level) {
  selectedDifficulty = level;
  currentBeatmap = songs[level].beatmap || [];
  resetGame();
  homeScreen.style.display = "none";
  difficultyScreen.style.display = "none";
  gameScreen.style.display = "block";
  statusMessage.innerText = "Selected: " + level + ". Press Start to play.";
}

function backToHome() {
  resetGame();
  selectedDifficulty = null;
  currentBeatmap = [];
  homeScreen.style.display = "flex";
  difficultyScreen.style.display = "none";
  gameScreen.style.display = "none";
}

async function startGame() {
  if (gameRunning) return;

  if (!selectedDifficulty) {
    statusMessage.innerText = "Please select a difficulty first.";
    return;
  }

  if (!currentBeatmap || currentBeatmap.length === 0) {
    statusMessage.innerText = "No beatmap found for " + selectedDifficulty + ". Please choose another difficulty.";
    return;
  }

  resetGame();
  await Tone.start();

  gameRunning = true;
  startTime = Tone.now();
  startGameButton.disabled = true;

  const song = songs[selectedDifficulty];

  if (song.audio) {
    try {
      const audio = new Audio(song.audio);
      currentAudio = audio;
      audio.addEventListener("ended", () => {
        currentAudio = null;
        endGame();
      });
      audio.addEventListener("error", () => {
        console.warn("Audio file error", song.audio);
        statusMessage.innerText = "Audio file not found. Generated audio will play.";
        scheduleSongAudio();
      });
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          console.warn("Audio playback failed", song.audio);
          statusMessage.innerText = "Audio playback failed. Generated audio will play.";
          scheduleSongAudio();
        });
      }
    } catch (error) {
      console.warn("Audio init failed", error);
      statusMessage.innerText = "Audio initialization failed. Generated audio will play.";
      scheduleSongAudio();
    }
  } else {
    scheduleSongAudio();
  }

  requestAnimationFrame(gameLoop);
}

function gameLoop() {
  if (!gameRunning) return;

  const currentTime = Tone.now() - startTime;

  while (beatIndex < currentBeatmap.length && currentBeatmap[beatIndex].t <= currentTime) {
    spawnBeat(currentBeatmap[beatIndex]);
    beatIndex++;
  }

  requestAnimationFrame(gameLoop);
}

function spawnBeat(beat) {
  const isHold = beat.hold && beat.hold > 0;
  beat.lanes.forEach(lane => {
    createTile(lane, isHold ? "long" : "short", isHold ? beat.hold * 1000 : 0, beat.notes);
  });
}

function createTile(laneIndex, type, holdTime, beatNotes = []) {
  const tile = document.createElement("div");
  tile.classList.add("tile");

  // Fixed heights for consistent feel
  const height = type === "long" ? 260 : 120;

  if (type === "long") {
    tile.classList.add("longTile");
  }

  tile.style.height = height + "px";

  let position = -height;
  tile.style.top = position + "px";

  if (beatNotes && beatNotes.length) {
    tile.dataset.notes = beatNotes.join(",");
  }
  if (holdTime) {
    tile.dataset.holdms = holdTime;
  }

  lanes[laneIndex].appendChild(tile);

  // Track hold note state
  let holdStart = null;
  let holdSuccess = false;
  let isBeingHeld = false;

  const fall = setInterval(() => {
    if (!gameRunning) {
      clearInterval(fall);
      return;
    }

    position += 2;
    tile.style.top = position + "px";
    tile.dataset.position = position;

    const inWindow = position >= 430 && position <= 580;

    // SHORT NOTE: auto-hit when key pressed in window
    if (type !== "long" && tile.dataset.hit !== "true" && isKeyDown(laneIndex) && inWindow) {
      handlePress(laneIndex);
    }

    // LONG NOTE: hold logic from working version
    if (type === "long") {
      const keyDown = isKeyDown(laneIndex);

      // Started holding in hit window
      if (keyDown && inWindow && !holdStart) {
        holdStart = Date.now();
        isBeingHeld = true;
        tile.dataset.isHeld = "true";
        tile.classList.add("held");
      }

      // Track hold duration
      if (holdStart) {
        const heldDuration = Date.now() - holdStart;
        if (heldDuration >= holdTime) {
          holdSuccess = true;
        }
      }

      // Key released
      if (!keyDown) {
        if (holdStart && !holdSuccess) {
          // Released too early
          holdStart = null;
          isBeingHeld = false;
          tile.dataset.isHeld = "false";
          tile.classList.remove("held");
        } else if (holdStart && holdSuccess) {
          // Completed hold, ready to confirm
          holdStart = null;
        }
      }

      // Hold completed and passed hit window: confirm success
      if (holdSuccess && position > 580) {
        clearInterval(fall);
        if (!tile.classList.contains("hit")) {
          tile.classList.add("pressed");
          setTimeout(() => {
            if (!tile.parentElement) return;
            tile.classList.remove("pressed");
            tile.classList.add("hit");
            score++;
            scoreValue.innerText = score;
            showFeedback("perfect");
            setTimeout(() => {
              if (tile.parentElement) tile.remove();
            }, 80);
          }, 70);
        }
        return;
      }
    }

    // Remove tile if it passed the hit window without success
    if (position > 600) {
      clearInterval(fall);

      if (type === "long") {
        if (!holdSuccess && tile.parentElement) {
          miss();
          showFeedback("miss");
        }
      } else if (tile.dataset.hit !== "true") {
        miss();
        showFeedback("miss");
      }

      tile.remove();
    }
  }, 10);
}

function handlePress(laneIndex) {
  const lane = lanes[laneIndex];
  const tiles = Array.from(lane.querySelectorAll(".tile")).sort((a, b) => Number(a.dataset.position) - Number(b.dataset.position));

  for (const tile of tiles) {
    const pos = Number(tile.dataset.position);
    if (tile.dataset.hit !== "true" && !tile.classList.contains("longTile") && pos >= 430 && pos <= 580) {
      tile.classList.add("pressed");
      hitTile(tile);
      return;
    }
  }
}

function hitTile(tile) {
  if (tile.dataset.hit === "true") return;

  tile.dataset.hit = "true";

  const dur = tile.dataset.holdms ? "2n" : "8n";
  const noteIndexes = tile.dataset.notes ? tile.dataset.notes.split(",").map(x => Number(x)) : [0];
  noteIndexes.forEach(i => {
    const note = notes[i] || notes[0];
    hitSynth.triggerAttackRelease(note, dur);
  });

  tile.classList.remove("pressed");
  tile.classList.add("hit");
  score++;
  scoreValue.innerText = score;
  showFeedback("perfect");

  setTimeout(() => tile.remove(), 80);
}

function miss() {
  misses++;
  missValue.innerText = misses;
  if (misses >= maxMisses) {
    endGame();
  }
}

const songVoices = {
  easy: {
    synthClass: Tone.Synth,
    settings: {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.18, sustain: 0.45, release: 0.55 }
    }
  },
  medium: {
    synthClass: Tone.Synth,
    settings: {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.01, decay: 0.14, sustain: 0.45, release: 0.5 }
    }
  },
  hard: {
    synthClass: Tone.FMSynth,
    settings: {
      harmonicity: 3,
      modulationIndex: 12,
      oscillator: { type: "square" },
      envelope: { attack: 0.005, decay: 0.12, sustain: 0.4, release: 0.4 }
    }
  }
};

function scheduleSongAudio() {
  if (!currentBeatmap || currentBeatmap.length === 0) return;

  stopSongAudio();

  if (songSynth) {
    songSynth.dispose();
    songSynth = null;
  }

  const voice = songVoices[selectedDifficulty] || songVoices.easy;
  songSynth = new Tone.PolySynth(voice.synthClass, voice.settings).toDestination();
  songSynth.volume.value = -6;

  const events = [];
  currentBeatmap.forEach(beat => {
    beat.notes.forEach(noteIndex => {
      events.push({
        time: beat.t,
        note: notes[noteIndex] || notes[0],
        duration: beat.hold ? "2n" : "8n"
      });
    });
  });

  songPart = new Tone.Part((time, event) => {
    songSynth.triggerAttackRelease(event.note, event.duration, time);
  }, events);

  songPart.start(0);
  Tone.Transport.position = "0:0:0";
  Tone.Transport.start("+0.05");
  statusMessage.innerText = "Playing generated " + selectedDifficulty + " melody.";
}

function endGame() {
  gameRunning = false;
  stopSongAudio();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  startGameButton.disabled = false;
  gameOverScreen.style.display = "flex";
}

startGameButton.addEventListener("click", startGame);
backHomeButton?.addEventListener("click", backToHome);

// Expose core functions globally
window.selectDifficulty = selectDifficulty;
window.showDifficultyScreen = showDifficultyScreen;
window.backFromDifficultyScreen = backFromDifficultyScreen;
window.backToHome = backToHome;
window.startGame = startGame;

// Attach event listeners once DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnStart")?.addEventListener("click", showDifficultyScreen);
  document.getElementById("btnBackDiff")?.addEventListener("click", backFromDifficultyScreen);
  document.getElementById("startGame")?.addEventListener("click", startGame);
  document.getElementById("backHome")?.addEventListener("click", backToHome);
});

document.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (!keyState.hasOwnProperty(k)) return;
  const wasDown = keyState[k];
  keyState[k] = true;
  if (!wasDown && keyToIndex.hasOwnProperty(k)) {
    handlePress(keyToIndex[k]);
  }
});

document.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  if (keyState.hasOwnProperty(k)) keyState[k] = false;
});
