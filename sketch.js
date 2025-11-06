/* P5.js Absurdist Minigame Generator  — “Four-Second Flux”
*/

/* ============================= GLOBAL STATE =============================  */
let gameMode = "game";           // "game" | "transition" | "menu" | "start" - GPT
const AVAILABLE_MINIS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]; // include 4
let currentMini = 1;             // default start
let gameStartMs = 0;             // start time of current game
let transitionStartMs = 0;       // start time of "NEXT!" transition
const GAME_DURATION = 6000;      // 6 seconds per micro-game
const TRANSITION_DURATION = 2000; // “NEXT!” duration

// Sequential toggle (set to true for fixed order; false for random)
let sequentialMode = true;      // flip to true if you want fixed order
let seqIndex = 0;                // sequence index

// Menu UI state
let menuRects = [];              // clickable hitboxes
let menuSelIndex = 0;            // keyboard-select index
let menuHoverIndex = -1;         // hover index

// Start screen config & UI
let enableStartScreen = true;    // set to true/false to enable/disable the start screen - GPT
let startBtn = { x: 0, y: 0, w: 0, h: 0, hover: false }; // start button rect - GPT

// Configurable GitHub URL for minigame 11 (change to class repo)
const GITHUB_URL = "https://github.com/"; // set to class Repo

// Shared visuals
let baseFont;

/* ========================= (AUDIO via p5.sound) ========================= */

let snd = {};                // sound handles
let currentBgMini = null;    // which mini’s BG loop is running

/* === Per-minigame background loops (only the ones you said you have) ===  */
const MINI_BG = { // map: miniId -> filename
  1:  'bg_cloud.m4a',     // Cloud
  3:  'bg_face.mp3',      // Glitchy Face
  6:  'bg_ego.flac',      // Ego Balloon
  8:  'bg_spaghetti.m4a', // Spaghetti
  9:  'bg_form.wav',      // Bureaucratic Maze
  10: 'bg_monty.wav',     // Monty Python
  12: 'bg_legal.wav'      // Legal Malware (held while pressing SPACE)
}; // no BG for 2,4,5,7,11,13 per your files

// Single NEXT sfx (only one per your request)
const NEXT_SFX_FILE = 'next.wav'; //

// Squirrel clicks: only two variants per your request
const SQUIRREL_FILES = ['squirrel2.wav', 'squirrel3.wav']; //

// Other SFX you listed and we use
const SFX_FILES = {
  cloud_trimmer_loop: 'cloud_trimmer_loop.mp3',
  dog_bite:           'dog_bite.wav',
  dog_hold:           'dog_while_click1wav.wav',
  ego_hit:            'ego_hit.wav',
  ego_pop:            'ego_pop.wav',
  reset_click:        'reset_click.wav',
  spaghetti_ok:       'spaghetti_ok.m4a',
  spaghetti_wrong:    'spaghetti_wrong.mp3',
  bong_gavel:         'bong_gavel.wav',
  denied_form:        'denied_form.wav',
  sausage_click:      'sausage_click.wav',
  turtle_drop:        'turtle_drop.wav',
  turtle_win:         'turtle_win.wav',
  monty_stomp:        'monty_stomp.wav',
  monty_hit:          'monty_hit.wav'
}; //

/* ============================= IMAGES / SPRITES ============================= */
let imgs = {
  tractor: null,   // 'cloud_tractor.png'
  foot: null,      // 'foot.webp'
  pd: []           // 'pd1.png','pd2.png','pd3.png'
}; //

/* =============================== SAFE LOADERS =============================== */
function safeLoadSound(path, assignKey) {
  return loadSound(
    path,
    (s) => { console.log(`[sound] loaded: ${path}`); snd[assignKey] = s; },  // success
    ()  => { console.warn(`[sound] missing or failed: ${path}`); snd[assignKey] = null; } // fail
  );
} //

function preload() {
  // FX
  for (const [k, file] of Object.entries(SFX_FILES)) safeLoadSound(file, k); //

  // NEXT! single sfx
  safeLoadSound(NEXT_SFX_FILE, 'next_sfx'); //

  // Squirrel click variations (two files)
  snd.squirrel_clicks = [];
  for (const f of SQUIRREL_FILES) snd.squirrel_clicks.push(safeLoadSound(f, `sq_${f}`)); //

  // Per-minigame BG loops
  for (const [miniId, filename] of Object.entries(MINI_BG)) {
    const key = `bg_${miniId}`;
    safeLoadSound(filename, key); // e.g., snd.bg_1, snd.bg_3, ...
  }

  // Images
  imgs.tractor = loadImage('cloud_tractor.png', () => {}, () => {}); // kept but not used by default
  imgs.foot    = loadImage('foot.webp',         () => {}, () => {}); //
  imgs.pd[0]   = loadImage('pd1.png',           () => {}, () => {}); //
  imgs.pd[1]   = loadImage('pd2.png',           () => {}, () => {}); //
  imgs.pd[2]   = loadImage('pd3.png',           () => {}, () => {}); //
}

/* ====================== BACKGROUND MUSIC HELPERS ====================== */
function playMiniBg(miniId) {
  // For mini 12 (legal), we only play while SPACE is held, so don’t auto-start here
  if (miniId === 12) { stopMiniBg(); return; } // handled inside drawLegalMalware
  stopMiniBg(); // ensure no overlap
  const key = `bg_${miniId}`;
  const s = snd[key];
  if (s && s.isLoaded && s.isLoaded() && !s.isPlaying()) { s.loop(); s.setVolume(0.45); currentBgMini = miniId; } //
} //

function stopMiniBg() {
  if (currentBgMini != null) {
    const key = `bg_${currentBgMini}`;
    const s = snd[key];
    if (s && s.isPlaying()) s.stop();
  }
  currentBgMini = null; //
} //

function playNextSfx() {
  const s = snd.next_sfx;
  if (s && s.isLoaded && s.isLoaded()) s.play(); //
} //

/* ========================= MINIGAME STATE VARS =========================  */
/* 1: Mow the Cloud */
let mowSpots = [];                      // {x,y,r} patches
let prevMouse = { x: null, y: null };   // to detect motion

/* 2: Find the Hidden Noise (Squirrel) */
let noiseClicks = 0;                    // up to 5
let clickPuffs = [];                    // {x,y,kind,when}
let noiseFlashStartMs = 0;              // “SQUIRREL” flash timer
const NOISE_FLASH_TIME = 700;           // ms

/* 3: Glitchy Face Fix */
let faceReset = false;                  // after button
let faceExpression = 0;                 // overlay expression
const FACE_EXPRESSIONS = 6;             // 1..6

/* 4: Tag the Fleeting Motivation (NEW as ID 4) --------------------------- */
let mini4_targetCaught = false;              // whether clicked
let mini4_motPos = { x: 0, y: 0 };           // target position
let mini4_motVel = { x: 0, y: 0 };           // target velocity

/* 5: Sort Abstract Concepts */
let sortedOnce = false;                 // space pressed
let griefPos = { x: 0, y: 0 };          // spiky
let mayoPos = { x: 0, y: 0 };           // smooth
let bongFlashStartMs = -1;              // BONG text flash
const BONG_FLASH_TIME = 450;            // ms

/* 6: Deflate the Ego Balloon */
let egoPopped = false;                  // final state
let egoBaseRadius = 0;                  // radius
let egoHits = 0;                        // clicks to pop
const EGO_HITS_TO_POP = 6;              // threshold
let egoLastHitMs = -1;                  // “pssst!” timer
let egoPopPlayed = false;               // play pop only once

/* 7: Pet the Invisible Dog */
let dogEverPressed = false;             // did player start holding
let dogFailed = false;                  // released early -> true

/* 8: Sentient Spaghetti */
let spaghettiState = "tangle";          // "tangle" | "column" | "angry"
let spaghettiPoints = [];               // wobbly noodle points

/* 9: Bureaucratic Maze (Form) */
let formPos = { x: 0, y: 0 };           //
let formVel = { x: 0, y: 0 };           //
let formSize = { w: 0, h: 0 };          //
let denied = false;                     //
let stamps = [];                        // stamp particles

/* 10: Monty Python Foot Stomp */
let montyTargets = [];                  // array of creatures (pd images)
let footX = 0, footY = 0;               // foot position
let footDown = false;                   // stomping
let footScale = 1.0;                    // scale factor

