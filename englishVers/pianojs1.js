// ── LANE / KEY SETUP (unchanged) ───────────────────────────────────────────
const laneKeys   = ["a", "s", "d", "f", "g"];
const keyToIndex = { a:0, s:1, d:2, f:3, g:4 };
const lanes      = document.querySelectorAll(".lane");
const laneCooldown = [0,0,0,0,0];
const keyState   = { a:false, s:false, d:false, f:false, g:false };

function isKeyDown(i) { return keyState[laneKeys[i]]; }

// ── DOM REFS (unchanged) ───────────────────────────────────────────────────
const homeScreen      = document.getElementById("homeScreen");
const levelScreen     = document.getElementById("levelScreen");
const gameScreen      = document.getElementById("gameScreen");
const scoreValue      = document.getElementById("scoreValue");
const missValue       = document.getElementById("missValue");
const gameOverScreen  = document.getElementById("gameOverScreen");
const statusMessage   = document.getElementById("message");
const startGameButton = document.getElementById("startGame");
const backHomeButton  = document.getElementById("backHome");
const passScreen      = document.getElementById("passScreen");
const prizeScreen     = document.getElementById("prizeScreen");
const rewardScreen    = document.getElementById("rewardScreen");
const pauseScreen     = document.getElementById("pauseScreen");
const rewardText      = document.getElementById("rewardText");
const rewardImg       = document.getElementById("rewardImg");
const currentSongName = document.getElementById("currentSongName");
const currentLevelName= document.getElementById("currentLevelName");
const speechBubble    = document.getElementById("speechBubble");
const speechText      = document.getElementById("speechText");
const songProgressFill= document.getElementById("songProgressFill");
const albumCover      = document.getElementById("albumCover");
let buttonSynth = null;

// ── GAME STATE ─────────────────────────────────────────────────────────────
let score = 0, misses = 0;
const maxMisses = 10;
let gameRunning = false;
let selectedDifficulty = null;
let currentBeatmap = [];
let beatIndex = 0;
let currentAudio = null;
let songSynth = null, songPart = null;

// ── CLOCK ──────────────────────────────────────────────────────────────────
// Single source of truth: audio.currentTime when audio is running,
// performance.now() fallback for synth-only mode.
let perfStartMs = 0;
function now() {
  if (currentAudio && !currentAudio.paused && currentAudio.currentTime > 0) {
    return currentAudio.currentTime;
  }
  return (performance.now() - perfStartMs) / 1000;
}

// ── TIMING CONSTANTS ───────────────────────────────────────────────────────
const TRAVEL_TIME = 2.5;   // seconds tile travels from spawn to hit-line
const HIT_LINE_PX = 520;   // must match CSS ::after top value
const SPEED_PX    = HIT_LINE_PX / TRAVEL_TIME;
const HIT_WINDOW  = 0.22;  // ±220 ms — generous so nothing feels laggy

// ── BEATMAPS ───────────────────────────────────────────────────────────────
const EASY_BEATMAP_RAW = [
  { hit: 3.85, lanes:[1], notes:[13] },
  { hit: 4.55, lanes:[2], notes:[13] },
  { hit: 5.12, lanes:[2], notes:[17] },
  { hit: 5.88, lanes:[3], notes:[20] },
  { hit: 8.28, lanes:[2], notes:[24] },
  { hit: 9.05, lanes:[2], notes:[24] },
  { hit:10.62, lanes:[3], notes:[21] },
  { hit:11.72, lanes:[2], notes:[17] },
  { hit:12.48, lanes:[1], notes:[15] },
  { hit:13.32, lanes:[1], notes:[13] },
  { hit:15.52, lanes:[1], notes:[15] },
  { hit:17.02, lanes:[2], notes:[17] },
  { hit:17.78, lanes:[3], notes:[20] },
  { hit:18.67, lanes:[2], notes:[17] },
  { hit:20.82, lanes:[3], notes:[19] },
  { hit:21.62, lanes:[2], notes:[17] },
  { hit:22.34, lanes:[1], notes:[15] },
  { hit:24.98, lanes:[1], notes:[12] },
  { hit:26.00, lanes:[2], notes:[13] },
  { hit:26.66, lanes:[3], notes:[17] },
  { hit:28.08, lanes:[2], notes:[13] },
  { hit:29.28, lanes:[1], notes:[12] },
  { hit:31.41, lanes:[2], notes:[20] },
  { hit:32.30, lanes:[2], notes:[20] },
  { hit:32.89, lanes:[3], notes:[24] },
  { hit:33.67, lanes:[2], notes:[17] },
  { hit:34.29, lanes:[3], notes:[22] },
  { hit:35.51, lanes:[2], notes:[17] },
  { hit:36.63, lanes:[1], notes:[15] },
  { hit:37.70, lanes:[1], notes:[13] },
  { hit:39.45, lanes:[2], notes:[20] },
  { hit:41.09, lanes:[2], notes:[13] },
  { hit:41.92, lanes:[3], notes:[17] },
  { hit:42.81, lanes:[2], notes:[15] },
  { hit:43.54, lanes:[3], notes:[17] },
  { hit:44.70, lanes:[1], notes:[12] },
  { hit:45.73, lanes:[2], notes:[13] },
  { hit:47.32, lanes:[2], notes:[13] }
];

