/**
 * LINEAR ALGEBRA LAB — MASTER SIMULATION & INTERACTIVE MATHEMATICS ENGINE
 * 
 * Core Components:
 * 1. Procedural 3-Track Ambient Synthesizer (Web Audio API)
 * 2. Two-Grid Transformation Engine & Smooth I -> M Space Warping
 * 3. 17 Foundation, Transformation & Computation Modules
 * 4. Command Palette (Ctrl+K), Focus Mode, & View Perspectives
 * 5. Interactive Challenge Mode & Automated Geometric Verifiers
 * 6. Lab Notebook (Local Observations) & Deep Link URL Serialization
 * 7. High-Resolution Branded Canvas Screenshot Generator
 */

// ==========================================================================
// 1. GLOBAL STATE & DESIGN TOKENS
// ==========================================================================
const state = {
  activeExpId: 1,
  appMode: 'explore', // 'explore' | 'guided' | 'challenge'
  viewMode: 'space',  // 'space' | 'both' | 'math'
  activeChallengeId: 1,
  theme: 'dark',

  // Two-Grid & Rendering Options
  gridMode: 'both',   // 'both' | 'orig' | 'trans'
  showOriginalGrid: true,
  showTransformedGrid: true,
  showPlanes: false,
  showDropLines: true,
  showTrace: false,
  inspectMode: false,
  focusMode: false,
  
  // Transformation Flow Scrub Timeline (0.0 = Identity I, 1.0 = Target Matrix M)
  flowProgress: 1.0,
  flowPlaying: false,

  // Settings & Preferences
  reducedMotion: false,
  showStarfield: true,
  enableSfx: true,

  // Primary Vector (Exp 1, 2, 5, 8, 9, 11)
  v: { x: 3.0, y: 2.0, z: 1.0 },

  // Secondary Vectors (Exp 3, 4, 6, 7)
  a: { x: 3.0, y: 1.0, z: 0.0 },
  b: { x: 1.0, y: 2.0, z: 0.0 },

  // Scalar Multiplier (Exp 5)
  scalar: 2.0,

  // 2x2 Transformation Matrix (Exp 9, 10, 11, 13, 14, 15)
  M: { a: 1.0, b: 0.0, c: 0.0, d: 1.0 },

  // Matrix Multiplication (Exp 12)
  matRotDeg: 45,
  matShearK: 1.0,
  multOrder: 'AB', // 'AB' or 'BA'

  // Matrix Inverse Step (Exp 14: 0 = Original, 1 = Warped, 2 = Restored)
  invStep: 0,

  // Vector Cloud Batching (Exp 15)
  cloudCount: 64,
  cloudAngle: 30,

  // SIMD Hardware Lanes (Exp 16, 17)
  simdMode: 128, // 128 or 256 bit
  simdExecuted: false,
  simdScalar: 2.0
};

const COLORS = {
  axisX: 0xef4444,
  axisY: 0x10b981,
  axisZ: 0x3b82f6,
  vectorV: 0x38bdf8,
  vectorA: 0x38bdf8,
  vectorB: 0xf43f5e,
  vectorRes: 0x10b981,
  vectorProj: 0xfbbf24,
  gridOriginal: 0x182231,
  gridTransformed: 0x6366f1,
  dropLine: 0x475569,
  basisI: 0xef4444,
  basisJ: 0x10b981,
  basisK: 0x3b82f6
};

const labelTextureCache = new Map();

// Three.js Globals
let scene, camera, renderer, controls;
let dynamicObjectsGroup, baseGridGroup, transformedGridGroup, starFieldGroup;
let traceLineMesh = null;
let tracePoints = [];
let draggableMeshes = [];
let activeDragTarget = null;
let dragPlane = new THREE.Plane();
let planeIntersect = new THREE.Vector3();
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let isDragging = false;
let cameraTween = null;

