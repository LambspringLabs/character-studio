'use client';
/* oxlint-disable nextjs/no-img-element -- These are original NFT images with variable source dimensions; this sample intentionally preserves their public URLs and supplies fixed layout dimensions. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  ArrowUpRight,
  Layers3,
  Shuffle,
  Download,
  LockKeyhole,
  LockKeyholeOpen,
  RotateCcw,
  Search,
  Check,
  ChevronLeft,
  ChevronRight,
  FileJson,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox';
import {
  NONE,
  tokenChoice,
  randomChoice,
  planLayers,
  exactMatch,
  recipe,
  type Collection,
  type Token,
  type Choice,
} from '@/lib/composer';
import { renderCharacter, downloadBlob } from '@/lib/render-character';
import { AppearanceControls } from './appearance-controls';

const tokenCache = new Map<string, Token[]>();
const count = (n: number) => n.toLocaleString('en-US');
const sameChoice = (a: Choice, b: Choice) =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.entries(a).every(([k, v]) => b[k] === v);

function Portrait({
  src,
  alt,
  className = 'portrait',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return failed === src ? (
    <div className="image-error">
      <AlertCircle />
      <span>Portrait unavailable</span>
    </div>
  ) : (
    <img
      width={1000}
      height={1250}
      src={src}
      alt={alt}
      className={className}
      loading={className === 'portrait' ? 'eager' : 'lazy'}
      onError={() => setFailed(src)}
    />
  );
}

function StudioCollection({
  collection,
  onScan,
}: {
  collection: Collection;
  onScan: () => void;
}) {
  const [tokens, setTokens] = useState<Token[]>(
    tokenCache.get(collection.id) ?? [],
  );
  const [fetchError, setFetchError] = useState('');
  const [reference, setReference] = useState<Token | null>(null);
  const [selected, setSelected] = useState<Choice>({});
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState('create');
  const [query, setQuery] = useState('');
  const [tokenQuery, setTokenQuery] = useState('');
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('');
  const [rendered, setRendered] = useState(false);
  const [renderError, setRenderError] = useState('');
  const [retry, setRetry] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);
  const isRecipe = !collection.composable;
  const load = useCallback(
    (token: Token) => {
      setReference(token);
      setSelected(tokenChoice(collection, token));
      setStatus('');
      setRendered(false);
    },
    [collection],
  );
  useEffect(() => {
    let cancelled = false;
    async function acquire() {
      try {
        let all = tokenCache.get(collection.id);
        if (!all) {
          const r = await fetch(collection.tokensFile);
          if (!r.ok) throw Error('The token archive could not be loaded.');
          all = (await r.json()) as Token[];
          tokenCache.set(collection.id, all);
        }
        if (cancelled) return;
        setTokens(all);
        setFetchError('');
        if (!initialized.current && all.length) {
          initialized.current = true;
          load(all[0]);
        }
      } catch (e) {
        if (!cancelled) setFetchError((e as Error).message);
      }
    }
    void acquire();
    return () => {
      cancelled = true;
    };
  }, [collection, retry, load]);
  useEffect(() => {
    let disposed = false;
    if (!collection.composable || !Object.keys(selected).length) return;
    const timer = setTimeout(() => {
      setRendered(false);
      setRenderError('');
      void renderCharacter(collection, selected)
        .then((result) => {
          if (disposed) return;
          const canvas = canvasRef.current;
          if (!canvas) return;
          canvas.width = result.width;
          canvas.height = result.height;
          canvas.getContext('2d')?.drawImage(result, 0, 0);
          setRendered(true);
        })
        .catch((e) => {
          if (!disposed) setRenderError((e as Error).message);
        });
    }, 70);
    return () => {
      clearTimeout(timer);
      disposed = true;
    };
  }, [selected, collection, retry]);
  const original = reference
    ? sameChoice(selected, tokenChoice(collection, reference))
    : false;
  const matching = useMemo(
    () =>
      isRecipe && reference
        ? tokens.find((t) => exactMatch(collection, t, selected))
        : undefined,
    [tokens, selected, isRecipe, reference, collection],
  );
  const plan = useMemo(
    () => (collection.composable ? planLayers(collection, selected) : null),
    [collection, selected],
  );
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return tokens;
    return tokens.filter(
      (t) =>
        t.id === q.replace(/^#/, '') ||
        t.name.toLowerCase().includes(q) ||
        t.attributes.some((a) => String(a.value).toLowerCase().includes(q)),
    );
  }, [tokens, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / 24));
  const shown = filtered.slice(
    Math.min(page, pages - 1) * 24,
    Math.min(page, pages - 1) * 24 + 24,
  );
  function change(name: string, value: string) {
    setRendered(false);
    setSelected((s) => ({ ...s, [name]: value }));
    setStatus('');
  }
  function exportRecipe() {
    downloadBlob(
      new Blob(
        [JSON.stringify(recipe(collection, selected, reference?.id), null, 2)],
        { type: 'application/json' },
      ),
      `${collection.id}-custom.json`,
    );
    setStatus('Recipe downloaded.');
  }
  function exportImage() {
    if (!rendered || !canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (blob) {
        downloadBlob(blob, `${collection.id}-custom.png`);
        setStatus('PNG downloaded · 1000 × 1250');
      } else setRenderError('PNG export failed. Try again.');
    }, 'image/png');
  }
  async function importRecipe(file?: File) {
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw Error('Recipe is too large.');
      const value = JSON.parse(await file.text());
      if (
        value.format !== 'character-studio-recipe' ||
        value.version !== 1 ||
        value.contract?.toLowerCase() !== collection.contract.toLowerCase()
      )
        throw Error(`Choose a ${collection.name} recipe.`);
      const traits = value.traits;
      if (!traits || typeof traits !== 'object' || Array.isArray(traits))
        throw Error('Invalid recipe traits.');
      if (
        Object.keys(traits).some(
          (k) => !collection.categories.some((c) => c.name === k),
        )
      )
        throw Error('Recipe contains an unknown trait category.');
      const next: Choice = {};
      for (const c of collection.categories) {
        const v = traits[c.name] ?? NONE;
        if (v !== NONE && !c.values.some((o) => o.value === v))
          throw Error(`Unknown ${c.name} value.`);
        next[c.name] = v;
      }
      setSelected(next);
      setRendered(false);
      setStatus('Recipe loaded.');
    } catch (e) {
      setStatus((e as Error).message);
    }
    if (fileRef.current) fileRef.current.value = '';
  }
  const portrait = matching ?? reference;
  return (
    <>
      <div className="workspace">
        <section className="canvas-column">
          <div className="section-line">
            <span className="eyebrow">
              {isRecipe ? 'COLLECTION REFERENCE' : 'CHARACTER PREVIEW'}
            </span>
            <button className="text-button small" onClick={onScan}>
              {count(collection.tokenCount)} / {count(collection.expected)}{' '}
              indexed <ArrowUpRight />
            </button>
          </div>
          <div
            className={`canvas-mat ${isRecipe && !matching ? 'recipe-mat' : ''}`}
          >
            <div
              className="portrait-wrap"
              style={{
                aspectRatio:
                  collection.id === 'nonon'
                    ? '1400 / 1778'
                    : collection.id === 'radbro'
                      ? '1 / 1'
                      : '4 / 5',
              }}
            >
              {!isRecipe && (
                <canvas
                  ref={canvasRef}
                  className="portrait"
                  aria-label={`Custom ${collection.name} character`}
                  style={{ visibility: rendered ? 'visible' : 'hidden' }}
                />
              )}
              {(isRecipe || !rendered) && (
                <Portrait
                  src={
                    portrait?.id === collection.referenceId
                      ? collection.reference
                      : (portrait?.image ?? collection.reference)
                  }
                  alt={portrait?.name ?? `${collection.name} reference`}
                />
              )}
              {!isRecipe && !rendered && reference && (
                <span className="render-state">
                  {renderError
                    ? 'Render unavailable'
                    : 'Rendering your choices…'}
                </span>
              )}
            </div>
            <span className="mat-label">
              {isRecipe
                ? matching
                  ? 'EXACT EXISTING COMBINATION'
                  : 'REFERENCE ONLY · NOT YOUR CUSTOM COMBINATION'
                : 'ORIGINAL REMILIA LAYERS · 1000 × 1250'}
            </span>
          </div>
          <div className="preview-caption">
            <h1>
              {original && reference
                ? reference.name
                : `Custom ${collection.id === 'milady' ? 'Milady' : collection.id === 'radbro' ? 'Radbro' : 'nonon'}`}
            </h1>
            <span
              className={`status-pill ${isRecipe && !matching ? 'amber' : ''}`}
            >
              {isRecipe
                ? matching
                  ? 'Existing character'
                  : 'Recipe only'
                : 'Layer composition'}
            </span>
          </div>
          <p className="subtle">
            {isRecipe
              ? matching
                ? `This combination exists as ${matching.name}.`
                : `Showing ${reference?.name ?? 'a collection portrait'} for reference. New combinations need the original artwork layers.`
              : 'Change a trait to redraw your character. Lock favorites before shuffling.'}
          </p>
          <div className="action-row">
            <Button
              variant="outline"
              onClick={() => {
                setRendered(false);
                setSelected(randomChoice(collection, selected, locked));
                setStatus('');
              }}
              disabled={!reference}
            >
              <Shuffle />
              Shuffle
            </Button>
            {collection.composable && (
              <Button onClick={exportImage} disabled={!rendered}>
                <Download />
                Save PNG
              </Button>
            )}
            <Button
              variant={isRecipe ? 'default' : 'outline'}
              onClick={exportRecipe}
              disabled={!reference}
            >
              <FileJson />
              Save recipe
            </Button>
          </div>
          {renderError && (
            <div className="notice error" role="alert">
              {renderError}
              <button onClick={() => setRetry((v) => v + 1)}>Retry</button>
            </div>
          )}
          <p className="action-status" aria-live="polite">
            {status}
          </p>
          <div className="reference-controls">
            <span className="eyebrow">START FROM A CHARACTER</span>
            <div className="token-loader">
              <Combobox
                items={tokens
                  .filter((t) => t.id.includes(tokenQuery.replace(/^#/, '')))
                  .slice(0, 80)
                  .map((t) => t.id)}
                value={reference?.id ?? null}
                onInputValueChange={(v) => setTokenQuery(v)}
                onValueChange={(id) => {
                  const t = tokens.find((t) => t.id === id);
                  if (t) load(t);
                }}
              >
                <ComboboxInput
                  aria-label="Load token ID"
                  placeholder="Type any token ID"
                />
                <ComboboxContent>
                  <ComboboxEmpty>No token found.</ComboboxEmpty>
                  <ComboboxList>
                    {(id) => (
                      <ComboboxItem key={id} value={id}>
                        #{id}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              <Button
                variant="outline"
                disabled={!tokens.length}
                onClick={() =>
                  load(tokens[Math.floor(Math.random() * tokens.length)])
                }
              >
                <Shuffle />
                Random token
              </Button>
            </div>
          </div>
          {reference && (
            <details className="token-metadata">
              <summary>
                Original token metadata <span>#{reference.id}</span>
              </summary>
              <dl>
                {reference.attributes.map((a, i) => (
                  <div key={`${a.trait_type}-${i}`}>
                    <dt>{a.trait_type}</dt>
                    <dd>{String(a.value)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
          {reference?.sourceWarning && (
            <p className="notice">{reference.sourceWarning}</p>
          )}
        </section>
        <section className="trait-column">
          <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
            <TabsList className="mode-tabs">
              <TabsTrigger value="create">
                <Layers3 />
                Create
              </TabsTrigger>
              <TabsTrigger value="archive">
                <Search />
                Browse {count(collection.tokenCount)}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="create">
              <div className="section-line">
                <h2>{isRecipe ? 'Custom recipe' : 'Choose your traits'}</h2>
                <span className="small">
                  {collection.categories.length} categories
                </span>
              </div>
              <p className="panel-intro">
                {isRecipe
                  ? 'Combine any indexed values within this collection. Image composition is pending original source layers.'
                  : 'Original parts, freely recombined. Type in a field to find a trait.'}
              </p>
              {fetchError && (
                <div className="notice error" role="alert">
                  {fetchError}
                  <button onClick={() => setRetry((v) => v + 1)}>Retry</button>
                </div>
              )}
              <div className="trait-fields">
                {collection.categories.map((category) => {
                  const hidden = plan?.hidden.includes(category.name);
                  const values = [NONE, ...category.values.map((v) => v.value)];
                  return (
                    <div
                      className={`trait-field ${hidden ? 'hidden-trait' : ''}`}
                      key={category.name}
                    >
                      <div className="field-label">
                        <label
                          htmlFor={`trait-${encodeURIComponent(category.name)}`}
                        >
                          {category.name}
                          <span className="value-count">
                            {category.values.length}
                          </span>
                        </label>
                        <button
                          className="lock-button"
                          aria-label={`${locked.has(category.name) ? 'Unlock' : 'Lock'} ${category.name}`}
                          aria-pressed={locked.has(category.name)}
                          onClick={() =>
                            setLocked((current) => {
                              const next = new Set(current);
                              if (next.has(category.name))
                                next.delete(category.name);
                              else next.add(category.name);
                              return next;
                            })
                          }
                        >
                          {locked.has(category.name) ? (
                            <LockKeyhole />
                          ) : (
                            <LockKeyholeOpen />
                          )}
                        </button>
                      </div>
                      <Combobox
                        items={values}
                        value={selected[category.name] ?? NONE}
                        onValueChange={(v) => {
                          if (v) change(category.name, v);
                        }}
                      >
                        <ComboboxInput
                          id={`trait-${encodeURIComponent(category.name)}`}
                          aria-label={category.name}
                        />
                        <ComboboxContent>
                          <ComboboxEmpty>No trait found.</ComboboxEmpty>
                          <ComboboxList>
                            {(v) => (
                              <ComboboxItem key={v} value={v}>
                                {v}
                              </ComboboxItem>
                            )}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                      {hidden && (
                        <span className="field-hint">
                          Covered by the selected{' '}
                          {category.name === 'Brows' ? 'eyes' : 'hat'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="panel-tools">
                <Button
                  variant="ghost"
                  disabled={!reference}
                  onClick={() => reference && load(reference)}
                >
                  <RotateCcw />
                  Reset to token
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => fileRef.current?.click()}
                >
                  Load recipe
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={(e) => void importRecipe(e.target.files?.[0])}
                />
              </div>
              <div className="notice">
                <strong>
                  {isRecipe ? 'Source layers missing' : 'Source artwork'}
                </strong>
                <p>{collection.note}</p>
              </div>
            </TabsContent>
            <TabsContent value="archive">
              <div className="archive-search">
                <Search />
                <input
                  aria-label="Search collection"
                  placeholder="Token number or trait…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                />
              </div>
              <p className="small archive-count">
                {count(filtered.length)} characters · click one to load its
                traits
              </p>
              <div className="token-grid">
                {shown.map((token) => (
                  <button
                    className="token-card"
                    key={token.id}
                    onClick={() => {
                      load(token);
                      setTab('create');
                    }}
                  >
                    <Portrait
                      src={
                        token.id === collection.referenceId
                          ? collection.reference
                          : token.image
                      }
                      alt={token.name}
                      className="token-thumbnail"
                    />
                    <span>
                      #{token.id}
                      {token.id === reference?.id && <Check />}
                    </span>
                  </button>
                ))}
              </div>
              {!shown.length && (
                <p className="notice">
                  {tokens.length
                    ? 'No characters match this search.'
                    : 'Loading the collection archive…'}
                </p>
              )}
              <div className="page-controls">
                <Button
                  variant="outline"
                  aria-label="Previous page"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft />
                </Button>
                <span>
                  Page {Math.min(page + 1, pages)} / {pages}
                </span>
                <Button
                  variant="outline"
                  aria-label="Next page"
                  disabled={page >= pages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight />
                </Button>
              </div>
            </TabsContent>
          </Tabs>
          <div className="source-row">
            <a
              className="source-link"
              href={collection.website}
              target="_blank"
              rel="noreferrer"
            >
              Official collection
              <ArrowUpRight />
            </a>
            <button className="text-button" onClick={onScan}>
              View scan report
              <ArrowUpRight />
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

export default function Studio() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [active, setActive] = useState('milady');
  const [error, setError] = useState('');
  const [report, setReport] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch('/catalog.json')
      .then((r) => {
        if (!r.ok) throw Error('The collection index could not be loaded.');
        return r.json() as Promise<Collection[]>;
      })
      .then((c) => {
        if (!cancelled) {
          setCollections(c);
          setError('');
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [retry]);
  const collection = collections.find((c) => c.id === active);
  return (
    <main className="studio-shell">
      <header className="masthead">
        <button
          className="wordmark"
          onClick={() => {
            setReport(false);
            setActive('milady');
          }}
        >
          <Sparkles aria-hidden="true" />
          <span>
            character<span className="wordmark-second">studio</span>
          </span>
        </button>
        <div className="masthead-note">COLLECTIONS / CUSTOM CHARACTERS</div>
        <AppearanceControls />
        <button className="sample-tag" onClick={() => setReport(!report)}>
          {report ? 'BACK TO STUDIO' : 'SCAN REPORT'}
        </button>
      </header>
      <div className="collection-strip" aria-label="Collections">
        {collections.map((c, i) => (
          <button
            key={c.id}
            onClick={() => {
              setActive(c.id);
              setReport(false);
            }}
            className={`collection-choice ${active === c.id ? 'chosen' : ''}`}
            aria-pressed={active === c.id}
          >
            <span className="collection-number">0{i + 1}</span>
            <span>{c.name}</span>
            <span className="collection-dot" style={{ background: c.color }} />
          </button>
        ))}
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
          <button onClick={() => setRetry((v) => v + 1)}>Retry</button>
        </div>
      )}
      {!collection && !error && (
        <output className="loading-index">Loading the collection index…</output>
      )}
      {collection && !report && (
        <StudioCollection
          key={collection.id}
          collection={collection}
          onScan={() => setReport(true)}
        />
      )}
      {report && (
        <section className="scan-report">
          <div className="section-line">
            <div>
              <span className="eyebrow">SOURCE AUDIT / 08 SEP 2026</span>
              <h1>What’s in the archive</h1>
            </div>
            <Button variant="outline" onClick={() => setReport(false)}>
              Back to studio
            </Button>
          </div>
          <p className="report-intro">
            Token metadata, finished artwork, reusable layers, and 3D models are
            separate assets. Complete metadata does not mean complete character
            source files.
          </p>
          <div className="report-table-wrap">
            <Table className="report-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Collection</TableHead>
                  <TableHead>Metadata records</TableHead>
                  <TableHead>Archived portraits</TableHead>
                  <TableHead>Trait values</TableHead>
                  <TableHead>Layer files</TableHead>
                  <TableHead>Custom image</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((c) => (
                  <TableRow key={c.id}>
                    <TableHead>{c.name}</TableHead>
                    <TableCell>
                      {count(c.tokenCount)} / {count(c.expected)}
                    </TableCell>
                    <TableCell>
                      {count(c.imageCount)} / {count(c.expected)}
                    </TableCell>
                    <TableCell>
                      {count(c.traitCount)}
                      <small>
                        {c.categoryCount}{' '}
                        {c.id === 'milady' ? 'visual' : 'metadata'} categories
                      </small>
                    </TableCell>
                    <TableCell>
                      {c.layers.length
                        ? `${c.layers.length} / ${c.layers.length} listed`
                        : 'Not recovered'}
                    </TableCell>
                    <TableCell>
                      {c.composable ? 'Available' : 'Needs source layers'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="notice">
            Milady’s 331 generator files include 13 helpers and 318 selectable
            options. Generator extras are distinct from the traits found in the
            minted tokens. No complete per-token 3D model set was located for
            these collections; community avatars are not a substitute.
          </p>
          <div className="report-sources">
            {collections.map((c) => (
              <article key={c.id}>
                <h2>{c.name}</h2>
                <p>{c.note}</p>
                <p>{c.imageRepresentation}</p>
                <p>{c.modelNote}</p>
                <code>{c.contract}</code>
                <a href={c.tokensFile} download>
                  {count(c.tokenCount)} token metadata records ↓
                </a>
                <a href={`/data/${c.id}-audit.json`} download>
                  Download source audit ↓
                </a>
                {c.sourceLinks.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                    {s.name}
                    <ArrowUpRight />
                  </a>
                ))}
              </article>
            ))}
          </div>
          <p className="small">
            All selections stay within the selected collection. Recipes do not
            mint NFTs or modify any collection. Milady assets: Viral Public
            License. Other collection artwork remains credited to its creators.
          </p>
          <a className="source-link" href="/data/archive-summary.json" download>
            Download the complete archive summary ↓
          </a>
        </section>
      )}
      <footer>
        <span>Character Studio / collection sample</span>
        <span>Artwork: Remilia · Radbro · mini labo</span>
      </footer>
    </main>
  );
}