const MEDIUM_BEATMAP_RAW = [
  // ── intro: single taps, lanes 1-3 ──
  { hit: 1.50, lanes:[2], notes:[18] },
  { hit: 2.20, lanes:[1], notes:[16] },
  { hit: 2.90, lanes:[3], notes:[21] },
  { hit: 3.60, lanes:[2], notes:[18] },
  { hit: 4.30, lanes:[1], notes:[16] },

  // ── first hold, single, then gap ──
  { hit: 5.30, lanes:[2], notes:[21], hold:1.0 },
  // ends 6.30 → gap to 6.80
  { hit: 6.80, lanes:[3], notes:[23] },
  { hit: 7.50, lanes:[2], notes:[21] },
  { hit: 8.20, lanes:[1], notes:[18] },

  // ── dip into lane 0 ──
  { hit: 9.00, lanes:[0], notes:[14] },
  { hit: 9.70, lanes:[2], notes:[18] },
  { hit:10.40, lanes:[3], notes:[21] },

  // ── double hold, same length ──
  { hit:11.40, lanes:[1,3], notes:[16,21], hold:1.1 },
  // ends 12.50 → gap to 13.10
  { hit:13.10, lanes:[2], notes:[18] },
  { hit:13.80, lanes:[3], notes:[23] },
  { hit:14.50, lanes:[2], notes:[21] },
  { hit:15.20, lanes:[1], notes:[18] },

  // ── single hold, longer ──
  { hit:16.10, lanes:[2], notes:[23], hold:1.3 },
  // ends 17.40 → gap to 17.90
  { hit:17.90, lanes:[3], notes:[21] },
  { hit:18.60, lanes:[2], notes:[18] },
  { hit:19.30, lanes:[1], notes:[16] },

  // ── dip into lane 4 ──
  { hit:20.10, lanes:[4], notes:[25] },
  { hit:20.80, lanes:[2], notes:[21] },
  { hit:21.50, lanes:[3], notes:[23] },

  // ── double hold again ──
  { hit:22.40, lanes:[2,3], notes:[21,23], hold:1.0 },
  // ends 23.40 → gap to 23.90
  { hit:23.90, lanes:[1], notes:[16] },
  { hit:24.60, lanes:[2], notes:[18] },
  { hit:25.30, lanes:[3], notes:[21] },
  { hit:26.00, lanes:[2], notes:[18] },

  // ── single hold ──
  { hit:26.90, lanes:[1], notes:[16], hold:1.2 },
  // ends 28.10 → gap to 28.60
  { hit:28.60, lanes:[2], notes:[21] },
  { hit:29.30, lanes:[3], notes:[23] },
  { hit:30.00, lanes:[0], notes:[14] },
  { hit:30.70, lanes:[2], notes:[18] },

  // ── double hold, same length, lanes 1+3 ──
  { hit:31.60, lanes:[1,3], notes:[18,23], hold:1.1 },
  // ends 32.70 → gap to 33.20
  { hit:33.20, lanes:[2], notes:[21] },
  { hit:33.90, lanes:[3], notes:[23] },
  { hit:34.60, lanes:[2], notes:[21] },
  { hit:35.30, lanes:[1], notes:[18] },

  // ── final hold then outro taps ──
  { hit:36.20, lanes:[2], notes:[23], hold:1.3 },
  // ends 37.50 → gap to 38.00
  { hit:38.00, lanes:[1], notes:[18] },
  { hit:38.70, lanes:[3], notes:[21] },
  { hit:39.40, lanes:[2], notes:[18] }
];

