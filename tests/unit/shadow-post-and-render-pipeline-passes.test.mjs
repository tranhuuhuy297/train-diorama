// Post-pass uniforms/order, setOutline, the custom shadow depth pass, and renderDioramaFrame's fixed
// call order: info reset -> glows -> headlight uniforms -> sky follow -> matrices -> shadow -> main -> post.
import '../../src/core/disable-three-color-management.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPostPass } from '../../src/engine/post-ink-outline-dither-pass.js';
import { createShadowDepthPass, SHADOW_MAP_SIZE } from '../../src/engine/custom-shadow-depth-pass.js';
import { renderDioramaFrame } from '../../src/engine/render-pipeline.js';
import { Diorama } from '../../src/engine/diorama.js';
import { skyMaterial } from '../../src/materials/procedural-sky-dome-material.js';
import { G, LIGHTING_UNIFORMS } from '../../src/materials/shared-lighting-uniforms.js';
import { applyPalette, PALETTES } from '../../src/engine/time-of-day-palettes-and-transition.js';

beforeEach(() => {
  applyPalette(LIGHTING_UNIFORMS, 'day');
  G.uTime.value = 0;
});

test('createPostPass: uniform values, key order, identities, render-state flags', () => {
  const rt = new THREE.WebGLRenderTarget(4, 4, { depthTexture: new THREE.DepthTexture(4, 4) });
  const post = createPostPass(rt, 0.3, 1500);
  const u = post.material.uniforms;
  assert.equal(u.uNear.value, 0.3);
  assert.equal(u.uFar.value, 1500);
  assert.deepEqual(u.uRes.value.toArray(), [4, 4]);
  assert.equal(u.uOutline.value, 1);
  assert.equal(u.uThick.value, 1);
  assert.equal(u.uPixel.value, 0);
  assert.deepEqual(Object.keys(u), ['tColor', 'tDepth', 'uRes', 'uNear', 'uFar', 'uOutline', 'uThick', 'uPixel', 'uNight', 'uSaturation']);
  assert.equal(u.tColor.value, rt.texture);
  assert.equal(u.tDepth.value, rt.depthTexture);
  assert.equal(u.uNight, LIGHTING_UNIFORMS.uNight);
  assert.equal(u.uSaturation, LIGHTING_UNIFORMS.uSaturation);
  assert.equal(post.material.depthTest, false);
  assert.equal(post.material.depthWrite, false);
  assert.equal(post.scene.children[0].frustumCulled, false);
  assert.equal(post.camera.left, -1); assert.equal(post.camera.right, 1);
  assert.equal(post.camera.top, 1); assert.equal(post.camera.bottom, -1);
  assert.equal(post.camera.near, 0); assert.equal(post.camera.far, 1);
});

test('Diorama.prototype.setOutline flips the post uniform and the field', () => {
  const rt = new THREE.WebGLRenderTarget(4, 4, { depthTexture: new THREE.DepthTexture(4, 4) });
  const fake = { postMat: createPostPass(rt, 0.3, 1500).material, outline: true };
  Diorama.prototype.setOutline.call(fake, false);
  assert.equal(fake.outline, false);
  assert.equal(fake.postMat.uniforms.uOutline.value, 0);
});

test('createShadowDepthPass: RT/depth texture, light-cam frustum, DoubleSide colour-free material', () => {
  const pass = createShadowDepthPass();
  assert.equal(SHADOW_MAP_SIZE, 2048);
  assert.equal(G.uShadowMap.value, pass.renderTarget.depthTexture);
  assert.equal(G.uShadowTexel.value, 1 / 2048);
  assert.equal(pass.camera.left, -82); assert.equal(pass.camera.right, 82);
  assert.equal(pass.camera.top, 82); assert.equal(pass.camera.bottom, -82);
  assert.equal(pass.camera.near, 1); assert.equal(pass.camera.far, 360);
  assert.equal(pass.material.side, THREE.DoubleSide);
  assert.equal(pass.material.colorWrite, false);
});

test('shadow pass render: override material during render, light position, hide/restore, uShadowMatrix', () => {
  const pass = createShadowDepthPass();
  const scene = new THREE.Scene();
  let overrideDuringRender = null;
  let visibilityDuringRender = null;
  const renderer = {
    setRenderTarget() {},
    clear() {},
    render(renderedScene) {
      overrideDuringRender = renderedScene.overrideMaterial;
      visibilityDuringRender = hidden.map(o => o.visible);
    },
  };
  const a = new THREE.Object3D(); a.visible = true;
  const b = new THREE.Object3D(); b.visible = false;
  const hidden = [a, b];
  const visibility = new Array(2);

  pass.render(renderer, scene, hidden, visibility);

  assert.equal(overrideDuringRender, pass.material);
  assert.deepEqual(visibilityDuringRender, [false, false], 'every hidden object is invisible during the render call');
  assert.equal(scene.overrideMaterial, null);
  assert.equal(a.visible, true);
  assert.equal(b.visible, false, 'a pre-hidden object stays hidden after restore');

  const expectedPosition = PALETTES.day.uLightDir.clone().multiplyScalar(170);
  assert.ok(pass.camera.position.distanceTo(expectedPosition) < 1e-12);

  // Reference light camera built from scratch, so a wrong pass camera can't validate itself.
  const lightCam = new THREE.OrthographicCamera(-82, 82, 82, -82, 1, 360);
  lightCam.position.copy(PALETTES.day.uLightDir).multiplyScalar(170);
  lightCam.lookAt(0, 0, 0);
  lightCam.updateMatrixWorld();
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const expectedMatrix = bias.multiply(lightCam.projectionMatrix).multiply(lightCam.matrixWorldInverse);
  for (let i = 0; i < 16; i++) assert.ok(Math.abs(G.uShadowMatrix.value.elements[i] - expectedMatrix.elements[i]) < 1e-12, `element ${i}`);

  // Geometric sanity: the look-at origin lands mid-texture at depth (170 - near) / (far - near).
  const origin = new THREE.Vector3().applyMatrix4(G.uShadowMatrix.value);
  assert.ok(Math.abs(origin.x - 0.5) < 1e-12 && Math.abs(origin.y - 0.5) < 1e-12);
  assert.ok(Math.abs(origin.z - 169 / 359) < 1e-12);
});

