import * as THREE from './vendor/three.module.js';
import { fixedCameraDistance } from './viewer-framing.js?v=3';

function unavailableViewer() {
  return {
    setFinish() {}, setExploded() {}, setInteractionMode() {}, setZoom() {}, setPosition() {}, reset() {}, destroy() {}, getSnapshot: () => null,
    getViewState: () => ({ interactionMode: 'rotate', position: { x: 0, y: 0 }, zoom: 1, rotation: { x: -0.07, y: -0.5 } }),
  };
}

// A self-contained product model: no remote models, HDRs or control libraries.
export async function createHeadphoneViewer(canvas, options = {}) {
  try {
    return await buildViewer(canvas, options);
  } catch (error) {
    options.onError?.(error);
    return unavailableViewer();
  }
}

async function buildViewer(canvas, { onReady, onError, onViewChange } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch (error) {
    onError?.(error);
    return unavailableViewer();
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  const cameraBack = new THREE.Vector3(5.3, 1.9, 7.8).normalize();
  camera.position.copy(cameraBack).multiplyScalar(9.7);
  camera.lookAt(0, 0, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.setClearColor(0xffffff, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const textures = new Set();
  const materials = new Set();
  const geometries = new Set();
  const mat = (options) => {
    const material = new THREE.MeshPhysicalMaterial(options);
    materials.add(material);
    return material;
  };
  const mesh = (geometry, material, parent, x = 0, y = 0, z = 0) => {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  };

  // Fine deterministic grain keeps the leather from reading as flat plastic.
  const grainData = new Uint8Array(128 * 128);
  let random = 718391;
  for (let i = 0; i < grainData.length; i++) {
    random = (1664525 * random + 1013904223) >>> 0;
    grainData[i] = 105 + (random >>> 26);
  }
  const grain = new THREE.DataTexture(grainData, 128, 128, THREE.RedFormat);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(4, 4);
  grain.needsUpdate = true;
  textures.add(grain);

  const brushedData = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const index = (y * 128 + x) * 4;
    const value = 186 + Math.round(Math.sin(y * 2.13) * 9 + Math.sin(x * .19 + y) * 3);
    brushedData[index] = brushedData[index + 1] = brushedData[index + 2] = value;
    brushedData[index + 3] = 255;
  }
  const brushed = new THREE.DataTexture(brushedData, 128, 128, THREE.RGBAFormat);
  brushed.wrapS = brushed.wrapT = THREE.RepeatWrapping;
  brushed.repeat.set(2, 6);
  brushed.needsUpdate = true;
  textures.add(brushed);

  const shell = mat({ color: 0x2b3034, metalness: .82, roughness: .34, roughnessMap: brushed, clearcoat: .28, clearcoatRoughness: .23 });
  const cap = mat({ color: 0x11171d, metalness: .7, roughness: .29, roughnessMap: brushed, clearcoat: .5, clearcoatRoughness: .2 });
  const innerShell = mat({ color: 0x111519, metalness: .24, roughness: .48 });
  const leather = mat({ color: 0x16191b, roughness: .76, metalness: 0, bumpMap: grain, bumpScale: .014, sheen: .3, sheenRoughness: .72, sheenColor: 0x585b5d });
  const fabric = mat({ color: 0x080b0d, roughness: .98, bumpMap: grain, bumpScale: .009, sheen: .18, sheenRoughness: .9 });
  const metal = mat({ color: 0x8998a4, metalness: 1, roughness: .25, roughnessMap: brushed, clearcoat: .24, clearcoatRoughness: .16 });
  const darkMetal = mat({ color: 0x3f4b55, metalness: .95, roughness: .33, roughnessMap: brushed });
  const seam = mat({ color: 0x050607, roughness: 0.73, metalness: 0.05 });
  const white = mat({ color: 0xd7dedf, metalness: .18, roughness: .54 });
  const thread = mat({ color: 0x62696d, roughness: .9, metalness: 0 });
  const red = new THREE.MeshBasicMaterial({ color: 0xfa3326, toneMapped: false });
  materials.add(red);

  // Broad soft boxes are reflected in the aluminium without needing an HDR asset.
  const environmentScene = new THREE.Scene();
  environmentScene.background = new THREE.Color(0x22282d);
  const environmentGeometry = new THREE.BoxGeometry(1, 1, 1);
  const environmentMaterials = [];
  const softbox = (position, scale, intensity) => {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(intensity) });
    environmentMaterials.push(material);
    const panel = new THREE.Mesh(environmentGeometry, material);
    panel.position.set(...position);
    panel.scale.set(...scale);
    environmentScene.add(panel);
  };
  softbox([-4, 4, 3], [1.3, 7, 2], 4.2);
  softbox([5, 2, 2], [.65, 6, 3], 2.5);
  softbox([0, 6, -3], [5, .8, 2], 3.5);
  softbox([-2, -3, 4], [6, .5, 3], .8);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentTarget = pmrem.fromScene(environmentScene, 0.025, 0.1, 100);
  scene.environment = environmentTarget.texture;
  pmrem.dispose();
  environmentGeometry.dispose();
  environmentMaterials.forEach((material) => material.dispose());
  environmentScene.clear();

  scene.add(new THREE.HemisphereLight(0xeaf0f4, 0x242a30, 1.15));
  const keyLight = new THREE.DirectionalLight(0xfff8ed, 3.6);
  keyLight.position.set(-3, 5, 6);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xb5d2e6, .65);
  fillLight.position.set(5, 1, -2);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xe5f0fa, 2.4);
  rimLight.position.set(-2, 4, -4);
  scene.add(rimLight);

  const product = new THREE.Group();
  const positionRig = new THREE.Group();
  scene.add(positionRig);
  positionRig.add(product);
  const initialRotation = { x: -0.07, y: -0.5, z: -0.1 };
  product.rotation.set(initialRotation.x, initialRotation.y, initialRotation.z);

  const archShape = (rx, ry, thickness, centreY = 0.65, start = 0.02, end = Math.PI - 0.02) => {
    const shape = new THREE.Shape();
    const segments = Math.max(6, Math.ceil((end - start) / Math.PI * 70));
    for (let i = 0; i <= segments; i++) {
      const angle = start + (end - start) * i / segments;
      const x = Math.cos(angle) * rx;
      const y = Math.sin(angle) * ry + centreY;
      if (!i) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    for (let i = segments; i >= 0; i--) {
      const angle = start + (end - start) * i / segments;
      shape.lineTo(Math.cos(angle) * (rx - thickness), Math.sin(angle) * (ry - thickness) + centreY);
    }
    shape.closePath();
    return shape;
  };
  const extrude = (shape, depth, bevel) => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth, steps: 1, bevelEnabled: true, bevelSegments: 4,
      bevelSize: bevel, bevelThickness: bevel, curveSegments: 48,
    });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  };
  const roundedBlock = (width, height, depth, radius = .025) => {
    const x = width / 2, y = height / 2;
    const r = Math.min(radius, width * .24, height * .24);
    const shape = new THREE.Shape();
    shape.moveTo(-x + r, -y);
    shape.lineTo(x - r, -y); shape.quadraticCurveTo(x, -y, x, -y + r);
    shape.lineTo(x, y - r); shape.quadraticCurveTo(x, y, x - r, y);
    shape.lineTo(-x + r, y); shape.quadraticCurveTo(-x, y, -x, y - r);
    shape.lineTo(-x, -y + r); shape.quadraticCurveTo(-x, -y, -x + r, -y);
    const bevel = Math.min(.012, depth * .22, radius * .35);
    const innerDepth = Math.max(.003, depth - bevel * 2);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: innerDepth, bevelEnabled: true, bevelSegments: 2,
      bevelSize: bevel, bevelThickness: bevel, curveSegments: 3, steps: 1,
    });
    geometry.translate(0, 0, -innerDepth / 2);
    return geometry;
  };
  mesh(extrude(archShape(1.76, 2.06, 0.17), 0.55, 0.035), shell, product);
  mesh(extrude(archShape(1.56, 1.84, 0.15, 0.65, 0.08, Math.PI - 0.08), 0.6, 0.04), leather, product);
  // Flush curved segments follow the band, with hairline expansion joints.
  const segmentSpan = (Math.PI - .3) / 9;
  for (let i = 0; i < 9; i++) {
    const start = .15 + segmentSpan * i + .012;
    const end = .15 + segmentSpan * (i + 1) - .012;
    mesh(extrude(archShape(1.785, 2.085, .038, .65, start, end), .575, .012), i === 4 ? darkMetal : cap, product);
  }
  // Short recessed light guides and a machined centre insert stay within the crown.
  for (const [start, end] of [[.46, .63], [2.51, 2.68]]) {
    const guide = [];
    for (let i = 0; i <= 12; i++) {
      const a = start + (end - start) * i / 12;
      guide.push(new THREE.Vector3(Math.cos(a) * 1.772, Math.sin(a) * 2.073 + .65, .309));
    }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(guide), 16, .009, 6, false), red, product);
  }
  mesh(extrude(archShape(1.793, 2.093, .026, .65, 1.45, 1.69), .588, .008), metal, product);
  mesh(extrude(archShape(1.8, 2.1, .018, .65, 1.485, 1.655), .598, .006), darkMetal, product);
  // Slim metal seams along the two edges of the headband.
  [-0.29, 0.29].forEach((z) => {
    const points = [];
    for (let i = 0; i <= 65; i++) {
      const a = 0.05 + (Math.PI - 0.1) * i / 65;
      points.push(new THREE.Vector3(Math.cos(a) * 1.725, Math.sin(a) * 2.025 + 0.65, z));
    }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 72, 0.009, 8, false), metal, product);
  });
  // A fine stitched seam follows both edges of the padded underside.
  const bandStitchGeometry = new THREE.BoxGeometry(.035, .006, .004);
  [-.275, .275].forEach((z) => {
    for (let i = 0; i < 34; i++) {
      const a = .16 + (Math.PI - .32) * i / 33;
      const stitch = mesh(bandStitchGeometry, thread, product, Math.cos(a) * 1.508, Math.sin(a) * 1.79 + .65, z);
      stitch.rotation.z = a - Math.PI / 2;
    }
  });

  const ellipticShape = (rx, ry) => {
    const shape = new THREE.Shape();
    shape.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0);
    return shape;
  };
  const armourShape = (rx, ry) => {
    const shape = new THREE.Shape();
    const points = [[-.5,1],[.43,1],[.87,.64],[1,.16],[.94,-.53],[.48,-1],[-.43,-1],[-.92,-.57],[-1,.22],[-.88,.65]];
    points.forEach(([x,y], index) => index ? shape.lineTo(x * rx,y * ry) : shape.moveTo(x * rx,y * ry));
    shape.closePath();
    return shape;
  };
  const ring = (radius, tube, xScale, yScale, material, parent, z, radialSegments = 10) => {
    const object = mesh(new THREE.TorusGeometry(radius, tube, radialSegments, 72), material, parent, 0, 0, z);
    object.scale.set(xScale, yScale, 1);
    return object;
  };
  const movingLayers = [];
  const screws = (parent, z) => {
    [[-0.34, 0.57], [0.34, -0.57], [.34,.57],[-.34,-.57]].forEach(([x, y]) => {
      const screw = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.021, 6), metal, parent, x, y, z);
      screw.rotation.x = Math.PI / 2;
      mesh(new THREE.BoxGeometry(0.041, 0.008, 0.005), seam, parent, x, y, z + 0.01).rotation.z = 0.25;
    });
  };

  const padStitchGeometry = new THREE.BoxGeometry(.027, .006, .004);
  [-1, 1].forEach((side) => {
    // Sliding stems fit into substantial band end caps, rather than thin sticks.
    mesh(roundedBlock(.19, .73, .5, .035), innerShell, product, side * 1.69, 0.55, 0);
    mesh(roundedBlock(.025, .57, .41, .009), darkMetal, product, side * 1.8, 0.5, 0);
    for (let i = 0; i < 5; i++) {
      mesh(new THREE.BoxGeometry(0.009, 0.008, 0.12), seam, product, side * 1.817, 0.42 + i * 0.065, 0.06);
    }
    // Paired exposed rails, protective end blocks and a short braided cable loop.
    [-.21,.21].forEach((z) => {
      mesh(roundedBlock(.06,.82,.065,.014), metal, product, side * 1.86,.42,z);
      mesh(roundedBlock(.16,.11,.17,.022), cap, product, side * 1.83,.82,z);
    });
    const cablePoints = [
      new THREE.Vector3(side * 1.67,.82,-.32),new THREE.Vector3(side * 2.04,.68,-.4),
      new THREE.Vector3(side * 2.09,.18,-.43),new THREE.Vector3(side * 1.84,-.19,-.42),
    ];
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePoints),32,.029,10,false), seam, product);
    [-1, 1].forEach((front) => {
      const path = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 1.7, 0.62, front * 0.2),
        new THREE.Vector3(side * 1.82, 0.30, front * 0.46),
        new THREE.Vector3(side * 1.79, -0.13, front * 0.61),
        new THREE.Vector3(side * 1.61, -0.4, front * 0.6),
      ]);
      mesh(new THREE.TubeGeometry(path, 30, 0.057, 12, false), metal, product);
      const hinge = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.11, 32), darkMetal, product, side * 1.61, -0.4, front * 0.6);
      hinge.rotation.x = Math.PI / 2;
      const hingeBolt = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.116, 24), metal, product, side * 1.61, -0.4, front * 0.6);
      hingeBolt.rotation.x = Math.PI / 2;
    });

    const cup = new THREE.Group();
    cup.position.set(side * 1.5, -0.65, 0);
    cup.rotation.y = side * Math.PI / 2;
    cup.rotation.x = -0.05;
    cup.rotation.z = side * -0.025;
    product.add(cup);

    // Cup-local Z points outwards on both sides.
    mesh(extrude(armourShape(0.655, 0.9), 0.4, 0.035), shell, cup, 0, 0, 0.035);
    mesh(extrude(armourShape(0.658,0.902),.035,.017), metal, cup,0,0,.258);
    mesh(extrude(armourShape(0.635,0.875),.025,.012), seam, cup,0,0,.284);

    const outer = new THREE.Group();
    outer.position.z = 0.29;
    cup.add(outer);
    movingLayers.push({ object: outer, base: 0.29, distance: 0.65 });
    mesh(extrude(armourShape(0.59, 0.815), 0.11, 0.025), cap, outer);
    mesh(extrude(armourShape(.43,.59),.035,.012), darkMetal, outer,0,.015,.08);
    mesh(extrude(armourShape(.39,.55),.026,.009), cap, outer,0,.015,.108);
    // Deep angled heat vents, diagonal light channels and a machined central inset.
    for (let i = 0; i < 6; i++) {
      const vent = mesh(roundedBlock(.30,.022,.022,.008), seam, outer,.015,-.43 + i * .075,.143);
      vent.rotation.z = -.24;
      const lip = mesh(roundedBlock(.30,.006,.006,.002), darkMetal, outer,.015,-.407 + i * .075,.148);
      lip.rotation.z = -.24;
    }
    for (const x of [-.43,.43]) {
      const rail = mesh(roundedBlock(.036,.72,.035,.01), metal, outer,x,.015,.105);
      rail.rotation.z = x > 0 ? .16 : -.16;
      const slash = mesh(roundedBlock(.011,.49,.009,.004), red, outer,x,.055,.132);
      slash.rotation.z = rail.rotation.z;
    }
    for (let i = 0; i < 3; i++) {
      const logo = mesh(roundedBlock(.028,.19,.013,.005), i === 2 ? red : white, outer, -.06 + i * .067, .28, .153);
      logo.rotation.z = -0.43;
    }
    mesh(roundedBlock(.17,.012,.01,.005), red, outer, 0, -.65, .105);
    for (let i=0;i<4;i++) mesh(new THREE.BoxGeometry(.018,.06,.009),white,outer,-.12+i*.06,.62,.101);
    screws(outer, 0.108);

    const pad = new THREE.Group();
    pad.position.z = -0.27;
    cup.add(pad);
    movingLayers.push({ object: pad, base: -0.27, distance: -0.5 });
    ring(.6, .16, .82, 1.2, leather, pad, -.07, 24);
    ring(0.6, 0.013, 0.82, 1.2, darkMetal, pad, 0.075, 6);
    // The hollow cushion reveals a recessed fabric driver rather than a solid blob.
    mesh(new THREE.ShapeGeometry(ellipticShape(0.37, 0.59), 48), fabric, pad, 0, 0, 0.055).rotation.y = Math.PI;
    const innerRim = ring(0.457, 0.018, 0.82, 1.2, leather, pad, -0.065, 6);
    innerRim.scale.z = 0.65;
    ring(.615, .006, .82, 1.2, thread, pad, -.18, 6);
    for (let i = 0; i < 38; i++) {
      const angle = Math.PI * 2 * i / 38;
      const stitch = mesh(padStitchGeometry, thread, pad, Math.cos(angle) * .615 * .82, Math.sin(angle) * .615 * 1.2, -.185);
      stitch.rotation.z = Math.atan2(Math.cos(angle) * 1.2, -Math.sin(angle) * .82);
    }
    for (let i = -5; i <= 5; i++) {
      const width = Math.sqrt(Math.max(0.05, 1 - (i / 6) ** 2)) * 0.48;
      mesh(new THREE.BoxGeometry(width, 0.006, 0.003), innerShell, pad, 0, i * 0.068, 0.049);
    }
    // Tactile controls are only on the right cup.
    if (side === 1) {
      const button = mesh(new THREE.CapsuleGeometry(0.036, 0.16, 3, 7), metal, cup, 0.43, -0.6, 0.05);
      button.rotation.z = -0.4;
      const port = mesh(new THREE.BoxGeometry(0.15, 0.025, 0.055), seam, cup, 0.08, -0.947, 0.02);
      port.rotation.z = 0.07;
      mesh(new THREE.BoxGeometry(0.11, 0.008, 0.018), darkMetal, cup, 0.08, -0.959, 0.021);
    }
  });

  // Rotate about the centre of the full assembly, not the bottom of its arch.
  // Actual vertices at both separation endpoints form a fixed framing envelope;
  // every intermediate exploded position lies between those endpoints.
  const assembly = new THREE.Group();
  [...product.children].forEach((child) => assembly.add(child));
  product.add(assembly);
  product.rotation.set(0, 0, 0);
  const framingCoordinates = [];
  const envelope = new THREE.Box3();
  const vertex = new THREE.Vector3();
  const meshVertices = [];
  const vertexCache = new WeakMap();
  assembly.traverse((object) => {
    if (!object.isMesh) return;
    let coordinates = vertexCache.get(object.geometry);
    if (!coordinates) {
      const attributes = object.geometry.getAttribute('position');
      const unique = new Set();
      const values = [];
      for (let index = 0; index < attributes.count; index++) {
        const x = attributes.getX(index), y = attributes.getY(index), z = attributes.getZ(index);
        const key = `${x},${y},${z}`;
        if (unique.has(key)) continue;
        unique.add(key);
        values.push(x, y, z);
      }
      coordinates = new Float32Array(values);
      vertexCache.set(object.geometry, coordinates);
    }
    meshVertices.push({ object, coordinates });
  });
  for (const separation of [0, 1]) {
    movingLayers.forEach(({ object, base, distance }) => { object.position.z = base + distance * separation; });
    product.updateWorldMatrix(true, true);
    for (const { object, coordinates } of meshVertices) {
      for (let index = 0; index < coordinates.length; index += 3) {
        vertex.fromArray(coordinates, index).applyMatrix4(object.matrixWorld);
        envelope.expandByPoint(vertex);
        framingCoordinates.push(vertex.x, vertex.y, vertex.z);
      }
    }
  }
  const assemblyCentre = envelope.getCenter(new THREE.Vector3());
  assembly.position.copy(assemblyCentre).negate();
  for (let index = 0; index < framingCoordinates.length; index += 3) {
    framingCoordinates[index] -= assemblyCentre.x;
    framingCoordinates[index + 1] -= assemblyCentre.y;
    framingCoordinates[index + 2] -= assemblyCentre.z;
  }
  const framingPoints = new Float32Array(framingCoordinates);
  canvas.dataset.geometryVertices = String(meshVertices.reduce((sum, entry) => sum + entry.object.geometry.getAttribute('position').count, 0));
  framingCoordinates.length = 0;
  movingLayers.forEach(({ object, base }) => { object.position.z = base; });
  product.rotation.set(initialRotation.x, initialRotation.y, initialRotation.z);

  // A translucent procedural ground shadow stays soft against any page backdrop.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const shadowContext = shadowCanvas.getContext('2d');
  let shadow;
  if (shadowContext) {
    const gradient = shadowContext.createRadialGradient(64, 64, 4, 64, 64, 63);
    gradient.addColorStop(0, 'rgba(0,0,0,.23)');
    gradient.addColorStop(0.45, 'rgba(0,0,0,.1)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    shadowContext.fillStyle = gradient;
    shadowContext.fillRect(0, 0, 128, 128);
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    textures.add(shadowTexture);
    const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false });
    materials.add(shadowMaterial);
    shadow = mesh(new THREE.PlaneGeometry(5, 3), shadowMaterial, scene, 0, -2.7, 0);
    shadow.rotation.x = -Math.PI / 2;
  }

  let destroyed = false;
  let frame = 0;
  let explode = 0;
  let explodeTarget = 0;
  let rotationTarget = { ...initialRotation };
  let interactionMode = 'rotate';
  let zoom = 1;
  let zoomTarget = 1;
  const position = { x: 0, y: 0 };
  const positionTarget = { x: 0, y: 0 };
  let dragging = null;
  let lastTimestamp = 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let isVisible = true;

  const getViewState = () => ({
    interactionMode,
    position: { ...positionTarget },
    zoom: zoomTarget,
    rotation: { x: rotationTarget.x, y: rotationTarget.y },
  });
  const emitChange = () => {
    canvas.dataset.viewX = positionTarget.x.toFixed(3);
    canvas.dataset.viewY = positionTarget.y.toFixed(3);
    canvas.dataset.viewZoom = zoomTarget.toFixed(3);
    canvas.dataset.rotationX = rotationTarget.x.toFixed(3);
    canvas.dataset.rotationY = rotationTarget.y.toFixed(3);
    canvas.dataset.interactionMode = interactionMode;
    onViewChange?.(getViewState());
  };

  const cameraRight = new THREE.Vector3();
  const cameraUp = new THREE.Vector3();
  const point = new THREE.Vector3();
  const meshToCamera = new THREE.Matrix4();
  // Pan uses camera-space mesh bounds and only translates the position rig.
  // It never changes model scale or camera distance as the product turns.
  const placeWithinView = () => {
    positionRig.position.set(0, 0, 0);
    camera.updateMatrixWorld();
    cameraRight.setFromMatrixColumn(camera.matrixWorld, 0);
    cameraUp.setFromMatrixColumn(camera.matrixWorld, 1);
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const limits = { minX: -Infinity, maxX: Infinity, minY: -Infinity, maxY: Infinity };
    positionRig.updateWorldMatrix(true, true);
    for (const { object, coordinates } of meshVertices) {
      meshToCamera.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld);
      for (let index = 0; index < coordinates.length; index += 3) {
        point.fromArray(coordinates, index).applyMatrix4(meshToCamera);
        const halfHeight = Math.max(.1, -point.z) * tangent;
        const halfWidth = halfHeight * camera.aspect;
        limits.minX = Math.max(limits.minX, -halfWidth * .94 - point.x);
        limits.maxX = Math.min(limits.maxX, halfWidth * .94 - point.x);
        limits.minY = Math.max(limits.minY, -halfHeight * .94 - point.y);
        limits.maxY = Math.min(limits.maxY, halfHeight * .94 - point.y);
      }
    }
    const halfHeight = camera.position.length() * tangent;
    const halfWidth = halfHeight * camera.aspect;
    const x = limits.minX <= limits.maxX ? THREE.MathUtils.clamp(position.x * halfWidth * .36, limits.minX, limits.maxX) : (limits.minX + limits.maxX) / 2;
    const y = limits.minY <= limits.maxY ? THREE.MathUtils.clamp(position.y * halfHeight * .36, limits.minY, limits.maxY) : (limits.minY + limits.maxY) / 2;
    positionRig.position.copy(cameraRight).multiplyScalar(x).addScaledVector(cameraUp, y);
    if (shadow) {
      shadow.position.x = positionRig.position.x;
      shadow.position.z = positionRig.position.z;
    }
  };

  const render = (timestamp) => {
    frame = 0;
    if (destroyed || !isVisible || document.hidden) return;
    const delta = lastTimestamp ? Math.min((timestamp - lastTimestamp) / 16.67, 3) : 1;
    lastTimestamp = timestamp;
    const easing = reducedMotion.matches ? 1 : 1 - Math.pow(0.78, delta);
    product.rotation.x += (rotationTarget.x - product.rotation.x) * easing;
    product.rotation.y += (rotationTarget.y - product.rotation.y) * easing;
    product.rotation.z += (rotationTarget.z - product.rotation.z) * easing;
    position.x += (positionTarget.x - position.x) * easing;
    position.y += (positionTarget.y - position.y) * easing;
    zoom += (zoomTarget - zoom) * easing;
    product.scale.setScalar(zoom * .94);
    explode += (explodeTarget - explode) * easing;
    movingLayers.forEach(({ object, base, distance }) => { object.position.z = base + distance * explode; });
    if (shadow) shadow.scale.setScalar(1 + explode * 0.1);
    placeWithinView();
    renderer.render(scene, camera);
    canvas.dataset.renderedScale = product.scale.x.toFixed(6);
    canvas.dataset.cameraDistance = camera.position.length().toFixed(6);
    const unsettled = Math.abs(explodeTarget - explode) > 0.0005 ||
      Math.abs(rotationTarget.x - product.rotation.x) > 0.0005 ||
      Math.abs(rotationTarget.y - product.rotation.y) > 0.0005 ||
      Math.abs(rotationTarget.z - product.rotation.z) > 0.0005 ||
      Math.abs(positionTarget.x - position.x) > 0.0005 ||
      Math.abs(positionTarget.y - position.y) > 0.0005 ||
      Math.abs(zoomTarget - zoom) > 0.0005;
    if (unsettled) requestRender();
  };
  const requestRender = () => { if (!frame && !destroyed) frame = requestAnimationFrame(render); };

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, bounds.width);
    const height = Math.max(1, bounds.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Keep the whole headset in narrow configurations; no cropped ear cups.
    camera.fov = camera.aspect < 0.9 ? 45 : 35;
    camera.position.copy(cameraBack);
    camera.updateMatrixWorld();
    cameraRight.setFromMatrixColumn(camera.matrixWorld, 0);
    cameraUp.setFromMatrixColumn(camera.matrixWorld, 1);
    // Fit the default zoom once. Deliberate zooming can fill or crop the stage;
    // it must not silently move the camera backwards or shrink the product.
    const distance = fixedCameraDistance(framingPoints, {
      right: cameraRight.toArray(), up: cameraUp.toArray(), back: cameraBack.toArray(),
      aspect: camera.aspect, fov: camera.fov, maximumScale: .94, roll: initialRotation.z,
    });
    camera.position.copy(cameraBack).multiplyScalar(distance);
    camera.far = Math.max(50, distance * 2);
    camera.updateProjectionMatrix();
    canvas.dataset.cameraDistance = distance.toFixed(6);
    requestRender();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    isVisible = entry.isIntersecting;
    if (isVisible) requestRender();
  }, { rootMargin: '100px' });
  intersectionObserver.observe(canvas);

  const onPointerDown = (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    canvas.focus({ preventScroll: true });
    dragging = { id: event.pointerId, pointerType: event.pointerType, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, active: false, mode: event.shiftKey ? 'move' : interactionMode };
    if (event.pointerType !== 'touch') canvas.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (!dragging || dragging.id !== event.pointerId) return;
    const horizontal = event.clientX - dragging.startX;
    const vertical = event.clientY - dragging.startY;
    const totalDistance = Math.hypot(horizontal, vertical);
    if (!dragging.active && dragging.pointerType === 'touch' && totalDistance > 6 && Math.abs(vertical) > Math.abs(horizontal) * 1.1) {
      dragging = null;
      return;
    }
    if (totalDistance > 4 && !dragging.active) {
      dragging.active = true;
      canvas.setPointerCapture?.(event.pointerId);
    }
    if (dragging.active) {
      if (dragging.mode === 'move' || event.shiftKey) {
        const bounds = canvas.getBoundingClientRect();
        positionTarget.x = THREE.MathUtils.clamp(positionTarget.x + (event.clientX - dragging.x) / Math.max(1,bounds.width * .18), -1, 1);
        positionTarget.y = THREE.MathUtils.clamp(positionTarget.y - (event.clientY - dragging.y) / Math.max(1,bounds.height * .18), -1, 1);
      } else {
        rotationTarget.y += (event.clientX - dragging.x) * 0.009;
        rotationTarget.x = THREE.MathUtils.clamp(rotationTarget.x + (event.clientY - dragging.y) * 0.006, -0.85, 0.85);
      }
      canvas.style.cursor = dragging.mode === 'move' || event.shiftKey ? 'move' : 'grabbing';
      emitChange();
      requestRender();
    }
    dragging.x = event.clientX;
    dragging.y = event.clientY;
  };
  const onPointerUp = (event) => {
    if (dragging?.id !== event.pointerId) return;
    dragging = null;
    canvas.style.cursor = interactionMode === 'move' ? 'move' : 'grab';
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  const reset = () => {
    rotationTarget = { ...initialRotation };
    positionTarget.x = positionTarget.y = 0;
    zoomTarget = 1;
    emitChange();
    requestRender();
  };
  const onKeyDown = (event) => {
    const pan = interactionMode === 'move' || event.shiftKey;
    const amount = 0.1;
    if (event.key === 'ArrowLeft') pan ? positionTarget.x -= amount : rotationTarget.y -= amount;
    else if (event.key === 'ArrowRight') pan ? positionTarget.x += amount : rotationTarget.y += amount;
    else if (event.key === 'ArrowUp') pan ? positionTarget.y += amount : rotationTarget.x -= amount;
    else if (event.key === 'ArrowDown') pan ? positionTarget.y -= amount : rotationTarget.x += amount;
    else if (event.key === '+' || event.key === '=') zoomTarget += .05;
    else if (event.key === '-' || event.key === '_') zoomTarget -= .05;
    else if (event.key === 'Home') reset();
    else return;
    positionTarget.x = THREE.MathUtils.clamp(positionTarget.x,-1,1);
    positionTarget.y = THREE.MathUtils.clamp(positionTarget.y,-1,1);
    zoomTarget = THREE.MathUtils.clamp(zoomTarget,.8,1.25);
    rotationTarget.x = THREE.MathUtils.clamp(rotationTarget.x, -0.85, 0.85);
    event.preventDefault();
    emitChange();
    requestRender();
  };
  const onVisibility = () => { lastTimestamp = 0; if (!document.hidden) requestRender(); };
  const onContextLost = (event) => { event.preventDefault(); onError?.(new Error('3D preview lost its graphics context.')); };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('lostpointercapture', onPointerUp);
  canvas.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('webglcontextlost', onContextLost);
  document.addEventListener('visibilitychange', onVisibility);
  canvas.style.cursor = 'grab';
  // Allow vertical page scrolling on touch while horizontal drags turn the model.
  canvas.style.touchAction = 'pan-y';
  resize();
  emitChange();
  product.scale.setScalar(zoom * .94);
  placeWithinView();
  renderer.render(scene, camera);
  canvas.dataset.renderedScale = product.scale.x.toFixed(6);
  canvas.dataset.cameraDistance = camera.position.length().toFixed(6);
  onReady?.();

  return {
    setFinish(finish) {
      const finishes = {
        obsidian: { shell: 0x2b3034, cap: 0x11171d, shellRoughness: .34, capRoughness: .29 },
        chalk: { shell: 0xbfc5c8, cap: 0xdde1dc, shellRoughness: .45, capRoughness: .39 },
        signal: { shell: 0x971e15, cap: 0xc42c21, shellRoughness: .38, capRoughness: .32 },
      };
      const selected = finishes[finish] || finishes.obsidian;
      shell.color.setHex(selected.shell);
      cap.color.setHex(selected.cap);
      shell.roughness = selected.shellRoughness;
      cap.roughness = selected.capRoughness;
      requestRender();
    },
    setExploded(value) {
      explodeTarget = value ? 1 : 0;
      requestRender();
    },
    setInteractionMode(value) {
      if (!['rotate','move'].includes(value)) return;
      interactionMode = value;
      canvas.style.cursor = interactionMode === 'move' ? 'move' : 'grab';
      emitChange();
    },
    setPosition(x, y) {
      if (Number.isFinite(x)) positionTarget.x = THREE.MathUtils.clamp(x,-1,1);
      if (Number.isFinite(y)) positionTarget.y = THREE.MathUtils.clamp(y,-1,1);
      emitChange();
      requestRender();
    },
    setZoom(value) {
      if (!Number.isFinite(value)) return;
      zoomTarget = THREE.MathUtils.clamp(value,.8,1.25);
      emitChange();
      requestRender();
    },
    getViewState,
    getSnapshot() {
      if (destroyed) return null;
      try {
        // Copy immediately after drawing: this does not require retaining the
        // WebGL buffer between frames or changing the product's current pose.
        renderer.render(scene, camera);
        const snapshot = document.createElement('canvas');
        const ratio = Math.min(1, 640 / Math.max(1, canvas.width));
        snapshot.width = Math.max(1, Math.round(canvas.width * ratio));
        snapshot.height = Math.max(1, Math.round(canvas.height * ratio));
        const context = snapshot.getContext('2d');
        if (!context) return null;
        context.drawImage(canvas, 0, 0, snapshot.width, snapshot.height);
        return snapshot.toDataURL('image/png');
      } catch { return null; }
    },
    reset,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('lostpointercapture', onPointerUp);
      canvas.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      document.removeEventListener('visibilitychange', onVisibility);
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      environmentTarget.dispose();
      scene.clear();
      renderer.dispose();
    },
  };
}
