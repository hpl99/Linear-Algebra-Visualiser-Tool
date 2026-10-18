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
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume();

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
  try { localStorage.setItem('linear_lab_theme', normalized); } catch (e) {}
  if (scene && scene.fog) scene.fog.color.set(normalized === 'light' ? 0xf5f7fa : 0x03060b);

  const themeToggle = document.getElementById('chkThemeMode');
  if (themeToggle) themeToggle.checked = normalized === 'light';
}

function applyPreferredTheme() {
  let saved = null;
  try { saved = localStorage.getItem('linear_lab_theme'); } catch (e) {}
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
  let webglOk = false;
  try {
    const probe = document.createElement('canvas');
    webglOk = !!(window.WebGLRenderingContext && (probe.getContext('webgl') || probe.getContext('experimental-webgl')));
  } catch (e) { webglOk = false; }
  if (!webglOk || typeof THREE === 'undefined' || !THREE.OrbitControls) {
    const fb = document.getElementById('webglFallback');
    if (fb) fb.style.display = 'flex';
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
      if (ctx.roundRect) ctx.roundRect(4, 4, cWidth - 8, cHeight - 8, 10); else ctx.rect(4, 4, cWidth - 8, cHeight - 8);
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


// ==========================================================================
// 5. MATH, STATE HELPERS & SCENE UTILITIES
// ==========================================================================
const DEFAULT_PARAMS = JSON.parse(JSON.stringify({
  v: state.v, a: state.a, b: state.b, scalar: state.scalar, M: state.M,
  matRotDeg: state.matRotDeg, matShearK: state.matShearK, multOrder: state.multOrder,
  invStep: state.invStep, cloudCount: state.cloudCount, cloudAngle: state.cloudAngle,
  simdMode: state.simdMode, simdExecuted: state.simdExecuted, simdScalar: state.simdScalar,
  flowProgress: 1.0
}));

const O = new THREE.Vector3(0, 0, 0);
const V3 = (p) => new THREE.Vector3(p.x, p.y, p.z || 0);
const pad2 = (n) => String(n).padStart(2, '0');
const fmt = (n, d = 2) => (Math.abs(n) < 0.5 * Math.pow(10, -d) ? 0 : n).toFixed(d);
const cssHex = (c) => '#' + c.toString(16).padStart(6, '0');
const I2 = { a: 1, b: 0, c: 0, d: 1 };

const mat2 = {
  det: (m) => m.a * m.d - m.b * m.c,
  mul: (A, B) => ({
    a: A.a * B.a + A.b * B.c, b: A.a * B.b + A.b * B.d,
    c: A.c * B.a + A.d * B.c, d: A.c * B.b + A.d * B.d
  }),
  apply: (m, p) => ({ x: m.a * p.x + m.b * p.y, y: m.c * p.x + m.d * p.y, z: p.z || 0 }),
  lerp: (m, t) => ({
    a: 1 + t * (m.a - 1), b: t * m.b, c: t * m.c, d: 1 + t * (m.d - 1)
  }),
  inv: (m) => {
    const det = m.a * m.d - m.b * m.c;
    if (Math.abs(det) < 1e-6) return null;
    return { a: m.d / det, b: -m.b / det, c: -m.c / det, d: m.a / det };
  },
  rot: (deg) => {
    const r = deg * Math.PI / 180;
    return { a: Math.cos(r), b: -Math.sin(r), c: Math.sin(r), d: Math.cos(r) };
  },
  shear: (k) => ({ a: 1, b: k, c: 0, d: 1 })
};

const dot3 = (p, q) => p.x * q.x + p.y * q.y + p.z * q.z;
const len3 = (p) => Math.sqrt(dot3(p, p));
const cross3 = (p, q) => ({
  x: p.y * q.z - p.z * q.y, y: p.z * q.x - p.x * q.z, z: p.x * q.y - p.y * q.x
});

function showToast(msg) {
  const host = document.getElementById('toastContainer');
  if (!host) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  host.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2400);
}

function clearGroup(g) {
  for (let i = g.children.length - 1; i >= 0; i--) {
    const o = g.children[i];
    g.remove(o);
    o.traverse((n) => {
      if (n.geometry) n.geometry.dispose();
      if (n.material && n.material.dispose) n.material.dispose();
    });
  }
}

function setMatOpacity(obj, opacity) {
  obj.traverse((n) => {
    if (n.material) { n.material.transparent = true; n.material.opacity = opacity; }
  });
}

function addArrow(from, to, color, name, opts = {}) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  if (len > 1e-4) {
    const h = Math.min(0.3, len * 0.45);
    const arrow = new THREE.ArrowHelper(dir.clone().normalize(), from, len, color, h, h * 0.45);
    arrow.userData.name = name;
    if (opts.opacity !== undefined) setMatOpacity(arrow, opts.opacity);
    dynamicObjectsGroup.add(arrow);
  }
  if (opts.tag) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 20, 20),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35 })
    );
    s.position.copy(to);
    s.userData = { isDraggable: true, idTag: opts.tag, name: name + ' (drag handle)' };
    dynamicObjectsGroup.add(s);
    draggableMeshes.push(s);
  }
  if (opts.label) {
    create3DLabel(opts.label, to.clone().add(new THREE.Vector3(0.3, 0.35, 0)), cssHex(color), dynamicObjectsGroup);
  }
}

function addLines(pts, color, opacity = 1, name = 'Guide', dashed = false) {
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const m = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  const l = new THREE.LineSegments(g, m);
  if (dashed) l.computeLineDistances();
  l.userData.name = name;
  dynamicObjectsGroup.add(l);
  return l;
}

function addQuad(p0, p1, p2, p3, color, opacity, name) {
  const g = new THREE.BufferGeometry();
  const v = [p0, p1, p2, p0, p2, p3];
  g.setFromPoints(v);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false
  }));
  m.userData.name = name;
  dynamicObjectsGroup.add(m);
}

function addDropLines(p, color = COLORS.dropLine) {
  if (!state.showDropLines) return;
  const f = new THREE.Vector3(p.x, p.y, 0);
  addLines([p, f, f, new THREE.Vector3(p.x, 0, 0), f, new THREE.Vector3(0, p.y, 0)], color, 0.7, 'Drop lines', true);
}

function addInstanced(points, color, radius, opacity, name) {
  const n = points.length;
  if (!n) return;
  const mesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(radius, 10, 10),
    new THREE.MeshStandardMaterial({ color, transparent: true, opacity }), n
  );
  const d = new THREE.Object3D();
  points.forEach((p, i) => { d.position.set(p.x, p.y, p.z || 0); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix); });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.name = name;
  dynamicObjectsGroup.add(mesh);
}

function addBasisImages(Mt, opacity = 1, labels = true) {
  addArrow(O, new THREE.Vector3(Mt.a, Mt.c, 0), COLORS.basisI, 'Transformed î', { opacity, label: labels ? "î'" : null });
  addArrow(O, new THREE.Vector3(Mt.b, Mt.d, 0), COLORS.basisJ, 'Transformed ĵ', { opacity, label: labels ? "ĵ'" : null });
}

// --- Trace
function initTraceMesh() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(400 * 3), 3));
  g.setDrawRange(0, 0);
  traceLineMesh = new THREE.Line(g, new THREE.LineBasicMaterial({ color: COLORS.vectorProj }));
  traceLineMesh.frustumCulled = false;
  scene.add(traceLineMesh);
}

function pushTracePoint(p) {
  if (!traceLineMesh) return;
  tracePoints.push(new THREE.Vector3(p.x, p.y, p.z || 0));
  if (tracePoints.length > 400) tracePoints.shift();
  const arr = traceLineMesh.geometry.attributes.position.array;
  tracePoints.forEach((q, i) => { arr[i * 3] = q.x; arr[i * 3 + 1] = q.y; arr[i * 3 + 2] = q.z; });
  traceLineMesh.geometry.attributes.position.needsUpdate = true;
  traceLineMesh.geometry.setDrawRange(0, tracePoints.length);
}