/* 11: GitHub Button */
let githubBtn = { x: 0, y: 0, w: 0, h: 0, hover: false }; // button rect

/* 12: Legal Malware Text */
let legalSnippets = [];                 // on-screen “legal text” sprites
let legalLastSpawn = 0;                 // last spawn ms
let legalSpawnInterval = 80;            // ms between spawns while not paused

/* 13: Sausage Filler */
let sausageItems = [                    // world-politics “stuffing”
  "CORRUPTION", "HUNGER", "SANCTIONS", "PROPAGANDA",
  "W.M.D.", "SURVEILLANCE", "OLIGARCHS", "DISINFORMATION", "DEBT", "STRESS", "BUREAUCRACY", "INFLUENCERS", "NUKE", "WAR" , "LIFE COACHES" , 
"SPAM EMAILS", "SCROLLING", "MICROTRANSACTIONS", "CLICKBAIT",
"FAST FOOD", "ADVERTISING", "ALGORITHMS", "FOMO",
"COMMUTE", "SUBSCRIPTIONS", "INSTANT GRATIFICATION", "OVERWORK",
"DATA MINING", "MALWARE", "STAGNATION", "GOSSIP",
"NOTIFICATIONS", "BURNOUT", "MEETINGS", "MIDLIFE CRISIS",
"DOOMSCROLLING", "FAKE NEWS", "SURVEILLANCE CAPITALISM", "TERMS OF SERVICE",
"ADDICTION", "POP-UPS", "EGO", "ANXIETY", "PROCRASTINATION", "PORNOGRAPHY", "POLITICIANS"
]; //
let sausageFills = [];                  // active fly-in labels
let sausageFillCount = 0;               // progress
const SAUSAGE_FILL_TARGET = 8;          // items to fill

/* =============================== SETUP/DRAW ===============================  */
function setup() {
  createCanvas(windowWidth, windowHeight); // responsive
  textFont('sans-serif');                  // chunky via size/bold
  textStyle(BOLD);                         // punchy
  textAlign(CENTER, CENTER);               // center large texts
  if (enableStartScreen) { gameMode = "start"; } else { startNewGame(nextMiniIdForStart()); } // start screen gate - GPT
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight); // responsive
}

function draw() {
  background(245, 245, 255); // soft baseline

  if (gameMode === "start") { // start screen branch - GPT
    drawStartScreen();        // render start screen - GPT
    drawFooterRibbon();       // footer for consistency - GPT
    return;                   // stop when in start screen - GPT
  } // - GPT

  if (gameMode === "menu") {             // menu state
    drawMenu();                          // draw selectable list
    drawFooterRibbon();                  // footer
    return;                              // stop here when in menu
  }

  if (gameMode === "game") {
    const elapsed = millis() - gameStartMs; //
    drawGameFrame(elapsed);                 //

    // Objective text (smaller so it never bleeds)
    if (elapsed < 1100) {
      const t = 1 - constrain(elapsed / 1100, 0, 1);
      push();
      const size = min(width, height) * 0.06;
      textSize(size);
      fill(0, 0, 0, 220 * t);
      stroke(255);
      text(getObjectiveText(currentMini), width / 2, height * 0.52);
      pop();
    }

    if (elapsed >= GAME_DURATION) beginTransition(); //
  } else {
    const tElapsed = millis() - transitionStartMs;   //
    drawTransitionFrame(tElapsed);                   //
    if (tElapsed >= TRANSITION_DURATION) startNewGame(nextMiniId()); //
  }

  drawFooterRibbon(); // decorative
  prevMouse.x = mouseX; prevMouse.y = mouseY; // movement tracker
}

/* ============================= GAME FLOW UTILS =============================  */
function nextMiniIdForStart() {
  if (sequentialMode) { seqIndex = 0; return AVAILABLE_MINIS[seqIndex]; } //
  return randomMiniDifferentFrom(currentMini); //
} //

function nextMiniId() {
  if (sequentialMode) { seqIndex = (seqIndex + 1) % AVAILABLE_MINIS.length; return AVAILABLE_MINIS[seqIndex]; } //
  return randomMiniDifferentFrom(currentMini); //
} //

function startNewGame(nextMini) {
  gameMode = "game";         // enter gameplay
  currentMini = nextMini;    // which mini
  gameStartMs = millis();    // reset timer

  // Stop any loops from prior state
  if (snd.cloud_trimmer_loop && snd.cloud_trimmer_loop.isPlaying()) snd.cloud_trimmer_loop.stop(); //
  if (snd.dog_hold && snd.dog_hold.isPlaying && snd.dog_hold.isPlaying()) snd.dog_hold.stop();     //
  stopMiniBg(); // cut BG on switch

  resetMiniState(currentMini); // reset per-mini
  playMiniBg(currentMini);     // start BG if exists/allowed
} //

function beginTransition() {
  gameMode = "transition";      //
  transitionStartMs = millis(); //

  // Stop loops during NEXT!
  if (snd.cloud_trimmer_loop && snd.cloud_trimmer_loop.isPlaying()) snd.cloud_trimmer_loop.stop();
  if (snd.dog_hold && snd.dog_hold.isPlaying && snd.dog_hold.isPlaying()) snd.dog_hold.stop();
  stopMiniBg();        // BG cuts immediately
  playNextSfx();       // single NEXT sound
} //

function randomMiniDifferentFrom(prev) {
  const pool = AVAILABLE_MINIS.filter(v => v !== prev);
  return random(pool); // number from pool
} //

function getObjectiveText(mini) {
  if (mini === 1)  return "Practice your pollution."; //
  if (mini === 2)  return "Locate the noise.";                    //
  if (mini === 3)  return "Stop AI before it becomes Intelligent."; //
  if (mini === 4)  return "Click Motivation before it remembers it’s busy."; // NEW
  if (mini === 5)  return "Give 'Grief' and 'Mayonnaise' some Space."; //
  if (mini === 6)  return "Quickly deflate the ego."; //
  if (mini === 7)  return "Pet the Invisible Dog."; //
  if (mini === 8)  return "Only 'G' may pass-ta.";         //
  if (mini === 9)  return "Fragile. Do not touch.";         //
  if (mini === 10) return "Smash the civilized."; //
  if (mini === 11) return "Press the button to escape.";// GitHub
  if (mini === 12) return "Accept the Terms before they accept you."; // Legal
  if (mini === 13) return "Stuff the sausage.";   // Sausage
  return ""; //
} //

function getMiniName(mini) { // menu friendly names
  if (mini === 1)  return "Pollute the Cloud";               //
  if (mini === 2)  return "Find the Noise";       //
  if (mini === 3)  return "The AI Face";        //
  if (mini === 4)  return "Tag Motivation";     // NEW
  if (mini === 5)  return "Space them";      //
  if (mini === 6)  return "Deflate the Ego Balloon";     //
  if (mini === 7)  return "Pet the Invisible Dog";       //
  if (mini === 8)  return "Sentient Spaghetti";          //
  if (mini === 9)  return "Bureaucratic Maze";           //
  if (mini === 10) return "Monty Stomp";            //
  if (mini === 11) return "Repo It";     //
  if (mini === 12) return "Legal Malware Text";          //
  if (mini === 13) return "Bad Bad Sausage";           //
  return `Minigame ${mini}`;                             //
} //

