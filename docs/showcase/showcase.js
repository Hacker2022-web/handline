import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js';

const modules = [
  ['Movement becomes meaning.', 'MediaPipe tracks up to two hands in the browser. Handline compares normalized landmarks with your examples and waits for a stable, unambiguous match.', 'LOCAL TRACKING · VISIBLE MATCH SCORE', 0xa9ecc0],
  ['A vocabulary that is yours.', 'Record examples of your own gestures and connect each one to a phrase you choose. Your saved vocabulary stays in your browser.', 'PERSONAL ENROLLMENT · ONE OR TWO HANDS', 0xd4efaa],
  ['Give your words a voice.', 'Speak a saved phrase with a device voice or opt into ElevenLabs online speech. Cached audio can be played offline.', 'DEVICE SPEECH · OPTIONAL ELEVENLABS', 0xa3dfde],
  ['Assistance, with your review.', 'Optionally inspect a Gemma visual comparison or create an editable phrase draft. You decide when to speak the result.', 'VISUAL VERIFICATION · REVIEWED DRAFTS', 0xcbbded],
];
const buttons = [...document.querySelectorAll('[role="tab"]')];
const title = document.querySelector('#detail-title'), description = document.querySelector('#detail-text'), note = document.querySelector('#detail-note');
let selected = 0;
buttons.forEach((button, i) => button.addEventListener('click', () => { selected = i; buttons.forEach((b, j) => b.setAttribute('aria-selected', String(i === j))); [title.textContent, description.textContent, note.textContent] = modules[i]; }));
const stage = document.querySelector('#stage');
try {
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); stage.prepend(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(35, 1, .1, 100); camera.position.set(0, 0, 13);
  scene.add(new THREE.HemisphereLight(0xe2ffed, 0x183629, 2.4)); const light = new THREE.DirectionalLight(0xffffff, 2.5); light.position.set(3, 5, 8); scene.add(light);
  const group = new THREE.Group(); scene.add(group);
  const material = new THREE.MeshStandardMaterial({color:0xa9ecc0, roughness:.28, metalness:.25});
  const jointMat = new THREE.MeshStandardMaterial({color:0xe3ffeb, roughness:.25, metalness:.2});
  const points = [[0,-2,0],[-1.05,-.85,0],[-1.5,-.2,0],[-1.9,.35,0],[-2.25,.65,0],[-.75,-.1,0],[-.85,.8,0],[-.9,1.55,0],[-.9,2.15,0],[-.25,.05,0],[-.25,1.05,0],[-.25,1.9,0],[-.25,2.65,0],[.3,0,0],[.35,.95,0],[.4,1.7,0],[.42,2.3,0],[.8,-.15,0],[.95,.6,0],[1.05,1.2,0],[1.1,1.7,0]].map(p=>new THREE.Vector3(...p));
  const edges = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[17,0]];
  points.forEach(p=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.105,16,12),jointMat);m.position.copy(p);group.add(m)});
  edges.forEach(([a,b])=>{const d=new THREE.Vector3().subVectors(points[b],points[a]);const m=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,d.length(),10),material);m.position.copy(points[a]).add(points[b]).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());group.add(m)});
  const ring=new THREE.Mesh(new THREE.TorusGeometry(3.25,.012,8,100),material);ring.rotation.x=1.15;group.add(ring); group.rotation.set(.15,-.3,-.18);
  let dragging=false,lastX=0,lastY=0; renderer.domElement.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId)}); renderer.domElement.addEventListener('pointermove',e=>{if(!dragging)return;group.rotation.y+=(e.clientX-lastX)*.01;group.rotation.x+=(e.clientY-lastY)*.01;lastX=e.clientX;lastY=e.clientY});renderer.domElement.addEventListener('pointerup',()=>dragging=false);renderer.domElement.addEventListener('pointercancel',()=>dragging=false);
  const resize=()=>{const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};new ResizeObserver(resize).observe(stage);resize();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'); function animate(){requestAnimationFrame(animate);if(!dragging&&!reduced.matches)group.rotation.y+=.003;material.color.lerp(new THREE.Color(modules[selected][3]),.04);renderer.render(scene,camera)}animate();
} catch { document.querySelector('#hint').textContent='3D visualization unavailable on this device. Explore the modules below.'; }