function clearTrace() {
  tracePoints = [];
  if (traceLineMesh) traceLineMesh.geometry.setDrawRange(0, 0);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Transformed grid (two-grid system)
function updateTransformedGrid(Mt, exp) {
  clearGroup(transformedGridGroup);
  if (!exp.grid || !state.showTransformedGrid) return;
  const pts = [], axisPts = [], R = 8;
  for (let i = -R; i <= R; i++) {
    const target = i === 0 ? axisPts : pts;
    const v1 = mat2.apply(Mt, { x: i, y: -R }), v2 = mat2.apply(Mt, { x: i, y: R });
    const h1 = mat2.apply(Mt, { x: -R, y: i }), h2 = mat2.apply(Mt, { x: R, y: i });
    target.push(V3(v1), V3(v2), V3(h1), V3(h2));
  }
  const mk = (p, op) => {
    if (!p.length) return;
    transformedGridGroup.add(new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(p),
      new THREE.LineBasicMaterial({ color: COLORS.gridTransformed, transparent: true, opacity: op })
    ));
  };
  mk(pts, 0.45);
  mk(axisPts, 0.95);
}

// ==========================================================================
// 6. EXPERIMENT DEFINITIONS (17 MODULES)
// ==========================================================================
function vecCtls(key, label, rng = 6) {
  return ['x', 'y', 'z'].map((c) => ({
    type: 'slider', id: `sl_${key}${c}`, label: `${label}${c}`,
    min: -rng, max: rng, step: 0.5,
    get: () => state[key][c], set: (v) => { state[key][c] = v; }
  }));
}

function matCtls() {
  return [['a', 'M₁₁'], ['b', 'M₁₂'], ['c', 'M₂₁'], ['d', 'M₂₂']].map(([k, l]) => ({
    type: 'slider', id: `sl_M${k}`, label: l, min: -3, max: 3, step: 0.1,
    get: () => state.M[k], set: (v) => { state.M[k] = v; }
  }));
}

const setM = (a, b, c, d) => () => { state.M = { a, b, c, d }; state.flowProgress = 1; };
const C45 = Math.SQRT1_2;
const MAT_PRESETS = [
  { label: 'Identity', apply: setM(1, 0, 0, 1) },
  { label: 'Rotate 45°', apply: setM(C45, -C45, C45, C45) },
  { label: 'Shear', apply: setM(1, 1, 0, 1) },
  { label: 'Scale ×2', apply: setM(2, 0, 0, 2) },
  { label: 'Reflect', apply: setM(-1, 0, 0, 1) },
  { label: 'Singular', apply: setM(1, 2, 0.5, 1) }
];

const setV = (x, y, z) => () => { state.v = { x, y, z }; };
const VEC_PRESETS = [
  { label: '(3,2,1)', apply: setV(3, 2, 1) },
  { label: '(4,3,0)', apply: setV(4, 3, 0) },
  { label: '(-2,3,2)', apply: setV(-2, 3, 2) }
];
const setAB = (a, b) => () => { state.a = { ...a }; state.b = { ...b }; };
const AB_PRESETS = [
  { label: 'Default', apply: setAB({ x: 3, y: 1, z: 0 }, { x: 1, y: 2, z: 0 }) },
  { label: 'Perpendicular', apply: setAB({ x: 2, y: 2, z: 0 }, { x: -2, y: 2, z: 0 }) },
  { label: 'Parallel', apply: setAB({ x: 2, y: 1, z: 0 }, { x: 4, y: 2, z: 0 }) }
];

const execBtn = () => ({
  type: 'button', label: state.simdExecuted ? '↺ Reset result' : '▶ Execute operation',
  onClick: () => { state.simdExecuted = !state.simdExecuted; buildPanel(getExp()); renderActiveExperimentGraphics(); }
});