/* ============================= PER-MINI RESETS =============================  */
function resetMiniState(mini) {
  if (mini === 1) {
    mowSpots = []; //
  } else if (mini === 2) {
    noiseClicks = 0; clickPuffs = []; noiseFlashStartMs = millis(); //
  } else if (mini === 3) {
    faceReset = false; faceExpression = 0; //
  } else if (mini === 4) { // NEW reset for Tag Motivation
    mini4_targetCaught = false;                                     //
    mini4_motPos.x = width * 0.5; mini4_motPos.y = height * 0.5;    //
    const sp = Math.max(5, Math.min(width, height) * 0.012);        //
    const ang = random(TWO_PI);                                     //
    mini4_motVel.x = sp * cos(ang); mini4_motVel.y = sp * sin(ang); //
  } else if (mini === 5) {
    sortedOnce = false; bongFlashStartMs = -1;
    griefPos.x = width * 0.45; griefPos.y = height * 0.5;
    mayoPos.x = width * 0.55;  mayoPos.y = height * 0.5; //
  } else if (mini === 6) {
    egoPopped = false; egoBaseRadius = min(width, height) * 0.25;
    egoHits = 0; egoLastHitMs = -1; egoPopPlayed = false; //
  } else if (mini === 7) {
    dogEverPressed = false; dogFailed = false;
    if (snd.dog_hold && snd.dog_hold.isPlaying && snd.dog_hold.isPlaying()) snd.dog_hold.stop(); //
  } else if (mini === 8) {
    spaghettiState = "tangle"; spaghettiPoints = [];
    const count = 24;
    for (let i = 0; i < count; i++) {
      spaghettiPoints.push({
        x: width * 0.35 + random(width * 0.3),
        y: height * 0.35 + random(height * 0.3),
        off: random(TWO_PI)
      });
    } //
  } else if (mini === 9) {
    denied = false; stamps = [];
    formSize.w = min(width, height) * 0.25; formSize.h = min(width, height) * 0.12;
    formPos.x = random(width * 0.2, width * 0.8 - formSize.w);
    formPos.y = random(height * 0.2, height * 0.8 - formSize.h);
    const sp = max(2.2, min(width, height) * 0.0045); const a = random(TWO_PI);
    formVel.x = sp * cos(a); formVel.y = sp * sin(a); //
  } else if (mini === 10) {
    montyTargets = [];
    const n = 6;
    for (let i = 0; i < n; i++) {
      montyTargets.push({
        img: imgs.pd[i % imgs.pd.length],
        x: random(width * 0.1, width * 0.9),
        y: random(height * 0.4, height * 0.8),
        w: min(width, height) * random(0.10, 0.16),
        h: min(width, height) * random(0.10, 0.16),
        vx: random([-1, 1]) * random(2.0, 3.6),
        alive: true
      });
    }
    footX = width * 0.75; footY = height * 0.2; footDown = false; footScale = 1.35; //
  } else if (mini === 11) {
    // Centered GitHub button
    githubBtn.w = min(420, width * 0.6); githubBtn.h = 72;
    githubBtn.x = width / 2 - githubBtn.w / 2; githubBtn.y = height / 2 - githubBtn.h / 2;
    githubBtn.hover = false; //
  } else if (mini === 12) {
    // Clear snippets and reset spawn timing
    legalSnippets = []; legalLastSpawn = millis(); legalSpawnInterval = 80; //
  } else if (mini === 13) {
    sausageFills = []; sausageFillCount = 0; //
  }
} //

/* =========================== RENDER TRANSITION ============================  */
function drawTransitionFrame() {
  background(20, 20, 40); // dark
  push();
  const big = min(width, height) * 0.12;
  textSize(big);
  const c = color(
    180 + 75 * sin(frameCount * 0.3),
    100 + 155 * sin(frameCount * 0.5 + 1.2),
    240
  );
  fill(c);
  stroke(255);
  strokeWeight(2);
  text("NEXT!", width / 2, height / 2);
  pop();
} //

/* ============================ DRAW GAME FRAME ============================  */
function drawGameFrame(elapsed) {
  if      (currentMini === 1)  drawMowCloud(elapsed);        //
  else if (currentMini === 2)  drawFindNoise(elapsed);       //
  else if (currentMini === 3)  drawGlitchyFace(elapsed);     //
  else if (currentMini === 4)  drawMini4_TagMotivation(elapsed); // NEW
  else if (currentMini === 5)  drawSortAbstract(elapsed);    //
  else if (currentMini === 6)  drawDeflateEgo(elapsed);      //
  else if (currentMini === 7)  drawInvisibleDog(elapsed);    //
  else if (currentMini === 8)  drawSpaghetti(elapsed);       //
  else if (currentMini === 9)  drawFormMaze(elapsed);        //
  else if (currentMini === 10) drawMonty(elapsed);           //
  else if (currentMini === 11) drawGitHubButton(elapsed);    // NEW
  else if (currentMini === 12) drawLegalMalware(elapsed);    // NEW
  else if (currentMini === 13) drawSausage(elapsed);         // NEW
} //

/* ==================== START SCREEN (NEW) ==================== */
function drawStartScreen() { // renders title and start button - GPT
  background(18, 22, 38); // deep blue - GPT

  // Title
  push(); textAlign(CENTER, CENTER); textSize(min(width, height) * 0.07); fill(255); stroke(0); strokeWeight(3);
  text("Nonsense Games by Joao de Mendonca Salim", width / 2, height * 0.35); pop(); // - GPT

  // Button sizing & layout (responsive)
  const bw = Math.min(360, width * 0.5);        // button width - GPT
  const bh = Math.max(56, Math.min(80, height * 0.09)); // button height - GPT
  startBtn.w = bw; startBtn.h = bh;             // store for hit test - GPT
  startBtn.x = width / 2 - bw / 2;              // center X - GPT
  startBtn.y = height * 0.55 - bh / 2;          // place below title - GPT

  // Hover detection
  startBtn.hover = mouseX >= startBtn.x && mouseX <= startBtn.x + startBtn.w &&
                   mouseY >= startBtn.y && mouseY <= startBtn.y + startBtn.h; // - GPT

  // Draw button
  push();
  noStroke();
  fill(startBtn.hover ? color(80, 220, 150) : color(60, 190, 120)); // - GPT
  rect(startBtn.x, startBtn.y, startBtn.w, startBtn.h, 14); // - GPT
  fill(0); textSize(28); text("Press to Start", startBtn.x + startBtn.w / 2, startBtn.y + startBtn.h / 2); // - GPT
  pop();

  // Keyboard hint
  push(); textSize(min(width, height) * 0.03); fill(230);
  text("Press Enter to start", width / 2, startBtn.y + startBtn.h + 40); pop(); // - GPT
} // - GPT

/* ==================== MINIGAME 1: POLLUTE THE CLOUD (4s-5s) ====================  */
function drawMowCloud(elapsed) {
  background(120, 200, 255); // sky

  // Ground stripe
  noStroke(); fill(60, 180, 90); rect(0, height * 0.8, width, height * 0.2);

  // Puffy cloud
  push();
  const cy = height * 0.33, cx = width * 0.5, baseR = min(width, height) * 0.12;
  noStroke(); fill(200, 220, 240, 140);
  ellipse(cx - baseR, cy + baseR * 0.2, baseR * 2.2, baseR * 1.4);
  ellipse(cx + baseR, cy + baseR * 0.15, baseR * 2.0, baseR * 1.3);
  fill(255);
  ellipse(cx - baseR * 1.3, cy, baseR * 1.9, baseR * 1.6);
  ellipse(cx, cy - baseR * 0.2, baseR * 2.6, baseR * 2.0);
  ellipse(cx + baseR * 1.3, cy + baseR * 0.05, baseR * 2.0, baseR * 1.6);
  pop();

  // Dark “mown” patches
  push(); noStroke();
  for (let s of mowSpots) if (s.y < height * 0.6) { fill(80, 80, 90, 100); ellipse(s.x, s.y, s.r, s.r * 0.8); }
  pop();

  // Red mower cursor
  const mowerSize = max(25, min(width, height) * 0.06);
  const mx = constrain(mouseX, 0, width), my = constrain(mouseY, 0, height);
  const useTractorCursor = false; // toggle true to use imgs.tractor

  push();
  if (imgs.tractor && useTractorCursor) { imageMode(CENTER); image(imgs.tractor, mx, my, mowerSize, mowerSize); }
  else { stroke(0); strokeWeight(2); fill(220, 40, 40); rect(mx - mowerSize/2, my - mowerSize/2, mowerSize, mowerSize, 3);
         fill(0); rect(mx - mowerSize*0.5, my - mowerSize*0.7, mowerSize, mowerSize*0.2, 2); }
  pop();

  if (my < height * 0.6) { mowSpots.push({ x: mx, y: my, r: mowerSize * (0.9 + random(0.2)) }); if (mowSpots.length > 400) mowSpots.shift(); }

  // SOUND: trimmer loop when inside cloud & moving
  if (snd.cloud_trimmer_loop) {
    const inside = my < height * 0.6;
    const moved = (prevMouse.x !== null) ? dist(mx, my, prevMouse.x, prevMouse.y) > 1.5 : false;
    if (inside && moved) { if (!snd.cloud_trimmer_loop.isPlaying()) { snd.cloud_trimmer_loop.loop(); snd.cloud_trimmer_loop.setVolume(0.4); } }
    else { if (snd.cloud_trimmer_loop.isPlaying()) snd.cloud_trimmer_loop.stop(); }
  }
}

