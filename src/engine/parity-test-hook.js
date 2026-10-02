// Opt-in browser test hook: ?parity exposes the live Diorama; ?parity=freeze also pauses it. Dormant otherwise.

const STATION_SIGN_FONTS = ['bold 106px Fredoka', '24px Fredoka'];

function fredokaReadyNow() {
  const fontSet = globalThis.document?.fonts;
  if (!fontSet) return null;
  return STATION_SIGN_FONTS.every(font => fontSet.check(font));
}

export function installParityTestHook(diorama, search = globalThis.location?.search ?? '') {
  const query = new URLSearchParams(search);
  if (!query.has('parity')) return 'off';
  const hookMode = query.get('parity') === 'freeze' ? 'freeze' : 'live';
  // Fonts cannot finish loading inside the synchronous build, so this is the state the station sign saw.
  globalThis.__parityBuildInfo = { fredokaReadyAtBuild: fredokaReadyNow() };
  globalThis.__diorama = diorama;
  if (hookMode === 'freeze') diorama.paused = true;
  console.log(`[PARITY] Hook installed: ${hookMode}`);
  return hookMode;
}