// ==========================================================================
// 2. PROCEDURAL 3-TRACK SPACE AMBIENT SYNTHESIZER
// ==========================================================================
class SpaceAudioEngine {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.currentTrack = 'deep-space';
    this.volume = 0.3;
    this.masterGain = null;
    this.trackGain = null;
    this.activeNodes = [];
    this.analyser = null;
    this.customSource = null;
    this.customAudio = null;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.trackGain = this.ctx.createGain();
    this.trackGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    this.trackGain.connect(this.masterGain);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.connect(this.masterGain);
    this.trackGain.connect(this.analyser);
  }

  loadCustomTrack(url) {
    if (!url) return;
    if (this.customAudio) {
      try { this.customAudio.pause(); this.customAudio.src = ''; } catch (e) {}
    }
    this.customAudio = new Audio(url);
    this.customAudio.loop = true;
    this.customAudio.volume = 1.0;
    this.customAudio.crossOrigin = 'anonymous';
    this.currentTrack = 'custom';
    this.start();
  }

  bindCustomSource() {
    if (!this.ctx || !this.customAudio) return;
    if (this.customSource) {
      try { this.customSource.disconnect(); } catch (e) {}
    }
    const source = this.ctx.createMediaElementSource(this.customAudio);
    source.connect(this.trackGain);
    this.customSource = source;
  }

  start() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();

    if (this.currentTrack === 'custom' && this.customAudio) {
      if (this.customSource) {
        this.customAudio.play().catch(() => {});
      } else {
        this.bindCustomSource();
        this.customAudio.play().catch(() => {});
      }
      this.isPlaying = true;
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.5);
      return true;
    }

    this.stopCurrentTrack();
    this.buildTrack(this.currentTrack);
    this.isPlaying = true;
    this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.5);
    return true;
  }

  stop() {
    if (!this.isPlaying || !this.masterGain) return false;
    this.isPlaying = false;
    if (this.customAudio) {
      this.customAudio.pause();
    }
    this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    setTimeout(() => {
      if (!this.isPlaying) this.stopCurrentTrack();
    }, 500);
    return false;
  }

  toggle() {
    if (this.isPlaying) return this.stop();
    return this.start();
  }

  setVolume(val) {
    this.volume = parseFloat(val);
    if (this.isPlaying && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  switchTrack(trackName) {
    if (this.currentTrack === trackName && trackName !== 'custom') return;
    this.currentTrack = trackName;
    if (this.customAudio && trackName !== 'custom') {
      try { this.customAudio.pause(); } catch (e) {}
    }
    if (!this.isPlaying) return;

    const now = this.ctx.currentTime;
    this.trackGain.gain.setTargetAtTime(0.001, now, 0.3);
    setTimeout(() => {
      if (this.currentTrack === 'custom' && this.customAudio) {
        this.bindCustomSource();
        this.customAudio.play().catch(() => {});
      } else {
        this.stopCurrentTrack();
        this.buildTrack(trackName);
      }
      this.trackGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.5);
    }, 350);
  }

  stopCurrentTrack() {
    this.activeNodes.forEach(node => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch (e) {}
    });
    this.activeNodes = [];
  }

  buildTrack(name) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (name === 'deep-space') {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, now);
      filter.Q.setValueAtTime(3.5, now);
      filter.connect(this.trackGain);
      this.activeNodes.push(filter);

      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(0.05, now);
      lfoGain.gain.setValueAtTime(60, now);
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();
      this.activeNodes.push(lfo, lfoGain);

      [55, 110, 164.81].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.25 / (idx + 1), now);
        osc.connect(gain);
        gain.connect(filter);
        osc.start();
        this.activeNodes.push(osc, gain);
      });
    } else if (name === 'orbital') {
      const chords = [130.81, 164.81, 196.00];
      chords.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const tremolo = this.ctx.createOscillator();
        const tremGain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        tremolo.frequency.setValueAtTime(0.18 + i * 0.04, now);
        tremGain.gain.setValueAtTime(0.08, now);
        tremolo.connect(tremGain);
        tremGain.connect(gain.gain);

        gain.gain.setValueAtTime(0.15, now);
        osc.connect(gain);
        gain.connect(this.trackGain);

        osc.start();
        tremolo.start();
        this.activeNodes.push(osc, gain, tremolo, tremGain);
      });
    } else if (name === 'cosmic-drift') {
      [220, 277.18, 329.63, 440].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.06 / (idx + 1), now);

        if (panner) {
          panner.pan.setValueAtTime((idx % 2 === 0 ? 0.4 : -0.4), now);
          osc.connect(gain);
          gain.connect(panner);
          panner.connect(this.trackGain);
          this.activeNodes.push(panner);
        } else {
          osc.connect(gain);
          gain.connect(this.trackGain);
        }
        osc.start();
        this.activeNodes.push(osc, gain);
      });
    } else if (name === 'lofi-study') {
      const pad = this.ctx.createOscillator();
      pad.type = 'triangle';
      pad.frequency.setValueAtTime(174.61, now);
      const padGain = this.ctx.createGain();
      padGain.gain.setValueAtTime(0.08, now);
      pad.connect(padGain); padGain.connect(this.trackGain);
      pad.start();
      this.activeNodes.push(pad, padGain);

      const pulse = this.ctx.createOscillator();
      pulse.type = 'sawtooth';
      pulse.frequency.setValueAtTime(2.5, now);
      const pulseGain = this.ctx.createGain();
      pulseGain.gain.setTargetAtTime(0.025, now, 0.12);
      pulse.connect(pulseGain); pulseGain.connect(this.trackGain);
      pulse.start();
      this.activeNodes.push(pulse, pulseGain);
    } else if (name === 'glass-chimes') {
      [392, 523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.025 / (idx + 1), now);
        osc.connect(gain); gain.connect(this.trackGain);
        osc.start(now + idx * 0.08);
        this.activeNodes.push(osc, gain);
      });
    }
  }

  triggerChime(freq = 440) {
    if (!state.enableSfx || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(now + 0.36);
    } catch (e) {}
  }
}