/* ================= MINIGAME 2: FIND THE NOISE (4s-5s) =================  */
function drawFindNoise(elapsed) {
  background(255, 35, 190); // neon pink

  if (millis() - noiseFlashStartMs < NOISE_FLASH_TIME) {
    push(); textSize(min(width, height) * 0.06); stroke(255); strokeWeight(2); fill(0);
    text("THE NOISE IS A SQUIRREL", width / 2, height * 0.15); pop();
  }

  push(); textSize(min(width, height) * 0.045); fill(0); stroke(255); strokeWeight(2);
  const remaining = max(0, 5 - noiseClicks);
  text("Click to find the noise.", width / 2, height * 0.85);
  text(`Clicks remaining: ${remaining}`, width / 2, height * 0.9); pop();

  const now = millis(), showFor = 140;
  for (let i = clickPuffs.length - 1; i >= 0; i--) {
    const p = clickPuffs[i];
    if (now - p.when < showFor) drawSillyAt(p.x, p.y, p.kind);
    else clickPuffs.splice(i, 1);
  }

  if (noiseClicks >= 5) {
    push(); const blink = (frameCount % 30) < 15;
    if (blink) { textSize(min(width, height) * 0.07); fill(255); stroke(0); strokeWeight(2);
      text("…THE NOISE WAS INSIDE YOU ALL ALONG…", width / 2, height * 0.5); }
    pop();
  }
}
function drawSillyAt(x, y, kind) {
  push(); translate(x, y); noStroke();
  if (kind === 0) { fill(255); ellipse(0, 0, 28, 20); fill(0); ellipse(3, 0, 8, 8); }
  else if (kind === 1) { fill(255, 230, 80); triangle(-16, 10, 16, 10, -10, -10); fill(210, 170, 50);
    ellipse(-4, -2, 4, 4); ellipse(2, 2, 3, 3); }
  else { fill(255); ellipse(0, 0, 22, 22); fill(0); ellipse(0, 0, 10, 10); stroke(0); strokeWeight(3); line(6, 6, 12, 12); }
  pop();
}

/* ================= MINIGAME 3: THE GLITCHY FACE FIX (4s) =================  */
function drawGlitchyFace(elapsed) {
  background(60, 50, 180); // deep violet

  const faceR = min(width, height) * 0.22;
  const cx = width * 0.5, cy = height * 0.45;

  let faceCol = faceReset ? color(255, 240, 200)
    : color(180 + 75 * sin(frameCount * 0.4), 180 + 75 * sin(frameCount * 0.7 + 1.2), 180 + 75 * sin(frameCount * 0.9 + 0.7));

  push(); noStroke(); fill(faceCol); ellipse(cx, cy, faceR * 1.2, faceR * 1.1); pop();

  if (!faceReset) {
    push(); fill(0); noStroke();
    const dx = 6 * sin(frameCount * 0.6), dy = 4 * cos(frameCount * 0.5);
    ellipse(cx - faceR * 0.25 + dx, cy - faceR * 0.15 + dy, faceR * 0.16, faceR * 0.16);
    ellipse(cx + faceR * 0.25 - dx, cy - faceR * 0.15 - dy, faceR * 0.16, faceR * 0.16); pop();
    push(); noFill(); stroke(0); strokeWeight(3);
    const wob = sin(frameCount * 0.3) * (faceR * 0.1);
    arc(cx, cy + faceR * 0.12, faceR * 0.6, faceR * 0.3 + wob, 0, PI); pop();
  } else {
    push(); stroke(0); strokeWeight(2); noFill();
    ellipse(cx - faceR * 0.25, cy - faceR * 0.15, faceR * 0.22, faceR * 0.22);
    line(cx - faceR * 0.15, cy - faceR * 0.05, cx - faceR * 0.05, cy + faceR * 0.3);
    arc(cx, cy + faceR * 0.18, faceR * 0.55, faceR * 0.25, PI, TWO_PI);
    fill(0); noStroke();
    ellipse(cx - faceR * 0.25, cy - faceR * 0.15, faceR * 0.12, faceR * 0.12);
    ellipse(cx + faceR * 0.25, cy - faceR * 0.15, faceR * 0.12, faceR * 0.12);
    pop();
    drawExtraExpression(faceExpression, cx, cy, faceR); //
  }

  const bw = min(width, 600) * 0.35, bh = 56;
  const bx = width / 2 - bw / 2, by = height * 0.82 - bh / 2;

  push();
  const hovering = mouseX >= bx && mouseX <= bx + bw && mouseY >= by && mouseY <= by + bh;
  fill(hovering ? color(255, 210, 60) : color(255, 180, 40));
  stroke(0); rect(bx, by, bw, bh, 12);
  fill(0); textSize(28); text("FREEZE!", width / 2, by + bh / 2);
  pop();

  push(); textSize(18); fill(255);
  text("Freeze the AI Face in judgment.", width / 2, by - 24); pop();
}

/* ================= MINIGAME 4: TAG THE FLEETING MOTIVATION (4s) ================ */
function drawMini4_TagMotivation(elapsed) { // NEW
  background(10, 10, 20); // dark stage

  // Move target and bounce
  if (!mini4_targetCaught) {
    mini4_motPos.x += mini4_motVel.x;
    mini4_motPos.y += mini4_motVel.y;
    if (mini4_motPos.x < 20 || mini4_motPos.x > width - 20) mini4_motVel.x *= -1;
    if (mini4_motPos.y < 20 || mini4_motPos.y > height - 20) mini4_motVel.y *= -1;
  }

  // Glowing trail
  push();
  noFill();
  stroke(120, 240, 255, 70);
  strokeWeight(3);
  const trailLen = 10;
  for (let i = 0; i < trailLen; i++) {
    const f = i / trailLen;
    const tx = mini4_motPos.x - mini4_motVel.x * f * 2.5;
    const ty = mini4_motPos.y - mini4_motVel.y * f * 2.5;
    ellipse(tx, ty, 10 - i * 0.7, 10 - i * 0.7);
  }
  pop();

  // Target
  push();
  translate(mini4_motPos.x, mini4_motPos.y);
  noStroke();
  fill(mini4_targetCaught ? color(100, 255, 120) : color(255, 80, 160));
  ellipse(0, 0, 10, 10);
  if (!mini4_targetCaught) {
    fill(255);
    textSize(14);
    text("MOTIVATION", 0, -18);
  } else {
    textSize(26);
    stroke(255);
    strokeWeight(4);
    fill(0, 255, 160);
    text("GOT IT", 0, -24);
  }
  pop();

  // Helper text
  push();
  textSize(Math.min(width, height) * 0.04);
  stroke(255);
  strokeWeight(3);
  fill(255);
  text("Motivation Catch-up.", width / 2, height * 0.12);
  pop();
} //

/* ============= MINIGAME 5: Give them Space (4s) ==============  */
function drawSortAbstract(elapsed) {
  background(70, 240, 90);
  stroke(0); strokeWeight(3);
  line(width / 2, height * 0.2, width / 2, height * 0.8);

  push(); noStroke();
  drawSpiky(griefPos.x, griefPos.y, min(width, height) * 0.1, 11, color(240, 40, 40));
  drawLabel("GRIEF", griefPos.x, griefPos.y - min(width, height) * 0.12, 0);
  fill(255, 245, 120); ellipse(mayoPos.x, mayoPos.y, min(width, height) * 0.18, min(width, height) * 0.16);
  fill(255, 255, 200, 180); ellipse(mayoPos.x - 10, mayoPos.y - 10, 20, 12);
  drawLabel("MAYONNAISE", mayoPos.x, mayoPos.y + min(width, height) * 0.12, 0); pop();

  push(); textSize(min(width, height) * 0.045); fill(0); stroke(255); strokeWeight(2);
  text("Give them Space.", width / 2, height * 0.12); pop();

  if (sortedOnce && bongFlashStartMs > 0 && millis() - bongFlashStartMs < BONG_FLASH_TIME) {
    push(); textSize(min(width, height) * 0.16); fill(255); stroke(0); strokeWeight(2);
    text("BONG!", width / 2, height * 0.35); pop();
  }
}
function drawSpiky(x, y, r, spikes, colr) {
  push(); translate(x, y); fill(colr); stroke(0); strokeWeight(2);
  beginShape();
  for (let i = 0; i < spikes * 2; i++) {
    const ang = (PI * i) / spikes, rr = (i % 2 === 0) ? r : r * 0.45;
    vertex(cos(ang) * rr, sin(ang) * rr);
  }
  endShape(CLOSE);
  pop();
}
function drawLabel(txt, x, y, rot) {
  push(); translate(x, y); rotate(rot);
  textSize(min(width, height) * 0.05); stroke(255); strokeWeight(2); fill(0);
  text(txt, 0, 0); pop();
}

