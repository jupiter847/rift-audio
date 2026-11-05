import * as THREE from './vendor/three.module.js';

const EMPTY_API = () => ({ selectComponent() {}, setSurfaceMode() {}, setHighlight() {}, reset() {}, destroy() {} });

export async function createComponentLab(canvas, options = {}) {
  try { return buildLab(canvas, options); }
  catch (error) { options.onError?.(error); return EMPTY_API(); }
}

function buildLab(canvas, { onReady, onError, onChange } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.setClearColor(0x11140f, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .1, 60);
  camera.position.set(6, 3.1, 8);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xe5ece7, 0x18211a, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(-3, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xb9cebf, 1.7);
  rim.position.set(5, 1, -3); scene.add(rim);

  const resources = { geometries: new Set(), materials: new Set(), textures: new Set() };
  const models = new Map();
  const drawables = [];
  const rememberGeometry = (geometry) => { resources.geometries.add(geometry); return geometry; };
  const rememberMaterial = (material) => { resources.materials.add(material); return material; };
  const red = 0xfa3b2e;
  const lineMaterial = rememberMaterial(new THREE.LineBasicMaterial({ color: 0xc4d0be, transparent: true, opacity: .62, depthTest: true, depthWrite: false }));
  const pointMaterial = rememberMaterial(new THREE.PointsMaterial({ color: red, size: 1.8, sizeAttenuation: false, transparent: true, opacity: .7, depthTest: true, depthWrite: false }));

  function makeModel(id) {
    const group = new THREE.Group();
    group.name = id;
    const annotationGroup = new THREE.Group();
    scene.add(annotationGroup);
    const data = { id, group, annotationGroup, annotations: [], activeFeature: null, meshes: [], vertices: 0, triangles: 0, radius: 1 };
    models.set(id, data);
    return data;
  }

  function part(model, geometry, parent = model.group, position = [0, 0, 0], colour = 0xaab4a4, accent = false) {
    rememberGeometry(geometry);
    const material = rememberMaterial(new THREE.MeshStandardMaterial({ color: colour, metalness: accent ? .25 : .68, roughness: .4, flatShading: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    const object = new THREE.Mesh(geometry, material);
    object.userData.feature = parent.userData.feature || model.activeFeature;
    object.position.set(...position);
    parent.add(object);
    const wire = new THREE.LineSegments(rememberGeometry(new THREE.WireframeGeometry(geometry)), rememberMaterial(lineMaterial.clone()));
    wire.renderOrder = 2;
    object.add(wire);

    // A sparse selection of real mesh vertices keeps the topology easy to read.
    const positions = geometry.getAttribute('position');
    const unique = new Map();
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index), y = positions.getY(index), z = positions.getZ(index);
      unique.set(`${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`, [x, y, z]);
    }
    const points = [...unique.values()];
    const stride = Math.max(1, Math.ceil(points.length / 42));
    const sampled = points.filter((_, index) => index % stride === 0).flat();
    const pointGeometry = rememberGeometry(new THREE.BufferGeometry());
    pointGeometry.setAttribute('position', new THREE.Float32BufferAttribute(sampled, 3));
    const vertices = new THREE.Points(pointGeometry, rememberMaterial(pointMaterial.clone()));
    vertices.renderOrder = 3;
    object.add(vertices);
    const info = { object, material, wire, vertices, colour, accent };
    model.meshes.push(info); drawables.push(info);
    model.vertices += positions.count;
    model.triangles += (geometry.index ? geometry.index.count : positions.count) / 3;
    return object;
  }

  const box = (width, height, depth) => new THREE.BoxGeometry(width, height, depth);
  function cylinder(model, radius, height, parent, position, colour, sides = 12, accent = false) {
    const object = part(model, new THREE.CylinderGeometry(radius, radius, height, sides, 1, false), parent, position, colour, accent);
    object.rotation.x = Math.PI / 2;
    return object;
  }
  function curveTube(model, points, radius, parent = model.group, colour = 0x899583, segments = 18) {
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    return part(model, new THREE.TubeGeometry(curve, segments, radius, 5, false), parent, [0, 0, 0], colour);
  }
  function chamferedShape(width, height, cut = .18) {
    const x = width / 2, y = height / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-x + cut, -y); shape.lineTo(x - cut, -y);
    shape.lineTo(x, -y + cut); shape.lineTo(x, y - cut);
    shape.lineTo(x - cut, y); shape.lineTo(-x + cut, y);
    shape.lineTo(-x, y - cut); shape.lineTo(-x, -y + cut); shape.closePath();
    return shape;
  }
  function plate(width, height, depth, cut = .18) {
    const geometry = new THREE.ExtrudeGeometry(chamferedShape(width, height, cut), { depth, bevelEnabled: false, curveSegments: 1, steps: 1 });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  }

  // N01-F / an open structural bridge with separate crown ribs and sliding rails.
  const frame = makeModel('frame');
  frame.activeFeature = 'A';
  const archRadiusX = 1.58, archRadiusY = 1.95;
  for (let index = 0; index < 17; index++) {
    const angle = .1 + (Math.PI - .2) * (index + .5) / 17;
    const x = Math.cos(angle) * archRadiusX;
    const y = Math.sin(angle) * archRadiusY + .25;
    const tangent = Math.atan2(Math.cos(angle) * archRadiusY, -Math.sin(angle) * archRadiusX);
    const rib = part(frame, box(.29, .15, .54), frame.group, [x, y, 0], index % 3 ? 0xa5b19f : 0xe3e8dc);
    rib.rotation.z = tangent;
    if (index % 4 === 0) {
      const inset = part(frame, box(.11, .016, .32), rib, [0, .087, 0], red, true);
      inset.rotation.z = 0;
    }
  }
  for (const z of [-.31, .31]) {
    const points = [];
    for (let index = 0; index <= 22; index++) {
      const angle = .05 + (Math.PI - .1) * index / 22;
      points.push([Math.cos(angle) * 1.57, Math.sin(angle) * 1.94 + .25, z]);
    }
    curveTube(frame, points, .042, frame.group, 0xc2cebb, 30);
  }
  for (const side of [-1, 1]) {
    frame.activeFeature = 'B';
    part(frame, plate(.32, .57, .56, .07), frame.group, [side * 1.57, .18, 0], 0x717d69);
    part(frame, box(.16, .92, .13), frame.group, [side * 1.61, -.2, -.22], 0xd0d8c8);
    part(frame, box(.16, .92, .13), frame.group, [side * 1.61, -.2, .22], 0xd0d8c8);
    for (const z of [-.3, .3]) {
      frame.activeFeature = 'C';
      curveTube(frame, [[side * 1.61, -.2, z], [side * 1.75, -.57, z * 1.5], [side * 1.58, -.95, z * 1.5]], .057, frame.group, 0xadbba3, 8);
      cylinder(frame, .12, .11, frame.group, [side * 1.58, -.95, z * 1.5], 0xd2dcc8, 8);
    }
    frame.activeFeature = 'B';
    part(frame, box(.06, .29, .04), frame.group, [side * 1.62, -.28, .31], red, true);
  }

  // N01-P / the padded ring is intentionally low-poly so every radial quad reads.
  const cushion = makeModel('cushion');
  cushion.activeFeature = 'A';
  const pad = part(cushion, new THREE.TorusGeometry(1, .25, 10, 28), cushion.group, [0, 0, .08], 0x444e3c);
  pad.scale.set(.8, 1.12, .7);
  cushion.activeFeature = 'B';
  const backing = part(cushion, new THREE.TorusGeometry(.99, .055, 5, 28), cushion.group, [0, 0, -.16], 0xc4d0bc);
  backing.scale.set(.8, 1.12, 1);
  cushion.activeFeature = 'C';
  const driver = cylinder(cushion, .65, .035, cushion.group, [0, 0, -.32], 0x606e56, 24);
  driver.scale.set(.8, 1, 1.23);
  const driverRing = part(cushion, new THREE.TorusGeometry(.58, .025, 4, 22), cushion.group, [0, 0, -.28], 0x9fad93);
  driverRing.scale.set(.85, 1.25, 1);
  for (let row = -4; row <= 4; row++) {
    const width = Math.sqrt(Math.max(.08, 1 - (row / 5) ** 2)) * .8;
    part(cushion, box(width, .011, .015), cushion.group, [0, row * .115, -.27], 0x1a2414);
  }
  cushion.activeFeature = 'B';
  for (let index = 0; index < 24; index++) {
    const angle = index / 24 * Math.PI * 2;
    const stitch = part(cushion, box(.045, .014, .014), cushion.group, [Math.cos(angle) * .96, Math.sin(angle) * 1.34, .12], 0xd2dacc);
    stitch.rotation.z = angle + Math.PI / 2;
  }
  for (const side of [-1, 1]) part(cushion, plate(.17, .24, .06, .035), cushion.group, [side * .72, -.83, -.13], red, true);

  // N01-I / a separated faceplate, tactile hardware and the recessed control board.
  const controls = makeModel('controls');
  const base = part(controls, plate(1.6, 2.1, .18, .29), controls.group, [0, 0, -.35], 0x66735c);
  base.rotation.z = -.1;
  const board = part(controls, plate(1.34, 1.8, .065, .25), controls.group, [.05, .03, .04], 0x31422a);
  board.rotation.z = -.1;
  const face = part(controls, plate(1.48, 1.98, .13, .28), controls.group, [.1, .07, .43], 0xaab89f);
  face.rotation.z = -.1;
  for (const x of [-.42, .42]) for (const y of [-.67, .67]) {
    cylinder(controls, .047, .06, face, [x, y, .1], 0xdde5d5, 6);
  }
  for (let index = 0; index < 5; index++) {
    const vent = part(controls, box(.33, .028, .012), face, [-.16, .4 - index * .09, .08], 0x172312);
    vent.rotation.z = -.2;
  }
  controls.activeFeature = 'A';
  const wheel = cylinder(controls, .16, .085, controls.group, [.72, -.1, .51], 0xc5d1ba, 20);
  for (let index = 0; index < 16; index++) {
    const angle = index / 16 * Math.PI * 2;
    part(controls, box(.035, .045, .09), wheel, [Math.cos(angle) * .16, 0, Math.sin(angle) * .16], 0x738169).rotation.y = -angle;
  }
  controls.activeFeature = 'B';
  part(controls, plate(.15, .35, .05, .045), face, [.35, -.34, .11], red, true);
  part(controls, box(.36, .045, .025), face, [-.15, -.69, .09], red, true);
  controls.activeFeature = 'C';
  part(controls, plate(.39, .11, .055, .035), face, [-.15, -.84, .095], 0xd4dfc8);
  part(controls, box(.27, .045, .014), face, [-.15, -.84, .132], 0x15200f);
  const audioSocket = part(controls, new THREE.TorusGeometry(.06, .018, 4, 10), face, [.36, -.79, .12], 0xd4dfc8);
  audioSocket.rotation.z = .1;
  controls.activeFeature = null;
  for (const x of [-.37, -.12, .13, .38]) {
    part(controls, box(.06, .12, .045), board, [x, -.2, .07], 0xb3c3a3);
    part(controls, box(.015, .55, .012), board, [x, .17, .06], 0xc4d6b1);
  }

  function labelTexture(letter, selected) {
    const bitmap = document.createElement('canvas'); bitmap.width = bitmap.height = 96;
    const context = bitmap.getContext('2d');
    if (!context) return null;
    context.fillStyle = selected ? '#fa3b2e' : '#172013';
    context.fillRect(0, 0, 96, 96);
    context.strokeStyle = '#fa3b2e'; context.lineWidth = 5;
    context.strokeRect(3, 3, 90, 90);
    context.fillStyle = selected ? '#11140f' : '#f0f1e9';
    context.font = 'bold 57px monospace'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(letter, 48, 51);
    const texture = new THREE.CanvasTexture(bitmap);
    texture.colorSpace = THREE.SRGBColorSpace;
    resources.textures.add(texture);
    return texture;
  }
  function leader(model, from, slot, letter) {
    const geometry = rememberGeometry(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
    const line = new THREE.Line(geometry, rememberMaterial(new THREE.LineBasicMaterial({ color: red, transparent: true, opacity: .75, depthTest: false, depthWrite: false })));
    line.renderOrder = 20;
    line.frustumCulled = false;
    const marker = new THREE.Mesh(rememberGeometry(new THREE.OctahedronGeometry(.035, 0)), rememberMaterial(new THREE.MeshBasicMaterial({ color: red, depthTest: false, depthWrite: false })));
    marker.renderOrder = 21;
    const normalTexture = labelTexture(letter, false);
    const activeTexture = labelTexture(letter, true);
    const label = normalTexture ? new THREE.Sprite(rememberMaterial(new THREE.SpriteMaterial({ map: normalTexture, transparent: true, depthTest: false, depthWrite: false }))) : null;
    if (label) {
      label.userData.letter = letter;
      label.renderOrder = 30;
      model.annotationGroup.add(label);
    }
    model.annotationGroup.add(line, marker);
    model.annotations.push({ letter, anchor: new THREE.Vector3(...from), slot, line, marker, label, normalTexture, activeTexture });
  }

  const pivot = new THREE.Group(); scene.add(pivot);
  for (const model of models.values()) {
    const bounds = new THREE.Box3().setFromObject(model.group);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    model.radius = sphere.radius * 1.2;
    model.group.position.sub(sphere.center);
    // These anchors attach to specific model geometry, rather than the screen.
    if (model.id === 'frame') {
      leader(model, [0, 2.2, 0], [-.66, .68], 'A');
      leader(model, [1.62, -.23, .3], [.68, .24], 'B');
      leader(model, [-1.58, -.95, .45], [-.65, -.62], 'C');
    } else if (model.id === 'cushion') {
      leader(model, [0, 1.35, .12], [-.66, .68], 'A');
      leader(model, [-.64, -.95, .12], [-.65, -.62], 'B');
      leader(model, [.3, .25, -.28], [.68, .24], 'C');
    } else {
      leader(model, [.72, -.1, .51], [.68, .62], 'A');
      leader(model, [.43, -.27, .54], [.68, -.18], 'B');
      leader(model, [-.13, -.75, .56], [-.65, -.62], 'C');
    }
    pivot.add(model.group);
    model.group.visible = model.id === 'frame';
    model.annotationGroup.visible = model.id === 'frame';
  }

  const grid = new THREE.GridHelper(8, 20, 0x57634e, 0x303d28);
  grid.material.transparent = true; grid.material.opacity = .24; resources.geometries.add(grid.geometry); resources.materials.add(grid.material); scene.add(grid);
  const axisGroup = new THREE.Group(); scene.add(axisGroup);
  for (const [direction, colour] of [[new THREE.Vector3(1, 0, 0), red], [new THREE.Vector3(0, 1, 0), 0xc6d3bc], [new THREE.Vector3(0, 0, 1), 0x788b69]]) {
    const arrow = new THREE.ArrowHelper(direction, new THREE.Vector3(), .45, colour, .1, .045);
    axisGroup.add(arrow);
    arrow.traverse((object) => { if (object.geometry) resources.geometries.add(object.geometry); if (object.material) resources.materials.add(object.material); });
  }

  let component = 'frame';
  let surfaceMode = 'wireframe';
  let highlight = null;
  let destroyed = false, visible = true, frameId = 0, lastTime = 0;
  const initialRotation = { x: -.13, y: -.25 };
  const target = { ...initialRotation };
  pivot.rotation.set(target.x, target.y, 0);
  let drag = null;
  let pointerMoved = false;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');

  function state() {
    const model = models.get(component);
    return { component, surfaceMode, highlight, highlightedMeshes: highlight ? model.meshes.filter(({ object }) => object.userData.feature === highlight).length : 0, vertices: model.vertices, triangles: Math.round(model.triangles), rotation: { ...target } };
  }
  function emit() {
    const value = state();
    canvas.dataset.component = component;
    canvas.dataset.surfaceMode = surfaceMode;
    canvas.dataset.highlight = highlight || 'none';
    canvas.dataset.highlightedMeshes = String(value.highlightedMeshes);
    canvas.dataset.rotationX = target.x.toFixed(3);
    canvas.dataset.rotationY = target.y.toFixed(3);
    canvas.dataset.vertices = String(value.vertices);
    canvas.dataset.triangles = String(value.triangles);
    onChange?.(value);
  }
  function updateSurfaceMode() {
    for (const { object, material, wire, vertices, colour, accent } of drawables) {
      const isWire = surfaceMode === 'wireframe';
      const focused = Boolean(highlight && object.userData.feature === highlight);
      const dimmed = Boolean(highlight && !focused);
      // The dark solid is a depth mask: back-facing and internal triangles no
      // longer compete with the visible surface's topology.
      material.transparent = false;
      material.opacity = 1;
      material.depthWrite = true;
      material.color.setHex(isWire ? (focused ? 0x30392a : accent ? 0x3a2016 : 0x1c2717) : colour);
      if (dimmed) material.color.multiplyScalar(isWire ? .57 : .28);
      material.emissive.setHex(focused ? 0x301106 : 0x000000);
      material.emissiveIntensity = .28;
      material.metalness = isWire ? .08 : .56;
      material.roughness = isWire ? .94 : .39;
      wire.visible = isWire || focused;
      wire.material.color.setHex(focused ? red : 0xc1ceb6);
      wire.material.opacity = focused ? 1 : dimmed ? .19 : .56;
      wire.material.depthTest = !focused;
      wire.renderOrder = focused ? 12 : 2;
      vertices.visible = isWire || focused;
      vertices.material.size = focused ? 3.1 : 1.8;
      vertices.material.opacity = focused ? 1 : dimmed ? .2 : .65;
      vertices.material.depthTest = !focused;
      vertices.renderOrder = focused ? 13 : 3;
    }
    for (const model of models.values()) {
      for (const annotation of model.annotations) {
        const focused = highlight === annotation.letter;
        const dimmed = Boolean(highlight && !focused);
        annotation.line.material.opacity = focused ? 1 : dimmed ? .23 : .65;
        annotation.marker.material.color.setHex(focused ? 0xff816b : red);
        annotation.marker.scale.setScalar(focused ? 1.45 : 1);
        if (annotation.label) {
          annotation.label.material.map = focused ? annotation.activeTexture : annotation.normalTexture;
          annotation.label.material.opacity = dimmed ? .52 : 1;
        }
      }
    }
  }
  const annotationRight = new THREE.Vector3();
  const annotationUp = new THREE.Vector3();
  const annotationAnchor = new THREE.Vector3();
  const annotationProjected = new THREE.Vector3();
  const annotationElbow = new THREE.Vector3();
  const annotationLabel = new THREE.Vector3();
  function updateAnnotations() {
    camera.updateMatrixWorld();
    pivot.updateWorldMatrix(true, true);
    annotationRight.setFromMatrixColumn(camera.matrixWorld, 0);
    annotationUp.setFromMatrixColumn(camera.matrixWorld, 1);
    const halfWidth = (camera.right - camera.left) / 2;
    const halfHeight = (camera.top - camera.bottom) / 2;
    const pixelSize = 2 * halfHeight * 26 / Math.max(1, canvas.getBoundingClientRect().height);
    for (const annotation of models.get(component).annotations) {
      annotationAnchor.copy(annotation.anchor);
      models.get(component).group.localToWorld(annotationAnchor);
      annotationProjected.copy(annotationAnchor).project(camera);
      annotationLabel.copy(annotationRight).multiplyScalar(annotation.slot[0] * halfWidth)
        .addScaledVector(annotationUp, annotation.slot[1] * halfHeight);
      const elbowX = annotation.slot[0] + (annotation.slot[0] < 0 ? .12 : -.12);
      annotationElbow.copy(annotationRight).multiplyScalar(elbowX * halfWidth)
        .addScaledVector(annotationUp, THREE.MathUtils.clamp(annotationProjected.y, -.78, .78) * halfHeight);
      const positions = annotation.line.geometry.getAttribute('position');
      positions.setXYZ(0, annotationAnchor.x, annotationAnchor.y, annotationAnchor.z);
      positions.setXYZ(1, annotationElbow.x, annotationElbow.y, annotationElbow.z);
      positions.setXYZ(2, annotationLabel.x, annotationLabel.y, annotationLabel.z);
      positions.needsUpdate = true;
      annotation.marker.position.copy(annotationAnchor);
      if (annotation.label) {
        annotation.label.position.copy(annotationLabel);
        annotation.label.scale.set(pixelSize, pixelSize, 1);
      }
    }
  }
  function setHighlight(value) {
    if (value !== null && !['A', 'B', 'C'].includes(value)) return;
    highlight = value;
    updateSurfaceMode(); emit(); requestRender();
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width), height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    const radius = models.get(component).radius;
    const aspect = width / height;
    const halfHeight = radius / Math.min(1, aspect);
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
    camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    grid.position.y = -radius * .69;
    grid.scale.setScalar(radius / 3);
    axisGroup.position.set(-radius * .65, -radius * .62, 0);
    updateAnnotations();
    requestRender();
  }
  function render(timestamp) {
    frameId = 0;
    if (destroyed || document.hidden || !visible) return;
    const delta = lastTime ? Math.min((timestamp - lastTime) / 16.67, 3) : 1;
    lastTime = timestamp;
    const ease = motion.matches ? 1 : 1 - Math.pow(.76, delta);
    pivot.rotation.x += (target.x - pivot.rotation.x) * ease;
    pivot.rotation.y += (target.y - pivot.rotation.y) * ease;
    updateAnnotations();
    renderer.render(scene, camera);
    if (Math.abs(target.x - pivot.rotation.x) > .0005 || Math.abs(target.y - pivot.rotation.y) > .0005) requestRender();
  }
  function requestRender() { if (!destroyed && !frameId) frameId = requestAnimationFrame(render); }
  function reset() { Object.assign(target, initialRotation); highlight = null; updateSurfaceMode(); emit(); requestRender(); }
  function stopDrag(event) {
    if (!drag || (event && event.pointerId !== drag.id)) return;
    const pointerId = drag.id; drag = null; canvas.style.cursor = 'grab';
    if (canvas.hasPointerCapture?.(pointerId)) canvas.releasePointerCapture(pointerId);
  }
  const annotationRay = new THREE.Raycaster();
  const annotationPointer = new THREE.Vector2();
  function labelAtPointer(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    annotationPointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    annotationRay.setFromCamera(annotationPointer, camera);
    const labels = models.get(component).annotations.map((annotation) => annotation.label).filter(Boolean);
    return annotationRay.intersectObjects(labels, false)[0]?.object.userData.letter || null;
  }
  function pointerDown(event) {
    if (!event.isPrimary || event.button !== 0) return;
    canvas.focus({ preventScroll: true });
    pointerMoved = false;
    drag = { id: event.pointerId, type: event.pointerType, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false };
    if (event.pointerType !== 'touch') canvas.setPointerCapture?.(event.pointerId);
  }
  function pointerMove(event) {
    if (!drag) { if (event.pointerType !== 'touch') canvas.style.cursor = labelAtPointer(event) ? 'pointer' : 'grab'; return; }
    if (drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
    if (!drag.active) {
      if (Math.hypot(dx, dy) < 5) return;
      if (drag.type === 'touch' && Math.abs(dy) > Math.abs(dx) * 1.1) { pointerMoved = true; stopDrag(event); return; }
      drag.active = true; canvas.setPointerCapture?.(event.pointerId); canvas.style.cursor = 'grabbing';
      pointerMoved = true;
    }
    target.y += (event.clientX - drag.x) * .009;
    target.x = THREE.MathUtils.clamp(target.x + (event.clientY - drag.y) * .007, -.95, .95);
    drag.x = event.clientX; drag.y = event.clientY;
    emit(); requestRender();
  }
  function clickAnnotation(event) {
    if (!pointerMoved) {
      const letter = labelAtPointer(event);
      if (letter) setHighlight(highlight === letter ? null : letter);
    }
    pointerMoved = false;
  }
  function keyDown(event) {
    const amount = event.shiftKey ? .22 : .1;
    if (event.key === 'ArrowLeft') target.y -= amount;
    else if (event.key === 'ArrowRight') target.y += amount;
    else if (event.key === 'ArrowUp') target.x -= amount;
    else if (event.key === 'ArrowDown') target.x += amount;
    else if (event.key === 'Home') reset();
    else return;
    target.x = THREE.MathUtils.clamp(target.x, -.95, .95);
    event.preventDefault(); emit(); requestRender();
  }
  const onVisibility = () => { lastTime = 0; if (!document.hidden) requestRender(); };
  const onContextLost = (event) => { event.preventDefault(); onError?.(new Error('The component viewer lost its graphics context.')); };
  canvas.style.touchAction = 'pan-y'; canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', stopDrag);
  canvas.addEventListener('pointercancel', stopDrag);
  canvas.addEventListener('lostpointercapture', stopDrag);
  canvas.addEventListener('keydown', keyDown);
  canvas.addEventListener('click', clickAnnotation);
  canvas.addEventListener('webglcontextlost', onContextLost);
  document.addEventListener('visibilitychange', onVisibility);
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas);
  const intersectionObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) requestRender(); }, { rootMargin: '100px' });
  intersectionObserver.observe(canvas);
  updateSurfaceMode(); resize(); emit();
  // The ready callback follows a complete first frame, including shader setup.
  renderer.render(scene, camera);
  canvas.dataset.ready = 'true';
  onReady?.();

  return {
    selectComponent(id) {
      if (!models.has(id)) return;
      component = id;
      highlight = null;
      for (const [key, model] of models) {
        model.group.visible = key === id;
        model.annotationGroup.visible = key === id;
      }
      Object.assign(target, initialRotation);
      pivot.rotation.set(target.x, target.y, 0);
      updateSurfaceMode(); resize(); emit();
    },
    setSurfaceMode(value) {
      if (!['wireframe', 'solid'].includes(value)) return;
      surfaceMode = value; updateSurfaceMode(); emit(); requestRender();
    },
    setHighlight,
    reset,
    destroy() {
      if (destroyed) return;
      destroyed = true; stopDrag();
      if (frameId) cancelAnimationFrame(frameId);
      resizeObserver.disconnect(); intersectionObserver.disconnect();
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', stopDrag);
      canvas.removeEventListener('pointercancel', stopDrag);
      canvas.removeEventListener('lostpointercapture', stopDrag);
      canvas.removeEventListener('keydown', keyDown);
      canvas.removeEventListener('click', clickAnnotation);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      document.removeEventListener('visibilitychange', onVisibility);
      resources.geometries.forEach((geometry) => geometry.dispose());
      resources.materials.forEach((material) => material.dispose());
      resources.textures.forEach((texture) => texture.dispose());
      scene.clear(); renderer.dispose();
    },
  };
}
