// Handline 3D Interactive Showcase
// Uses local three.module.js with CDN fallback

let THREE;
try {
  THREE = await import('./three.module.js');
} catch {
  THREE = await import('https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js');
}

// MediaPipe 21 Hand Landmarks Definition
const LANDMARK_NAMES = [
  '0 · WRIST', '1 · THUMB_CMC', '2 · THUMB_MCP', '3 · THUMB_IP', '4 · THUMB_TIP',
  '5 · INDEX_FINGER_MCP', '6 · INDEX_FINGER_PIP', '7 · INDEX_FINGER_DIP', '8 · INDEX_FINGER_TIP',
  '9 · MIDDLE_FINGER_MCP', '10 · MIDDLE_FINGER_PIP', '11 · MIDDLE_FINGER_DIP', '12 · MIDDLE_FINGER_TIP',
  '13 · RING_FINGER_MCP', '14 · RING_FINGER_PIP', '15 · RING_FINGER_DIP', '16 · RING_FINGER_TIP',
  '17 · PINKY_MCP', '18 · PINKY_PIP', '19 · PINKY_DIP', '20 · PINKY_TIP'
];

const LANDMARK_DESCS = [
  'Coordinate anchor (0,0,0). All 21 points are translation-normalized relative to wrist.',
  'Carpometacarpal joint for thumb rotational freedom.',
  'Metacarpophalangeal knuckle joint for thumb abduction.',
  'Interphalangeal joint for thumb flexion.',
  'Terminal thumb apex. Critical for Thumbs Up / Down recognition.',
  'Index knuckle base. Anchors lateral palm geometry.',
  'Index proximal interphalangeal joint.',
  'Index distal joint before fingertip.',
  'Index tip. Core landmark for Victory and Pointing poses.',
  'Middle knuckle base. Used to compute scale normalization factor D(0->9).',
  'Middle proximal joint.',
  'Middle distal joint.',
  'Middle tip. Highest point in Open Palm pose.',
  'Ring finger knuckle base.',
  'Ring proximal joint.',
  'Ring distal joint.',
  'Ring tip. Flexed inward for Victory and Thumbs poses.',
  'Pinky knuckle base. Defines outer boundary of palm width.',
  'Pinky proximal joint.',
  'Pinky distal joint.',
  'Pinky tip. Establishes overall hand span and posture.'
];

const EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