const EXPS = [
  {
    id: 1, cat: 'FOUNDATIONS', title: 'A Vector',
    desc: 'A vector is an arrow from the origin: three numbers describing a direction and a length. Drag the sphere or use the sliders.',
    controls: () => vecCtls('v', 'v'), presets: VEC_PRESETS,
    render() { const p = V3(state.v); addArrow(O, p, COLORS.vectorV, 'Vector v', { tag: 'v', label: 'v' }); addDropLines(p); },
    formula: () => 'v = x·î + y·ĵ + z·k̂',
    calc: () => `v = (${fmt(state.v.x)}, ${fmt(state.v.y)}, ${fmt(state.v.z)})`,
    metrics: () => [['x', fmt(state.v.x)], ['y', fmt(state.v.y)], ['z', fmt(state.v.z)], ['|v|', fmt(len3(state.v))]]
  },
  {
    id: 2, cat: 'FOUNDATIONS', title: 'Vector Length (Magnitude)',
    desc: 'Length comes from Pythagoras in 3D: square each component, add, take the square root.',
    controls: () => vecCtls('v', 'v'), presets: VEC_PRESETS,
    render() {
      const p = V3(state.v);
      addArrow(O, p, COLORS.vectorV, 'Vector v', { tag: 'v', label: `|v|=${fmt(len3(state.v))}` });
      const f = new THREE.Vector3(p.x, p.y, 0);
      addLines([O, f, f, p], COLORS.vectorProj, 0.9, 'Pythagoras legs', true);
    },
    formula: () => '|v| = √(x² + y² + z²)',
    calc: () => `|v| = √(${fmt(state.v.x)}² + ${fmt(state.v.y)}² + ${fmt(state.v.z)}²) = ${fmt(len3(state.v))}`,
    metrics: () => [['|v|', fmt(len3(state.v))], ['|v|²', fmt(dot3(state.v, state.v))]]
  },
  {
    id: 3, cat: 'FOUNDATIONS', title: 'Vector Addition (a + b)',
    desc: 'Add components, or place b at the tip of a. Both routes land on the same point (the parallelogram rule).',
    controls: () => [...vecCtls('a', 'a'), ...vecCtls('b', 'b')], presets: AB_PRESETS,
    render() {
      const a = V3(state.a), b = V3(state.b), r = a.clone().add(b);
      addArrow(O, a, COLORS.vectorA, 'Vector a', { tag: 'a', label: 'a' });
      addArrow(O, b, COLORS.vectorB, 'Vector b', { tag: 'b', label: 'b' });
      addArrow(a, r, COLORS.vectorB, 'b shifted', { opacity: 0.4 });
      addArrow(b, r, COLORS.vectorA, 'a shifted', { opacity: 0.4 });
      addArrow(O, r, COLORS.vectorRes, 'a + b', { label: 'a+b' });
    },
    formula: () => 'a + b = (aₓ+bₓ, a_y+b_y, a_z+b_z)',
    calc: () => `a + b = (${fmt(state.a.x + state.b.x)}, ${fmt(state.a.y + state.b.y)}, ${fmt(state.a.z + state.b.z)})`,
    metrics: () => [['|a|', fmt(len3(state.a))], ['|b|', fmt(len3(state.b))],
      ['|a+b|', fmt(len3({ x: state.a.x + state.b.x, y: state.a.y + state.b.y, z: state.a.z + state.b.z }))]]
  },
  {
    id: 4, cat: 'FOUNDATIONS', title: 'Vector Subtraction (a − b)',
    desc: 'a − b is the arrow that starts at the tip of b and ends at the tip of a: "how do I get from b to a?"',
    controls: () => [...vecCtls('a', 'a'), ...vecCtls('b', 'b')], presets: AB_PRESETS,
    render() {
      const a = V3(state.a), b = V3(state.b);
      addArrow(O, a, COLORS.vectorA, 'Vector a', { tag: 'a', label: 'a' });
      addArrow(O, b, COLORS.vectorB, 'Vector b', { tag: 'b', label: 'b' });
      addArrow(b, a, COLORS.vectorRes, 'a − b (from b to a)', { label: 'a−b' });
      addArrow(O, a.clone().sub(b), COLORS.vectorRes, 'a − b at origin', { opacity: 0.45 });
    },
    formula: () => 'a − b = (aₓ−bₓ, a_y−b_y, a_z−b_z)',
    calc: () => `a − b = (${fmt(state.a.x - state.b.x)}, ${fmt(state.a.y - state.b.y)}, ${fmt(state.a.z - state.b.z)})`,
    metrics: () => [['|a−b|', fmt(len3({ x: state.a.x - state.b.x, y: state.a.y - state.b.y, z: state.a.z - state.b.z }))]]
  },
  {
    id: 5, cat: 'FOUNDATIONS', title: 'Scalar Multiplication',
    desc: 'Multiplying by a scalar stretches (|s|>1), shrinks (|s|<1) or flips (s<0) a vector, without changing its line.',
    controls: () => [...vecCtls('v', 'v'), {
      type: 'slider', id: 'sl_scalar', label: 's', min: -3, max: 3, step: 0.5,
      get: () => state.scalar, set: (v) => { state.scalar = v; }
    }], presets: VEC_PRESETS,
    render() {
      const p = V3(state.v), q = p.clone().multiplyScalar(state.scalar);
      addArrow(O, p, COLORS.vectorV, 'Vector v', { tag: 'v', label: 'v' });
      addArrow(O, q, COLORS.vectorRes, 's·v', { label: 's·v' });
    },
    formula: () => 's·v = (s·x, s·y, s·z)',
    calc: () => `${fmt(state.scalar)} · (${fmt(state.v.x)}, ${fmt(state.v.y)}, ${fmt(state.v.z)}) = (${fmt(state.scalar * state.v.x)}, ${fmt(state.scalar * state.v.y)}, ${fmt(state.scalar * state.v.z)})`,
    metrics: () => [['s', fmt(state.scalar)], ['|v|', fmt(len3(state.v))], ['|s·v|', fmt(Math.abs(state.scalar) * len3(state.v))]]
  },
  {
    id: 6, cat: 'FOUNDATIONS', title: 'Dot Product & Projection',
    desc: 'a·b measures alignment. It is 0 when the vectors are perpendicular; the amber arrow is the shadow of a on b.',
    controls: () => [...vecCtls('a', 'a'), ...vecCtls('b', 'b')], presets: AB_PRESETS,
    render() {
      const a = V3(state.a), b = V3(state.b), bb = dot3(state.b, state.b);
      addArrow(O, a, COLORS.vectorA, 'Vector a', { tag: 'a', label: 'a' });
      addArrow(O, b, COLORS.vectorB, 'Vector b', { tag: 'b', label: 'b' });
      if (bb > 1e-9) {
        const proj = b.clone().multiplyScalar(dot3(state.a, state.b) / bb);
        addArrow(O, proj, COLORS.vectorProj, 'Projection of a on b', { label: 'proj' });
        addLines([a, proj], COLORS.vectorProj, 0.8, 'Perpendicular drop', true);
      }
    },
    formula: () => 'a·b = aₓbₓ + a_yb_y + a_zb_z = |a||b|cos θ',
    calc: () => `a·b = ${fmt(dot3(state.a, state.b))},  θ = ${fmt(angleDeg(state.a, state.b), 1)}°`,
    metrics: () => [['a·b', fmt(dot3(state.a, state.b))], ['θ', fmt(angleDeg(state.a, state.b), 1) + '°'],
      ['Perpendicular?', Math.abs(dot3(state.a, state.b)) < 1e-6 ? 'Yes ✓' : 'No']]
  },
  {
    id: 7, cat: 'FOUNDATIONS', title: 'Cross Product & Parallelogram Area',
    desc: 'a×b is perpendicular to both vectors; its length equals the area of the parallelogram they span.',
    controls: () => [...vecCtls('a', 'a', 4), ...vecCtls('b', 'b', 4)], presets: AB_PRESETS,
    render() {
      const a = V3(state.a), b = V3(state.b), c = cross3(state.a, state.b), cl = len3(c);
      addArrow(O, a, COLORS.vectorA, 'Vector a', { tag: 'a', label: 'a' });
      addArrow(O, b, COLORS.vectorB, 'Vector b', { tag: 'b', label: 'b' });
      addQuad(O, a, a.clone().add(b), b, COLORS.vectorProj, 0.22, 'Parallelogram');
      const k = cl > 8 ? 8 / cl : 1;
      addArrow(O, V3(c).multiplyScalar(k), COLORS.vectorRes, 'a × b', { label: k < 1 ? 'a×b (scaled)' : 'a×b' });
    },
    formula: () => 'a × b = (a_yb_z−a_zb_y, a_zb_x−a_xb_z, a_xb_y−a_yb_x)',
    calc: () => { const c = cross3(state.a, state.b); return `a × b = (${fmt(c.x)}, ${fmt(c.y)}, ${fmt(c.z)}),  area = ${fmt(len3(c))}`; },
    metrics: () => { const c = cross3(state.a, state.b); return [['a × b', `(${fmt(c.x, 1)}, ${fmt(c.y, 1)}, ${fmt(c.z, 1)})`], ['Area', fmt(len3(c))]]; }
  },
  {
    id: 8, cat: 'FOUNDATIONS', title: 'Basis Vectors & Coordinate Systems',
    desc: 'Coordinates are just instructions: "go x steps along î, y along ĵ, z along k̂". Basis vectors are the building blocks.',
    controls: () => vecCtls('v', 'v'), presets: VEC_PRESETS,
    render() {
      const v = state.v;
      const p1 = new THREE.Vector3(v.x, 0, 0), p2 = new THREE.Vector3(v.x, v.y, 0), p3 = V3(v);
      addArrow(O, new THREE.Vector3(1, 0, 0), COLORS.basisI, 'Basis î', { label: 'î' });
      addArrow(O, new THREE.Vector3(0, 1, 0), COLORS.basisJ, 'Basis ĵ', { label: 'ĵ' });
      addArrow(O, new THREE.Vector3(0, 0, 1), COLORS.basisK, 'Basis k̂', { label: 'k̂' });
      addArrow(O, p1, COLORS.basisI, 'x·î', { opacity: 0.55 });
      addArrow(p1, p2, COLORS.basisJ, 'y·ĵ', { opacity: 0.55 });
      addArrow(p2, p3, COLORS.basisK, 'z·k̂', { opacity: 0.55 });
      addArrow(O, p3, COLORS.vectorV, 'Vector v', { tag: 'v', label: 'v' });
    },
    formula: () => 'v = x·î + y·ĵ + z·k̂',
    calc: () => `v = ${fmt(state.v.x)}·î + ${fmt(state.v.y)}·ĵ + ${fmt(state.v.z)}·k̂`,
    metrics: () => [['x·î', fmt(state.v.x)], ['y·ĵ', fmt(state.v.y)], ['z·k̂', fmt(state.v.z)]]
  },
  {
    id: 9, cat: 'TRANSFORMATIONS', title: 'Matrices as Transformation Machines',
    desc: 'A matrix is a machine that moves all of space. Its columns are where î and ĵ land. Scrub the flow from I to M.',
    flow: true, grid: true, controls: () => matCtls(), presets: MAT_PRESETS,
    render(Mt) {
      const v = state.v, mv = mat2.apply(Mt, v);
      addBasisImages(Mt);
      addArrow(O, V3(v), COLORS.vectorV, 'Input vector v', { tag: 'v', label: 'v', opacity: 0.55 });
      addArrow(O, V3(mv), COLORS.vectorRes, 'Output M·v', { label: 'Mv' });
    },
    formula: () => 'v ↦ M·v,   M = [ î′  ĵ′ ] (columns)',
    calc: () => matrixLine(state.M),
    metrics: () => matMetrics(state.M)
  },
  {
    id: 10, cat: 'TRANSFORMATIONS', title: 'Transforming the Entire Grid',
    desc: 'Every grid line stays a straight line and the origin stays put: that is what makes a transformation linear.',
    flow: true, grid: true, controls: () => matCtls(), presets: MAT_PRESETS,
    render(Mt) {
      addBasisImages(Mt);
      const sq = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }].map((p) => V3(mat2.apply(Mt, p)));
      addQuad(sq[0], sq[1], sq[2], sq[3], COLORS.vectorProj, 0.25, 'Unit square image');
    },
    formula: () => 'grid point (x, y) ↦ M·(x, y)',
    calc: () => matrixLine(state.M),
    metrics: () => matMetrics(state.M)
  },
  {
    id: 11, cat: 'TRANSFORMATIONS', title: 'Matrix × Vector Component Arithmetic',
    desc: 'M·v is a recipe: take x copies of the new î plus y copies of the new ĵ. Same answer as row-by-row arithmetic.',
    flow: true, grid: true,
    controls: () => [...matCtls(), ...vecCtls('v', 'v').slice(0, 2)], presets: MAT_PRESETS,
    render(Mt) {
      const v = state.v, mv = mat2.apply(Mt, v);
      const xi = new THREE.Vector3(Mt.a * v.x, Mt.c * v.x, 0);
      addBasisImages(Mt, 0.5, false);
      addArrow(O, xi, COLORS.basisI, 'x·î′', { opacity: 0.8 });
      addArrow(xi, V3(mv), COLORS.basisJ, 'y·ĵ′', { opacity: 0.8 });
      addArrow(O, V3(v), COLORS.vectorV, 'Input v', { tag: 'v', label: 'v', opacity: 0.55 });
      addArrow(O, V3(mv), COLORS.vectorRes, 'Output M·v', { label: 'Mv' });
    },
    formula: () => '[a b; c d]·[x; y] = [a·x + b·y ; c·x + d·y]',
    calc: () => {
      const M = state.M, v = state.v;
      return `[${fmt(M.a * v.x)} + ${fmt(M.b * v.y)} ; ${fmt(M.c * v.x)} + ${fmt(M.d * v.y)}] = (${fmt(M.a * v.x + M.b * v.y)}, ${fmt(M.c * v.x + M.d * v.y)})`;
    },
    metrics: () => { const o = mat2.apply(state.M, state.v); return [['M·v', `(${fmt(o.x)}, ${fmt(o.y)})`], ['det M', fmt(mat2.det(state.M))]]; }
  },
  {
    id: 12, cat: 'TRANSFORMATIONS', title: 'Matrix Multiplication (AB ≠ BA)',
    desc: 'Combining transformations means multiplying matrices, and order matters: rotate-then-shear is not shear-then-rotate. A = rotation, B = shear.',
    flow: true, grid: true,
    controls: () => [
      { type: 'slider', id: 'sl_rot', label: 'A: rotation °', min: -180, max: 180, step: 5, get: () => state.matRotDeg, set: (v) => { state.matRotDeg = v; } },
      { type: 'slider', id: 'sl_shear', label: 'B: shear k', min: -2, max: 2, step: 0.1, get: () => state.matShearK, set: (v) => { state.matShearK = v; } },
      { type: 'seg', label: 'Product', options: [['AB', 'A·B'], ['BA', 'B·A']], get: () => state.multOrder, set: (v) => { state.multOrder = v; } }
    ],
    presets: [
      { label: '45° & 1.0', apply: () => { state.matRotDeg = 45; state.matShearK = 1; } },
      { label: '90° & 1.0', apply: () => { state.matRotDeg = 90; state.matShearK = 1; } },
      { label: '30° & 0.5', apply: () => { state.matRotDeg = 30; state.matShearK = 0.5; } }
    ],
    render(Mt) {
      const other = state.multOrder === 'AB' ? productBA() : productAB();
      addBasisImages(Mt);
      const o = mat2.lerp(other, state.flowProgress);
      addArrow(O, new THREE.Vector3(o.a, o.c, 0), COLORS.basisI, 'Other order î′', { opacity: 0.3 });
      addArrow(O, new THREE.Vector3(o.b, o.d, 0), COLORS.basisJ, 'Other order ĵ′', { opacity: 0.3 });
      addArrow(O, V3(mat2.apply(Mt, state.v)), COLORS.vectorRes, 'Output', { label: state.multOrder });
    },
    formula: () => 'AB ≠ BA   (apply the right-hand matrix first)',
    calc: () => `AB = ${matInline(productAB())}   BA = ${matInline(productBA())}`,
    metrics: () => {
      const ab = productAB(), ba = productBA();
      const same = Math.abs(ab.a - ba.a) + Math.abs(ab.b - ba.b) + Math.abs(ab.c - ba.c) + Math.abs(ab.d - ba.d) < 1e-6;
      return [['det A·B', fmt(mat2.det(ab))], ['AB = BA?', same ? 'Yes' : 'No'], ['Showing', state.multOrder]];
    }
  },
  {
    id: 13, cat: 'TRANSFORMATIONS', title: 'Determinant (Area Scaling Factor)',
    desc: 'The determinant says how much areas are scaled. Negative means orientation flipped; zero means the plane collapsed to a line.',
    flow: true, grid: true, controls: () => matCtls(), presets: MAT_PRESETS,
    render(Mt) {
      const sq = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
      addLines([V3(sq[0]), V3(sq[1]), V3(sq[1]), V3(sq[2]), V3(sq[2]), V3(sq[3]), V3(sq[3]), V3(sq[0])], 0xffffff, 0.6, 'Unit square', true);
      const img = sq.map((p) => V3(mat2.apply(Mt, p)));
      const det = mat2.det(Mt);
      addQuad(img[0], img[1], img[2], img[3], det >= 0 ? COLORS.vectorRes : COLORS.vectorB, 0.4, 'Image of unit square');
      addBasisImages(Mt);
    },
    formula: () => 'det [a b; c d] = a·d − b·c',
    calc: () => `det = ${fmt(state.M.a)}·${fmt(state.M.d)} − ${fmt(state.M.b)}·${fmt(state.M.c)} = ${fmt(mat2.det(state.M))}`,
    metrics: () => matMetrics(state.M)
  },
  {
    id: 14, cat: 'TRANSFORMATIONS', title: 'Matrix Inverse (Undoing Space)',
    desc: 'M⁻¹ undoes M. Step through: original → warped by M → restored by M⁻¹. If det = 0 information is lost and no inverse exists.',
    grid: true,
    controls: () => [
      { type: 'seg', label: 'Step', options: [[0, '0 Original'], [1, '1 Warped'], [2, '2 Restored']], get: () => state.invStep, set: (v) => { state.invStep = Number(v); } },
      ...matCtls()
    ],
    presets: MAT_PRESETS,
    render(Mt) {
      const singular = !mat2.inv(state.M);
      addBasisImages(Mt);
      const mv = mat2.apply(state.M, state.v);
      addArrow(O, V3(state.v), COLORS.vectorV, 'Vector v', { tag: 'v', label: 'v', opacity: state.invStep === 1 ? 0.45 : 1 });
      if (state.invStep === 1) addArrow(O, V3(mv), COLORS.vectorRes, 'M·v', { label: 'Mv' });
      if (state.invStep === 2) {
        if (!singular) addArrow(O, V3(mv), COLORS.vectorRes, 'M·v (ghost)', { opacity: 0.3 });
        else addArrow(O, V3(mv), COLORS.vectorB, 'Collapsed (cannot undo)', { label: 'lost' });
      }
    },
    formula: () => 'M⁻¹ = (1/det) · [d −b; −c a],   M⁻¹·M = I',
    calc: () => { const i = mat2.inv(state.M); return i ? `M⁻¹ = ${matInline(i)}` : 'det = 0 → M is singular, no inverse exists'; },
    metrics: () => { const i = mat2.inv(state.M); return [['det M', fmt(mat2.det(state.M))], ['Invertible?', i ? 'Yes ✓' : 'No ✗'], ['Step', ['Original', 'Warped by M', i ? 'Restored by M⁻¹' : 'Cannot restore'][state.invStep]]]; }
  },
  {
    id: 15, cat: 'COMPUTATION', title: 'Transforming Many Vectors Simultaneously',
    desc: 'One matrix transforms every vector in a cloud. Cyan = inputs, violet = outputs. The extra rotation is composed after M.',
    flow: true, grid: true,
    controls: () => [
      { type: 'slider', id: 'sl_cloudN', label: 'Vectors N', min: 8, max: 256, step: 8, get: () => state.cloudCount, set: (v) => { state.cloudCount = v; } },
      { type: 'slider', id: 'sl_cloudAngle', label: 'Extra rotation °', min: -180, max: 180, step: 5, get: () => state.cloudAngle, set: (v) => { state.cloudAngle = v; } },
      ...matCtls()
    ],
    presets: MAT_PRESETS,
    render(Mt) {
      const pts = cloudPoints(state.cloudCount);
      addInstanced(pts, COLORS.vectorA, 0.07, 0.45, 'Input cloud');
      addInstanced(pts.map((p) => mat2.apply(Mt, p)), 0x818cf8, 0.09, 0.95, 'Output cloud');
    },
    formula: () => '[v₁′ v₂′ … vₙ′] = M · [v₁ v₂ … vₙ]',
    calc: () => `${state.cloudCount} vectors × one ${matInline(getTarget())}`,
    metrics: () => [['Vectors', state.cloudCount], ['Multiplies (scalar)', state.cloudCount * 4], ['Matrix ops (batch)', 1]]
  },
  {
    id: 16, cat: 'COMPUTATION', title: 'What Vectorization Actually Means',
    desc: 'A loop handles one vector at a time; vectorised code describes the whole batch in one operation: s·[v₁…vₙ].',
    controls: () => [{
      type: 'slider', id: 'sl_simdScalar', label: 'Scalar s', min: -3, max: 3, step: 0.5,
      get: () => state.simdScalar, set: (v) => { state.simdScalar = v; }
    }, execBtn()], presets: [],
    render() {
      for (let i = 0; i < 8; i++) {
        const v = new THREE.Vector3(-3.5 + i, ((i * 5) % 4) - 1.5, 0);
        addArrow(O, v, COLORS.vectorA, `v${i + 1}`, { opacity: state.simdExecuted ? 0.3 : 0.9 });
        if (state.simdExecuted) addArrow(O, v.clone().multiplyScalar(state.simdScalar), COLORS.vectorProj, `s·v${i + 1}`, { opacity: 0.9 });
      }
    },
    formula: () => 'for i: out[i] = s·v[i]   ⟶   out = s·V',
    calc: () => state.simdExecuted ? `Executed: 8 vectors scaled by ${fmt(state.simdScalar, 1)} in one batch` : 'Press “Execute operation”',
    metrics: () => [['Loop iterations', 8], ['Vector operations', 1], ['Status', state.simdExecuted ? 'Done ✓' : 'Waiting']]
  },
  {
    id: 17, cat: 'COMPUTATION', title: 'SIMD CPU Hardware Concept',
    desc: 'SIMD hardware multiplies many numbers in a single instruction: a 128-bit register holds 4 floats, a 256-bit register holds 8.',
    controls: () => [
      { type: 'seg', label: 'Register width', options: [[128, '128-bit'], [256, '256-bit']], get: () => state.simdMode, set: (v) => { state.simdMode = Number(v); state.simdExecuted = false; } },
      { type: 'slider', id: 'sl_simdScalar', label: 'Scalar s', min: -3, max: 3, step: 0.5, get: () => state.simdScalar, set: (v) => { state.simdScalar = v; } },
      execBtn()
    ],
    presets: [],
    render() {
      const n = state.simdMode / 32, s = state.simdScalar, gap = 1.25;
      const rows = [
        { y: 2.4, color: COLORS.vectorA, name: 'Register A', cap: 'A', val: (i) => i + 1, on: true },
        { y: 0, color: COLORS.vectorProj, name: 'Register S (broadcast)', cap: 's', val: () => s, on: true },
        { y: -2.4, color: COLORS.vectorRes, name: 'Result register', cap: 'R', val: (i) => (i + 1) * s, on: state.simdExecuted }
      ];
      rows.forEach((r) => {
        const frame = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(n * gap + 0.1, 1.15, 1.15)),
          new THREE.LineBasicMaterial({ color: r.color, transparent: true, opacity: 0.8 })
        );
        frame.position.set(0, r.y, 0);
        frame.userData.name = r.name;
        dynamicObjectsGroup.add(frame);
        create3DLabel(r.cap, new THREE.Vector3(-(n * gap) / 2 - 0.9, r.y, 0), cssHex(r.color), dynamicObjectsGroup);
        for (let i = 0; i < n; i++) {
          const x = (i - (n - 1) / 2) * gap;
          const box = new THREE.Mesh(
            new THREE.BoxGeometry(0.9, 0.9, 0.9),
            new THREE.MeshStandardMaterial({ color: r.color, transparent: true, opacity: r.on ? 0.85 : 0.12 })
          );
          box.position.set(x, r.y, 0);
          box.userData.name = `${r.name} lane ${i}`;
          dynamicObjectsGroup.add(box);
          if (r.on) create3DLabel(fmt(r.val(i), 1), new THREE.Vector3(x, r.y + 0.85, 0), '#e8eef7', dynamicObjectsGroup);
        }
      });
    },
    formula: () => 'R[0..n] = A[0..n] × s    (one instruction)',
    calc: () => `${state.simdMode}-bit register = ${state.simdMode / 32} lanes × 32-bit float`,
    metrics: () => [['Lanes', state.simdMode / 32], ['Register bytes', state.simdMode / 8], ['Scalar steps', state.simdMode / 32], ['SIMD steps', 1], ['Ideal speed-up', (state.simdMode / 32) + '×']]
  }
];