/* ============== MINIGAME 6: DEFLATE THE EGO BALLOON (4s) ================  */
function drawDeflateEgo(elapsed) {
  background(40, 0, 80); const cx = width * 0.5, cy = height * 0.52;
  if (!egoPopped) egoBaseRadius += 0.35; else {
    egoBaseRadius = lerp(egoBaseRadius, min(width, height) * 0.04, 0.25);
    if (!egoPopPlayed && snd.ego_pop && snd.ego_pop.isLoaded && snd.ego_pop.isLoaded()) { snd.ego_pop.play(); egoPopPlayed = true; }
  }
  const rr = 180 + 75 * sin(frameCount * 0.05), gg = 180 + 75 * sin(frameCount * 0.07 + 1.7), bb = 180 + 75 * sin(frameCount * 0.09 + 0.6);
  noStroke(); for (let i = 5; i >= 1; i--) { fill(rr, gg, bb, 14 * i); ellipse(cx, cy, egoBaseRadius * 2 + i * 14, egoBaseRadius * 2 + i * 14); }
  fill(rr, gg, bb); stroke(255); strokeWeight(2); ellipse(cx, cy, egoBaseRadius * 2, egoBaseRadius * 2);
  if (egoPopped) { push(); stroke(255); strokeWeight(2); for (let i = 0; i < 10; i++) { const a = (TWO_PI * i) / 10 + frameCount * 0.03;
    line(cx, cy, cx + cos(a) * (egoBaseRadius + 30), cy + sin(a) * (egoBaseRadius + 30)); } pop(); }
  if (egoLastHitMs > 0 && millis() - egoLastHitMs < 150) { push(); textSize(min(width, height) * 0.06); stroke(0); strokeWeight(2); fill(255);
    text("pssst!", cx, cy - egoBaseRadius * 0.2); pop(); }
  if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) { push(); translate(mouseX, mouseY); noStroke(); fill(250);
    triangle(-4, 0, 4, 0, 0, -16); fill(0); rect(-2, -28, 4, 14, 2); pop(); }
  if (!egoPopped && (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height)) egoPopped = true;
}

/* ===================== MINIGAME 7: PET THE INVISIBLE DOG ===================  */
function drawInvisibleDog(elapsed) {
  background(236, 225, 206);
  if (mouseIsPressed && !dogFailed) {
    const r = min(width, height) * (0.06 + 0.01 * sin(frameCount * 0.2));
    push(); noFill(); stroke(255, 200, 80); strokeWeight(2); ellipse(width / 2, height / 2, r, r); pop();
    push(); noStroke(); fill(255, 220, 120, 40); ellipse(width / 2, height / 2, r * 1.4, r * 1.4); pop();
    if (snd.dog_hold && snd.dog_hold.isLoaded && snd.dog_hold.isLoaded()) if (!snd.dog_hold.isPlaying()) snd.dog_hold.loop(); //
  } else { if (snd.dog_hold && snd.dog_hold.isPlaying && snd.dog_hold.isPlaying()) snd.dog_hold.stop(); } //

  if (dogFailed) { const blink = (frameCount % 20) < 12;
    if (blink) { push(); textSize(min(width, height) * 0.12); stroke(0); strokeWeight(2); fill(230, 40, 40); text("HE BIT YOU", width / 2, height * 0.45); pop(); } }

  push(); textSize(min(width, height) * 0.045); stroke(255); strokeWeight(2); fill(0);
  text("Hold the mouse button down for the full duration.", width / 2, height * 0.8); pop();
}

/* ============ MINIGAME 8: ORGANIZE THE SENTIENT SPAGHETTI (4s) ============  */
function drawSpaghetti(elapsed) {
  background(200, 45, 20); // tomato sauce red
  if (spaghettiState === "tangle") {
    noFill(); stroke(230, 170, 60); strokeWeight(5);
    beginShape();
    for (let i = 0; i < spaghettiPoints.length; i++) {
      const p = spaghettiPoints[i];
      const wobX = p.x + 10 * sin(frameCount * 0.05 + p.off);
      const wobY = p.y + 10 * cos(frameCount * 0.06 + p.off);
      curveVertex(wobX, wobY);
    }
    endShape();
  } else if (spaghettiState === "column") {
    stroke(230, 170, 60); strokeWeight(5); const cx = width / 2;
    for (let i = -4; i <= 4; i++) line(cx + i * 8, height * 0.3, cx + i * 8, height * 0.7);
    push(); stroke(0); strokeWeight(5); line(cx - 25, height * 0.72, cx - 10, height * 0.75); line(cx - 10, height * 0.75, cx + 20, height * 0.68); pop();
  } else if (spaghettiState === "angry") {
    push(); translate(width / 2, height / 2); noStroke(); fill(255, 220, 70);
    ellipse(0, 0, min(width, height) * 0.5, min(width, height) * 0.5);
    fill(0); ellipse(-50, -30, 28, 28); ellipse(50, -30, 28, 28);
    noFill(); stroke(0); strokeWeight(2); arc(0, 30, 120, 90, PI, TWO_PI); pop();
  }
  push(); textSize(min(width, height) * 0.045); stroke(255); strokeWeight(2); fill(0);
  text("Press 'G' once. Any other key offends the spaghetti.", width / 2, height * 0.15); pop();
}

/* =========== MINIGAME 9: NAVIGATE THE MAZE (4s) ============  */
function drawFormMaze(elapsed) {
  background(240, 240, 255);
  if (!denied) {
    formPos.x += formVel.x; formPos.y += formVel.y;
    if (formPos.x < 0 || formPos.x + formSize.w > width) formVel.x *= -1;
    if (formPos.y < 0 || formPos.y + formSize.h > height) formVel.y *= -1;
  }
  if (!denied) { push(); fill(220, 40, 40); stroke(0); strokeWeight(2); rect(formPos.x, formPos.y, formSize.w, formSize.h); pop(); }
  else {
    for (let s of stamps) { s.x += s.vx; s.y += s.vy; s.vy += 0.06; push(); translate(s.x, s.y); rotate(s.rot);
      noStroke(); fill(240, 40, 40); rect(-6, -4, 12, 8, 2); fill(60); rect(-2, 4, 4, 8, 1); pop(); s.rot += s.vr; }
    const blink = (frameCount % 20) < 14;
    if (blink) { push(); textSize(min(width, height) * 0.12); stroke(0); strokeWeight(2); fill(255, 60, 60); text("DENIED", width / 2, height * 0.2); pop(); }
  }
  drawStickPetitioner(mouseX, mouseY);
  if (!denied) {
    if (mouseX >= formPos.x && mouseX <= formPos.x + formSize.w && mouseY >= formPos.y && mouseY <= formPos.y + formSize.h) {
      denied = true;
      const n = 36;
      for (let i = 0; i < n; i++) stamps.push({ x: formPos.x + formSize.w / 2, y: formPos.y + formSize.h / 2, vx: random(-3, 3), vy: random(-3, -0.5), rot: random(TWO_PI), vr: random(-0.1, 0.1) });
      if (snd.denied_form && snd.denied_form.isLoaded && snd.denied_form.isLoaded()) snd.denied_form.play(); //
    }
  }
  push(); textSize(min(width, height) * 0.04); stroke(255); strokeWeight(2); fill(0);
  text("Avoid the moving form. Do not touch it!", width / 2, height * 0.9); pop();
}
function drawStickPetitioner(x, y) {
  push(); translate(x, y); stroke(0); strokeWeight(2);
  fill(255); ellipse(0, -10, 10, 10); line(0, -5, 0, 10);
  line(0, 2, -6, 8); line(0, 2, 6, 8); line(0, 10, -5, 18); line(0, 10, 5, 18); pop();
}