const audio = new SpaceAudioEngine();

// ==========================================================================
// 3. THEME / SETTINGS
// ==========================================================================
function setTheme(themeName) {
  const normalized = themeName === 'light' ? 'light' : 'dark';
  state.theme = normalized;
  document.documentElement.classList.toggle('theme-light', normalized === 'light');
  document.documentElement.classList.toggle('theme-dark', normalized === 'dark');
  localStorage.setItem('linear_lab_theme', normalized);

  const themeToggle = document.getElementById('chkThemeMode');
  if (themeToggle) themeToggle.checked = normalized === 'light';
}

function applyPreferredTheme() {
  const saved = localStorage.getItem('linear_lab_theme');
  if (saved === 'light' || saved === 'dark') {
    setTheme(saved);
    return;
  }
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  setTheme(prefersLight ? 'light' : 'dark');
}

// ==========================================================================
// 4. THREE.JS INITIALIZATION & SCENE GRAPH
// ==========================================================================
function initScene() {
  const container = document.getElementById('viewport');
  const canvas = document.getElementById('canvas3d');

  // Check WebGL availability
  if (!window.WebGLRenderingContext) {
    document.getElementById('webglFallback').style.display = 'flex';
    return false;
  }

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x03060b, 0.022);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(7.5, 6.5, 9.5);

  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxDistance = 35;
  controls.minDistance = 2;
  controls.target.set(0, 0, 0);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
  dirLight.position.set(10, 15, 10);
  scene.add(dirLight);

  const backLight = new THREE.DirectionalLight(0x6366f1, 0.4);
  backLight.position.set(-10, -10, -10);
  scene.add(backLight);

  // Scene Hierarchy Groups
  dynamicObjectsGroup = new THREE.Group();
  scene.add(dynamicObjectsGroup);

  buildStarfield();
  buildCoordinateGrids();
  initTraceMesh();
  setupInteractionEvents();

  window.addEventListener('resize', onWindowResize);
  return true;
}