function angleDeg(p, q) {
  const d = len3(p) * len3(q);
  if (d < 1e-9) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot3(p, q) / d))) * 180 / Math.PI;
}
function matInline(m) { return `[${fmt(m.a)} ${fmt(m.b)}; ${fmt(m.c)} ${fmt(m.d)}]`; }
function matrixLine(m) { return `M = ${matInline(m)},  î′ = (${fmt(m.a)}, ${fmt(m.c)}),  ĵ′ = (${fmt(m.b)}, ${fmt(m.d)})`; }
function matMetrics(m) {
  const det = mat2.det(m);
  return [['det M', fmt(det)], ['Area scale', fmt(Math.abs(det)) + '×'],
    ['Orientation', Math.abs(det) < 1e-6 ? 'Collapsed' : det < 0 ? 'Flipped' : 'Preserved']];
}
function productAB() { return mat2.mul(mat2.rot(state.matRotDeg), mat2.shear(state.matShearK)); }
function productBA() { return mat2.mul(mat2.shear(state.matShearK), mat2.rot(state.matRotDeg)); }
function cloudPoints(n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const r = 0.4 + Math.sqrt((i + 0.5) / n) * 3.2, th = i * 2.399963;
    pts.push({ x: r * Math.cos(th), y: r * Math.sin(th), z: 0 });
  }
  return pts;
}

