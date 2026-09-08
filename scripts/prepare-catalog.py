"""Build the sample from the independently acquired, provenance-backed archive.

Original downloads remain untouched in research/nft-archive. Web layers are
resized lossless derivatives; no traits are invented or AI generated.
"""
import json
import shutil
from pathlib import Path
from collections import Counter, defaultdict
from PIL import Image

SITE = Path(__file__).resolve().parents[1]
ARCHIVE = SITE.parents[1] / 'research' / 'nft-archive'
PUBLIC = SITE / 'public'

def read(path, default=None):
    return json.loads(path.read_text(encoding='utf-8-sig')) if path.exists() else default

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

CONFIG = [
    ('milady', 'Milady Maker', '#eca4cd', 10000, 'https://www.miladymaker.net', '0x5af0d9827e0c53e4799bb226655a1de152a425a5'),
    ('radbro', 'Radbro Webring V2', '#acd562', 5000, 'https://radbro.xyz', '0xabcdb5710b88f456fed1e99025379e2969f29610'),
    ('nonon', 'nonon', '#a7b7ef', 5000, 'https://nonon.house', '0xd3607bc8c7927b348bac50dc224c28e3ce933ca6'),
]

catalog=[]
for key, name, color, expected, website, contract in CONFIG:
    folder=ARCHIVE/key
    tokens=read(folder/'tokens.json', [])
    assert isinstance(tokens, list), f'{key}: tokens must be an array'
    tokens=sorted(tokens, key=lambda t:int(t['id']))
    selections={t['id']:t['selection'] for t in read(folder/'token-selections.json', [])} if key=='milady' else {}
    prepared=[]
    counts=defaultdict(Counter)
    for t in tokens:
        t['id']=str(t['id'])
        ui={'id':t['id'],'name':f'Milady {t["id"]}' if key=='milady' else t['name'],'image':t['image'],'attributes':t.get('makerAttributes',t['attributes'])}
        if t.get('imageAvailability'):
            ui['imageAvailability']=t['imageAvailability']
            if t['imageAvailability']=='thumbnail-only':
                ui['sourceWarning']='The full-size portrait is unavailable from the tested sources. This is the verified 250-pixel thumbnail.'
            elif t['imageAvailability']=='unavailable':
                ui['sourceWarning']='The portrait could not be recovered from the official site or tested public caches. This token’s metadata is complete.'
        if key=='milady':
            ui['selection']=selections.get(t['id'],{})
            if t['id']=='1000':
                ui['sourceWarning']='The original metadata URL for #1000 serves #1001. This character uses the correctly identified official maker record; the raw conflicting response is preserved in the local archive.'
                ui['conflictingOriginalAttributes']=t['attributes']
        prepared.append(ui)
        for a in t['attributes']:
            counts[a['trait_type']][str(a['value'])]+=1
    write(PUBLIC/'data'/f'{key}-tokens.json',prepared)
    layers=[]
    maker=read(folder/'maker-config.json', {})
    for layer in read(folder/'layers.json', []) if key=='milady' else []:
        if not layer.get('downloaded'): continue
        source=folder/layer['path']
        target=PUBLIC/'layers'/key/Path(layer['path']).relative_to('layers').with_suffix('.webp')
        target.parent.mkdir(parents=True,exist_ok=True)
        if not target.exists():
            with Image.open(source) as im:
                im=im.convert('RGBA')
                im.thumbnail((1000,1250),Image.Resampling.LANCZOS)
                im.save(target,format='WEBP',lossless=True,method=4)
        with Image.open(target) as im: width,height=im.size
        layers.append({**layer,'path':'/'+target.relative_to(PUBLIC).as_posix(),'width':width,'height':height})
    categories=[]
    if key=='milady':
        for category in maker.get('DISPLAY',[]):
            entries=[l for l in layers if l['category']==category and not l.get('helper')]
            if not entries: continue
            categories.append({'name':category,'optional':entries[0]['optional'],'values':[{'value':l['value'],'count':0} for l in entries]})
    else:
        for category,values in counts.items():
            categories.append({'name':category,'optional':sum(values.values())<len(tokens),'values':[{'value':v,'count':n} for v,n in sorted(values.items())]})
    references={'milady':folder/'reference-0.png','radbro':folder/'images'/'1-cdn.png','nonon':folder/'reference'/'1.webp'}
    ref=references[key]
    if ref.exists():
        dest=PUBLIC/'art'/f'{key}-reference.webp'
        with Image.open(ref) as im:
            im.thumbnail((800,1000));im.save(dest,format='WEBP',quality=90)
        reference='/art/'+dest.name
    else: reference=tokens[0]['image'] if tokens else ''
    entry={'id':key,'name':name,'short':key.upper(),'color':color,'expected':expected,'website':website,'contract':contract,'tokenCount':len(tokens),'traitCount':sum(len(v) for v in counts.values()),'categoryCount':len(counts),'categories':categories,'tokensFile':f'/data/{key}-tokens.json','reference':reference,'referenceId':tokens[0]['id'] if tokens else '', 'layers':layers,'maker':maker,'composable':bool(layers),'metadataCategories':list(counts),'sourceLinks':[], 'scanDate':'2026-09-08'}
    if key=='milady':
        coverage=read(folder/'visual-trait-coverage.json',{})
        entry['traitCount']=coverage.get('canonicalVisualValueCount',entry['traitCount'])
        entry['categoryCount']=coverage.get('canonicalVisualCategoryCount',entry['categoryCount'])
        entry['sourceLinks']=[{'name':'Official trait generator','url':'https://maker.remilia.org/milady'},{'name':'Official token metadata','url':'https://www.miladymaker.net/milady/json/0'},{'name':'Viral Public License','url':'https://viralpubliclicense.org'}]
        entry['note']='All 261 original visual trait values map to Remilia layers. The public generator adds 57 options, including overlays and accessories. Some artist rules hide overlapping parts. Token #1000 uses corrected official maker metadata.'
        verified=read(folder/'verification.json',{})
        entry['imageCount']=10000-len(verified.get('missingImageIds',list(range(10000))))
        entry['imageRepresentation']='Original PNGs; #9999 recovered from its metadata IPFS address after the main URL returned an empty file.'
        entry['modelNote']='No canonical per-token model set found. Community derivatives are recorded separately in the local source inventory.'
    elif key=='radbro':
        entry['sourceLinks']=[{'name':'Official token metadata','url':'https://radbro.xyz/api/tokens/metadata/1'},{'name':'Community model files','url':'https://github.com/0xsks/radbro3d'}]
        entry['note']='Full token traits are selectable as a recipe. Original V2 layers have not been recovered, so a new combination has no authentic composite image.'
        verified=read(folder/'coverage.json',{})
        entry['imageCount']=verified.get('imagesDownloaded',0)+len(verified.get('thumbnailOnlyIds',[]))
        entry['imageRepresentation']=f"{verified.get('imagesDownloaded',0):,} full-size portraits, {len(verified.get('thumbnailOnlyIds',[]))} thumbnail-only fallback. Missing portraits: {', '.join('#'+str(i) for i in verified.get('noUsableImageIds',[])) or 'none'}. Verified source corrections and image exceptions are recorded in the audit."
        entry['modelNote']='Community Blender/glTF/FBX/OBJ/VRM files recovered; these are standalone models, not the original V2 trait wardrobe.'
    else:
        entry['sourceLinks']=[{'name':'Collection metadata','url':'https://api.scatter.art/v1/collection/nonon'},{'name':'Artist documentation','url':'https://nonon.house'}]
        entry['note']='Full token traits are selectable as a recipe. Original painted layers and compatibility variants have not been recovered, so a new combination has no authentic composite image.'
        verified=read(folder/'coverage.json',{})
        entry['imageCount']=verified.get('downloadedCharacterImages',0)
        entry['imageRepresentation']='All official-site 1400 × 1778 WebP portraits; original IPFS PNG addresses are preserved. Also archived 1,475 associated Friend Card SVG snapshots and all eight badge-level sprites.'
        entry['modelNote']='One community VRM, with conflicting repository and embedded reuse terms. No canonical per-token models or model URLs found.'
    audits={}
    audit_files={'milady':['FINAL_SUMMARY.json','verification.json','visual-trait-coverage.json','9999-fallback-receipt.json','composition-comparison.json'], 'radbro':['coverage.json','findings.json','image-fallbacks.json','image-repair-report.json','layer-manifest.json','model-manifest.json'],'nonon':['coverage.json','audit.json','findings.json','asset-inventory.json']}
    for filename in audit_files[key]:
        value=read(folder/filename)
        if value is not None: audits[filename]=value
    write(PUBLIC/'data'/f'{key}-audit.json',audits)
    catalog.append(entry)
write(PUBLIC/'catalog.json',catalog)
if (ARCHIVE/'SUMMARY.json').exists(): shutil.copyfile(ARCHIVE/'SUMMARY.json',PUBLIC/'data'/'archive-summary.json')
print(json.dumps([{'id':c['id'],'tokens':c['tokenCount'],'traits':c['traitCount'],'layers':len(c['layers'])} for c in catalog]))
