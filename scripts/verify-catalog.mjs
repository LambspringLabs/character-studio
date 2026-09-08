import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { test } from 'node:test';
import {
  NONE,
  tokenChoice,
  planLayers,
  randomChoice,
  exactMatch,
  recipe,
} from '../lib/composer.ts';

const read = async (p) =>
  JSON.parse(await readFile(new URL(p, import.meta.url), 'utf8'));
const catalog = await read('../public/catalog.json');
const collections = await Promise.all(
  catalog.map(async (c) => ({
    c,
    tokens: await read(`../public${c.tokensFile}`),
  })),
);

test('every requested token ID is represented once, including collection boundaries', () => {
  for (const { c, tokens } of collections) {
    assert.equal(tokens.length, c.expected, c.id);
    const ids = new Set(tokens.map((t) => t.id));
    assert.equal(ids.size, c.expected);
    for (
      let n = c.id === 'milady' ? 0 : 1;
      n < (c.id === 'milady' ? 10000 : 5001);
      n++
    )
      assert.ok(ids.has(String(n)), `${c.id} missing ${n}`);
  }
});

test('every published source layer exists and is a decodable WebP container', async () => {
  for (const c of catalog)
    for (const layer of c.layers) {
      const path = new URL(`../public${layer.path}`, import.meta.url),
        bytes = await readFile(path);
      assert.equal(bytes.subarray(0, 4).toString(), 'RIFF', layer.path);
      assert.equal(bytes.subarray(8, 12).toString(), 'WEBP', layer.path);
      assert.ok((await stat(path)).size > 30);
    }
});

test('all 10000 Milady selections resolve to real images with eyes, mouth, and brows', () => {
  const { c, tokens } = collections.find((v) => v.c.id === 'milady');
  for (const t of tokens) {
    const selected = tokenChoice(c, t),
      plan = planLayers(c, selected);
    assert.equal(plan.missing.length, 0, `${t.id}: ${plan.missing.join(', ')}`);
    assert.ok(selected.Mouth !== NONE, `Mouth missing ${t.id}`);
    assert.ok(selected.Brows !== NONE, `Brows missing ${t.id}`);
    assert.ok(plan.instructions.every((v) => v.layer.category !== 'Eye Color'));
  }
});

test('token1000 uses the correct maker identity rather than the faulty original endpoint', () => {
  const { c, tokens } = collections.find((v) => v.c.id === 'milady'),
    t = tokens.find((t) => t.id === '1000');
  const selected = tokenChoice(c, t);
  assert.equal(t.name, 'Milady 1000');
  assert.equal(selected.Background, 'Sonora');
  assert.equal(selected.Hat, NONE);
  assert.equal(selected.Shirt, 'Blue Pink Shirt');
  assert.ok(t.sourceWarning.includes('#1001'));
});

test('artist rules cover hair, change the base under clothes, and put the banana under glasses', () => {
  const { c, tokens } = collections.find((v) => v.c.id === 'milady');
  const selected = {
    ...tokenChoice(c, tokens[0]),
    Hat: 'Strawberry Hat',
    Eyes: 'Chinese',
    Overlay: 'Banana Sticker',
  };
  const plan = planLayers(c, selected);
  assert.deepEqual(plan.hidden.sort(), ['Brows', 'Earrings', 'Hair']);
  assert.ok(
    plan.instructions.some(
      (i) => i.layer.category === 'UnclothedBase' && i.layer.order === 1,
    ),
  );
  assert.equal(
    plan.instructions.find((i) => i.layer.category === 'Overlay').layer.order,
    9,
  );
  assert.ok(
    !plan.instructions.some((i) =>
      ['Brows', 'Earrings', 'Hair'].includes(i.layer.category),
    ),
  );
});

test('shuffle respects locks and collection boundaries; recipes never promise unavailable renders', () => {
  for (const { c, tokens } of collections) {
    const initial = tokenChoice(c, tokens[0]),
      locked = new Set([c.categories[0].name]);
    for (let i = 0; i < 30; i++) {
      const result = randomChoice(c, initial, locked);
      assert.equal(result[c.categories[0].name], initial[c.categories[0].name]);
      for (const category of c.categories)
        assert.ok(
          result[category.name] === NONE ||
            category.values.some((v) => v.value === result[category.name]),
        );
    }
    assert.equal(recipe(c, initial).renderable, c.id === 'milady');
    assert.equal(exactMatch(c, tokens[0], initial), true);
  }
});

test('all Radbro and nonon metadata values remain selectable without dropping rare traits', () => {
  for (const { c, tokens } of collections.filter((v) => v.c.id !== 'milady'))
    for (const token of tokens) {
      const selection = tokenChoice(c, token);
      for (const attr of token.attributes)
        assert.equal(
          selection[attr.trait_type],
          String(attr.value),
          `${c.id}#${token.id} ${attr.trait_type}`,
        );
    }
});