function buildStarfield() {
  starFieldGroup = new THREE.Group();
  const starCount = 350;
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const r = 25 + Math.random() * 25;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    const shade = 0.4 + Math.random() * 0.45;
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade * 1.05;
    colors[i * 3 + 2] = shade * 1.2;
  }

  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.18,
    vertexColors: true,
    transparent: true,
    opacity: 0.65
  });

  const stars = new THREE.Points(geom, mat);
  starFieldGroup.add(stars);
  scene.add(starFieldGroup);
}

function buildCoordinateGrids() {
  baseGridGroup = new THREE.Group();

  // Original Coordinate Floor Grid on XY plane
  const gridHelper = new THREE.GridHelper(16, 16, 0x223247, 0x0e1726);
  gridHelper.rotation.x = Math.PI / 2;
  baseGridGroup.add(gridHelper);

  // Coordinate Axes
  const axisLen = 7.5;
  const origin = new THREE.Vector3(0, 0, 0);

  const arrowX = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), origin, axisLen, COLORS.axisX, 0.22, 0.07);
  const arrowY = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), origin, axisLen, COLORS.axisY, 0.22, 0.07);
  const arrowZ = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), origin, axisLen, COLORS.axisZ, 0.22, 0.07);
  baseGridGroup.add(arrowX, arrowY, arrowZ);

  // 3D Axis Labels
  create3DLabel('X', new THREE.Vector3(axisLen + 0.3, 0, 0), '#ef4444', baseGridGroup);
  create3DLabel('Y', new THREE.Vector3(0, axisLen + 0.3, 0), '#10b981', baseGridGroup);
  create3DLabel('Z', new THREE.Vector3(0, 0, axisLen + 0.3), '#3b82f6', baseGridGroup);

  scene.add(baseGridGroup);

  transformedGridGroup = new THREE.Group();
  scene.add(transformedGridGroup);
}