/* =============== MINIGAME 10: MONTY PYTHON FOOT STOMP (4s) =============== */
function drawMonty(elapsed) {
  background(255, 235, 180);

  // Ensure a stomp goes all the way down once initiated (latch the action).
  if (this.prevFootDown === undefined) { 
    this.prevFootDown = false; 
    this.stompLatched = false; 
    this.stompCompleted = false; 
  } // init once
  const footPressed = footDown && !this.prevFootDown;            // detect rising edge (stomp start)
  if (footPressed) { this.stompLatched = true; this.stompCompleted = false; } // latch until bottom reached
  const stomping = footDown || (this.stompLatched && !this.stompCompleted);   // keep stomping until we hit bottom

  for (let c of montyTargets) 
    if (c.alive) { 
      c.x += c.vx; 
      if (c.x < 0) { c.x = 0; c.vx *= -1; } 
      if (c.x + c.w > width) { c.x = width - c.w; c.vx *= -1; } 
    }

  for (let c of montyTargets) 
    if (c.alive && c.img) { 
      push(); 
      imageMode(CORNER); 
      image(c.img, c.x, c.y, c.w, c.h); 
      pop(); 
    }

  footX = mouseX;

  const footScaleFactor = 0.3;  // shrink to 30% size
  const baseFootW = min(width, height) * 0.55 * footScale * footScaleFactor; // reduced width
  const baseFootH = baseFootW * 0.7; // proportional height
  const upY = height * 0.18, downY = height * 0.45;

  // Corridor-lock: keep targets' Y within the foot's hittable vertical band so game is always winnable.
  const hitTop  = downY - baseFootH * 0.50;
  const hitBot  = downY + baseFootH * 0.35;
  const bandTop = Math.max(0, hitTop);
  const bandBot = Math.min(height, hitBot);
  for (let c of montyTargets) {
    if (!c.alive) continue;
    const maxTop = bandBot - c.h;
    const minTop = bandTop;
    c.y = constrain(c.y, minTop, maxTop);
  }

  // Animate down if stomping; otherwise rise. Clamp to exact bottom to finish the stomp.
  const targetY = stomping ? downY : upY;
  footY = lerp(footY, targetY, stomping ? 0.35 : 0.18);
  if (stomping && footY >= downY - 1) { 
    footY = downY; 
    this.stompCompleted = true; 
  }
  if (!stomping && this.stompLatched && this.stompCompleted) { 
    this.stompLatched = false; 
  }
  this.prevFootDown = footDown;

  if (imgs.foot) { 
    push(); 
    imageMode(CENTER); 
    translate(footX, footY); 
    image(imgs.foot, 0, 0, baseFootW, baseFootH); 
    pop(); 
  } else { 
    push(); 
    noStroke(); 
    fill(255, 200, 170); 
    ellipse(footX, footY, baseFootW, baseFootH); 
    pop(); 
  }

  if (stomping) {                                                
    for (let c of montyTargets) {
      if (!c.alive) continue;
      const fx1 = footX - baseFootW / 2, fx2 = footX + baseFootW / 2;
      const fy1 = footY - baseFootH / 2, fy2 = footY + baseFootH / 2;
      const cx1 = c.x, cx2 = c.x + c.w, cy1 = c.y, cy2 = c.y + c.h;
      const overlap = !(fx2 < cx1 || fx1 > cx2 || fy2 < cy1 || fy1 > cy2);
      if (overlap) { 
        c.alive = false; 
        if (snd.monty_hit && snd.monty_hit.isLoaded && snd.monty_hit.isLoaded()) 
          snd.monty_hit.play(); 
      }
    }
  }

  const aliveLeft = montyTargets.filter(c => c.alive).length;
  if (aliveLeft === 0) {
    push(); 
    textSize(min(width, height) * 0.03); 
    stroke(0); 
    strokeWeight(2); 
    fill(255);
    text("AND NOW FOR SOMETHING COMPLETELY FLATTENED", width / 2, height * 0.25); 
    pop();
  }
}

/* ===================== MINIGAME 11: GITHUB BUTTON (4s) ===================== */
function drawGitHubButton(elapsed) {
  background(24, 28, 44); // dark

  // Title
  push(); textSize(min(width, height) * 0.08); fill(255); stroke(0); strokeWeight(2);
  text("Repo Something!", width / 2, height * 0.28); pop();

  // Button
  githubBtn.hover = mouseX >= githubBtn.x && mouseX <= githubBtn.x + githubBtn.w &&
                    mouseY >= githubBtn.y && mouseY <= githubBtn.y + githubBtn.h;

  push();
  noStroke();
  fill(githubBtn.hover ? color(60, 220, 120) : color(40, 180, 90));
  rect(githubBtn.x, githubBtn.y, githubBtn.w, githubBtn.h, 12);
  fill(0); textSize(28);
  text("REPOSSESS", githubBtn.x + githubBtn.w / 2, githubBtn.y + githubBtn.h / 2);
  pop();

  // Tip
  push(); textSize(min(width, height) * 0.035); fill(230);
  text("Click the button to escape the nonsense.", width / 2, height * 0.68); pop();
}

/* ================== MINIGAME 12: LEGAL MALWARE TEXT (4s) ================== */
function drawLegalMalware(elapsed) {
  background(248, 250, 255); // pale

  const holdingSpace = keyIsDown(32); // true while key held

  // While holding SPACE: pause spawning & play/loop bg_legal; on release: stop
  const legalBg = snd['bg_12'];

  // Simple timer to limit playback duration
  if (!this.legalPlayStart) this.legalPlayStart = 0;           // store when looping began
  const now = millis();                                        // current time in ms

  if (holdingSpace) {
    if (
      legalBg &&
      legalBg.isLoaded &&
      legalBg.isLoaded() &&
      !legalBg.isPlaying()
    ) {
      legalBg.loop();                                          // start loop
      legalBg.setVolume(0.5);                                  // set volume
      this.legalPlayStart = now;                               // mark start time
    }

    // Stop automatically after 3 seconds of playback
    if (
      legalBg &&
      legalBg.isPlaying &&
      legalBg.isPlaying() &&
      now - this.legalPlayStart > 3000
    ) {
      legalBg.setLoop(false);                                  // disable loop flag
      legalBg.stop();                                          // cut playback
    }
  } else {
    if (legalBg && legalBg.isPlaying && legalBg.isPlaying()) {
      legalBg.setLoop(false);                                  // ensure looping disabled
      legalBg.stop();                                          // stop when space released
    }
  }

  // Spawn new snippets ONLY when not holding space
  if (!holdingSpace && millis() - legalLastSpawn > legalSpawnInterval) {
    legalLastSpawn = millis();
    legalSnippets.push({
      x: random(width), y: random(height), rot: random(-0.2, 0.2),
      txt: random([
        "LIMITED LIABILITY NOTICE",
        "NON-DISCLOSURE ACKNOWLEDGED",
        "FOR INTERNAL USE ONLY",
        "USER CONSENT PENDING",
        "INTELLECTUAL PROPERTY CLAIM",
        "VOID WHERE PROHIBITED",
        "SUBJECT TO AUDIT",
        "LICENSE AGREEMENT EXPIRED",
        "TERMINATION CLAUSE ACTIVE",
        "FORCE MAJEURE INVOKED",
        "CONTRACTUAL OBLIGATION LOOP",
        "THIRD-PARTY DATA SHARING",
        "INDEMNIFICATION REQUIRED",
        "CONFIDENTIALITY BREACH REPORTED",
        "DISPUTE RESOLUTION IN PROGRESS",
        "PATENT PENDING PERPETUITY",
        "WAIVER OF RIGHTS ACCEPTED",
        "JURISDICTION: UNKNOWN",
        "RETENTION POLICY ENABLED",
        "FINAL SETTLEMENT OFFER",
        "NOTICE OF COMPLIANCE FAILURE",
        "MANDATORY UPDATE ENFORCED",
        "CONSENT FORM OUTDATED",
        "SECTION 404 UNAVAILABLE",
        "NON-COMPETE ACTIVATED",
        "EXCLUSIVITY AGREEMENT VIOLATED",
        "TERMS SUBJECT TO CHANGE",
        "PERPETUAL LICENSE GRANTED",
        "CLAUSE 9.3(B) DISPUTED",
        "CONSUMER RIGHTS OVERRIDDEN"
      ]),
      size: random(14, 28),
      life: random(1500, 4000)
    }); //
    if (legalSnippets.length > 240) legalSnippets.shift(); // cap memory
  }

  // Update & draw snippets (malware swarm)
  for (let i = legalSnippets.length - 1; i >= 0; i--) {
    const s = legalSnippets[i]; s.life -= deltaTime;
    push(); translate(s.x, s.y); rotate(s.rot);
    textSize(s.size);
    fill(holdingSpace ? color(60, 160, 255) : color(10, 10, 10)); // frozen text turns bluish
    noStroke(); text(s.txt, 0, 0); pop();
    if (s.life <= 0) legalSnippets.splice(i, 1);
  }

  // Header/instructions
  push(); textSize(min(width, height) * 0.045); stroke(255); strokeWeight(2); fill(20);
  text("THE TERMS ARE MULTIPLYING — HOLD SPACE TO FREEZE THEM", width / 2, height * 0.12); pop();
}

