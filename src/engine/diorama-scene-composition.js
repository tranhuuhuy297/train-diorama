// Scene content in insertion order: world, train, brake sparks (then motion init), sky dome, smoke
// puffs, the shadow-hidden list and the night-glow registry. Insertion order sets material ids and
// glow order; the registry collection stays last so it sees every glow inserted before it.
import * as THREE from 'three';
import { World } from '../world/world.js';
import { Train } from '../train/train.js';
import { BrakeSparks } from '../train/brake-sparks.js';
import { LocomotiveSmokePuffPool } from '../train/locomotive-smoke-puff-pool.js';
import { initTrainMotion } from '../train/train-station-motion-controller.js';
import { skyMaterial } from '../materials/procedural-sky-dome-material.js';
import { collectNightLightGlows } from './night-light-glow-registry.js';

export function composeDioramaScene(d) {
  d.world = new World();
  d.scene.add(d.world.group);

  d.train = new Train();
  d.scene.add(d.train.group);
  d.brakeSparks = new BrakeSparks(d.world.heightAt.bind(d.world));
  d.scene.add(d.brakeSparks.mesh);
  initTrainMotion(d, d.world.stationS);

  d.sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), skyMaterial());
  d.sky.frustumCulled = false;
  d.sky.renderOrder = -1;
  d.scene.add(d.sky);

  d.puffPool = new LocomotiveSmokePuffPool(d.scene);
  d.puffs = d.puffPool.puffs;

  const puffMeshes = d.puffs.map(puff => puff.mesh);
  d.shadowHiddenObjects = [d.sky, d.brakeSparks.mesh, ...d.world.noShadow, ...d.train.noShadow, ...puffMeshes];
  d.shadowVisibility = new Array(d.shadowHiddenObjects.length);

  d.nightGlows = collectNightLightGlows(d.scene);
}
