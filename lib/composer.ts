export type Attributes = { trait_type: string; value: string | number }[];
export type Token = {
  id: string;
  name: string;
  image: string;
  attributes: Attributes;
  selection?: Choice;
  sourceWarning?: string;
};
export type Choice = Record<string, string>;
export type Layer = {
  category: string;
  value: string;
  path: string;
  url: string;
  order: number;
  optional: boolean;
  helper: boolean;
  blendMode: GlobalCompositeOperation;
  width: number;
  height: number;
};
export type Category = {
  name: string;
  optional: boolean;
  values: { value: string; count: number }[];
};
export type Collection = {
  id: string;
  name: string;
  short: string;
  color: string;
  expected: number;
  website: string;
  contract: string;
  tokenCount: number;
  imageCount: number;
  imageRepresentation: string;
  modelNote: string;
  traitCount: number;
  categoryCount: number;
  categories: Category[];
  tokensFile: string;
  reference: string;
  referenceId: string;
  layers: Layer[];
  composable: boolean;
  note: string;
  sourceLinks: { name: string; url: string }[];
  scanDate: string;
  maker: {
    TRAIT_NAME_MAPPING?: Record<string, string>;
    TRAIT_VALUE_MAPPING?: Record<string, Record<string, string>>;
    EXCLUSIONS?: Record<string, Record<string, string[]>>;
    COLORABLE_LAYER_MASKS?: Record<
      string,
      { MaskDir: string; MaskableValues: string[] }
    >;
    Z_OVERRIDES?: Record<string, Record<string, number>>;
  };
};
export const NONE = '— None —';

export function tokenChoice(collection: Collection, token: Token): Choice {
  const result: Choice = Object.fromEntries(
    collection.categories.map((c) => [c.name, NONE]),
  );
  if (token.selection) {
    for (const [category, value] of Object.entries(token.selection)) {
      if (
        collection.categories.some(
          (c) => c.name === category && c.values.some((v) => v.value === value),
        )
      )
        result[category] = value;
    }
    return result;
  }
  for (const attr of token.attributes) {
    const category =
      collection.maker.TRAIT_NAME_MAPPING?.[attr.trait_type] ?? attr.trait_type;
    const value =
      collection.maker.TRAIT_VALUE_MAPPING?.[attr.trait_type]?.[
        String(attr.value)
      ] ?? String(attr.value);
    const group = collection.categories.find((c) => c.name === category);
    const match = group?.values.find(
      (v) => v.value.toLowerCase() === value.toLowerCase(),
    );
    if (match) result[category] = match.value;
  }
  return result;
}

export function randomChoice(
  collection: Collection,
  current: Choice,
  locked: Set<string>,
): Choice {
  return Object.fromEntries(
    collection.categories.map((c) => {
      if (locked.has(c.name)) return [c.name, current[c.name] ?? NONE];
      const values = c.values.map((v) => v.value);
      // Optional layers should have a realistic chance to be absent, not pile up.
      const value =
        c.optional && Math.random() < 0.45
          ? NONE
          : values[Math.floor(Math.random() * values.length)];
      return [c.name, value ?? NONE];
    }),
  );
}

export function planLayers(collection: Collection, selected: Choice) {
  const hidden = new Set<string>();
  for (const [cat, rules] of Object.entries(collection.maker.EXCLUSIONS ?? {}))
    for (const value of rules[selected[cat]] ?? []) hidden.add(value);
  const instructions: { layer: Layer; mask?: Layer; color?: Layer }[] = [];
  const missing: string[] = [];
  for (const [category, value] of Object.entries(selected)) {
    if (value === NONE || category === 'Eye Color' || hidden.has(category))
      continue;
    const realCategory =
      category === 'Skin' && selected.Shirt && selected.Shirt !== NONE
        ? 'UnclothedBase'
        : category;
    const layer = collection.layers.find(
      (l) => l.category === realCategory && l.value === value,
    );
    if (!layer) {
      missing.push(`${category}: ${value}`);
      continue;
    }
    const normalized = {
      ...layer,
      order:
        category === 'Skin'
          ? 1
          : (collection.maker.Z_OVERRIDES?.[category]?.[value] ?? layer.order),
    };
    const maskConfig = collection.maker.COLORABLE_LAYER_MASKS?.[category];
    const color = collection.layers.find(
      (l) => l.category === 'Eye Color' && l.value === selected['Eye Color'],
    );
    const mask =
      maskConfig?.MaskableValues.includes(value) && color
        ? collection.layers.find(
            (l) => l.category === maskConfig.MaskDir && l.value === value,
          )
        : undefined;
    instructions.push({ layer: normalized, mask, color });
  }
  instructions.sort((a, b) => a.layer.order - b.layer.order);
  return { instructions, hidden: [...hidden], missing };
}

export function exactMatch(
  collection: Collection,
  token: Token,
  selected: Choice,
): boolean {
  const values = tokenChoice(collection, token);
  return collection.categories.every(
    (c) => (values[c.name] ?? NONE) === (selected[c.name] ?? NONE),
  );
}

export function recipe(
  collection: Collection,
  selected: Choice,
  tokenId?: string,
) {
  return {
    format: 'character-studio-recipe',
    version: 1,
    collection: collection.name,
    contract: collection.contract,
    referenceTokenId: tokenId ?? null,
    kind: collection.composable
      ? 'custom-layer-composition'
      : 'custom-trait-recipe',
    renderable: collection.composable,
    traits: selected,
    source: collection.website,
    notice: collection.note,
  };
}