const HARD_BEATMAP_RAW = [
  // Elderly-friendly hard:
  // predictable non-adjacent pattern, fewer taps, more holds
  // lanes pattern mostly: 0 → 3 → 1 → 4 → 2

  { hit: 1.72, lanes:[0], notes:[12] },
  { hit: 2.90, lanes:[3], notes:[19] },
  { hit: 3.97, lanes:[1], notes:[14] },
  { hit: 5.04, lanes:[4], notes:[21] },

  { hit: 6.59, lanes:[1], notes:[14], hold:1.00 },
  { hit: 6.59, lanes:[3], notes:[19], hold:1.35 },

  { hit: 8.71, lanes:[2], notes:[16] },
  { hit: 9.78, lanes:[0], notes:[12] },
  { hit:10.80, lanes:[4], notes:[21] },

  { hit:12.91, lanes:[0], notes:[12], hold:1.10 },
  { hit:12.91, lanes:[4], notes:[21] },

  { hit:15.05, lanes:[3], notes:[19] },
  { hit:16.08, lanes:[1], notes:[14] },
  { hit:17.14, lanes:[4], notes:[21] },
  { hit:18.20, lanes:[2], notes:[16] },

  { hit:19.25, lanes:[0], notes:[12], hold:1.20 },
  { hit:19.25, lanes:[3], notes:[19], hold:1.55 },

  { hit:21.34, lanes:[4], notes:[21] },
  { hit:22.40, lanes:[1], notes:[14] },
  { hit:23.45, lanes:[3], notes:[19] },
  { hit:24.50, lanes:[0], notes:[12] },

  { hit:25.57, lanes:[2], notes:[16], hold:1.20 },
  { hit:25.57, lanes:[4], notes:[21] },

  { hit:27.65, lanes:[0], notes:[12] },
  { hit:28.71, lanes:[3], notes:[19] },
  { hit:29.77, lanes:[1], notes:[14] },
  { hit:30.82, lanes:[4], notes:[21] },

  { hit:31.86, lanes:[0,4], notes:[12,21] },
  { hit:33.99, lanes:[1,3], notes:[14,19] },

  { hit:36.08, lanes:[0], notes:[12], hold:1.30 },
  { hit:36.08, lanes:[3], notes:[19], hold:1.70 },

  { hit:38.20, lanes:[4], notes:[21] },
  { hit:39.25, lanes:[1], notes:[14] },
  { hit:40.29, lanes:[3], notes:[19] },
  { hit:41.35, lanes:[0], notes:[12] },

  { hit:42.40, lanes:[2], notes:[16] },
  { hit:43.45, lanes:[4], notes:[21] },
  { hit:44.51, lanes:[0], notes:[12] },

  { hit:46.63, lanes:[1], notes:[14], hold:1.10 },
  { hit:46.63, lanes:[4], notes:[21], hold:1.50 },

  { hit:48.72, lanes:[2], notes:[16] },
  { hit:49.77, lanes:[0], notes:[12] },
  { hit:50.83, lanes:[3], notes:[19] },

  { hit:52.94, lanes:[0], notes:[12], hold:1.20 },
  { hit:52.94, lanes:[4], notes:[21] },

  { hit:55.03, lanes:[1,3], notes:[14,19] },
  { hit:57.14, lanes:[0,4], notes:[12,21] },

  { hit:59.23, lanes:[1], notes:[14], hold:1.30 },
  { hit:59.23, lanes:[4], notes:[21], hold:1.70 },

  { hit:61.35, lanes:[2], notes:[16] },
  { hit:63.46, lanes:[0], notes:[12] },
  { hit:65.55, lanes:[3], notes:[19] },
  { hit:67.66, lanes:[1], notes:[14] },
  { hit:69.78, lanes:[4], notes:[21] }
];