// Normalized 3D Coordinates for Preset Poses
const POSES = {
  open_palm: [
    [0, -1.8, 0],
    [-0.8, -1.0, 0.1], [-1.3, -0.4, 0.2], [-1.7, 0.1, 0.25], [-2.1, 0.5, 0.3], // Thumb
    [-0.7, -0.1, 0.05], [-0.8, 0.8, 0.05], [-0.85, 1.5, 0.05], [-0.9, 2.1, 0.05], // Index
    [-0.2, 0.0, 0.0], [-0.2, 0.95, 0.0], [-0.2, 1.8, 0.0], [-0.2, 2.5, 0.0], // Middle
    [0.35, -0.1, -0.05], [0.4, 0.8, -0.05], [0.42, 1.55, -0.05], [0.45, 2.15, -0.05], // Ring
    [0.85, -0.25, -0.1], [0.95, 0.5, -0.1], [1.05, 1.1, -0.1], [1.15, 1.6, -0.1]  // Pinky
  ],
  thumbs_up: [
    [0, -1.8, 0],
    [-0.6, -1.1, 0.3], [-0.8, -0.4, 0.6], [-0.9, 0.4, 0.8], [-0.95, 1.3, 1.0], // Thumb UP
    [-0.5, -0.2, 0.1], [-0.4, 0.4, 0.4], [-0.2, 0.1, 0.6], [-0.2, -0.3, 0.5], // Index Curled
    [-0.1, -0.1, 0.0], [-0.05, 0.45, 0.35], [0.15, 0.15, 0.55], [0.15, -0.25, 0.45], // Middle Curled
    [0.35, -0.15, -0.1], [0.4, 0.35, 0.25], [0.55, 0.05, 0.45], [0.5, -0.3, 0.35], // Ring Curled
    [0.75, -0.3, -0.2], [0.75, 0.15, 0.15], [0.85, -0.1, 0.35], [0.8, -0.4, 0.25]  // Pinky Curled
  ],
  thumbs_down: [
    [0, 1.6, 0],
    [-0.6, 0.9, 0.3], [-0.8, 0.2, 0.6], [-0.9, -0.6, 0.8], [-0.95, -1.5, 1.0], // Thumb DOWN
    [-0.5, 0.0, 0.1], [-0.4, -0.6, 0.4], [-0.2, -0.3, 0.6], [-0.2, 0.1, 0.5],
    [-0.1, -0.1, 0.0], [-0.05, -0.65, 0.35], [0.15, -0.35, 0.55], [0.15, 0.05, 0.45],
    [0.35, -0.05, -0.1], [0.4, -0.55, 0.25], [0.55, -0.25, 0.45], [0.5, 0.1, 0.35],
    [0.75, 0.1, -0.2], [0.75, -0.35, 0.15], [0.85, -0.1, 0.35], [0.8, 0.2, 0.25]
  ],
  victory: [
    [0, -1.8, 0],
    [-0.6, -1.0, 0.3], [-0.5, -0.3, 0.5], [-0.2, -0.1, 0.6], [-0.0, -0.2, 0.5], // Thumb folded over fingers
    [-0.6, -0.1, 0.1], [-0.8, 0.7, 0.1], [-1.0, 1.5, 0.1], [-1.2, 2.2, 0.1], // Index SPREAD LEFT
    [-0.1, 0.0, 0.0], [-0.0, 0.9, 0.0], [0.2, 1.7, 0.0], [0.4, 2.4, 0.0],   // Middle SPREAD RIGHT
    [0.35, -0.15, -0.1], [0.4, 0.35, 0.35], [0.45, 0.05, 0.55], [0.4, -0.3, 0.45], // Ring Curled
    [0.75, -0.3, -0.2], [0.75, 0.15, 0.25], [0.8, -0.1, 0.45], [0.75, -0.4, 0.35]  // Pinky Curled
  ],
  dual_namaste: [
    [0.9, -1.5, 0],
    [0.3, -0.9, 0.2], [-0.1, -0.4, 0.3], [-0.4, 0.0, 0.35], [-0.6, 0.3, 0.4],
    [0.5, -0.1, 0.1], [0.4, 0.7, 0.1], [0.35, 1.4, 0.1], [0.3, 2.0, 0.1],
    [0.85, 0.0, 0.0], [0.8, 0.85, 0.0], [0.75, 1.6, 0.0], [0.7, 2.3, 0.0],
    [1.2, -0.1, -0.1], [1.15, 0.7, -0.1], [1.1, 1.4, -0.1], [1.05, 1.9, -0.1],
    [1.5, -0.25, -0.2], [1.45, 0.4, -0.2], [1.4, 0.9, -0.2], [1.35, 1.4, -0.2]
  ],
  dual_frame: [
    [1.6, -1.2, 0],
    [0.8, -0.7, 0.2], [0.1, -0.4, 0.3], [-0.6, -0.4, 0.35], [-1.2, -0.4, 0.4], // Thumb pointing left (L-shape)
    [1.2, -0.1, 0.1], [1.2, 0.7, 0.1], [1.2, 1.4, 0.1], [1.2, 2.1, 0.1], // Index pointing UP (L-shape)
    [1.5, -0.1, -0.1], [1.4, 0.4, 0.3], [1.2, 0.1, 0.5], [1.1, -0.2, 0.4], // Others curled
    [1.8, -0.2, -0.2], [1.7, 0.3, 0.2], [1.5, 0.0, 0.4], [1.4, -0.3, 0.3],
    [2.1, -0.3, -0.3], [2.0, 0.1, 0.1], [1.8, -0.1, 0.3], [1.7, -0.4, 0.2]
  ]
};

