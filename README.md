# Character Studio

A collection archive and character customizer for Milady Maker, Radbro Webring V2,
and nonon, with selectable traits and appearance themes.

## What works

- Sage, Ocean, Lilac, and Rose themes, each with Light, Dark, and System modes.
  Appearance is saved per browser, synchronized between tabs, and applied before
  first paint. System mode follows device changes. Themes leave artwork untouched.
- All 20,000 token IDs indexed and searchable, with complete metadata and available character images.
- Image archive: 19,979 genuine portraits. Radbro has 4,974 verified full-size images,
  five thumbnail-only fallbacks, and 21 unavailable portraits, labeled per token.
  The audit detected 96 generic CDN replacements, repaired 72, and excluded the rest.
- Milady: all 261 original visual trait values resolve to official Remilia layers.
  The generator's 57 extra options are included, for 318 selectable options.
  All 331 source files (including 13 helpers) were acquired separately.
- Milady composition honors eye masks, hue/saturation/lightness, color darkening,
  layer order, artist exclusions, blend modes, and base-under-shirt substitution.
- Save PNG (1000 × 1250), shuffle with locks, reset to any token, save/load recipes.
- Radbro V2: all 692 values in 23 categories; nonon: all 1,516 values in 12.
  Their custom selections are **recipes**, not rendered composites. Exact existing
  combinations display the corresponding token; otherwise the portrait is labeled
  reference-only. No flattened crop or AI reconstruction is passed off as a layer.

## Known source limits

Original Radbro V2 and nonon artwork layers were not found in the official public
sites, source bundles, repositories, storage listings, or metadata inspected.
nonon has hand-painted compatibility subtraits, so transparent layers alone may
not be sufficient without its render rules. Source access remains necessary to
complete arbitrary authentic composition for these two collections.

No verified canonical per-token 3D model set was found. Public community avatars
were archived for study and recorded separately. Some VRMs contain author-only /
redistribution-prohibited metadata despite a repository-level VPL license; those
files are not republished by this sample.

Milady's original metadata URL for token #1000 incorrectly serves #1001. The
sample uses the correctly identified official maker record, which matches the
current original #1000 image. The conflicting raw response is retained locally.
Minted footer badges/grade bars are not generator layers and are not reproduced.
Milady assets are published by the official collection under Viral Public License;
attribution and source links are included in the scan report.

## Reproduce

The untouched source archive is `../../research/nft-archive/`, outside this Site's
Git repository. Each collection contains its acquisition scripts, source receipts,
token/trait indices, original images, and coverage findings. The sample creates
lossless WebP derivatives of the downloaded layers; original files remain intact.

```powershell
Copy-Item .openai/hosting.example.json .openai/hosting.json
npm ci
python scripts/prepare-catalog.py
node --test scripts/verify-catalog.mjs
npx tsc --noEmit
npx oxlint app lib scripts/verify-catalog.mjs
npm run dev
npm run build
```

Data export can be regenerated only where the local archive exists; all generated
web data and web layers are checked into this Site so deployment does not need it.
Skip `prepare-catalog.py` when using the checked-in catalog and layers. Hosting
configuration is local and excluded from source control.

## Validation

Catalog checks verify exact ID ranges and uniqueness, all 10,000 Milady render
plans, every Radbro/nonon attribute value, the #1000 correction, all published
layer files, masking-related draw rules, lock behavior, and honest recipe flags.
Independent source-image reconstruction of Milady #0 and #1000 closely matches
their original artwork (mean RGB error over the top 80% below 0.35/255). This
confirms source alignment; it is not a claim of identical minted footer graphics.

TypeScript, scoped application lint, and production build pass. The scaffold's
full lint command reports existing issues in unmodified bundled UI components;
those vendored files are retained as supplied. Browser interaction and physical
device testing were not performed in this pass.