function convertBeatmap(raw) {
  return raw.map(n => ({
    hitTime:   n.hit,
    spawnTime: Math.max(0, n.hit - TRAVEL_TIME),
    lanes:     n.lanes,
    notes:     n.notes,
    hold:      n.hold || 0
  }));
}

const EASY_BEATMAP   = convertBeatmap(EASY_BEATMAP_RAW);
const MEDIUM_BEATMAP = convertBeatmap(MEDIUM_BEATMAP_RAW);
const HARD_BEATMAP   = convertBeatmap(HARD_BEATMAP_RAW);

// ── NOTES / HIT SYNTH ─────────────────────────────────────────────────────
const noteNames = [
  "C3","C#3","D3","D#3","E3","F3","F#3","G3","G#3","A3","A#3","B3",
  "C4","C#4","D4","D#4","E4","F4","F#4","G4","G#4","A4","A#4","B4",
  "C5","C#5","D5","D#5","E5","F5","F#5","G5","G#5","A5","A#5","B5"
];

const hitSynth = new Tone.AMSynth(Tone.Synth, {
  oscillator: { type: "sine" },
  envelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.4 }
}).toDestination();
hitSynth.volume.value = -5;

function playHitSound(noteIndexes, isLong) {
  const dur = isLong ? "4n" : "16n";
  noteIndexes.forEach(i => {
    hitSynth.triggerAttackRelease(noteNames[i] || noteNames[0], dur);
  });
}

// ── SONG DATA ──────────────────────────────────────────────────────────────
const songs = {
  easy:   { audio: "moonlight.mp3", beatmap: EASY_BEATMAP },
  medium: { audio: "sweet.mp3",     beatmap: MEDIUM_BEATMAP },
  hard:   { audio: "nianyi.mp3",    beatmap: HARD_BEATMAP }
};

const levelInfo = {
  easy:   { song:"月亮代表我的心", level:"Level 1 · Easy",   icon:"月", coverClass:"easy" },
  medium: { song:"甜蜜蜜",         level:"Level 2 · Medium", icon:"甜", coverClass:"medium" },
  hard:   { song:"许多年以后",     level:"Level 3 · Hard",   icon:"许", coverClass:"hard" }
};

// ── UI HELPERS ─────────────────────────────────────────────────────────────
function updateNowPlaying() {
  const info = levelInfo[selectedDifficulty];
  if (currentSongName)  currentSongName.innerText  = info ? info.song  : "Choose a level";
  if (currentLevelName) currentLevelName.innerText = info ? info.level : "-";
  if (albumCover) {
    albumCover.classList.remove("easy","medium","hard");
    albumCover.innerText = info ? info.icon : "♪";
    if (info) albumCover.classList.add(info.coverClass);
  }
}

function showFeedback(type) {
  if (!speechBubble || !speechText) return;
  speechText.innerText = type === "perfect" ? "Perfect!" : "Miss!";
  speechBubble.classList.remove("perfect","miss","visible");
  speechBubble.classList.add(type, "visible");
  setTimeout(() => speechBubble.classList.remove("visible"), 900);
}

function setGameVisualState(on) {
  document.body.classList.toggle("game-playing", Boolean(on));
}

function updateProgressBar() {
  if (!songProgressFill || !currentAudio) return;
  const d = currentAudio.duration;
  if (!d || !isFinite(d)) return;
  songProgressFill.style.width = Math.min(100, currentAudio.currentTime / d * 100).toFixed(1) + "%";
}

async function playButtonSound() {
  try {
    await Tone.start();
    if (!buttonSynth) {
      buttonSynth = new Tone.Synth({
        oscillator:{type:"sine"},
        envelope:{attack:0.005,decay:0.08,sustain:0.05,release:0.12}
      }).toDestination();
      buttonSynth.volume.value = -10;
    }
    buttonSynth.triggerAttackRelease("C6","32n");
    setTimeout(()=>{ try{buttonSynth.triggerAttackRelease("G6","32n");}catch(_){} },70);
  } catch(_){}
}

// ── TILE POOL ──────────────────────────────────────────────────────────────
// Each entry: { tile, laneIdx, hitTime, holdSec, isLong, noteIndexes,
//               hit, holdStarted, holdStartedAt, releaseGraceAt }
const pool = [];