// Feature Information Modules
const MODULES = [
  {
    title: 'Invariant 21-Point Skeleton Tracking',
    desc: 'MediaPipe extracts 21 wrist-relative 3D landmarks at 12 fps. Handline translates and scale-normalizes each point against the distance between wrist and middle MCP, guaranteeing consistent recognition across varying camera distances while preserving orientation.',
    tags: ['Local WASM', 'Scale Invariant', 'Zero Latency']
  },
  {
    title: 'Dual-Hand 126-D Spatial Vector Geometry',
    desc: 'Dual-hand mode tracks 42 total landmarks (21 per hand). Handline models inter-wrist distance, hand displacement angles, and individual finger articulations into an invariant 126-dimensional spatial vector for two-handed gestures like Namaste and Viewfinder framing.',
    tags: ['Dual-Hand Support', '126-D Vector', 'Inter-Wrist Tracking']
  },
  {
    title: 'Gemma Multimodal Visual Reasoner',
    desc: 'For custom poses, Handline composites a labeled contact sheet (LIVE POSE vs REFERENCE crops). Local Gemma 4 12B visually audits finger extension, thumb placement, and orientation, providing natural language explanations alongside candidate validation.',
    tags: ['Multimodal Reasoner', 'Contact Sheet In-Memory', 'Visual Audit']
  },
  {
    title: 'ElevenLabs Voice Banking & Multilingual Speech',
    desc: 'Integrated with ElevenLabs Multilingual v2 and Turbo v2.5. Offers instant voice cloning for AAC voice banking, automated sound effects, and intelligent IndexedDB caching. Falls back seamlessly to offline device speech when network is unavailable.',
    tags: ['ElevenLabs TTS', 'Voice Banking (IVC)', 'IndexedDB Cache']
  }
];

// Initialize Three.js Scene
const stageWrapper = document.getElementById('stage-wrapper');
const canvas = document.getElementById('stage-canvas');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0, 0.5, 11);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Lighting
const ambient = new THREE.AmbientLight(0xdcf8e8, 1.4);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(5, 8, 10);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x72cba2, 2.0);
rimLight.position.set(-6, -4, -6);
scene.add(rimLight);

// Master Hand Group
const handGroup = new THREE.Group();
scene.add(handGroup);

// Materials
const jointMaterial = new THREE.MeshStandardMaterial({
  color: 0x9ee6b8,
  roughness: 0.22,
  metalness: 0.35,
  emissive: 0x184d33,
  emissiveIntensity: 0.4
});

const jointHoverMaterial = new THREE.MeshStandardMaterial({
  color: 0xffee88,
  roughness: 0.15,
  metalness: 0.5,
  emissive: 0x997700,
  emissiveIntensity: 0.8
});

const boneMaterial = new THREE.MeshStandardMaterial({
  color: 0x487a60,
  roughness: 0.35,
  metalness: 0.2
});

const leftJointMaterial = new THREE.MeshStandardMaterial({
  color: 0x86c7db,
  roughness: 0.22,
  metalness: 0.35,
  emissive: 0x153945,
  emissiveIntensity: 0.4
});

const leftBoneMaterial = new THREE.MeshStandardMaterial({
  color: 0x335b69,
  roughness: 0.35,
  metalness: 0.2
});

const interWristMaterial = new THREE.LineDashedMaterial({
  color: 0x69d499,
  dashSize: 0.2,
  gapSize: 0.15,
  linewidth: 2
});

// Build Hand 1 (Right Hand)
const rightJoints = [];
const rightBones = [];

for (let i = 0; i < 21; i++) {
  const geom = new THREE.SphereGeometry(i === 0 ? 0.17 : i % 4 === 0 ? 0.14 : 0.11, 20, 16);
  const mesh = new THREE.Mesh(geom, jointMaterial);
  mesh.userData = { id: i, hand: 'right', name: LANDMARK_NAMES[i], desc: LANDMARK_DESCS[i] };
  handGroup.add(mesh);
  rightJoints.push(mesh);
}

EDGES.forEach(([a, b]) => {
  const geom = new THREE.CylinderGeometry(0.045, 0.045, 1, 10);
  const mesh = new THREE.Mesh(geom, boneMaterial);
  handGroup.add(mesh);
  rightBones.push({ mesh, a, b });
});

// Build Hand 2 (Left Hand for Dual-Hand Mode)
const leftGroup = new THREE.Group();
const leftJoints = [];
const leftBones = [];