function create3DLabel(text, pos, colorHexStr, parentGroup = dynamicObjectsGroup) {
  const cacheKey = `${text}|${colorHexStr}`;
  let texture = labelTextureCache.get(cacheKey);
  if (!texture) {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    const fontSize = 36;
    tempCtx.font = `600 ${fontSize}px "JetBrains Mono", monospace`;
    const textMetrics = tempCtx.measureText(text);
    const textWidth = Math.ceil(textMetrics.width);
    const padX = 22;
    const cWidth = Math.max(80, textWidth + padX * 2);
    const cHeight = 60;

    const canvas = document.createElement('canvas');
    canvas.width = cWidth;
    canvas.height = cHeight;
    const ctx = canvas.getContext('2d');
    ctx.font = `600 ${fontSize}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (text.length > 2) {
      ctx.fillStyle = 'rgba(7, 12, 20, 0.75)';
      ctx.beginPath();
      ctx.roundRect(4, 4, cWidth - 8, cHeight - 8, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.fillStyle = colorHexStr;
    ctx.fillText(text, cWidth / 2, cHeight / 2);

    texture = new THREE.CanvasTexture(canvas);
    labelTextureCache.set(cacheKey, texture);
  }

  const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true, opacity: 0.92 });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.copy(pos);
  const aspect = 1;
  const hScale = 0.36;
  sprite.scale.set(hScale * aspect, hScale, 1);
  parentGroup.add(sprite);
  return sprite;
}

// ... full file continues unchanged below ...

// ==========================================================================
// 14. 3D RAYCASTING & OBJECT DRAGGING
// ==========================================================================
function setupInteractionEvents() {
  const canvas = renderer.domElement;

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(draggableMeshes, true);

    if (intersects.length > 0) {
      let target = intersects[0].object;
      while (target && !target.userData.isDraggable && target.parent) {
        target = target.parent;
      }

      if (target && target.userData.isDraggable) {
        isDragging = true;
        activeDragTarget = target;
        controls.enabled = false;

        const normal = new THREE.Vector3(0, 0, 1);
        dragPlane.setFromNormalAndCoplanarPoint(normal, activeDragTarget.position);
      }
    } else if (state.inspectMode) {
      const allDynamic = raycaster.intersectObjects(dynamicObjectsGroup.children, true);
      if (allDynamic.length > 0) {
        showInspectHud(allDynamic[0].object, e.clientX, e.clientY);
      }
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (!isDragging || !activeDragTarget) return;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(dragPlane, planeIntersect)) {
      const snapX = Math.round(planeIntersect.x * 2) / 2;
      const snapY = Math.round(planeIntersect.y * 2) / 2;

      const tag = activeDragTarget.userData.idTag;
      if (tag === 'v') {
        state.v.x = snapX;
        state.v.y = snapY;
        const sx = document.getElementById('sl_vx'); if (sx) sx.value = snapX;
        const sy = document.getElementById('sl_vy'); if (sy) sy.value = snapY;
      } else if (tag === 'a') {
        state.a.x = snapX;
        state.a.y = snapY;
        const sx = document.getElementById('sl_ax'); if (sx) sx.value = snapX;
        const sy = document.getElementById('sl_ay'); if (sy) sy.value = snapY;
      } else if (tag === 'b') {
        state.b.x = snapX;
        state.b.y = snapY;
        const sx = document.getElementById('sl_bx'); if (sx) sx.value = snapX;
        const sy = document.getElementById('sl_by'); if (sy) sy.value = snapY;
      }

      renderActiveExperimentGraphics();
    }
  });

  window.addEventListener('pointerup', () => {
    if (isDragging) {
      isDragging = false;
      activeDragTarget = null;
      controls.enabled = true;
    }
  });
}

function showInspectHud(obj, clientX, clientY) {
  const hud = document.getElementById('inspectHud');
  const title = document.getElementById('inspectTargetName');
  const content = document.getElementById('inspectContent');

  let parentGroup = obj;
  while (parentGroup && !parentGroup.userData.name && parentGroup.parent) {
    parentGroup = parentGroup.parent;
  }

  const name = parentGroup.userData.name || '3D Object';
  title.innerText = name;
  content.innerHTML = `Position: (${obj.position.x.toFixed(2)}, ${obj.position.y.toFixed(2)}, ${obj.position.z.toFixed(2)})<br>Active Experiment: #${state.activeExpId}`;

  hud.style.left = `${Math.min(window.innerWidth - 220, clientX + 15)}px`;
  hud.style.top = `${Math.min(window.innerHeight - 150, clientY + 15)}px`;
  hud.style.display = 'block';
}

// ==========================================================================
// 15. DOM BINDINGS & KEYBOARD SHORTCUTS
// ==========================================================================
function setupUIEventListeners() {
  // Theme
  const themeToggle = document.getElementById('chkThemeMode');
  if (themeToggle) {
    themeToggle.addEventListener('change', (e) => setTheme(e.target.checked ? 'light' : 'dark'));
  }

  // Audio upload
  const uploadInput = document.getElementById('audioUploadInput');
  const uploadBtn = document.getElementById('btnUploadTrack');
  if (uploadBtn && uploadInput) {
    uploadBtn.addEventListener('click', () => uploadInput.click());
    uploadInput.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      audio.loadCustomTrack(url);
      showToast(`📁 Loaded custom track: ${file.name}`);
      const status = document.getElementById('audioTrackStatus');
      if (status) status.innerText = 'Custom';
    });
  }

  // Command Palette Trigger
  document.getElementById('btnCommandPalette').addEventListener('click', openCommandPalette);

  const paletteInput = document.getElementById('paletteSearchInput');
  paletteInput.addEventListener('input', (e) => filterPaletteCommands(e.target.value));
  paletteInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      paletteSelectedIndex = Math.min(paletteFilteredItems.length - 1, paletteSelectedIndex + 1);
      renderPaletteResults();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      paletteSelectedIndex = Math.max(0, paletteSelectedIndex - 1);
      renderPaletteResults();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executePaletteItem(paletteSelectedIndex);
    } else if (e.key === 'Escape') {
      closeAllModals();
    }
  });

  // Focus Mode
  document.getElementById('btnFocusMode').addEventListener('click', toggleFocusMode);
  document.getElementById('btnExitFocus').addEventListener('click', toggleFocusMode);

  // View Mode Selector (SPACE / BOTH / MATH)
  document.querySelectorAll('.view-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setViewMode(btn.dataset.view));
  });
  document.getElementById('btnCloseMathHud').addEventListener('click', () => setViewMode('space'));

  // Camera Popover & Perspectives
  const camPopover = document.getElementById('cameraViewPopover');
  document.getElementById('btnCameraMenu').addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = camPopover.classList.contains('open');
    closeAllModals();
    if (!isOpen) camPopover.classList.add('open');
  });

  document.querySelectorAll('.menu-item-btn[data-cam]').forEach(btn => {
    btn.addEventListener('click', () => setCameraPerspective(btn.dataset.cam));
  });

  // Audio Popover & Synthesizer
  const audioPopover = document.getElementById('audioPopover');
  document.getElementById('btnAudioMenu').addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = audioPopover.classList.contains('open');
    closeAllModals();
    if (!isOpen) audioPopover.classList.add('open');
  });

  document.getElementById('btnToggleAudioPlayback').addEventListener('click', toggleAudioPlayback);

  document.querySelectorAll('.track-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.track-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      audio.switchTrack(opt.dataset.track);
      const statusEl = document.getElementById('audioTrackStatus');
      if (statusEl) statusEl.innerText = opt.dataset.track.replace(/-/g, ' ');
    });
  });

  document.getElementById('audioVolumeInput').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    audio.setVolume(val);
    document.getElementById('val_audioVolume').innerText = `${Math.round(val * 100)}%`;
  });

  // Two-Grid Popover
  const gridPopover = document.getElementById('gridPopover');
  document.getElementById('btnGridMenu').addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = gridPopover.classList.contains('open');
    closeAllModals();
    if (!isOpen) gridPopover.classList.add('open');
  });

  document.querySelectorAll('.grid-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.grid-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.gridmode;
      state.gridMode = mode;
      state.showOriginalGrid = mode === 'both' || mode === 'orig';
      state.showTransformedGrid = mode === 'both' || mode === 'trans';
      document.getElementById('chkOriginalGrid').checked = state.showOriginalGrid;
      document.getElementById('chkTransformedGrid').checked = state.showTransformedGrid;
      baseGridGroup.visible = state.showOriginalGrid;
      renderActiveExperimentGraphics();
    });
  });

  document.getElementById('chkOriginalGrid').addEventListener('change', (e) => {
    state.showOriginalGrid = e.target.checked;
    baseGridGroup.visible = state.showOriginalGrid;
  });

  document.getElementById('chkTransformedGrid').addEventListener('change', (e) => {
    state.showTransformedGrid = e.target.checked;
    renderActiveExperimentGraphics();
  });

  document.getElementById('chkDropLines').addEventListener('change', (e) => {
    state.showDropLines = e.target.checked;
    renderActiveExperimentGraphics();
  });

  document.getElementById('chkTraceMode').addEventListener('change', (e) => {
    state.showTrace = e.target.checked;
    if (!state.showTrace) clearTrace();
  });

  document.getElementById('btnTransformationFlow').addEventListener('click', toggleFlowPlayback);

  // Flow scrub timeline slider
  document.getElementById('sl_flowProgress').addEventListener('input', (e) => {
    state.flowPlaying = false;
    document.getElementById('btnPlayFlow').innerText = '▶';
    setFlowProgress(parseFloat(e.target.value));
  });
  document.getElementById('btnPlayFlow').addEventListener('click', toggleFlowPlayback);

  // Inspector Mode Toggle
  document.getElementById('btnInspectMode').addEventListener('click', () => {
    state.inspectMode = !state.inspectMode;
    document.getElementById('btnInspectMode').classList.toggle('active', state.inspectMode);
    showToast(state.inspectMode ? '🔍 Inspect Mode: Click any 3D object' : 'Inspect Mode disabled');
  });
  document.getElementById('inspectCloseBtn').addEventListener('click', () => {
    document.getElementById('inspectHud').style.display = 'none';
  });

  // Explorer Modal
  document.getElementById('btnOpenExplorer').addEventListener('click', () => {
    closeAllModals();
    buildExplorerCardGrid();
    document.getElementById('explorerModal').classList.add('open');
  });
  document.getElementById('btnCloseExplorer').addEventListener('click', () => {
    document.getElementById('explorerModal').classList.remove('open');
  });
  document.getElementById('expIndicatorCard').addEventListener('click', () => {
    closeAllModals();
    buildExplorerCardGrid();
    document.getElementById('explorerModal').classList.add('open');
  });

  document.getElementById('explorerSearchInput').addEventListener('input', (e) => {
    buildExplorerCardGrid(e.target.value);
  });

  // Mathematical Info Modal
  document.getElementById('btnInfoModal').addEventListener('click', () => {
    closeAllModals();
    document.getElementById('infoModal').classList.add('open');
  });
  document.getElementById('btnCloseInfo').addEventListener('click', () => {
    document.getElementById('infoModal').classList.remove('open');
  });

  // Lab Notebook
  document.getElementById('btnOpenNotebook').addEventListener('click', () => {
    closeAllModals();
    renderNotebookModal();
    document.getElementById('notebookModal').classList.add('open');
  });
  document.getElementById('btnCloseNotebook').addEventListener('click', () => {
    document.getElementById('notebookModal').classList.remove('open');
  });
  document.getElementById('btnSaveObservation').addEventListener('click', () => saveCurrentObservation());
  document.getElementById('btnSaveCurrentState').addEventListener('click', () => {
    const input = document.getElementById('notebookNoteInput');
    saveCurrentObservation(input.value.trim());
    input.value = '';
  });

  // Settings Modal
  document.getElementById('btnSettingsModal').addEventListener('click', () => {
    closeAllModals();
    document.getElementById('settingsModal').classList.add('open');
  });
  document.getElementById('btnCloseSettings').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('open');
  });

  document.getElementById('chkReducedMotion').addEventListener('change', (e) => {
    state.reducedMotion = e.target.checked;
  });
  document.getElementById('chkStarfield').addEventListener('change', (e) => {
    state.showStarfield = e.target.checked;
    starFieldGroup.visible = state.showStarfield;
  });
  document.getElementById('chkSfx').addEventListener('change', (e) => {
    state.enableSfx = e.target.checked;
  });
  document.getElementById('btnClearStorage').addEventListener('click', () => {
    localStorage.clear();
    showToast('Local storage cleared');
    renderNotebookModal();
  });

  // Share & Screenshot
  document.getElementById('btnShareLink').addEventListener('click', serializeStateToUrl);
  document.getElementById('btnCaptureScreenshot').addEventListener('click', captureCanvasScreenshot);

  // Mode Selectors (Explore, Guided, Challenge)
  document.getElementById('btnModeExplore').addEventListener('click', () => setAppMode('explore'));
  document.getElementById('btnModeGuided').addEventListener('click', () => setAppMode('guided'));
  document.getElementById('btnModeChallenge').addEventListener('click', () => setAppMode('challenge'));

  // Guided Stepper Navigation
  document.getElementById('btnGuidedPrev').addEventListener('click', () => {
    const prevId = state.activeExpId > 1 ? state.activeExpId - 1 : 17;
    switchExperiment(prevId);
  });
  document.getElementById('btnGuidedNext').addEventListener('click', () => {
    const nextId = state.activeExpId < 17 ? state.activeExpId + 1 : 1;
    switchExperiment(nextId);
  });

  // Contextual Panel Collapse Toggle
  document.getElementById('btnTogglePanelCollapse').addEventListener('click', () => {
    document.getElementById('contextualPanel').classList.toggle('collapsed');
  });
  document.getElementById('btnResetExpParams').addEventListener('click', () => {
    switchExperiment(state.activeExpId);
    showToast('↺ Parameters reset to default');
  });

  // Landing Page Overlay
  document.getElementById('btnEnterLab').addEventListener('click', () => {
    document.getElementById('landingOverlay').style.display = 'none';
    audio.start();
    document.getElementById('audioTrackStatus').innerText = 'Playing';
    document.getElementById('audioTrackStatus').style.color = 'var(--accent-emerald)';
    document.getElementById('btnToggleAudioPlayback').innerText = 'Pause Ambient Audio';
  });

  document.querySelectorAll('.domain-card').forEach(card => {
    card.addEventListener('click', () => {
      const domain = card.dataset.domain;
      document.getElementById('landingOverlay').style.display = 'none';
      if (domain === 'vectors') switchExperiment(1);
      else if (domain === 'transformations') switchExperiment(9);
      else if (domain === 'computation') switchExperiment(15);
      audio.start();
    });
  });

  // Close modals on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeAllModals();
    });
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openCommandPalette();
    } else if (e.key === '/') {
      e.preventDefault();
      openCommandPalette();
    } else if (e.key.toLowerCase() === 'e') {
      document.getElementById('btnOpenExplorer').click();
    } else if (e.key.toLowerCase() === 'g') {
      document.getElementById('btnGridMenu').click();
    } else if (e.key.toLowerCase() === 'm') {
      toggleAudioPlayback();
    } else if (e.key.toLowerCase() === 'f') {
      toggleFocusMode();
    } else if (e.key.toLowerCase() === 'i') {
      document.getElementById('btnInfoModal').click();
    } else if (e.key.toLowerCase() === 'r') {
      setCameraPerspective('reset');
    } else if (e.key === 'Escape') {
      if (state.focusMode) toggleFocusMode();
      else closeAllModals();
    } else if (e.key === ' ') {
      e.preventDefault();
      toggleFlowPlayback();
    }
  });
}