function clearTiles() {
  lanes.forEach(l => { l.innerHTML = ""; });
  pool.length = 0;
}

function spawnTile(laneIdx, hitTime, holdSec, noteIndexes) {
  const isLong = holdSec > 0;
  const height = isLong ? Math.max(120, 120 + holdSec * SPEED_PX * 0.5) : 80;

  const tile = document.createElement("div");
  tile.className = "tile" + (isLong ? " longTile" : "");
  tile.style.cssText = `height:${height}px; position:absolute; width:85%; left:7.5%;
    transform:translateY(${-height}px); will-change:transform; border-radius:18px;`;

  lanes[laneIdx].appendChild(tile);
  pool.push({ tile, laneIdx, hitTime, holdSec, isLong, noteIndexes,
    hit:false, holdStarted:false, holdStartedAt:0, releaseGraceAt:null });
}

function spawnBeat(beat) {
  beat.lanes.forEach((laneIdx, i) => {
    spawnTile(laneIdx, beat.hitTime, beat.hold, [beat.notes[i] ?? beat.notes[0] ?? 12]);
  });
}

// ── MAIN LOOP ──────────────────────────────────────────────────────────────
function gameLoop() {
  if (!gameRunning) return;

  const t = now();
  updateProgressBar();

  // Spawn
  while (beatIndex < currentBeatmap.length && currentBeatmap[beatIndex].spawnTime <= t) {
    spawnBeat(currentBeatmap[beatIndex++]);
  }

  // Move + miss-check all tiles
  for (let i = pool.length - 1; i >= 0; i--) {
    const e = pool[i];
    if (!e.tile.parentElement) { pool.splice(i,1); continue; }

    // Position: bottom of tile lands on HIT_LINE_PX exactly at hitTime
    const bottomY = HIT_LINE_PX - (e.hitTime - t) * SPEED_PX;
    const topY    = bottomY - parseInt(e.tile.style.height);
    e.tile.style.transform = `translateY(${topY}px)`;

    const diff = t - e.hitTime;   // positive = past hit time

    if (e.isLong) {
      // Start hold: key must be down within window
      if (!e.holdStarted && !e.hit) {
        if (isKeyDown(e.laneIdx) && diff >= -HIT_WINDOW && diff <= HIT_WINDOW) {
          e.holdStarted   = true;
          e.holdStartedAt = t;
          e.tile.classList.add("held");
        }
        if (diff > HIT_WINDOW) { registerMiss(e, i); continue; }
      }
      // Hold in progress
      if (e.holdStarted && !e.hit) {
        if (!isKeyDown(e.laneIdx)) {
          if (e.releaseGraceAt === null) e.releaseGraceAt = t;
          if (t - e.releaseGraceAt > 0.12) { registerMiss(e, i); continue; }
        } else {
          e.releaseGraceAt = null;
        }
        // Complete hold
        if (t >= e.hitTime + e.holdSec * 0.85) {
          registerHit(e, i); continue;
        }
      }
    } else {
      // Short tile: just check if it passed
      if (!e.hit && diff > HIT_WINDOW) { registerMiss(e, i); continue; }
    }
  }

  // End of song
  if (beatIndex >= currentBeatmap.length && pool.length === 0 && !currentAudio) {
    setTimeout(() => { if (gameRunning) levelPassed(); }, 1500);
    return;
  }

  requestAnimationFrame(gameLoop);
}

function registerHit(entry, idx) {
  if (entry.hit) return;
  entry.hit = true;
  score++;
  scoreValue.innerText = score;
  showFeedback("perfect");
  playHitSound(entry.noteIndexes, entry.isLong);
  entry.tile.remove();
  pool.splice(idx, 1);
}

function registerMiss(entry, idx) {
  if (entry.hit) return;
  entry.hit = true;
  entry.tile.remove();
  pool.splice(idx, 1);
  misses++;
  missValue.innerText = misses;
  showFeedback("miss");
  if (misses >= maxMisses) endGame();
}