for (let i = 0; i < 21; i++) {
  const geom = new THREE.SphereGeometry(i === 0 ? 0.17 : i % 4 === 0 ? 0.14 : 0.11, 20, 16);
  const mesh = new THREE.Mesh(geom, leftJointMaterial);
  mesh.userData = { id: i, hand: 'left', name: `LEFT ${LANDMARK_NAMES[i]}`, desc: LANDMARK_DESCS[i] };
  leftGroup.add(mesh);
  leftJoints.push(mesh);
}

EDGES.forEach(([a, b]) => {
  const geom = new THREE.CylinderGeometry(0.045, 0.045, 1, 10);
  const mesh = new THREE.Mesh(geom, leftBoneMaterial);
  leftGroup.add(mesh);
  leftBones.push({ mesh, a, b });
});

leftGroup.visible = false;
handGroup.add(leftGroup);

// Inter-wrist connection line for dual hand vector visualization
const interWristGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const interWristLine = new THREE.Line(interWristGeom, interWristMaterial);
interWristLine.visible = false;
handGroup.add(interWristLine);

// 3D Holographic Contact Sheet Plane (Visual Reasoner Inspection)
const contactCanvas = document.createElement('canvas');
contactCanvas.width = 512;
contactCanvas.height = 340;
const ctx = contactCanvas.getContext('2d');

function updateContactSheetCanvas(label = 'MATCH CONFIRMED') {
  ctx.fillStyle = '#10221a';
  ctx.fillRect(0, 0, 512, 340);

  // Header bar
  ctx.fillStyle = '#254f41';
  ctx.fillRect(0, 0, 512, 44);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('GEMMA 4 VISUAL REASONER', 18, 28);

  // Tile 1: Live Pose
  ctx.fillStyle = '#18382c';
  ctx.fillRect(20, 60, 225, 180);
  ctx.strokeStyle = '#9ee6b8';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 60, 225, 180);
  ctx.fillStyle = '#9ee6b8';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('LIVE POSE [QUERY]', 30, 85);
  ctx.fillStyle = '#a1bcab';
  ctx.font = '12px sans-serif';
  ctx.fillText('• 21 Landmarks active', 30, 115);
  ctx.fillText('• Thumb vector: [0.95, 1.30]', 30, 135);
  ctx.fillText('• Fingers curled: 4/4', 30, 155);

  // Tile 2: Enrolled Reference
  ctx.fillStyle = '#18382c';
  ctx.fillRect(265, 60, 225, 180);
  ctx.strokeStyle = '#69d49988';
  ctx.lineWidth = 1;
  ctx.strokeRect(265, 60, 225, 180);
  ctx.fillStyle = '#69d499';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('REFERENCE A1 [SAVED]', 275, 85);
  ctx.fillStyle = '#a1bcab';
  ctx.font = '12px sans-serif';
  ctx.fillText('• Enrolled pose #1', 275, 115);
  ctx.fillText('• Stored vector similarity: 96%', 275, 135);
  ctx.fillText('• Phrase: "Yes"', 275, 155);

  // Bottom verdict box
  ctx.fillStyle = '#173f2e';
  ctx.fillRect(20, 255, 470, 65);
  ctx.fillStyle = '#bdf7d4';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`VERDICT: ${label}`, 36, 282);
  ctx.fillStyle = '#89bfa1';
  ctx.font = '12px sans-serif';
  ctx.fillText('Gemma explanation: "Live thumb raised with fingers curled; matches Ref A1 with high fidelity."', 36, 305);
}

updateContactSheetCanvas();
const contactTexture = new THREE.CanvasTexture(contactCanvas);
const contactMaterial = new THREE.MeshBasicMaterial({ map: contactTexture, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
const contactPlane = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.0), contactMaterial);
contactPlane.position.set(4.2, 0.4, -0.8);
contactPlane.rotation.y = -0.32;
contactPlane.visible = false;
scene.add(contactPlane);

// Audio Wave Rings (Simulated Speech Pulse)
const waveRings = [];
for (let i = 0; i < 3; i++) {
  const ringGeom = new THREE.TorusGeometry(1.6 + i * 0.8, 0.025, 8, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x9ee6b8, transparent: true, opacity: 0 });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.rotation.x = Math.PI / 2;
  handGroup.add(ring);
  waveRings.push(ring);
}