/* ================== MINIGAME 13: SAUSAGE (4s) =================== */
function drawSausage(elapsed) {
  background(255, 237, 210); // deli-beige

  // Sausage body
  const sx = width * 0.2, sy = height * 0.5, sw = width * 0.6, sh = min(height * 0.22, 180);
  push();
  noStroke(); fill(200, 80, 70); rect(sx, sy - sh/2, sw, sh, sh/2); // main body
  fill(170, 60, 55); rect(sx + 8, sy - sh/2 + 8, sw - 16, sh - 16, sh/2 - 12); // inner shade
  pop();

  // Fill progress bar
  const pct = constrain(sausageFillCount / SAUSAGE_FILL_TARGET, 0, 1);
  push(); noStroke(); fill(30, 200, 110); rect(sx, sy + sh/2 + 20, sw * pct, 14, 7); stroke(0); noFill(); rect(sx, sy + sh/2 + 20, sw, 14, 7); pop();

  // Active flying labels moving into sausage
  for (let i = sausageFills.length - 1; i >= 0; i--) {
    const f = sausageFills[i];
    // Move towards a random point inside sausage
    const tx = sx + random(20, sw - 20), ty = sy + random(-sh/2 + 14, sh/2 - 14);
    f.x = lerp(f.x, tx, 0.08); f.y = lerp(f.y, ty, 0.08); f.a += 0.03; // wiggle
    push(); translate(f.x, f.y); rotate(0.2 * sin(f.a));
    textSize(20); fill(255); stroke(0); strokeWeight(2); text(f.txt, 0, 0); pop();
    // When close enough, remove from flying set
    if (dist(f.x, f.y, tx, ty) < 18) sausageFills.splice(i, 1);
  }

  // Instructions
  push(); textSize(min(width, height) * 0.045); stroke(255); strokeWeight(2); fill(0);
  text("Click to Add ‘content’ into the sausage.", width / 2, sy - sh/2 - 40); pop();

  // Win text
  if (sausageFillCount >= SAUSAGE_FILL_TARGET) {
    push(); textSize(min(width, height) * 0.07); fill(255); stroke(0); strokeWeight(2);
    text("A FINE MEAL!", width / 2, sy - sh/2 - 100); pop();
  }
}

/* =============================== INTERACTION ===============================  */
let __audioArmed = false; function armAudioOnce_() { __audioArmed = true; } //

function mousePressed() {
  armAudioOnce_(); //

  if (gameMode === "start") { // start screen click handling - GPT
    if (mouseX >= startBtn.x && mouseX <= startBtn.x + startBtn.w &&
        mouseY >= startBtn.y && mouseY <= startBtn.y + startBtn.h) {
      startNewGame(nextMiniIdForStart()); // enter gameplay - GPT
    }
    return; // do not fall through - GPT
  } // - GPT

  if (gameMode === "menu") {
    for (let i = 0; i < menuRects.length; i++) {
      const r = menuRects[i];
      if (mouseX >= r.x && mouseX <= r.x + r.w && mouseY >= r.y && mouseY <= r.y + r.h) {
        const chosen = AVAILABLE_MINIS[i]; startNewGame(chosen); return; //
      }
    }
    return;
  }

  if (gameMode !== "game") return;

  if (currentMini === 2) {
    if (noiseClicks < 5) {
      noiseClicks++;
      clickPuffs.push({ x: mouseX, y: mouseY, kind: floor(random(0, 3)), when: millis() });
      const pool = (snd.squirrel_clicks || []).filter(h => h && h.isLoaded && h.isLoaded());
      if (pool.length > 0) { const choice = random(pool); if (choice && choice.play) choice.play(); } //
    }
  }

  if (currentMini === 3) {
    const bw = min(width, 600) * 0.35, bh = 56, bx = width/2 - bw/2, by = height*0.82 - bh/2;
    if (mouseX >= bx && mouseX <= bx + bw && mouseY >= by && mouseY <= by + bh) {
      faceReset = true; faceExpression = floor(random(0, FACE_EXPRESSIONS + 1));
      if (snd.reset_click && snd.reset_click.isLoaded && snd.reset_click.isLoaded()) snd.reset_click.play(); //
    }
  }

  if (currentMini === 4) { // click tiny target to catch it
    const d = dist(mouseX, mouseY, mini4_motPos.x, mini4_motPos.y); //
    if (d <= 10) mini4_targetCaught = true; //
  }

  if (currentMini === 6) {
    const cx = width * 0.5, cy = height * 0.52, dx = mouseX - cx, dy = mouseY - cy;
    const inside = (dx * dx + dy * dy) <= (egoBaseRadius * egoBaseRadius);
    if (!egoPopped && inside) {
      egoHits++; egoBaseRadius *= 0.85; egoLastHitMs = millis();
      if (snd.ego_hit && snd.ego_hit.isLoaded && snd.ego_hit.isLoaded()) snd.ego_hit.play(); //
      if (egoHits >= EGO_HITS_TO_POP || egoBaseRadius < min(width, height) * 0.06) egoPopped = true;
    }
  }

  if (currentMini === 7) dogEverPressed = true; //

  if (currentMini === 10) { footDown = true; if (snd.monty_stomp && snd.monty_stomp.isLoaded && snd.monty_stomp.isLoaded()) snd.monty_stomp.play(); } //

  if (currentMini === 11) {
    // Click GitHub button to open link
    if (mouseX >= githubBtn.x && mouseX <= githubBtn.x + githubBtn.w && mouseY >= githubBtn.y && mouseY <= githubBtn.y + githubBtn.h) {
      if (GITHUB_URL && GITHUB_URL.startsWith("http")) window.open(GITHUB_URL, "_blank"); //
    }
  }

  if (currentMini === 13) {
    // Add a flying label and increment fill (with click sfx)
    const label = random(sausageItems);
    sausageFills.push({ x: mouseX, y: mouseY, txt: label, a: random(TWO_PI) });
    if (sausageFillCount < SAUSAGE_FILL_TARGET) sausageFillCount++;
    if (snd.sausage_click && snd.sausage_click.isLoaded && snd.sausage_click.isLoaded()) snd.sausage_click.play(); //
  }
}

function mouseReleased() {
  if (gameMode === "menu") return; //
  if (gameMode !== "game") return;

  if (currentMini === 7) {
    if (dogEverPressed) {
      dogFailed = true;
      if (snd.dog_bite && snd.dog_bite.isLoaded && snd.dog_bite.isLoaded()) snd.dog_bite.play(); //
    }
  }
  if (currentMini === 10) footDown = false; // raise foot
}

