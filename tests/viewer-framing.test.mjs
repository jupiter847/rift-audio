import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { fixedCameraDistance, rotationEnvelopeSupport } from '../dist/viewer-framing.js';

test('rotation envelope contains the actual Three.js XYZ rotations', () => {
  const cases = [
    { point: [2.5, -2.1, .7], normal: [.6, 1, .2] },
    { point: [-1.2, 2.3, -.5], normal: [-.8, .3, -.4] },
    { point: [0, 2.3, 0], normal: [0, -1, .4] },
  ];
  for (const { point, normal } of cases) {
    const maximum = rotationEnvelopeSupport(point, normal);
    let sampled = -Infinity;
    for (let pitch = -.85; pitch <= .85001; pitch += .025) {
      for (let yaw = 0; yaw < Math.PI * 2; yaw += .025) {
        const rotated = new THREE.Vector3(...point).applyEuler(new THREE.Euler(pitch, yaw, -.1));
        sampled = Math.max(sampled, rotated.dot(new THREE.Vector3(...normal)));
      }
    }
    assert.ok(maximum >= sampled - 1e-9, 'analytical envelope contains sampled rotations');
    assert.ok(maximum - sampled < .003, 'framing is tight rather than using an oversized sphere');
  }
});

test('one fixed camera contains all orientations at default zoom across viewport shapes', () => {
  const points = new Float32Array([2.5, -2.1, .7, -2.5, -2.1, -.7, 0, 2.3, .4, 1.8, .3, -.8]);
  for (const aspect of [.65, 1, 1.6]) {
    const camera = new THREE.PerspectiveCamera(aspect < .9 ? 45 : 35, aspect, .1, 100);
    const back = new THREE.Vector3(5.3, 1.9, 7.8).normalize();
    camera.position.copy(back);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).toArray();
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).toArray();
    const distance = fixedCameraDistance(points, { right, up, back: back.toArray(), aspect, fov: camera.fov });
    camera.position.copy(back).multiplyScalar(distance);
    camera.updateMatrixWorld();
    for (const scale of [.752, .94]) {
      for (let pitch = -.85; pitch <= .85001; pitch += .17) {
        for (let yaw = 0; yaw < Math.PI * 2; yaw += Math.PI / 32) {
          for (let index = 0; index < points.length; index += 3) {
            const projected = new THREE.Vector3(points[index], points[index + 1], points[index + 2])
              .applyEuler(new THREE.Euler(pitch, yaw, -.1)).multiplyScalar(scale).project(camera);
            assert.ok(Math.abs(projected.x) <= .940001 && Math.abs(projected.y) <= .940001);
          }
          assert.equal(camera.position.length().toFixed(8), distance.toFixed(8), 'turning the model does not refit the camera');
        }
      }
    }
    // Zoom is an explicit model transform after framing. It is allowed to crop;
    // the camera fitted for default zoom stays at precisely the same distance.
    const object = new THREE.Object3D();
    for (const zoom of [.8, 1, 1.25]) {
      object.scale.setScalar(zoom * .94);
      for (const yaw of [0, .8, 2.7, 5.6]) {
        object.rotation.y = yaw;
        object.updateMatrixWorld();
        assert.equal(object.getWorldScale(new THREE.Vector3()).x.toFixed(6), (zoom * .94).toFixed(6));
        assert.equal(camera.position.length().toFixed(8), distance.toFixed(8));
      }
    }
  }
});