// Current & Target 3D Coordinates
let currentPoseName = 'open_palm';
let currentPoints = POSES.open_palm.map(p => new THREE.Vector3(...p));
let targetPoints = POSES.open_palm.map(p => new THREE.Vector3(...p));
let dualHandMode = false;
let audioPulseActive = false;
let pulseTimer = 0;

// Updates bone cylinders between joint positions
function updateBones(joints, bones) {
  bones.forEach(({ mesh, a, b }) => {
    const pA = joints[a].position;
    const pB = joints[b].position;
    const dir = new THREE.Vector3().subVectors(pB, pA);
    const len = dir.length();
    mesh.position.copy(pA).add(pB).multiplyScalar(0.5);
    mesh.scale.set(1, len, 1);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  });
}

function setPose(poseKey) {
  currentPoseName = poseKey;
  const raw = POSES[poseKey] || POSES.open_palm;
  targetPoints = raw.map(p => new THREE.Vector3(...p));

  const isDual = poseKey.startsWith('dual_') || dualHandMode;
  setDualHand(isDual, false);

  // Update HUD
  const title = poseKey.replace('_', ' ').toUpperCase();
  document.getElementById('hud-pose-title').textContent = `${title} · ${isDual ? '42 LANDMARKS (DUAL)' : '21 LANDMARKS'}`;
  document.getElementById('hud-status').textContent = `MATCH SCORE: ${poseKey === 'thumbs_down' ? '92%' : '98%'} · VERIFIED`;

  // Update Contact Sheet
  updateContactSheetCanvas(`POSE ${title} MATCH`);
  contactTexture.needsUpdate = true;
}

function setDualHand(enabled, updateButtons = true) {
  dualHandMode = enabled;
  leftGroup.visible = enabled;
  interWristLine.visible = enabled;

  const btn = document.getElementById('toggle-hands-btn');
  if (btn) btn.classList.toggle('active-toggle', enabled);

  if (enabled) {
    if (!currentPoseName.startsWith('dual_')) {
      setPose('dual_namaste');
    }
  } else if (currentPoseName.startsWith('dual_')) {
    setPose('open_palm');
  }
}

// Interactive Orbit & Drag Rotation
let isDragging = false;
let prevX = 0, prevY = 0;
let velX = 0, velY = 0;

renderer.domElement.addEventListener('pointerdown', e => {
  isDragging = true;
  prevX = e.clientX;
  prevY = e.clientY;
  renderer.domElement.setPointerCapture(e.pointerId);
});

renderer.domElement.addEventListener('pointermove', e => {
  if (isDragging) {
    const deltaX = e.clientX - prevX;
    const deltaY = e.clientY - prevY;
    velX = deltaX * 0.007;
    velY = deltaY * 0.007;
    handGroup.rotation.y += velX;
    handGroup.rotation.x += velY;
    prevX = e.clientX;
    prevY = e.clientY;
  }
  checkRaycasting(e);
});

renderer.domElement.addEventListener('pointerup', () => { isDragging = false; });
renderer.domElement.addEventListener('pointercancel', () => { isDragging = false; });

// Zoom with wheel
renderer.domElement.addEventListener('wheel', e => {
  e.preventDefault();
  camera.position.z = THREE.MathUtils.clamp(camera.position.z + e.deltaY * 0.01, 6, 18);
}, { passive: false });

// Raycasting Joint Inspector
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hoveredMesh = null;

function checkRaycasting(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const targets = [...rightJoints, ...(dualHandMode ? leftJoints : [])];
  const hits = raycaster.intersectObjects(targets);

  if (hits.length > 0) {
    const mesh = hits[0].object;
    if (hoveredMesh !== mesh) {
      if (hoveredMesh) hoveredMesh.material = hoveredMesh.userData.hand === 'left' ? leftJointMaterial : jointMaterial;
      hoveredMesh = mesh;
      hoveredMesh.material = jointHoverMaterial;

      // Update Inspector Card
      const card = document.getElementById('joint-card');
      const name = document.getElementById('joint-name');
      const coords = document.getElementById('joint-coords');
      const desc = document.getElementById('joint-desc');

      const p = hoveredMesh.position;
      name.textContent = hoveredMesh.userData.name;
      coords.textContent = `X: ${p.x.toFixed(3)} · Y: ${p.y.toFixed(3)} · Z: ${p.z.toFixed(3)}`;
      desc.textContent = hoveredMesh.userData.desc;
      card.style.opacity = '1';
    }
  } else if (hoveredMesh) {
    hoveredMesh.material = hoveredMesh.userData.hand === 'left' ? leftJointMaterial : jointMaterial;
    hoveredMesh = null;
  }
}

