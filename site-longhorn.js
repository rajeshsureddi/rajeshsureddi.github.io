// A 3D Texas longhorn that lives in the corner of the page.
// Double-click the page to plant bluebonnets for it to graze, wave the cursor near it
// like a matador's cape to make it charge, hover to get its attention, or click it.
// It only appears once the visitor switches on "Fun mode"; the choice is remembered.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const toggle = document.getElementById('site-longhorn-toggle');
const STORAGE_KEY = 'site-longhorn-on';
const HINT_KEY = 'site-longhorn-hint-seen';

if (toggle && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) setUpToggle();

function setUpToggle() {
  let longhorn = null;
  const remembered = () => { try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (error) { return false; } };
  const apply = on => {
    if (on && !longhorn) longhorn = start();
    if (on && !longhorn) {
      // No WebGL: there is nothing to switch on.
      toggle.hidden = true;
      return;
    }
    toggle.setAttribute('aria-checked', String(on));
    if (longhorn) longhorn[on ? 'show' : 'hide']();
  };
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    const on = toggle.getAttribute('aria-checked') !== 'true';
    try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch (error) { /* private mode */ }
    apply(on);
  });
  apply(remembered());
}

function start() {
  const canvas = document.createElement('canvas');
  canvas.id = 'site-longhorn';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (error) {
    canvas.remove();
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 1.4, 0.1, 60);
  camera.position.set(0, 2.2, 10.2);
  camera.lookAt(0, 0.95, 0);
  scene.add(new THREE.HemisphereLight(0xfff4e2, 0x6b4a2e, 1.4));
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.2);
  sun.position.set(-3, 6, 5);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xffd2a8, 0.9);
  rim.position.set(4, 3, -4);
  scene.add(rim);

  const steer = buildLonghorn();
  scene.add(steer.root);

  // ---------------------------------------------------------------------------
  // Model
  // ---------------------------------------------------------------------------

  function coatTexture() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#b4520c';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4000; i += 1) {
      const shade = Math.random() < .5 ? 'rgba(120, 48, 6, .18)' : 'rgba(226, 128, 52, .14)';
      g.fillStyle = shade;
      g.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 3 + Math.random() * 6);
    }
    // Irregular white patches, like Bevo's.
    g.fillStyle = '#f4ede1';
    const patches = [[110, 150, 46], [330, 300, 54], [430, 110, 34], [200, 420, 30]];
    patches.forEach(([cx, cy, r]) => {
      for (let i = 0; i < 16; i += 1) {
        g.beginPath();
        g.ellipse(cx + (Math.random() - .5) * r * 1.2, cy + (Math.random() - .5) * r * 1.4, r * (.3 + Math.random() * .35), r * (.4 + Math.random() * .4), Math.random() * 3, 0, Math.PI * 2);
        g.fill();
      }
    });
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // A tapered tube that sweeps out, forward and up, shading from cream to a dark tip.
  function hornGeometry(side) {
    const points = [[0, 0, 0], [0.03, 0.03, 0.38], [0.08, 0.02, 0.8], [0.13, 0.07, 1.2], [0.12, 0.22, 1.5], [0.05, 0.42, 1.64]]
      .map(([x, y, z]) => new THREE.Vector3(x, y, z * side));
    const curve = new THREE.CatmullRomCurve3(points);
    const rings = 56;
    const sides = 12;
    const geometry = new THREE.TubeGeometry(curve, rings, 1, sides, false);
    const position = geometry.attributes.position;
    const colors = [];
    const base = new THREE.Color(0xf2e6c8);
    const middle = new THREE.Color(0xd9c49a);
    const tip = new THREE.Color(0x3d2e22);
    const vertex = new THREE.Vector3();
    for (let i = 0; i <= rings; i += 1) {
      const t = i / rings;
      const centre = curve.getPointAt(t);
      const radius = 0.09 * (1 - .87 * Math.pow(t, .7));
      const color = t < .7 ? base.clone().lerp(middle, t / .7) : middle.clone().lerp(tip, (t - .7) / .3);
      for (let j = 0; j <= sides; j += 1) {
        const index = i * (sides + 1) + j;
        vertex.fromBufferAttribute(position, index).sub(centre).multiplyScalar(radius).add(centre);
        position.setXYZ(index, vertex.x, vertex.y, vertex.z);
        colors.push(color.r, color.g, color.b);
      }
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  function shadowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gradient = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(30, 25, 20, .38)');
    gradient.addColorStop(1, 'rgba(30, 25, 20, 0)');
    g.fillStyle = gradient;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function buildLonghorn() {
    const material = {
      coat: new THREE.MeshStandardMaterial({ map: coatTexture(), roughness: .88 }),
      plain: new THREE.MeshStandardMaterial({ color: 0xa9490a, roughness: .88 }),
      white: new THREE.MeshStandardMaterial({ color: 0xf1e9dc, roughness: .9 }),
      horn: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .32 }),
      hoof: new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: .55 }),
      eye: new THREE.MeshStandardMaterial({ color: 0x0f0805, roughness: .08 }),
      muzzle: new THREE.MeshStandardMaterial({ color: 0xcfa892, roughness: .65 }),
      nostril: new THREE.MeshStandardMaterial({ color: 0x3a2219, roughness: .7 }),
      tuft: new THREE.MeshStandardMaterial({ color: 0x3b2416, roughness: 1 })
    };
    const mesh = (geometry, mat, [x, y, z] = [0, 0, 0], [sx, sy, sz] = [1, 1, 1]) => {
      const m = new THREE.Mesh(geometry, mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      return m;
    };
    const sphere = r => new THREE.SphereGeometry(r, 24, 16);

    const root = new THREE.Group();     // yaw (facing)
    const rig = new THREE.Group();      // lying down, gallop pitch
    root.add(rig);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.1, 1.5),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = .005;
    root.add(shadow);

    const torso = new THREE.Group();
    torso.position.y = 1.15;
    rig.add(torso);
    const barrel = mesh(new THREE.CapsuleGeometry(.42, 1.16, 10, 24), material.coat, [0, 0, 0], [1, 1, .86]);
    barrel.rotation.z = Math.PI / 2;
    torso.add(barrel);
    torso.add(mesh(sphere(.34), material.coat, [.45, .14, 0], [1.4, .66, .9]));      // shoulder hump
    torso.add(mesh(sphere(.36), material.white, [0, -.28, 0], [2.1, .45, .76]));     // pale belly
    torso.add(mesh(sphere(.34), material.coat, [-.66, .1, 0], [1, .95, .9]));         // hips

    // Neck and head hang off a pivot at the shoulders so the head can drop to graze.
    const neck = new THREE.Group();
    neck.position.set(.78, .14, 0);
    torso.add(neck);
    const neckMesh = mesh(new THREE.CapsuleGeometry(.27, .32, 8, 16), material.coat, [.2, .06, 0], [1, 1, .82]);
    neckMesh.rotation.z = -1.05;
    neck.add(neckMesh);
    neck.add(mesh(sphere(.17), material.coat, [.2, -.12, 0], [1.4, .8, .6]));        // dewlap

    const head = new THREE.Group();
    head.position.set(.54, .2, 0);
    head.scale.setScalar(1.15);
    neck.add(head);
    head.add(mesh(sphere(.22), material.coat, [0, 0, 0], [1.05, 1, .95]));
    const faceAngle = -2.2;
    const along = d => [Math.sin(-faceAngle) * d, Math.cos(-faceAngle) * d];
    const face = mesh(new THREE.CylinderGeometry(.135, .175, .46, 18), material.white);
    face.rotation.z = faceAngle;
    face.position.set(...along(.21), 0);
    head.add(face);
    const muzzle = mesh(sphere(.15), material.muzzle, [...along(.45), 0], [1.05, .85, 1.1]);
    head.add(muzzle);
    [-1, 1].forEach(side => {
      const nostril = mesh(sphere(.03), material.nostril, [...along(.56), side * .065], [1, .7, 1]);
      head.add(nostril);
    });
    const eyes = [-1, 1].map(side => {
      const eye = mesh(sphere(.042), material.eye, [.07, .06, side * .185]);
      head.add(eye);
      return eye;
    });
    const ears = [-1, 1].map(side => {
      const ear = new THREE.Group();
      ear.position.set(-.06, .06, side * .19);
      ear.add(mesh(sphere(.11), material.plain, [0, -.03, side * .12], [.5, .3, 1]));
      ear.rotation.x = side * .35;
      head.add(ear);
      return ear;
    });
    [-1, 1].forEach(side => {
      const horn = new THREE.Mesh(hornGeometry(side), material.horn);
      horn.position.set(-.03, .17, side * .1);
      head.add(horn);
    });
    head.add(mesh(sphere(.12), material.coat, [-.03, .17, 0], [.8, .55, 1.5]));       // horn boss

    const legs = [[.6, .2, true], [.6, -.2, true], [-.64, .2, false], [-.64, -.2, false]].map(([x, z, front]) => {
      const hip = new THREE.Group();
      hip.position.set(x, .92, z);
      hip.add(mesh(new THREE.CylinderGeometry(.12, .075, .47, 12), material.plain, [0, -.2, 0]));
      const knee = new THREE.Group();
      knee.position.y = -.45;
      knee.add(mesh(sphere(.07), material.plain, [0, 0, 0]));
      knee.add(mesh(new THREE.CylinderGeometry(.062, .052, .38, 10), material.plain, [0, -.19, 0]));
      knee.add(mesh(new THREE.CylinderGeometry(.06, .072, .09, 10), material.hoof, [0, -.415, 0]));
      hip.add(knee);
      rig.add(hip);
      return { hip, knee, front };
    });

    const tail = new THREE.Group();
    tail.position.set(-1.02, .2, 0);
    torso.add(tail);
    const tailBones = [];
    let parent = tail;
    for (let i = 0; i < 4; i += 1) {
      const bone = new THREE.Group();
      bone.position.y = i === 0 ? 0 : -.2;
      bone.add(mesh(new THREE.CylinderGeometry(.035 - i * .004, .03 - i * .004, .21, 8), material.plain, [0, -.1, 0]));
      parent.add(bone);
      tailBones.push(bone);
      parent = bone;
    }
    parent.add(mesh(sphere(.075), material.tuft, [0, -.25, 0], [1, 1.8, 1]));

    return { root, rig, torso, neck, head, eyes, ears, legs, tailBones, muzzle };
  }

  // ---------------------------------------------------------------------------
  // Page behaviour
  // ---------------------------------------------------------------------------

  const MAX_FLOWERS = 5;
  const GREETINGS = ["Hook 'em! \u{1F918}", 'Moo!', "Hook 'em! \u{1F918}", 'Mooo?'];
  const BURNT_ORANGE = '#bf5700';

  const mobile = () => window.innerWidth <= 720;
  const size = () => (mobile() ? { width: 210, height: 150 } : { width: 300, height: 214 });
  const flowerSize = () => (mobile() ? { width: 20, height: 34 } : { width: 26, height: 44 });
  const now = () => performance.now();
  const random = (min, max) => min + Math.random() * (max - min);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const floorY = () => window.innerHeight - size().height + 8;
  const yawFor = side => (side === 1 ? -.72 : -Math.PI + .72);

  let home;
  let position;
  let target;
  let facing = -1;
  let yaw = yawFor(-1);
  let state = 'idle';
  let stateStarted = 0;
  let lastFrameTime = now();
  let hovering = false;
  let blinkAt = 0;
  let blinkUntil = 0;
  let nextIdleAction = 0;
  let sitUntil = 0;
  let sleepAt = 0;
  let fxAt = 0;
  let earFlickAt = 0;
  let hop = 0;
  let speed = 0;
  let greeting = 0;
  let calmUntil = 0;
  let gaitPhase = 0;
  let hitBox = null;
  const flowers = [];
  let meal = null;
  let enabled = false;
  let frame = 0;

  // Smoothed pose values; each state sets targets and the rig eases toward them.
  const pose = { lie: 0, neck: 0, head: 0, look: 0, walk: 0, gallop: 0, paw: 0, chew: 0, pitch: 0, blink: 0 };
  const goal = { ...pose };

  function resize() {
    const { width, height } = size();
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function setHome() {
    resize();
    home = { x: window.innerWidth - size().width - 8, y: floorY() };
    if (!position || state === 'idle' || state === 'sit' || state === 'sleep') {
      position = { ...home };
      target = { ...home };
    }
  }

  function enter(nextState) {
    state = nextState;
    canvas.dataset.state = nextState;
    stateStarted = now();
    if (nextState === 'idle') nextIdleAction = stateStarted + random(4000, 9000);
  }

  const resting = () => state === 'idle' || state === 'sit' || state === 'sleep' || state === 'wander';

  function applyPose(p, time) {
    const { rig, torso, neck, head, eyes, ears, legs, tailBones } = steer;
    rig.position.y = -.56 * p.lie;
    rig.rotation.z = p.pitch;
    torso.scale.y = 1 + Math.sin(time / 600) * .012;
    neck.rotation.z = p.neck - .25 * p.lie;
    head.rotation.z = p.head + Math.sin(time / 70) * .07 * p.chew;
    head.rotation.y = p.look;
    eyes.forEach(eye => { eye.scale.y = 1 - .88 * p.blink; });
    const flick = time < earFlickAt + 260 ? Math.sin((time - earFlickAt) / 260 * Math.PI) * .5 : 0;
    ears.forEach((ear, i) => { ear.rotation.y = i ? flick : 0; });

    legs.forEach((leg, i) => {
      const walkPhase = gaitPhase + (i === 0 || i === 3 ? 0 : Math.PI);
      const gallopPhase = gaitPhase + [0, .5, Math.PI, Math.PI + .5][i];
      let swing = Math.sin(walkPhase) * .38 * p.walk + Math.sin(gallopPhase) * .72 * p.gallop;
      let bend = Math.max(0, Math.cos(walkPhase)) * .5 * p.walk + Math.max(0, Math.cos(gallopPhase)) * 1.1 * p.gallop;
      if (i === 0) {
        // Paw the ground: lift forward, then scrape back.
        const scrape = Math.sin(time / 95);
        swing += (scrape * .45 + .15) * p.paw;
        bend += Math.max(0, scrape) * 1.0 * p.paw;
      }
      const fold = leg.front ? [-1.45, 2.7] : [1.35, -2.6];
      leg.hip.rotation.z = swing * (1 - p.lie) + fold[0] * p.lie;
      leg.knee.rotation.z = bend * (leg.front ? -1 : 1) * (1 - p.lie) + fold[1] * p.lie;
    });

    const swish = Math.sin(time / 380) * (.25 + .25 * p.gallop);
    tailBones.forEach((bone, i) => {
      bone.rotation.x = swish * (i + 1) * .35;
      bone.rotation.z = i === 0 ? -.35 - .9 * p.gallop : -.08 * p.gallop;
    });
  }

  function render(time) {
    steer.root.rotation.y = yaw;
    applyPose(pose, time);
    renderer.render(scene, camera);
    canvas.style.transform = `translate3d(${Math.round(position.x)}px, ${Math.round(position.y - hop)}px, 0)`;
  }

  // Where a part of the model sits on the page.
  function screenPoint(object, at = position) {
    const point = object.getWorldPosition(new THREE.Vector3()).project(camera);
    const { width, height } = size();
    return { x: at.x + (point.x + 1) / 2 * width, y: at.y + (1 - point.y) / 2 * height };
  }

  // Muzzle position relative to the canvas when grazing while facing `side`.
  function grazeMuzzleOffset(side) {
    const saved = steer.root.rotation.y;
    steer.root.rotation.y = yawFor(side);
    applyPose({ ...pose, lie: 0, neck: -1.15, head: -.55, look: 0, walk: 0, gallop: 0, paw: 0, chew: 0, pitch: 0 }, 0);
    scene.updateMatrixWorld(true);
    const offset = screenPoint(steer.muzzle, { x: 0, y: 0 });
    steer.root.rotation.y = saved;
    applyPose(pose, now());
    scene.updateMatrixWorld(true);
    return offset;
  }

  function updateHitBox() {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(steer.rig);
    const { width, height } = size();
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (let i = 0; i < 8; i += 1) {
      const corner = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
      const x = (corner.x + 1) / 2 * width;
      const y = (1 - corner.y) / 2 * height;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
    // The horns make the box generous; trim it so only the animal itself counts.
    const padX = (right - left) * .16;
    hitBox = { left: left + padX, right: right - padX, top: top + (bottom - top) * .18, bottom };
  }

  function overLonghorn(x, y) {
    if (!hitBox) return false;
    const localX = x - position.x;
    const localY = y - position.y + hop;
    return localX > hitBox.left && localX < hitBox.right && localY > hitBox.top && localY < hitBox.bottom;
  }

  // --- effects ----------------------------------------------------------------

  function fx({ x, y, size: diameter = 10, color = 'transparent', text = '', textColor = BURNT_ORANGE, dx = 0, dy = -60, duration = 1000, grow = 1.2, blur = 0 }) {
    const element = document.createElement('div');
    element.className = 'site-longhorn-fx';
    element.style.left = `${x - diameter / 2}px`;
    element.style.top = `${y - diameter / 2}px`;
    if (text) {
      element.textContent = text;
      element.style.color = textColor;
      element.style.fontSize = `${diameter}px`;
    } else {
      element.style.width = element.style.height = `${diameter}px`;
      element.style.background = color;
      if (blur) element.style.filter = `blur(${blur}px)`;
    }
    document.body.append(element);
    const animation = element.animate([
      { opacity: 1, transform: 'translate(0, 0) scale(1)' },
      { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(${grow})` }
    ], { duration, easing: 'ease-out', fill: 'forwards' });
    animation.onfinish = () => element.remove();
  }

  function showHearts(count) {
    const centre = screenPoint(steer.head);
    for (let i = 0; i < count; i += 1) {
      setTimeout(() => fx({
        x: centre.x + random(-30, 30), y: centre.y - random(10, 30), size: random(14, 20),
        text: '♥', textColor: i % 2 ? BURNT_ORANGE : '#e8873a', dx: random(-10, 10), dy: -60
      }), i * 140);
    }
  }

  function snort() {
    const nose = screenPoint(steer.muzzle);
    [-1, 1].forEach(side => fx({
      x: nose.x + side * 5, y: nose.y + 4, size: 12, color: 'rgba(215, 222, 232, .85)', blur: 2,
      dx: side * random(22, 40), dy: random(-14, 0), duration: 700, grow: 2.4
    }));
  }

  function dust(x, y, direction, count = 1) {
    for (let i = 0; i < count; i += 1) {
      fx({
        x: x + random(-10, 10), y: y + random(-6, 2), size: random(10, 18), color: 'rgba(196, 164, 118, .55)', blur: 2,
        dx: direction * random(20, 60), dy: random(-28, -8), duration: random(500, 900), grow: 2
      });
    }
  }

  function munchBits() {
    const mouth = screenPoint(steer.muzzle);
    fx({
      x: mouth.x + random(-8, 8), y: mouth.y, size: random(4, 6), color: Math.random() < .6 ? '#3b5bdb' : '#4c9a2a',
      dx: random(-26, 26), dy: random(-30, -12), duration: 600, grow: 1
    });
  }

  function hooves() {
    const { legs } = steer;
    return screenPoint(legs[state === 'paw' ? 0 : 2].knee);
  }

  function showBubble(text) {
    const at = screenPoint(steer.head);
    const bubble = document.createElement('div');
    bubble.className = 'site-longhorn-bubble';
    bubble.textContent = text;
    bubble.style.left = `${at.x + 8}px`;
    bubble.style.top = `${at.y - 62}px`;
    document.body.append(bubble);
    setTimeout(() => bubble.remove(), 1250);
  }

  // The first time Fun mode is switched on, tell the visitor how to play.
  function showHintOnce() {
    try {
      if (localStorage.getItem(HINT_KEY)) return;
      localStorage.setItem(HINT_KEY, '1');
    } catch (error) { /* private mode: show it anyway */ }
    const at = screenPoint(steer.head);
    const bubble = document.createElement('div');
    bubble.className = 'site-longhorn-bubble site-longhorn-hint';
    bubble.textContent = 'Double-click anywhere to plant bluebonnets for me! \u{1F33C}';
    document.body.append(bubble);
    bubble.style.left = `${clamp(at.x - bubble.offsetWidth / 2, 8, window.innerWidth - bubble.offsetWidth - 8)}px`;
    bubble.style.top = `${at.y - 70}px`;
    setTimeout(() => bubble.remove(), 5050);
  }

  // --- bluebonnets ------------------------------------------------------------

  const BLUEBONNET = (() => {
    const florets = [];
    for (let i = 0; i < 11; i += 1) {
      const y = 25 - i * 2;
      const spread = 5.2 - i * .38;
      const fill = i > 7 ? '#ffffff' : i % 2 ? '#3557d6' : '#4469ea';
      [-1, 1].forEach(side => florets.push(`<ellipse cx="${12 + side * spread * .55}" cy="${y}" rx="${2.6 - i * .12}" ry="${1.9 - i * .08}" fill="${fill}"/>`));
      if (i % 2) florets.push(`<ellipse cx="12" cy="${y - 1}" rx="${2.3 - i * .1}" ry="1.6" fill="${i > 7 ? '#f1f3ff' : '#2a46b8'}"/>`);
    }
    return `<svg viewBox="0 0 24 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 39 C12 33 12 30 12 25" stroke="#3f7d22" stroke-width="1.6" fill="none"/>
      ${[-55, -25, 0, 25, 55].map(a => `<ellipse cx="12" cy="34" rx="1.4" ry="4.4" fill="#4c9a2a" transform="rotate(${a} 12 38)"/>`).join('')}
      ${florets.join('')}
    </svg>`;
  })();

  function setFlowerStage(flower, stage) {
    flower.element.style.clipPath = `inset(${[0, 38, 62][stage]}% -20% 0 -20%)`;
  }

  function plantFlower(x, y) {
    const { width, height } = flowerSize();
    // Keep the bloom within reach of the muzzle without the longhorn leaving the bottom of the screen.
    const reach = grazeMuzzleOffset(-1).y;
    const lowest = window.innerHeight - size().height + 20 + reach - height * .45;
    const flower = {
      x: clamp(x - width / 2, 40, window.innerWidth - width - 40),
      y: clamp(y - height / 2, Math.max(150, reach - height * .45), Math.min(window.innerHeight - height - 10, lowest)),
      element: document.createElement('div')
    };
    flower.element.className = 'site-longhorn-flower';
    flower.element.innerHTML = BLUEBONNET;
    Object.assign(flower.element.style, { left: `${flower.x}px`, top: `${flower.y}px`, width: `${width}px`, height: `${height}px` });
    setFlowerStage(flower, 0);
    document.body.append(flower.element);
    flowers.push(flower);
    if (flowers.length > MAX_FLOWERS) removeFlower(flowers[0]);
  }

  function removeFlower(flower) {
    const index = flowers.indexOf(flower);
    if (index !== -1) flowers.splice(index, 1);
    flower.element.classList.add('gone');
    setTimeout(() => flower.element.remove(), 320);
  }

  // Walk so the muzzle lands exactly on the flower. Near a screen edge, approach head-first
  // toward the edge so the body stays on screen.
  function headToFlower() {
    meal = flowers[0];
    if (!meal) return false;
    const { width, height } = flowerSize();
    const bloom = { x: meal.x + width / 2, y: meal.y + height * .45 };
    const spot = side => {
      const offset = grazeMuzzleOffset(side);
      return { x: bloom.x - offset.x, y: bloom.y - offset.y };
    };
    const offscreen = p => {
      const { width } = size();
      return Math.max(0, -(p.x + width * .25)) + Math.max(0, p.x + width * .75 - window.innerWidth);
    };
    let side = bloom.x < position.x + size().width / 2 ? -1 : 1;
    let goalSpot = spot(side);
    const otherSpot = spot(-side);
    if (offscreen(otherSpot) < offscreen(goalSpot)) {
      side = -side;
      goalSpot = otherSpot;
    }
    target = { x: goalSpot.x, y: goalSpot.y, facing: side };
    enter('trot');
    return true;
  }

  function goHome() {
    target = { ...home };
    enter('return');
  }

  // --- matador cape detection -------------------------------------------------

  const cape = { lastX: null, direction: 0, travelled: 0, flips: [] };

  function trackCape(event) {
    const time = now();
    if (!position || !resting() || time < calmUntil || !hitBox) return;
    const centre = { x: position.x + (hitBox.left + hitBox.right) / 2, y: position.y + (hitBox.top + hitBox.bottom) / 2 };
    const near = Math.hypot(event.clientX - centre.x, event.clientY - centre.y) < size().width * 1.1;
    if (!near || hovering) {
      cape.flips = [];
      cape.lastX = null;
      return;
    }
    if (cape.lastX !== null) {
      const dx = event.clientX - cape.lastX;
      const direction = Math.sign(dx);
      if (direction && direction !== cape.direction) {
        if (cape.travelled > 14) cape.flips.push(time);
        cape.direction = direction;
        cape.travelled = 0;
      }
      cape.travelled += Math.abs(dx);
    }
    cape.lastX = event.clientX;
    cape.flips = cape.flips.filter(t => time - t < 1100);
    if (cape.flips.length >= 5) {
      cape.flips = [];
      provoke(event.clientX);
    }
  }

  function provoke(capeX) {
    hop = 0;
    facing = capeX < position.x + size().width / 2 ? -1 : 1;
    fxAt = 0;
    showBubble('!!');
    enter('paw');
  }

  function charge() {
    const left = -20;
    const right = window.innerWidth - size().width + 20;
    // Charge through the cape; turn around if there is no room that way.
    if (facing === -1 && position.x - left < window.innerWidth * .3) facing = 1;
    else if (facing === 1 && right - position.x < window.innerWidth * .3) facing = -1;
    target = { x: facing === -1 ? left : right, y: position.y };
    speed = 160;
    enter('charge');
  }

  // --- behaviour loop ---------------------------------------------------------

  function decideIdleAction(time) {
    const choice = Math.random();
    if (choice < .45) {
      target = {
        x: clamp(random(window.innerWidth * .3, window.innerWidth - size().width), 0, window.innerWidth - size().width),
        y: clamp(floorY() + random(-40, 0), 60, floorY())
      };
      enter('wander');
    } else if (choice < .85) {
      sitUntil = time + random(8000, 16000);
      sleepAt = time + random(10000, 13000);
      enter('sit');
    } else {
      earFlickAt = time;
      nextIdleAction = time + random(3000, 6000);
    }
  }

  function wake() {
    if (state === 'sit' || state === 'sleep') enter('idle');
  }

  function moveToward(destination, pace, delta) {
    const dx = destination.x - position.x;
    const dy = destination.y - position.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 6) {
      position = { x: destination.x, y: destination.y };
      return true;
    }
    const step = Math.min(distance, pace * delta);
    position.x += dx / distance * step;
    position.y += dy / distance * step;
    if (Math.abs(dx) > 2) facing = dx >= 0 ? 1 : -1;
    return false;
  }

  // Turn the head toward the viewer (the camera sits in front of the page).
  const lookAtViewer = () => clamp(-Math.PI / 2 - yaw, -1.0, 1.0);

  let frameCount = 0;
  function tick(time) {
    const delta = Math.min(40, time - lastFrameTime) / 1000;
    lastFrameTime = time;
    const elapsed = time - stateStarted;
    Object.assign(goal, { lie: 0, neck: 0, head: 0, look: 0, walk: 0, gallop: 0, paw: 0, chew: 0, pitch: 0, blink: 0 });

    if (time > blinkAt) {
      blinkUntil = time + 140;
      blinkAt = time + random(2000, 5000);
    }
    if (time < blinkUntil) goal.blink = 1;
    let gaitSpeed = 0;

    if (state === 'wander' || state === 'return' || state === 'trot') {
      const pace = state === 'trot' ? 170 : state === 'return' ? 140 : 95;
      goal.walk = 1;
      gaitSpeed = pace / 16;
      if (moveToward(target, pace, delta)) {
        if (state === 'trot') {
          facing = target.facing;
          enter('graze');
        } else if (!headToFlower()) {
          facing = -1;
          enter('idle');
        }
      }
    } else if (state === 'graze') {
      Object.assign(goal, { neck: -1.15, head: -.55, chew: 1 });
      if (!flowers.includes(meal)) {
        if (!headToFlower()) goHome();
      } else if (elapsed > 500) {
        const progress = Math.min(1, (elapsed - 500) / 2600);
        setFlowerStage(meal, Math.min(2, Math.floor(progress * 3)));
        if (time > fxAt) {
          munchBits();
          fxAt = time + 240;
        }
        if (progress >= 1) {
          removeFlower(meal);
          meal = null;
          enter('savor');
          showHearts(2);
        }
      }
    } else if (state === 'savor') {
      Object.assign(goal, { neck: .1, head: .15, look: lookAtViewer(), blink: .7 });
      if (elapsed > 1000 && !headToFlower()) goHome();
    } else if (state === 'paw') {
      Object.assign(goal, { neck: -.55, head: -.35, paw: 1 });
      if (time > fxAt && elapsed > 250) {
        snort();
        const hoof = hooves();
        dust(hoof.x, hoof.y + 30, -facing, 2);
        fxAt = time + 400;
      }
      if (elapsed > 1700) charge();
    } else if (state === 'charge') {
      speed = Math.min(950, speed + 1900 * delta);
      Object.assign(goal, { neck: -.5, head: -.3, gallop: 1 });
      gaitSpeed = 17;
      goal.pitch = Math.sin(gaitPhase) * .05;
      const arrived = moveToward(target, speed, delta);
      if (time > fxAt) {
        const hoof = hooves();
        dust(hoof.x, hoof.y + 30, -facing);
        fxAt = time + 60;
      }
      if (arrived) {
        const front = screenPoint(steer.legs[0].knee);
        dust(front.x, front.y + 30, facing, 7);
        showBubble('Olé!');
        enter('skid');
      }
    } else if (state === 'skid') {
      Object.assign(goal, elapsed < 700 ? { neck: -.35, head: -.2, pitch: .06 } : { neck: .1, head: .1, look: lookAtViewer() });
      if (elapsed > 1500) {
        calmUntil = time + 5000;
        if (!headToFlower()) goHome();
      }
    } else if (state === 'bark') {
      const progress = Math.min(1, elapsed / 420);
      hop = Math.sin(Math.PI * progress) * 22;
      Object.assign(goal, { neck: .25, head: .2, look: lookAtViewer(), walk: .4 });
      gaitSpeed = 14;
      if (progress >= 1) {
        hop = 0;
        enter('idle');
      }
    } else if (state === 'sit' || state === 'sleep') {
      goal.lie = 1;
      if (hovering) goal.look = lookAtViewer();
      if (state === 'sleep') {
        Object.assign(goal, { blink: 1, head: -.25, neck: -.15 });
        if (time > fxAt) {
          const at = screenPoint(steer.head);
          fx({ x: at.x + 16, y: at.y - 24, size: random(13, 18), text: 'z', textColor: '#8e99ad', dx: 22, dy: -48, duration: 1700, grow: 1.3 });
          fxAt = time + 1200;
        }
        if (hovering) wake();
      } else if (time > sleepAt && !hovering) {
        fxAt = 0;
        enter('sleep');
      } else if (time > sitUntil) enter('idle');
    } else {
      goal.neck = Math.sin(time / 2400) * .08;
      if (hovering) {
        goal.look = lookAtViewer();
        goal.head = .12;
        nextIdleAction = time + 4000;
      } else if (time > nextIdleAction) decideIdleAction(time);
    }

    // Turn smoothly toward the direction of travel; the turn passes through a front view.
    const wantedYaw = yawFor(facing);
    yaw += (wantedYaw - yaw) * Math.min(1, delta * (state === 'charge' ? 14 : 6));
    gaitPhase += delta * gaitSpeed;
    const ease = Math.min(1, delta * 7);
    Object.keys(pose).forEach(key => { pose[key] += (goal[key] - pose[key]) * ease; });

    render(time);
    if (frameCount++ % 8 === 0) updateHitBox();
    frame = requestAnimationFrame(tick);
  }

  // --- input ------------------------------------------------------------------

  function isInteractive(element) {
    return element.closest('a, button, input, select, textarea, label, summary, [role="button"], [contenteditable="true"]');
  }

  document.addEventListener('click', event => {
    if (!enabled) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (isInteractive(event.target)) return;
    if (overLonghorn(event.clientX, event.clientY)) {
      if (resting() || state === 'savor') {
        wake();
        facing = -1;
        showBubble(GREETINGS[greeting++ % GREETINGS.length]);
        showHearts(2);
        enter('bark');
      }
    }
  });

  // Whether the point is over an actual visible character (not blank space beside the text).
  function pointIsOnText(x, y) {
    let node;
    let offset;
    if (document.caretPositionFromPoint) {
      const caret = document.caretPositionFromPoint(x, y);
      if (!caret) return false;
      node = caret.offsetNode;
      offset = caret.offset;
    } else if (document.caretRangeFromPoint) {
      const caret = document.caretRangeFromPoint(x, y);
      if (!caret) return false;
      node = caret.startContainer;
      offset = caret.startOffset;
    }
    if (!node || node.nodeType !== Node.TEXT_NODE) return false;
    const range = document.createRange();
    for (const start of [offset - 1, offset]) {
      if (start < 0 || start >= node.length || !/\S/.test(node.data[start])) continue;
      range.setStart(node, start);
      range.setEnd(node, start + 1);
      for (const rect of range.getClientRects()) {
        if (x >= rect.left - 2 && x <= rect.right + 2 && y >= rect.top - 3 && y <= rect.bottom + 3) return true;
      }
    }
    return false;
  }

  const plantable = event => enabled && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey &&
    !isInteractive(event.target) && !overLonghorn(event.clientX, event.clientY) && !pointIsOnText(event.clientX, event.clientY);

  // Double-clicking blank space would otherwise select stray nearby text; double-clicking a word still selects it.
  document.addEventListener('mousedown', event => {
    if (event.detail >= 2 && plantable(event)) event.preventDefault();
  });

  // Planting needs a double-click so ordinary clicks on the page stay ordinary.
  document.addEventListener('dblclick', event => {
    if (!plantable(event)) return;
    window.getSelection()?.removeAllRanges();
    plantFlower(event.clientX, event.clientY);
    if (resting() || state === 'bark') {
      wake();
      hop = 0;
      headToFlower();
    }
  });

  document.addEventListener('pointermove', event => {
    if (!enabled) return;
    const over = overLonghorn(event.clientX, event.clientY) && !isInteractive(event.target);
    if (over !== hovering) {
      hovering = over;
      document.body.classList.toggle('site-longhorn-hover', over);
      if (over && (state === 'idle' || state === 'sit')) showHearts(1);
    }
    trackCape(event);
  }, { passive: true });
  window.addEventListener('resize', () => { if (enabled) setHome(); }, { passive: true });

  function show() {
    if (enabled) return;
    enabled = true;
    // Always walk back on stage from the corner, rested and calm.
    position = null;
    hop = 0;
    speed = 0;
    facing = -1;
    yaw = yawFor(-1);
    enter('idle');
    setHome();
    render(now());
    updateHitBox();
    canvas.classList.add('ready');
    lastFrameTime = now();
    frame = requestAnimationFrame(tick);
    setTimeout(() => { if (enabled) showHintOnce(); }, 500);
  }

  function hide() {
    if (!enabled) return;
    enabled = false;
    cancelAnimationFrame(frame);
    canvas.classList.remove('ready');
    flowers.slice().forEach(removeFlower);
    meal = null;
    hovering = false;
    document.body.classList.remove('site-longhorn-hover');
    document.querySelectorAll('.site-longhorn-hint').forEach(hint => hint.remove());
  }

  return { show, hide };
}
