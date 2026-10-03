// Real engine core: renderer, frame loop, palettes, sky, shadows, post, pixel-art resolution,
// the four camera rigs, the world, the bird flocks and the train.
import '../core/disable-three-color-management.js';
import * as THREE from 'three';
import { LIGHTING_UNIFORMS } from '../materials/shared-lighting-uniforms.js';
import { PALETTES, applyPalette, beginPaletteTransition, stepPaletteTransition } from './time-of-day-palettes-and-transition.js';
import { CAMERA_FOV, setCameraMode, updateCameraRig } from './cameras/camera-mode-director.js';
import { OVERVIEW_HOME, createOverviewControls, bindOverviewIntroInterrupt, prepareOverviewIntro as prepareOverviewIntroPose } from './cameras/overview-orbit-camera.js';
import { createFirstPersonControls, bindClickToLock, disposeFirstPersonControls } from './cameras/free-fly-pointer-lock-camera.js';
import { composeDioramaScene } from './diorama-scene-composition.js';
import { createShadowDepthPass } from './custom-shadow-depth-pass.js';
import { createPostPass } from './post-ink-outline-dither-pass.js';
import { resizeDiorama } from './render-resolution-resizer.js';
import { createFrameLoop } from './frame-loop-scheduler.js';
import { renderDioramaFrame } from './render-pipeline.js';
import { updateTrainAndEffects } from '../train/train-frame-update.js';

export class Diorama {
  constructor(container) {
    this.scene = new THREE.Scene();
    this.scene.matrixWorldAutoUpdate = false;
    this.lightingUniforms = LIGHTING_UNIFORMS;

    this.mode = 'overview';
    this.overviewIntro = null;
    this.autoRotateEnabled = true;
    this.speedMul = 1;
    this.timeScale = 1;
    this.paused = false;
    this.pixelShortSide = null;
    this.outline = true;
    this.timeOfDay = null;
    this.timeOfDayTransition = null;

    this.last = performance.now();
    this.nextFrameAt = this.last;
    this.time = 0;
    this.raf = 0;
    this.s = 0;
    this.speed = 0;
    this.stopTimer = 0;
    this.justLeft = false;

    // Camera-rig state shared by the overview, free, train fly-along and bridge rigs.
    this.camPos = new THREE.Vector3();
    this.camTarget = new THREE.Vector3();
    this.flyAlongElapsed = 0;
    this.flyAlongSide = 1;
    this.flyAlongAnchor = new THREE.Vector3();
    this.flyAlongVelocity = new THREE.Vector3();
    this.previousFlyAlongAnchor = new THREE.Vector3();

    this.movementKeys = new Set();
    this.tmpA = new THREE.Vector3();
    this.tmpB = new THREE.Vector3();
    this.loop = createFrameLoop(this);

    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.info.autoReset = false;
    this.performanceStats = { frameMilliseconds: 1000 / 60, cpuMilliseconds: 0 };
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';

    // Home position; OrbitControls' own constructor re-orients it just below.
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV.overview, 1, 0.3, 1500);
    this.camera.position.copy(OVERVIEW_HOME);
    this.controls = createOverviewControls(this);
    bindOverviewIntroInterrupt(this);
    this.firstPersonControls = createFirstPersonControls(this);
    bindClickToLock(this);

    composeDioramaScene(this);

    this.shadowPass = createShadowDepthPass();
    this.shadowRT = this.shadowPass.renderTarget;
    this.shadowCam = this.shadowPass.camera;
    this.depthMat = this.shadowPass.material;

    this.mainRT = new THREE.WebGLRenderTarget(4, 4, { depthTexture: new THREE.DepthTexture(4, 4) });
    const post = createPostPass(this.mainRT, this.camera.near, this.camera.far);
    this.postScene = post.scene;
    this.postCam = post.camera;
    this.postMat = post.material;

    this.setTimeOfDay('day', true);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.container);
    this.resize();

    this.camPos.copy(this.camera.position);
    this.camTarget.copy(this.controls.target);
    this.loop(performance.now());
  }

  setMode(mode) {
    setCameraMode(this, mode);
  }

  setTimeOfDay(id, immediate = false) {
    if (!Object.prototype.hasOwnProperty.call(PALETTES, id)) throw new Error(`Invalid time of day: ${id}`);
    if (id === this.timeOfDay && !immediate) return;
    this.timeOfDay = id;
    if (immediate) {
      this.timeOfDayTransition = null;
      applyPalette(this.lightingUniforms, id);
      return;
    }
    this.timeOfDayTransition = beginPaletteTransition(this.lightingUniforms, id);
  }

  updateTimeOfDay(realDt) {
    this.timeOfDayTransition = stepPaletteTransition(this.lightingUniforms, this.timeOfDayTransition, realDt);
  }

  setPixelResolution(shortSide) {
    this.pixelShortSide = shortSide;
    this.resize();
  }

  setOutline(on) {
    this.outline = on;
    this.postMat.uniforms.uOutline.value = on ? 1 : 0;
  }

  setAutoRotate(on) {
    this.autoRotateEnabled = on;
    this.controls.autoRotate = this.mode === 'overview' && on;
  }

  prepareOverviewIntro() {
    prepareOverviewIntroPose(this);
  }

  logCameraPose() {
    const toMillis3 = n => Number(n.toFixed(3));
    const pose = {
      mode: this.mode,
      position: { x: toMillis3(this.camera.position.x), y: toMillis3(this.camera.position.y), z: toMillis3(this.camera.position.z) },
      rotationDegrees: {
        x: toMillis3(THREE.MathUtils.radToDeg(this.camera.rotation.x)),
        y: toMillis3(THREE.MathUtils.radToDeg(this.camera.rotation.y)),
        z: toMillis3(THREE.MathUtils.radToDeg(this.camera.rotation.z)),
      },
    };
    console.log(`[DEBUG] Camera pose: ${JSON.stringify(pose)}`);
  }

  resize() {
    resizeDiorama(this);
  }

  updateTrain(simDt) {
    return updateTrainAndEffects(this, simDt);
  }

  // The smoke pool owns the emission timer; the parity surface reads and writes it here.
  get puffTimer() { return this.puffPool.timer; }
  set puffTimer(seconds) { this.puffPool.timer = seconds; }

  updateCamera(dt) {
    updateCameraRig(this, dt);
  }

  render() {
    renderDioramaFrame(this);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    disposeFirstPersonControls(this);
    this.controls.removeEventListener('start', this.onOverviewInteraction);
    this.controls.dispose();
    this.birds.dispose();
    this.brakeSparks.dispose();
    for (const glow of this.nightGlows) {
      glow.geometry.dispose();
      glow.material.dispose();
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