// ── KEY PRESS → HIT DETECTION ──────────────────────────────────────────────
function handlePress(laneIdx) {
  const ms = Date.now();
  if (ms - laneCooldown[laneIdx] < 30) return;
  laneCooldown[laneIdx] = ms;

  if (!gameRunning) return;

  const t = now();
  let best = null, bestDiff = Infinity;

  for (let i = 0; i < pool.length; i++) {
    const e = pool[i];
    if (e.laneIdx !== laneIdx || e.hit || e.isLong) continue;
    const diff = Math.abs(t - e.hitTime);
    if (diff <= HIT_WINDOW && diff < bestDiff) { bestDiff = diff; best = i; }
  }

  if (best !== null) registerHit(pool[best], best);
}

// ── START / STOP ───────────────────────────────────────────────────────────
function stopSongAudio() {
  if (songPart)  { songPart.stop(); songPart.dispose(); songPart = null; }
  if (Tone.Transport.state === "started") { Tone.Transport.stop(); Tone.Transport.cancel(); }
  if (songSynth) { songSynth.dispose(); songSynth = null; }
}

function resetGame() {
  stopSongAudio();
  if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; currentAudio = null; }
  clearTiles();
  score = misses = 0;
  scoreValue.innerText = 0;
  missValue.innerText  = 0;
  beatIndex   = 0;
  perfStartMs = 0;
  gameRunning = false;
  setGameVisualState(false);
  if (songProgressFill) songProgressFill.style.width = "0%";
  gameOverScreen.style.display = "none";
  if (pauseScreen) pauseScreen.style.display = "none";
  startGameButton.disabled = false;
}

async function startGame() {
  if (gameRunning) return;
  if (!selectedDifficulty) { statusMessage.innerText = "Pick a level first."; return; }

  resetGame();
  await Tone.start();

  gameRunning = true;
  setGameVisualState(true);
  startGameButton.disabled = true;

  const song  = songs[selectedDifficulty];
  const audio = new Audio(song.audio);
  currentAudio = audio;

  audio.addEventListener("ended", () => { currentAudio = null; levelPassed(); });
  audio.addEventListener("error", () => {
    currentAudio = null;
    perfStartMs = performance.now();
    // synth fallback — schedule notes from beatmap
    scheduleSynthFallback();
  });

  // Play. The moment audio.currentTime starts ticking, now() is correct.
  audio.play().catch(() => {
    currentAudio = null;
    perfStartMs  = performance.now();
    scheduleSynthFallback();
  });

  // Perf clock as fallback if audio API is instant
  perfStartMs = performance.now();

  requestAnimationFrame(gameLoop);
}

function scheduleSynthFallback() {
  songSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator:{type:"triangle"},
    envelope:{attack:0.02,decay:0.18,sustain:0.45,release:0.55}
  }).toDestination();
  songSynth.volume.value = -6;

  const events = [];
  currentBeatmap.forEach(beat => {
    beat.notes.forEach(ni => {
      events.push({ time: beat.hitTime, note: noteNames[ni] || noteNames[0], dur: beat.hold ? "2n":"8n" });
    });
  });

  songPart = new Tone.Part((time, ev) => {
    songSynth.triggerAttackRelease(ev.note, ev.dur, time);
  }, events);
  songPart.start(0);
  Tone.Transport.position = "0:0:0";
  Tone.Transport.start("+0.05");
}

// ── SCREEN NAVIGATION (unchanged logic) ───────────────────────────────────
function hideAllScreens() {
  [homeScreen, levelScreen, gameScreen, passScreen, prizeScreen,
   rewardScreen, pauseScreen, gameOverScreen].forEach(s => { if(s) s.style.display="none"; });
}

function showLevelScreen()     { hideAllScreens(); levelScreen.style.display="flex"; }
function backFromLevelScreen() { hideAllScreens(); homeScreen.style.display="flex"; }

function selectLevel(level) {
  selectedDifficulty = {1:"easy",2:"medium",3:"hard"}[level];
  currentBeatmap = songs[selectedDifficulty].beatmap;
  updateNowPlaying(); resetGame();
  hideAllScreens();
  gameScreen.style.display = "block";
  statusMessage.innerText = "Level " + level + " selected. Press Start.";
}

function backToHome() {
  resetGame(); selectedDifficulty=null; currentBeatmap=[];
  updateNowPlaying(); hideAllScreens(); homeScreen.style.display="flex";
}

