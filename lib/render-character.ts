import { planLayers, type Collection, type Choice } from './composer';

const images = new Map<string, Promise<HTMLImageElement>>();
function image(path: string) {
  const cached = images.get(path);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => {
      images.delete(path);
      reject(Error('A source layer could not be loaded. Try again.'));
    };
    img.src = path;
  });
  images.set(path, promise);
  if (images.size > 24) images.delete(images.keys().next().value!);
  return promise;
}
function fitted(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const scale = Math.min(
    ctx.canvas.width / img.width,
    ctx.canvas.height / img.height,
  );
  ctx.drawImage(img, 0, 0, img.width * scale, img.height * scale);
}
function hsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const hi = Math.max(r, g, b),
    lo = Math.min(r, g, b),
    delta = hi - lo,
    light = (hi + lo) / 2;
  const hue = !delta
    ? 0
    : hi === r
      ? ((g - b) / delta + 6) % 6
      : hi === g
        ? (b - r) / delta + 2
        : (r - g) / delta + 4;
  return [hue * 60, delta ? delta / (1 - Math.abs(2 * light - 1)) : 0, light];
}
function rgb(h: number, s: number, l: number) {
  const chroma = (1 - Math.abs(2 * l - 1)) * s,
    second = chroma * (1 - Math.abs(((h / 60) % 2) - 1)),
    offset = l - chroma / 2;
  const parts =
    h < 60
      ? [chroma, second, 0]
      : h < 120
        ? [second, chroma, 0]
        : h < 180
          ? [0, chroma, second]
          : h < 240
            ? [0, second, chroma]
            : h < 300
              ? [second, 0, chroma]
              : [chroma, 0, second];
  return parts.map((v) => (v + offset) * 255);
}

/** Render offscreen and publish atomically; rapid trait changes never export stale art. */
export async function renderCharacter(
  collection: Collection,
  selected: Choice,
): Promise<HTMLCanvasElement> {
  const plan = planLayers(collection, selected);
  if (plan.missing.length)
    throw Error(`Source layers missing: ${plan.missing.join(', ')}`);
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 1250;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw Error('Canvas rendering is unavailable.');
  const assets = await Promise.all(
    plan.instructions.map(async (instruction) => ({
      ...instruction,
      img: await image(instruction.layer.path),
      maskImage: instruction.mask
        ? await image(instruction.mask.path)
        : undefined,
      colorImage: instruction.color
        ? await image(instruction.color.path)
        : undefined,
    })),
  );
  for (const item of assets) {
    ctx.globalCompositeOperation = item.layer.blendMode ?? 'source-over';
    fitted(ctx, item.img);
    ctx.globalCompositeOperation = 'source-over';
    if (item.maskImage && item.colorImage) {
      const scratch = document.createElement('canvas');
      scratch.width = 1000;
      scratch.height = 1250;
      const colorCtx = scratch.getContext('2d', { willReadFrequently: true })!;
      colorCtx.drawImage(item.colorImage, 0, 0);
      const color = colorCtx.getImageData(0, 0, 1, 1).data;
      const [h, s] = hsl(color[0], color[1], color[2]);
      colorCtx.clearRect(0, 0, 1000, 1250);
      fitted(colorCtx, item.maskImage);
      const mask = colorCtx.getImageData(0, 0, 1000, 1250),
        under = ctx.getImageData(0, 0, 1000, 1250).data;
      const darken: Record<string, number> = {
        Brown: 0.47,
        Leaf: 0.28,
        Blue: 0.8,
        Gold: 0.7,
      };
      for (let i = 0; i < mask.data.length; i += 4) {
        const d = mask.data;
        if (d[i] + d[i + 1] + d[i + 2] + d[i + 3] === 255) {
          d[i + 3] = 0;
          continue;
        }
        if (d[i + 3] === 0) continue;
        let l =
          (Math.max(under[i], under[i + 1], under[i + 2]) +
            Math.min(under[i], under[i + 1], under[i + 2])) /
          510;
        if (darken[selected['Eye Color']])
          l = l < 0.05 ? 0.05 : l * darken[selected['Eye Color']];
        const next = rgb(h, s, l);
        d[i] = next[0];
        d[i + 1] = next[1];
        d[i + 2] = next[2];
      }
      colorCtx.putImageData(mask, 0, 0);
      ctx.drawImage(scratch, 0, 0);
    }
  }
  return canvas;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