// Locomotive turned off-axis with an offset headlight anchor; logs when the uniform write reads it.
function headlightRig(calls, glow) {
  const loco = { obj: new THREE.Object3D() };
  loco.obj.position.set(4, 0.5, -7);
  loco.obj.quaternion.setFromEuler(new THREE.Euler(0.1, 0.9, -0.05));
  const headlight = new THREE.Object3D();
  headlight.position.set(0, 1.2, 2.6);
  loco.obj.add(headlight);
  const readWorldPosition = headlight.getWorldPosition.bind(headlight);
  headlight.getWorldPosition = target => {
    calls.push(glow.visible ? 'headlight' : 'headlight-before-glows');
    return readWorldPosition(target);
  };
  return { headlight, loco };
}

test('renderDioramaFrame: fixed order, glow visibility, headlight uniforms, sky follow, one matrix refresh', () => {
  const calls = [];
  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), skyMaterial());
  const scene = new THREE.Scene();
  const originalUpdateMatrixWorld = scene.updateMatrixWorld.bind(scene);
  scene.updateMatrixWorld = (...args) => { calls.push('matrixWorld'); originalUpdateMatrixWorld(...args); };
  const camera = { position: new THREE.Vector3(1, 2, 3) };
  const renderer = {
    info: { reset: () => calls.push('infoReset') },
    setRenderTarget: rt => calls.push(['setRenderTarget', rt]),
    clear: () => calls.push('clear'),
    render: (s, c) => calls.push(['render', s, c]),
  };
  // Tagged (not structurally-equal) stand-ins so deepEqual on `{}` can't mask swapped args.
  const mainRT = { tag: 'mainRT' };
  const postScene = { tag: 'postScene' }; const postCam = { tag: 'postCam' };
  const glowA = { visible: false };
  const shadowPass = createShadowDepthPass();
  scene.add(sky);
  const d = {
    renderer, scene, camera, sky, mainRT, postScene, postCam,
    lightingUniforms: {
      uNight: { value: 1 },
      uHeadlightPosition: { value: new THREE.Vector3() },
      uHeadlightDirection: { value: new THREE.Vector3(0, 0, 1) },
    },
    nightGlows: [glowA],
    shadowHiddenObjects: [], shadowVisibility: [],
    shadowPass,
    train: headlightRig(calls, glowA),
  };

  renderDioramaFrame(d);

  assert.equal(calls[0], 'infoReset');
  assert.equal(calls[1], 'headlight', 'headlight uniforms are written after glow visibility, before the matrix refresh');
  const anchorWorld = d.train.headlight.getWorldPosition(new THREE.Vector3());
  assert.deepStrictEqual(d.lightingUniforms.uHeadlightPosition.value.toArray(), anchorWorld.toArray());
  const beam = new THREE.Vector3(0, -0.08, 1).normalize().applyQuaternion(d.train.loco.obj.quaternion).toArray();
  const written = d.lightingUniforms.uHeadlightDirection.value.toArray();
  assert.ok(beam.every((value, axis) => Object.is(written[axis], value)), `beam ${written} vs ${beam}`);
  assert.equal(glowA.visible, true);
  assert.deepEqual(sky.position.toArray(), [1, 2, 3]);
  assert.deepEqual(sky.matrixWorld.elements.slice(12, 15), [1, 2, 3], 'sky follows the camera before the single updateMatrixWorld, not after');
  assert.equal(calls.filter(c => c === 'matrixWorld').length, 1);
  const matrixWorldIndex = calls.indexOf('matrixWorld');
  const firstSetRenderTargetIndex = calls.findIndex(c => Array.isArray(c) && c[0] === 'setRenderTarget');
  assert.ok(matrixWorldIndex < firstSetRenderTargetIndex, 'matrixWorld runs before any render pass');
  const setRenderTargets = calls.filter(c => Array.isArray(c) && c[0] === 'setRenderTarget').map(c => c[1]);
  assert.equal(setRenderTargets.length, 3);
  assert.equal(setRenderTargets[0], shadowPass.renderTarget);
  assert.equal(setRenderTargets[1], mainRT);
  assert.equal(setRenderTargets[2], null);

  const renderCalls = calls.filter(c => Array.isArray(c) && c[0] === 'render').map(c => [c[1], c[2]]);
  assert.equal(renderCalls.length, 3);
  assert.equal(renderCalls[0][0], scene); assert.equal(renderCalls[0][1], shadowPass.camera);
  assert.equal(renderCalls[1][0], scene); assert.equal(renderCalls[1][1], camera);
  assert.equal(renderCalls[2][0], postScene); assert.equal(renderCalls[2][1], postCam);
});
