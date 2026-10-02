// Side effect only: palette colours authored elsewhere in this codebase are display-space,
// so hex/CSS colours must never be silently converted to linear on creation.
import * as THREE from 'three';

THREE.ColorManagement.enabled = false;