// UI Event Listeners
document.querySelectorAll('.pose-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pose-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    setPose(btn.dataset.pose);
  });
});

document.getElementById('toggle-hands-btn').addEventListener('click', () => {
  setDualHand(!dualHandMode);
});

document.getElementById('toggle-inspector-btn').addEventListener('click', function() {
  contactPlane.visible = !contactPlane.visible;
  this.classList.toggle('active-toggle', contactPlane.visible);
});

document.getElementById('simulate-speech-btn').addEventListener('click', () => {
  audioPulseActive = true;
  pulseTimer = 0;

  // Browser Speech synthesis preview
  if ('speechSynthesis' in window) {
    const utter = new SpeechSynthesisUtterance(currentPoseName === 'thumbs_up' ? 'Yes, that works.' : 'Handline gestures in three dimensions.');
    utter.rate = 1.0;
    window.speechSynthesis.speak(utter);
  }
});

// Tab Module Selectors
document.querySelectorAll('.tab-btn').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active-tab'));
    tab.classList.add('active-tab');

    const mod = MODULES[Number(tab.dataset.module)];
    document.getElementById('feature-title').textContent = mod.title;
    document.getElementById('feature-desc').textContent = mod.desc;

    const tagsContainer = document.getElementById('feature-tags');
    tagsContainer.innerHTML = mod.tags.map(t => `<span class="feature-tag">${t}</span>`).join('');

    // Trigger visual cue
    if (tab.dataset.module === '1') setDualHand(true);
    if (tab.dataset.module === '2') {
      contactPlane.visible = true;
      document.getElementById('toggle-inspector-btn').classList.add('active-toggle');
    }
  });
});

// Responsive resize
function onResize() {
  const w = stageWrapper.clientWidth;
  const h = stageWrapper.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', onResize);
onResize();

// Main Animation Loop
function animate() {
  requestAnimationFrame(animate);

  // Smooth inertial damping for rotation
  if (!isDragging) {
    velX *= 0.93;
    velY *= 0.93;
    handGroup.rotation.y += velX + 0.003;
    handGroup.rotation.x += velY;
  }

  // Smooth Landmark Morphing (Right Hand)
  for (let i = 0; i < 21; i++) {
    currentPoints[i].lerp(targetPoints[i], 0.09);
    rightJoints[i].position.copy(currentPoints[i]);

    // Mirrored Left Hand
    if (dualHandMode) {
      const leftTarget = new THREE.Vector3(-currentPoints[i].x, currentPoints[i].y, currentPoints[i].z);
      leftJoints[i].position.lerp(leftTarget, 0.09);
    }
  }

  updateBones(rightJoints, rightBones);
  if (dualHandMode) {
    updateBones(leftJoints, leftBones);

    // Update inter-wrist beam
    const pos = interWristGeom.attributes.position;
    pos.setXYZ(0, rightJoints[0].position.x, rightJoints[0].position.y, rightJoints[0].position.z);
    pos.setXYZ(1, leftJoints[0].position.x, leftJoints[0].position.y, leftJoints[0].position.z);
    pos.needsUpdate = true;
  }

  // Audio Pulse Animation
  if (audioPulseActive) {
    pulseTimer += 0.04;
    waveRings.forEach((ring, i) => {
      const scale = 1 + (pulseTimer - i * 0.25) * 1.5;
      if (scale > 1) {
        ring.scale.set(scale, scale, scale);
        ring.material.opacity = Math.max(0, 0.7 - (scale - 1) * 0.45);
      }
    });
    if (pulseTimer > 2.2) {
      audioPulseActive = false;
      waveRings.forEach(r => { r.material.opacity = 0; });
    }
  }

  // Subtle floating motion for holographic contact sheet
  if (contactPlane.visible) {
    contactPlane.position.y = 0.4 + Math.sin(Date.now() * 0.002) * 0.08;
  }

  renderer.render(scene, camera);
}

animate();
