'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Monitor, Moon, Palette, Sun } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  applyAppearance,
  getAppearanceSnapshot,
  getServerAppearanceSnapshot,
  saveAppearance,
  subscribeAppearance,
  modes,
  palettes,
  readAppearance,
  type Appearance,
} from '@/lib/appearance';

export function AppearanceControls() {
  const snapshot = useSyncExternalStore(
    subscribeAppearance,
    getAppearanceSnapshot,
    getServerAppearanceSnapshot,
  );
  const appearance = useMemo(() => readAppearance(snapshot), [snapshot]);
  useEffect(() => {
    const preference = matchMedia('(prefers-color-scheme: dark)');
    applyAppearance(appearance, preference.matches);
    const onSystemChange = () => {
      applyAppearance(appearance, preference.matches);
    };
    preference.addEventListener('change', onSystemChange);
    return () => {
      preference.removeEventListener('change', onSystemChange);
    };
  }, [appearance]);

  function update(next: Appearance) {
    saveAppearance(next);
    applyAppearance(next, matchMedia('(prefers-color-scheme: dark)').matches);
  }
  const ModeIcon =
    appearance.mode === 'system'
      ? Monitor
      : appearance.mode === 'dark'
        ? Moon
        : Sun;

  return (
    <fieldset className="appearance-controls" aria-label="Appearance">
      <div className="appearance-field">
        <label id="palette-label" htmlFor="studio-palette">
          Theme
        </label>
        <Select
          value={appearance.palette}
          items={palettes}
          onValueChange={(value) => {
            if (palettes.some((p) => p.value === value))
              update({
                ...appearance,
                palette: value as Appearance['palette'],
              });
          }}
        >
          <SelectTrigger
            id="studio-palette"
            aria-labelledby="palette-label"
            className="appearance-trigger"
          >
            <Palette aria-hidden="true" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            align="end"
            alignItemWithTrigger={false}
            className="appearance-menu"
          >
            {palettes.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                <span
                  aria-hidden="true"
                  className={`theme-swatch swatch-${p.value}`}
                />
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="appearance-field">
        <label id="mode-label" htmlFor="studio-mode">
          Mode
        </label>
        <Select
          value={appearance.mode}
          items={modes}
          onValueChange={(value) => {
            if (modes.some((m) => m.value === value))
              update({ ...appearance, mode: value as Appearance['mode'] });
          }}
        >
          <SelectTrigger
            id="studio-mode"
            aria-labelledby="mode-label"
            className="appearance-trigger"
          >
            <ModeIcon aria-hidden="true" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            align="end"
            alignItemWithTrigger={false}
            className="appearance-menu"
          >
            {modes.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </fieldset>
  );
}