const getExp = () => EXPS.find((e) => e.id === state.activeExpId) || EXPS[0];

function getTarget() {
  switch (state.activeExpId) {
    case 12: return state.multOrder === 'AB' ? productAB() : productBA();
    case 14: return state.invStep === 1 ? state.M : (state.invStep === 2 && !mat2.inv(state.M) ? state.M : I2);
    case 15: return mat2.mul(mat2.rot(state.cloudAngle), state.M);
    default: return state.M;
  }
}
function getMt() {
  const exp = getExp();
  return exp.flow ? mat2.lerp(getTarget(), state.flowProgress) : getTarget();
}

// ==========================================================================
// 7. CONTEXTUAL PANEL (controls, presets, readouts)
// ==========================================================================
let activeControls = [];

function buildPanel(exp) {
  const title = document.getElementById('panelHeaderTitle');
  if (title) title.textContent = `${pad2(exp.id)} — ${exp.title}`;

  const badge = document.getElementById('statusBadgeNum');
  if (badge) badge.textContent = pad2(exp.id);
  const cat = document.getElementById('statusCategoryTag');
  if (cat) cat.textContent = exp.cat;
  const at = document.getElementById('statusActiveTitle');
  if (at) at.textContent = exp.title;
  const counter = document.getElementById('guidedStepCounter');
  if (counter) counter.textContent = `${pad2(exp.id)} / ${EXPS.length}`;

  // Presets
  const ps = document.getElementById('dynamicPresetStrip');
  ps.innerHTML = '';
  (exp.presets || []).forEach((p) => {
    const b = document.createElement('button');
    b.className = 'preset-chip';
    b.textContent = p.label;
    b.addEventListener('click', () => {
      p.apply();
      syncControls();
      if (exp.flow) setFlowProgress(state.flowProgress); else renderActiveExperimentGraphics();
    });
    ps.appendChild(b);
  });

  // Flow box
  const fb = document.getElementById('flowScrubberBox');
  fb.style.display = exp.flow ? 'block' : 'none';

  // Controls
  const host = document.getElementById('dynamicControlsContainer');
  host.innerHTML = '';
  activeControls = [];

  if (state.appMode === 'guided') {
    const note = document.createElement('div');
    note.className = 'guided-note';
    note.textContent = exp.desc;
    host.appendChild(note);
  }

  exp.controls().forEach((c) => {
    const row = document.createElement('div');
    row.className = 'control-row';
    if (c.type === 'slider') {
      row.innerHTML = `<label class="control-label" for="${c.id}">${c.label}</label>
        <div class="slider-container">
          <input type="range" id="${c.id}" min="${c.min}" max="${c.max}" step="${c.step}">
          <input type="number" class="numeric-input" id="num_${c.id}" min="${c.min}" max="${c.max}" step="${c.step}" aria-label="${c.label} value">
        </div>`;
      host.appendChild(row);
      const range = row.querySelector('input[type=range]');
      const num = row.querySelector('input[type=number]');
      const apply = (val) => {
        if (!isFinite(val)) return;
        c.set(Math.max(c.min, Math.min(c.max, val)));
        syncControls();
        renderActiveExperimentGraphics();
        if (exp.flow && state.showTrace) setFlowProgress(state.flowProgress);
      };
      range.addEventListener('input', () => apply(parseFloat(range.value)));
      num.addEventListener('change', () => apply(parseFloat(num.value)));
      activeControls.push({ c, range, num });
    } else if (c.type === 'seg') {
      row.innerHTML = `<span class="control-label">${c.label}</span><div class="seg-group"></div>`;
      const grp = row.querySelector('.seg-group');
      c.options.forEach(([val, lab]) => {
        const b = document.createElement('button');
        b.className = 'seg-btn';
        b.textContent = lab;
        b.dataset.val = val;
        b.addEventListener('click', () => {
          c.set(val);
          grp.querySelectorAll('.seg-btn').forEach((x) => x.classList.toggle('active', x.dataset.val === String(c.get())));
          if (exp.flow) setFlowProgress(state.flowProgress); else renderActiveExperimentGraphics();
        });
        grp.appendChild(b);
      });
      grp.querySelectorAll('.seg-btn').forEach((x) => x.classList.toggle('active', x.dataset.val === String(c.get())));
      host.appendChild(row);
    } else if (c.type === 'button') {
      const b = document.createElement('button');
      b.className = 'btn-action primary';
      b.style.width = '100%';
      b.textContent = c.label;
      b.addEventListener('click', c.onClick);
      row.appendChild(b);
      host.appendChild(row);
    }
  });
  syncControls();
}

