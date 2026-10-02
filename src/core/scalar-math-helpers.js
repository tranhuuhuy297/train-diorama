// Small numeric helpers reused across world/train/life code; each form is bitwise-equal
// to the inline expression it stands in for. Substitution limits: docs/code-standards.md.
export function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

// Only replaces a rate expression that is a single operand or parenthesised; never a
// three-factor exponent, and never the cloud-return exponential (that one is rate-first).
export function exponentialResponse(dt, rate) {
  return 1 - Math.exp(-dt * rate);
}