function restartSameLevel() {
  if (!selectedDifficulty) { showLevelScreen(); return; }
  currentBeatmap = songs[selectedDifficulty].beatmap;
  updateNowPlaying(); resetGame();
  hideAllScreens(); gameScreen.style.display="block";
  statusMessage.innerText = selectedDifficulty + " — Press Start.";
}

function backToLevelSelect() {
  resetGame(); selectedDifficulty=null; currentBeatmap=[];
  updateNowPlaying(); hideAllScreens(); levelScreen.style.display="flex";
}

function pauseGame() {
  if (!gameRunning) return;
  gameRunning = false;
  setGameVisualState(false);
  if (currentAudio) currentAudio.pause();
  stopSongAudio();
  if (pauseScreen) pauseScreen.style.display="flex";
}

function levelPassed() {
  if (!gameRunning) return;
  gameRunning = false;
  setGameVisualState(false);
  if (songProgressFill) songProgressFill.style.width="100%";
  stopSongAudio();
  if (currentAudio) { currentAudio.pause(); currentAudio.currentTime=0; currentAudio=null; }
  clearTiles();
  startGameButton.disabled = false;
  hideAllScreens();
  if (passScreen) passScreen.style.display="block";
}

function endGame() {
  gameRunning = false;
  setGameVisualState(false);
  if (songProgressFill) songProgressFill.style.width="100%";
  stopSongAudio();
  if (currentAudio) { currentAudio.pause(); currentAudio.currentTime=0; currentAudio=null; }
  startGameButton.disabled = false;
  if (pauseScreen) pauseScreen.style.display="none";
  gameOverScreen.style.display="flex";
}

function showPrizeScreen() { hideAllScreens(); if(prizeScreen) prizeScreen.style.display="block"; }

const possibleRewards = [
  "NTUC $5 voucher","FairPrice treat","Coffee voucher","Snack pack",
  "Bonus star","Mystery prize","Well done badge","Lucky gift","Small surprise"
];

function pickPrize() {
  const r = possibleRewards[Math.floor(Math.random()*possibleRewards.length)];
  if (rewardText) rewardText.innerText = "Congratulations! You won: " + r;
  if (rewardImg)  rewardImg.src = "giftbox_open.png";
  hideAllScreens();
  if (rewardScreen) rewardScreen.style.display="flex";
}

// ── GLOBAL EXPORTS ─────────────────────────────────────────────────────────
window.selectLevel       = selectLevel;
window.showLevelScreen   = showLevelScreen;
window.backFromLevelScreen = backFromLevelScreen;
window.backToHome        = backToHome;
window.startGame         = startGame;
window.showPrizeScreen   = showPrizeScreen;
window.pickPrize         = pickPrize;
window.levelPassed       = levelPassed;
window.restartSameLevel  = restartSameLevel;
window.backToLevelSelect = backToLevelSelect;
window.pauseGame         = pauseGame;
window.playButtonSound   = playButtonSound;

// ── EVENT LISTENERS ────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnStart")?.addEventListener("click", showLevelScreen);
  document.getElementById("btnBackLevel")?.addEventListener("click", backFromLevelScreen);
  document.getElementById("startGame")?.addEventListener("click", startGame);
  document.getElementById("backHome")?.addEventListener("click", backToHome);
  document.getElementById("btnGoPrize")?.addEventListener("click", showPrizeScreen);
  document.getElementById("btnPlayAgain")?.addEventListener("click", backToHome);
  document.getElementById("pauseGame")?.addEventListener("click", pauseGame);
  document.getElementById("pauseRestart")?.addEventListener("click", restartSameLevel);
  document.getElementById("pauseBack")?.addEventListener("click", backToLevelSelect);
  document.getElementById("gameOverRestart")?.addEventListener("click", restartSameLevel);
  document.getElementById("gameOverBack")?.addEventListener("click", backToLevelSelect);
  document.querySelectorAll("button").forEach(b => b.addEventListener("click", playButtonSound));
});

document.addEventListener("keydown", e => {
  const k = e.key.toLowerCase();
  if (!(k in keyState)) return;
  const was = keyState[k];
  keyState[k] = true;
  if (!was && k in keyToIndex) handlePress(keyToIndex[k]);
});

document.addEventListener("keyup", e => {
  const k = e.key.toLowerCase();
  if (k in keyState) keyState[k] = false;
});