function syncControls() {
  activeControls.forEach(({ c, range, num }) => {
    const v = c.get();
    range.value = v;
    if (document.activeElement !== num) num.value = Math.round(v * 100) / 100;
  });
}

function updateReadouts(exp, Mt) {
  const mb = document.getElementById('dynamicMetricsBox');
  if (mb) mb.innerHTML = exp.metrics().map(([k, v]) => `<div class="metric-row"><span>${k}</span><b>${v}</b></div>`).join('');

  const hf = document.getElementById('mathHudFormula');
  const hc = document.getElementById('mathHudCalc');
  const ht = document.getElementById('mathHudTitle');
  if (hf) hf.textContent = exp.formula();
  if (hc) hc.textContent = exp.calc();
  if (ht) ht.textContent = exp.title;

  const ab = document.getElementById('dynamicSpaceAnalysisBox');
  if (ab) {
    if (exp.flow || exp.id === 14) {
      const T = getTarget(), det = mat2.det(T);
      ab.style.display = 'block';
      ab.innerHTML = `<div class="analysis-title">What changed?</div>
        <div class="analysis-line">î → (${fmt(T.a)}, ${fmt(T.c)}) &nbsp; ĵ → (${fmt(T.b)}, ${fmt(T.d)})</div>
        <div class="analysis-line">Areas scale by ${fmt(Math.abs(det))}×${det < -1e-6 ? ' and the plane is mirrored' : ''}${Math.abs(det) < 1e-6 ? ' — the plane collapsed onto a line!' : ''}</div>`;
    } else {
      ab.style.display = 'none';
      ab.innerHTML = '';
    }
  }
}

// ==========================================================================
// 8. EXPERIMENT SWITCHING, FLOW & RENDER ORCHESTRATION
// ==========================================================================
function renderActiveExperimentGraphics() {
  if (!scene) return;
  const exp = getExp();
  clearGroup(dynamicObjectsGroup);
  draggableMeshes.length = 0;
  const Mt = getMt();
  updateTransformedGrid(Mt, exp);
  exp.render(Mt);
  updateReadouts(exp, Mt);
  checkChallenge();
}

function switchExperiment(id) {
  const exp = EXPS.find((e) => e.id === id) || EXPS[0];
  state.activeExpId = exp.id;
  state.flowPlaying = false;
  state.flowProgress = 1.0;
  if (exp.id !== 14) state.invStep = 0;
  if (exp.id < 16) state.simdExecuted = false;
  clearTrace();
  const pb = document.getElementById('btnPlayFlow');
  if (pb) pb.innerText = '▶';
  buildPanel(exp);
  setFlowDom(1.0);
  const legend = document.getElementById('gridLegendStrip');
  if (legend) legend.style.display = exp.grid ? 'flex' : 'none';
  if (state.appMode === 'guided' || exp.desc) {
    const hd = document.getElementById('panelHeaderIcon');
    if (hd) hd.textContent = exp.cat === 'FOUNDATIONS' ? '➚' : exp.cat === 'TRANSFORMATIONS' ? '▦' : '⚡';
  }
  renderActiveExperimentGraphics();
}

function resetParams(silent) {
  Object.assign(state, JSON.parse(JSON.stringify(DEFAULT_PARAMS)));
  switchExperiment(state.activeExpId);
  if (!silent) showToast('↺ Parameters reset to default');
}

function setFlowDom(p) {
  const sl = document.getElementById('sl_flowProgress');
  const nm = document.getElementById('num_flowProgress');
  const bd = document.getElementById('flowProgressBadge');
  if (sl) sl.value = p;
  if (nm && document.activeElement !== nm) nm.value = Math.round(p * 100);
  if (bd) bd.textContent = p >= 0.999 ? '100% (M)' : p <= 0.001 ? '0% (I)' : `${Math.round(p * 100)}%`;
}

function setFlowProgress(p) {
  state.flowProgress = Math.max(0, Math.min(1, p));
  setFlowDom(state.flowProgress);
  if (state.showTrace && getExp().flow) pushTracePoint(mat2.apply(getMt(), state.v));
  renderActiveExperimentGraphics();
}

function toggleFlowPlayback() {
  const exp = getExp();
  if (!exp.flow) { showToast('Flow scrubbing is available for matrix experiments (09–13, 15)'); return; }
  if (state.flowPlaying) state.flowPlaying = false;
  else {
    if (state.flowProgress >= 0.999) { state.flowProgress = 0; clearTrace(); }
    state.flowPlaying = true;
  }
  const btn = document.getElementById('btnPlayFlow');
  if (btn) btn.innerText = state.flowPlaying ? '⏸' : '▶';
}