function toggleAudioPlayback() {
  const isPlaying = audio.toggle();
  const statusEl = document.getElementById('audioTrackStatus');
  const btnEl = document.getElementById('btnToggleAudioPlayback');
  if (statusEl) {
    statusEl.innerText = isPlaying ? 'Playing' : 'Off';
    statusEl.style.color = isPlaying ? 'var(--accent-emerald)' : 'var(--accent-indigo)';
  }
  if (btnEl) {
    btnEl.innerText = isPlaying ? 'Pause Ambient Audio' : 'Start Ambient Audio';
  }
}

// ==========================================================================
// 16. MAIN RAF SIMULATION & ANIMATION LOOP
// ==========================================================================
function animate(time) {
  requestAnimationFrame(animate);

  // Smooth camera perspective tweening
  if (cameraTween) {
    cameraTween.update(time);
  } else {
    controls.update();
  }

  // Smooth Transformation Flow Animation
  if (state.flowPlaying) {
    state.flowProgress += 0.008;
    if (state.flowProgress >= 1.0) {
      state.flowProgress = 1.0;
      state.flowPlaying = false;
      const btn = document.getElementById('btnPlayFlow');
      if (btn) btn.innerText = '▶';
    }
    setFlowProgress(state.flowProgress);
  }

  // Subtle Starfield Parallax Rotation
  if (starFieldGroup && state.showStarfield && !state.reducedMotion) {
    starFieldGroup.rotation.y = time * 0.00003;
    starFieldGroup.rotation.x = time * 0.000015;
  }

  renderer.render(scene, camera);
}

// ==========================================================================
// 17. APPLICATION INITIALIZATION
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
  applyPreferredTheme();
  if (initScene()) {
    deserializeStateFromUrl();
    setupUIEventListeners();
    switchExperiment(state.activeExpId);
    animate(0);
  }
});


// NOTE:
// The rest of the file remains exactly as in the original project; the inserted
// theme/audio helpers above are intentionally compact and compatible with the
// existing structure.
