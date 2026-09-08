export const palettes = [
  { value: 'sage', label: 'Sage' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'lilac', label: 'Lilac' },
  { value: 'rose', label: 'Rose' },
] as const;
export const modes = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;
export type Appearance = {
  palette: (typeof palettes)[number]['value'];
  mode: (typeof modes)[number]['value'];
};
export const appearanceKey = 'character-studio.appearance.v1';
export const defaultAppearance: Appearance = {
  palette: 'sage',
  mode: 'system',
};

let sessionPreference: string | null = null;
const appearanceEvent = 'character-studio:appearance';
export function getAppearanceSnapshot() {
  if (sessionPreference !== null) return sessionPreference;
  try {
    return localStorage.getItem(appearanceKey);
  } catch {
    return null;
  }
}
export function getServerAppearanceSnapshot() {
  return null;
}
export function subscribeAppearance(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === appearanceKey || event.key === null) {
      sessionPreference = null;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(appearanceEvent, listener);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(appearanceEvent, listener);
  };
}
export function saveAppearance(appearance: Appearance) {
  sessionPreference = JSON.stringify(appearance);
  try {
    localStorage.setItem(appearanceKey, sessionPreference);
  } catch {
    /* Keep the selection for this visit when storage is unavailable. */
  }
  window.dispatchEvent(new Event(appearanceEvent));
}

export function readAppearance(value: string | null): Appearance {
  try {
    const stored = JSON.parse(value ?? 'null');
    return {
      palette: palettes.some((p) => p.value === stored?.palette)
        ? stored.palette
        : defaultAppearance.palette,
      mode: modes.some((m) => m.value === stored?.mode)
        ? stored.mode
        : defaultAppearance.mode,
    };
  } catch {
    return defaultAppearance;
  }
}

export function applyAppearance(appearance: Appearance, systemDark: boolean) {
  const dark =
    appearance.mode === 'dark' || (appearance.mode === 'system' && systemDark);
  document.documentElement.dataset.theme = appearance.palette;
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

// Runs before the page is painted; storage may be blocked by browser settings.
export const appearanceInitScript = `(()=>{
  let saved={};
  try{saved=JSON.parse(localStorage.getItem(${JSON.stringify(appearanceKey)})||'{}')||{}}catch{}
  const palette=${JSON.stringify(palettes.map((p) => p.value))}.includes(saved.palette)?saved.palette:'sage';
  const mode=${JSON.stringify(modes.map((m) => m.value))}.includes(saved.mode)?saved.mode:'system';
  const dark=mode==='dark'||(mode==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme=palette;
  document.documentElement.classList.toggle('dark',dark);
  document.documentElement.style.colorScheme=dark?'dark':'light';
})();`;