// ==========================================================================
// 9. CAMERA PERSPECTIVES
// ==========================================================================
function setCameraPerspective(name) {
  const targets = {
    isometric: [7.5, 6.5, 9.5], reset: [7.5, 6.5, 9.5],
    top: [0, 0.001, 16], front: [0.001, -16, 0.001], side: [16, 0.001, 0.001]
  };
  const to = new THREE.Vector3(...(targets[name] || targets.isometric));
  const from = camera.position.clone();
  let start = null;
  const dur = state.reducedMotion ? 1 : 650;
  cameraTween = {
    update(t) {
      if (start === null) start = t;
      const k = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - k, 3);
      camera.position.lerpVectors(from, to, e);
      controls.target.set(0, 0, 0);
      controls.update();
      if (k >= 1) cameraTween = null;
    }
  };
  closeAllModals();
}

// ==========================================================================
// 10. MODES: VIEW, FOCUS, APP (EXPLORE / GUIDED / CHALLENGE)
// ==========================================================================
function setViewMode(mode) {
  state.viewMode = mode;
  document.querySelectorAll('.view-mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === mode));
  const hud = document.getElementById('prominentMathHud');
  if (hud) hud.style.display = mode === 'space' ? 'none' : 'block';
  document.body.classList.toggle('view-math', mode === 'math');
}

function toggleFocusMode() {
  state.focusMode = !state.focusMode;
  document.body.classList.toggle('focus-mode', state.focusMode);
  const pill = document.getElementById('btnExitFocus');
  if (pill) pill.style.display = state.focusMode ? 'flex' : 'none';
}

function setAppMode(mode) {
  state.appMode = mode;
  document.querySelectorAll('.mode-pill[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  document.getElementById('guidedStepperRow').style.display = mode === 'guided' ? 'flex' : 'none';
  document.getElementById('challengeBanner').style.display = mode === 'challenge' ? 'flex' : 'none';
  if (mode === 'challenge') loadChallenge(state.activeChallengeId);
  else buildPanel(getExp());
}

// ==========================================================================
// 11. CHALLENGE MODE
// ==========================================================================
const near = (a, b, t = 0.06) => Math.abs(a - b) <= t;
const CHALLENGES = [
  { id: 1, exp: 6, title: 'Make vectors a and b perpendicular', desc: 'Adjust the components until the dot product a · b = 0 (neither vector may be zero).',
    check: () => len3(state.a) > 0.1 && len3(state.b) > 0.1 && near(dot3(state.a, state.b), 0, 1e-6) },
  { id: 2, exp: 2, title: 'Build a vector of length 5', desc: 'Find components with |v| = 5 (hint: 3-4-5).',
    check: () => near(len3(state.v), 5, 0.01) },
  { id: 3, exp: 3, title: 'Make a + b = (4, 3, 0)', desc: 'Choose a and b so their sum lands exactly on (4, 3, 0).',
    check: () => near(state.a.x + state.b.x, 4, 1e-6) && near(state.a.y + state.b.y, 3, 1e-6) && near(state.a.z + state.b.z, 0, 1e-6) },
  { id: 4, exp: 5, title: 'Reach s·v = (6, 4, 2)', desc: 'With v = (3, 2, 1) pick the right scalar.',
    check: () => near(state.scalar * state.v.x, 6, 1e-6) && near(state.scalar * state.v.y, 4, 1e-6) && near(state.scalar * state.v.z, 2, 1e-6) },
  { id: 5, exp: 9, title: 'Rotate space by 90° counter-clockwise', desc: 'Set M so î lands on (0, 1) and ĵ on (−1, 0).',
    check: () => near(state.M.a, 0) && near(state.M.b, -1) && near(state.M.c, 1) && near(state.M.d, 0) },
  { id: 6, exp: 13, title: 'Double every area (det = 2)', desc: 'Pick a matrix with determinant 2 that is not just a scale of one axis.',
    check: () => near(mat2.det(state.M), 2, 0.05) && (Math.abs(state.M.b) > 0.05 || Math.abs(state.M.c) > 0.05) },
  { id: 7, exp: 13, title: 'Collapse the plane (det = 0)', desc: 'Find a non-zero matrix that squashes the whole plane onto a line.',
    check: () => near(mat2.det(state.M), 0, 0.02) && Math.abs(state.M.a) + Math.abs(state.M.b) + Math.abs(state.M.c) + Math.abs(state.M.d) > 0.3 }
];
let challengeSolved = false;

function loadChallenge(id) {
  const ch = CHALLENGES.find((c) => c.id === id) || CHALLENGES[0];
  state.activeChallengeId = ch.id;
  challengeSolved = false;
  Object.assign(state, JSON.parse(JSON.stringify(DEFAULT_PARAMS)));
  document.getElementById('challengeTitle').textContent = `${ch.id}/${CHALLENGES.length} · ${ch.title}`;
  document.getElementById('challengeDesc').textContent = ch.desc + '  (click banner for next)';
  switchExperiment(ch.exp);
}

function checkChallenge() {
  if (state.appMode !== 'challenge') return;
  const ch = CHALLENGES.find((c) => c.id === state.activeChallengeId);
  if (!ch) return;
  const dot = document.querySelector('#challengeStatus .challenge-dot');
  const txt = document.getElementById('challengeStatusText');
  const ok = ch.exp === state.activeExpId && ch.check();
  if (dot) dot.className = 'challenge-dot ' + (ok ? 'solved' : 'pending');
  if (txt) txt.textContent = ok ? 'Solved ✓' : (ch.exp === state.activeExpId ? 'Incomplete' : `Go to experiment ${pad2(ch.exp)}`);
  if (ok && !challengeSolved) { challengeSolved = true; showToast('🎉 Challenge solved!'); audio.triggerChime(660); setTimeout(() => audio.triggerChime(880), 140); }
  if (!ok) challengeSolved = false;
}

// ==========================================================================
// 12. COMMAND PALETTE, EXPLORER & NOTEBOOK
// ==========================================================================
let paletteItems = [], paletteFilteredItems = [], paletteSelectedIndex = 0;

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop.open, .popover-menu.open').forEach((m) => m.classList.remove('open'));
}

function buildPaletteItems() {
  paletteItems = [
    ...EXPS.map((e) => ({ label: `${pad2(e.id)} · ${e.title}`, hint: e.cat, run: () => switchExperiment(e.id) })),
    { label: 'Mode: Explore', hint: 'MODE', run: () => setAppMode('explore') },
    { label: 'Mode: Guided', hint: 'MODE', run: () => setAppMode('guided') },
    { label: 'Mode: Challenge', hint: 'MODE', run: () => setAppMode('challenge') },
    { label: 'View: Space', hint: 'VIEW', run: () => setViewMode('space') },
    { label: 'View: Both', hint: 'VIEW', run: () => setViewMode('both') },
    { label: 'View: Math', hint: 'VIEW', run: () => setViewMode('math') },
    { label: 'Camera: Isometric', hint: 'CAMERA', run: () => setCameraPerspective('isometric') },
    { label: 'Camera: Top', hint: 'CAMERA', run: () => setCameraPerspective('top') },
    { label: 'Camera: Front', hint: 'CAMERA', run: () => setCameraPerspective('front') },
    { label: 'Camera: Side', hint: 'CAMERA', run: () => setCameraPerspective('side') },
    { label: 'Toggle light / dark theme', hint: 'THEME', run: () => setTheme(state.theme === 'light' ? 'dark' : 'light') },
    { label: 'Toggle focus mode', hint: 'UI', run: toggleFocusMode },
    { label: 'Toggle ambient audio', hint: 'AUDIO', run: toggleAudioPlayback },
    { label: 'Copy share link', hint: 'SHARE', run: serializeStateToUrl },
    { label: 'Capture screenshot', hint: 'SHARE', run: captureCanvasScreenshot }
  ];
}

function openCommandPalette() {
  closeAllModals();
  if (!paletteItems.length) buildPaletteItems();
  const m = document.getElementById('commandPaletteModal');
  m.classList.add('open');
  const input = document.getElementById('paletteSearchInput');
  input.value = '';
  filterPaletteCommands('');
  setTimeout(() => input.focus(), 30);
}

function filterPaletteCommands(q) {
  const s = (q || '').toLowerCase().trim();
  paletteFilteredItems = s ? paletteItems.filter((i) => (i.label + ' ' + i.hint).toLowerCase().includes(s)) : paletteItems.slice();
  paletteSelectedIndex = 0;
  renderPaletteResults();
}

function renderPaletteResults() {
  const host = document.getElementById('paletteResults');
  host.innerHTML = '';
  if (!paletteFilteredItems.length) { host.innerHTML = '<div class="palette-empty">No matches</div>'; return; }
  paletteFilteredItems.forEach((it, i) => {
    const d = document.createElement('div');
    d.className = 'palette-item' + (i === paletteSelectedIndex ? ' selected' : '');
    d.innerHTML = `<span>${it.label}</span><span class="shortcut-tag">${it.hint}</span>`;
    d.addEventListener('click', () => executePaletteItem(i));
    host.appendChild(d);
    if (i === paletteSelectedIndex) d.scrollIntoView({ block: 'nearest' });
  });
}

function executePaletteItem(i) {
  const it = paletteFilteredItems[i];
  if (!it) return;
  closeAllModals();
  it.run();
}

function buildExplorerCardGrid(query = '') {
  const host = document.getElementById('explorerGrid');
  const q = query.toLowerCase().trim();
  host.innerHTML = '';
  EXPS.filter((e) => !q || (e.title + ' ' + e.cat + ' ' + e.desc).toLowerCase().includes(q)).forEach((e) => {
    const card = document.createElement('button');
    card.className = 'explorer-card' + (e.id === state.activeExpId ? ' active' : '');
    card.innerHTML = `<span class="exp-badge-num">${pad2(e.id)}</span><span class="exp-category-tag">${e.cat}</span><strong>${e.title}</strong><small>${e.desc}</small>`;
    card.addEventListener('click', () => { closeAllModals(); switchExperiment(e.id); });
    host.appendChild(card);
  });
}

function readNotebook() {
  try { return JSON.parse(localStorage.getItem('linear_lab_notebook') || '[]'); } catch (e) { return []; }
}
function writeNotebook(list) {
  try { localStorage.setItem('linear_lab_notebook', JSON.stringify(list)); } catch (e) {}
}

function saveCurrentObservation(note) {
  const exp = getExp();
  const list = readNotebook();
  list.unshift({
    t: new Date().toLocaleString(), exp: exp.id, title: exp.title,
    note: note || '', calc: exp.calc()
  });
  writeNotebook(list.slice(0, 100));
  showToast('📝 Observation saved');
  const m = document.getElementById('notebookModal');
  if (m && m.classList.contains('open')) renderNotebookModal();
}

function renderNotebookModal() {
  const host = document.getElementById('notebookList');
  if (!host) return;
  const list = readNotebook();
  host.innerHTML = '';
  if (!list.length) { host.innerHTML = '<div class="palette-empty">No observations yet. Press 📝 in the panel header to save one.</div>'; return; }
  list.forEach((n, idx) => {
    const d = document.createElement('div');
    d.className = 'note-card';
    const h = document.createElement('div');
    h.className = 'note-head';
    h.textContent = `${pad2(n.exp)} · ${n.title} — ${n.t}`;
    const c = document.createElement('code');
    c.textContent = n.calc;
    const p = document.createElement('p');
    p.textContent = n.note;
    const del = document.createElement('button');
    del.className = 'panel-mini-btn';
    del.textContent = '✕';
    del.title = 'Delete';
    del.addEventListener('click', () => { const l = readNotebook(); l.splice(idx, 1); writeNotebook(l); renderNotebookModal(); });
    d.append(h, c, p, del);
    host.appendChild(d);
  });
}

// ==========================================================================
// 13. SHARE LINK & SCREENSHOT
// ==========================================================================
function serializeStateToUrl() {
  const p = new URLSearchParams();
  p.set('exp', state.activeExpId);
  p.set('v', [state.v.x, state.v.y, state.v.z].join(','));
  p.set('a', [state.a.x, state.a.y, state.a.z].join(','));
  p.set('b', [state.b.x, state.b.y, state.b.z].join(','));
  p.set('M', [state.M.a, state.M.b, state.M.c, state.M.d].join(','));
  p.set('s', state.scalar);
  const url = `${location.origin}${location.pathname}#${p.toString()}`;
  try { history.replaceState(null, '', '#' + p.toString()); } catch (e) {}
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => showToast('🔗 Link copied to clipboard'), () => showToast('🔗 Link is in the address bar'));
  } else showToast('🔗 Link is in the address bar');
}