function keyPressed() {
  armAudioOnce_(); //

  if (gameMode === "start") { // Enter to start - GPT
    if (keyCode === ENTER || keyCode === RETURN) {
      startNewGame(nextMiniIdForStart()); // begin gameplay - GPT
      return false; // prevent default - GPT
    }
    return; // ignore other keys in start screen - GPT
  } // - GPT

  // TAB toggles menu
  if (keyCode === TAB) {
    if (gameMode !== "menu") enterMenu(); else startNewGame(currentMini);
    return false; // prevent browser focus jump
  }

  if (gameMode === "menu") {
    if (keyCode === UP_ARROW)   { menuSelIndex = (menuSelIndex - 1 + AVAILABLE_MINIS.length) % AVAILABLE_MINIS.length; return false; } //
    if (keyCode === DOWN_ARROW) { menuSelIndex = (menuSelIndex + 1) % AVAILABLE_MINIS.length; return false; } //
    if (keyCode === ENTER || keyCode === RETURN) { const chosen = AVAILABLE_MINIS[menuSelIndex]; startNewGame(chosen); return false; } //
    return;
  }

  if (gameMode !== "game") return;

  if (currentMini === 5 && (key === ' ' || keyCode === 32)) {
    if (!sortedOnce) {
      sortedOnce = true; bongFlashStartMs = millis();
      griefPos.x = width * 0.2;  griefPos.y = height * 0.5;
      mayoPos.x = width * 0.8;   mayoPos.y = height * 0.5;
      if (snd.bong_gavel && snd.bong_gavel.isLoaded && snd.bong_gavel.isLoaded()) snd.bong_gavel.play(); //
    }
  }

  if (currentMini === 8) {
    if (key.toLowerCase() === 'g') {
      spaghettiState = "column";
      if (snd.spaghetti_ok && snd.spaghetti_ok.isLoaded && snd.spaghetti_ok.isLoaded()) snd.spaghetti_ok.play(); //
    } else {
      spaghettiState = "angry";
      if (snd.spaghetti_wrong && snd.spaghetti_wrong.isLoaded && snd.spaghetti_wrong.isLoaded()) snd.spaghetti_wrong.play(); //
    }
  }

  // Note: Legal Malware (12) uses keyIsDown(32) in draw() for hold behavior; no toggle here
}

/* =============================== MENU RENDER =============================== */
function enterMenu() {
  if (snd.cloud_trimmer_loop && snd.cloud_trimmer_loop.isPlaying()) snd.cloud_trimmer_loop.stop(); //
  if (snd.dog_hold && snd.dog_hold.isPlaying && snd.dog_hold.isPlaying()) snd.dog_hold.stop();     //
  stopMiniBg(); gameMode = "menu"; menuSelIndex = max(0, AVAILABLE_MINIS.indexOf(currentMini)); //
} //

function drawMenu() {
  background(18, 22, 38);
  push(); textAlign(CENTER, CENTER); textSize(min(width, height) * 0.048); fill(255); stroke(0); strokeWeight(2);
  text("Select A Micro-Game", width / 2, height * 0.18); pop();

  push(); textSize(min(width, height) * 0.025); fill(230); noStroke();
  text("Click an option, or use ↑/↓ and Enter.  Press TAB to return.", width / 2, height * 0.26); pop();

  const listTop = height * 0.34, rowH = min(72, height * 0.08), padX = 40, itemW = min(width * 0.7, 720), x = (width - itemW) / 2;
  menuRects = []; menuHoverIndex = -1;

  const my = mouseY;

  // Two-column layout settings (keeps your existing 'x' as the left anchor).
  const COLS = 2;                           // number of columns to display
  const colGap = 24;                        // horizontal gap between columns
  const margin = 10;                        // right-side margin so UI doesn't touch canvas edge

  // Compute the widest safe item width so both columns fit from 'x' to the right edge.
  const availableRight = (width - margin) - x;                                     // space from left anchor to right edge
  const itemWFit = Math.max(80, Math.min(itemW, (availableRight - (COLS - 1) * colGap) / COLS)); // fitted width per column

  for (let i = 0; i < AVAILABLE_MINIS.length; i++) {
    const col = i % COLS, row = Math.floor(i / COLS);         // map linear index into (col,row)
    const xCellFit = x + col * (itemWFit + colGap);            // x-pos for this column using fitted width

    const y = listTop + row * (rowH + 12),                      // original row spacing preserved
          rectObj = { x: xCellFit, y: y - rowH / 2, w: itemWFit, h: rowH }; // use fitted x/width so both columns show

    menuRects.push(rectObj);
    let isHover =
      mouseX >= rectObj.x &&
      mouseX <= rectObj.x + rectObj.w &&
      my >= rectObj.y &&
      my <= rectObj.y + rectObj.h;
    if (isHover) menuHoverIndex = i;

    const selected = (i === menuSelIndex), hovered = (i === menuHoverIndex);
    push(); noStroke();
    const base = color(40, 48, 80), sel = color(70, 90, 160), hov = color(55, 66, 110);
    fill(selected ? sel : hovered ? hov : base);
    rect(rectObj.x, rectObj.y, rectObj.w, rectObj.h, 12);
    pop();

    push();
    textAlign(LEFT, CENTER);
    const label = `ID ${AVAILABLE_MINIS[i]} — ${getMiniName(AVAILABLE_MINIS[i])}`;
    textSize(min(width, height) * 0.024);
    fill(255); noStroke();
    text(label, rectObj.x + padX, y);
    pop();
  }
}

/* =============================== DECORATIVE ===============================  */
function drawFooterRibbon() {
  push(); noStroke(); fill(0, 0, 0, 30); rect(0, height - 36, width, 36);
  textSize(16); fill(255); text("ABSURDIST MICRO-GAMES • Press TAB for Menu • No score. No failure. Only nonsense.", width / 2, height - 18);
  pop();
}

/* ========================= EXTRA EXPRESSIONS HELPER =========================  */
function drawExtraExpression(type, cx, cy, faceR) {
  if (!faceReset || type <= 0) return;
  push(); stroke(0); strokeWeight(2); noFill();
  if (type === 1) { fill(0);
    rect(cx - faceR * 0.38, cy - faceR * 0.2, faceR * 0.28, faceR * 0.16, 4);
    rect(cx + faceR * 0.10, cy - faceR * 0.2, faceR * 0.28, faceR * 0.16, 4);
    noFill(); line(cx - faceR * 0.10, cy - faceR * 0.12, cx + faceR * 0.10, cy - faceR * 0.12);
    arc(cx + faceR * 0.08, cy + faceR * 0.22, faceR * 0.55, faceR * 0.25, 0.1 * PI, 0.8 * PI);
  } else if (type === 2) { noFill();
    for (let i = 0; i < 8; i++) {
      arc(cx - faceR * 0.25, cy - faceR * 0.15, faceR * (0.05 + i*0.02), faceR * (0.05 + i*0.02), 0, TWO_PI - 0.2*i);
      arc(cx + faceR * 0.25, cy - faceR * 0.15, faceR * (0.05 + i*0.02), faceR * (0.05 + i*0.02), 0, TWO_PI - 0.2*i);
    }
  } else if (type === 3) { fill(0);
    arc(cx - faceR * 0.12, cy + faceR * 0.18, faceR * 0.35, faceR * 0.18, PI, TWO_PI);
    arc(cx + faceR * 0.12, cy + faceR * 0.18, faceR * 0.35, faceR * 0.18, PI, TWO_PI);
  } else if (type === 4) { fill(255, 220, 0);
    star(cx - faceR * 0.25, cy - faceR * 0.15, faceR * 0.05, faceR * 0.11, 5);
    star(cx + faceR * 0.25, cy - faceR * 0.15, faceR * 0.05, faceR * 0.11, 5);
  } else if (type === 5) { noFill();
    arc(cx, cy + faceR * 0.18, faceR * 0.55, faceR * 0.25, 0, PI);
    noStroke(); fill(255, 80, 120);
    rect(cx - faceR * 0.08, cy + faceR * 0.22, faceR * 0.16, faceR * 0.16, 8);
    stroke(180, 0, 50); line(cx, cy + faceR * 0.22, cx, cy + faceR * 0.34);
  } else if (type === 6) {
    line(cx - faceR * 0.36, cy - faceR * 0.28, cx - faceR * 0.14, cy - faceR * 0.20);
    line(cx + faceR * 0.14, cy - faceR * 0.20, cx + faceR * 0.36, cy - faceR * 0.28);
  }
  pop();

  function star(x, y, r1, r2, n) {
    push(); beginShape(); for (let i = 0; i < n * 2; i++) { const ang = PI * i / n, rr = (i % 2 === 0) ? r2 : r1;
      vertex(x + cos(ang) * rr, y + sin(ang) * rr); } endShape(CLOSE); pop();
  }
}

/* =============================== END SKETCH =============================== */
// Press TAB for the menu. Change GITHUB_URL to point to your repository.
// Additions for Start Screen and its input are annotated with “- GPT”.