function deserializeStateFromUrl() {
  if (!location.hash || location.hash.length < 2) return;
  try {
    const p = new URLSearchParams(location.hash.slice(1));
    const nums = (k, n) => { const v = (p.get(k) || '').split(',').map(Number); return v.length === n && v.every(isFinite) ? v : null; };
    const e = parseInt(p.get('exp'), 10);
    if (e >= 1 && e <= EXPS.length) state.activeExpId = e;
    const v = nums('v', 3); if (v) state.v = { x: v[0], y: v[1], z: v[2] };
    const a = nums('a', 3); if (a) state.a = { x: a[0], y: a[1], z: a[2] };
    const b = nums('b', 3); if (b) state.b = { x: b[0], y: b[1], z: b[2] };
    const M = nums('M', 4); if (M) state.M = { a: M[0], b: M[1], c: M[2], d: M[3] };
    const s = parseFloat(p.get('s')); if (isFinite(s)) state.scalar = s;
  } catch (err) { /* ignore malformed link */ }
}

function captureCanvasScreenshot() {
  renderer.render(scene, camera);
  const src = renderer.domElement;
  const out = document.createElement('canvas');
  out.width = src.width; out.height = src.height;
  const ctx = out.getContext('2d');
  ctx.fillStyle = state.theme === 'light' ? '#F5F7FA' : '#03060B';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(src, 0, 0);
  ctx.fillStyle = 'rgba(138,150,168,0.9)';
  ctx.font = `${Math.round(out.width / 70)}px sans-serif`;
  ctx.fillText(`Linear Algebra Lab — ${pad2(state.activeExpId)} ${getExp().title}`, 20, out.height - 20);
  const a = document.createElement('a');
  a.download = `linear-algebra-lab-${pad2(state.activeExpId)}.png`;
  a.href = out.toDataURL('image/png');
  a.click();
  showToast('📸 Screenshot saved');
}

function setupExtraListeners() {
  const nf = document.getElementById('num_flowProgress');
  if (nf) nf.addEventListener('change', (e) => { state.flowPlaying = false; setFlowProgress((parseFloat(e.target.value) || 0) / 100); });
  const nv = document.getElementById('num_audioVolume');
  if (nv) nv.addEventListener('change', (e) => {
    const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) / 100;
    audio.setVolume(val);
    document.getElementById('audioVolumeInput').value = val;
    document.getElementById('val_audioVolume').innerText = `${Math.round(val * 100)}%`;
  });
  const av = document.getElementById('audioVolumeInput');
  if (av && nv) av.addEventListener('input', () => { nv.value = Math.round(parseFloat(av.value) * 100); });
  const cb = document.getElementById('challengeBanner');
  if (cb) cb.addEventListener('click', () => loadChallenge(state.activeChallengeId % CHALLENGES.length + 1));
  const brand = document.getElementById('brandBadgeBtn');
  if (brand) brand.addEventListener('click', () => { const l = document.getElementById('landingOverlay'); if (l) l.style.display = 'flex'; });
}


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
      if (state[tag]) {
        state[tag].x = Math.max(-6, Math.min(6, snapX));
        state[tag].y = Math.max(-6, Math.min(6, snapY));
        syncControls();
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

  const name = (parentGroup && parentGroup.userData.name) || '3D Object';
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
    resetParams();
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
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() !== 'k') return;

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
    setupExtraListeners();
    setViewMode(state.viewMode);
    switchExperiment(state.activeExpId);
    animate(0);
  }
});