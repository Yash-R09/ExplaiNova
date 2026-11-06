"""Attach generated screen references without exposing Stitch credentials."""
import json, os, pathlib, sys, tomllib, urllib.request, urllib.error, uuid

root = pathlib.Path(__file__).resolve().parent.parent
cfg_path = pathlib.Path(os.environ.get('CODEX_HOME', str(pathlib.Path.home()/'.codex'))) / 'config.toml'
cfg = tomllib.loads(cfg_path.read_text(encoding='utf-8'))['mcp_servers']['stitch']
key = cfg.get('http_headers',{}).get('X-Goog-Api-Key')
if not key:
    env_name = cfg.get('env_http_headers',{}).get('X-Goog-Api-Key','STITCH_API_KEY')
    key = os.environ.get(env_name)
if not key:
    sys.exit('Stitch credential unavailable; no changes made.')
headers = {'X-Goog-Api-Key':key, 'Content-Type':'application/json'}
manifest_file='stitch-reviewed-screens.json' if '--reviewed' in sys.argv else 'stitch-screens.json'
manifest = json.loads((root/'design'/manifest_file).read_text(encoding='utf-8'))
endpoint = 'https://stitch.googleapis.com/v1/projects/' + manifest['projectId']
def request(method, url, body=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.load(response)
try:
    project = request('GET',endpoint)
    existing = project.get('screenInstances',[])
    backup=root/'design/stitch-canvas-backup.json'
    if not backup.exists(): backup.write_text(json.dumps({'name':project.get('name'),'screenInstances':existing},indent=2),encoding='utf-8')
    print('Existing canvas instances:',len(existing))
    if '--write' not in sys.argv:
        print('Read-only check complete.')
        sys.exit(0)
    updated=0
    by_title={s['title']:s for s in manifest['screens']}
    for instance in existing:
        desired=by_title.get(instance.get('label'))
        if desired and instance.get('sourceScreen')==desired.get('originalName'):
            instance['sourceScreen']=desired['name']
            instance['width']=desired['width'];instance['height']=desired['height']
            updated+=1
    sources = {s.get('sourceScreen') for s in existing}
    additions=[]
    for i,s in enumerate(manifest['screens']):
        if s['name'] in sources: continue
        mobile = s['deviceType']=='MOBILE'
        group = 3 if mobile else (0 if i<6 else 1 if i<13 else 2)
        position = i-20 if mobile else (i if i<6 else i-6 if i<13 else i-13)
        additions.append({'id':uuid.uuid4().hex,'sourceScreen':s['name'],'label':s['title'],'x':1024+position*(454 if mobile else 1344),'y':5800+group*3400,'width':s['width'],'height':s['height'],'type':'SCREEN_INSTANCE'})
    if not additions and not updated:
        print('All requested screens already attached.')
        sys.exit(0)
    result=request('PATCH',endpoint+'?updateMask=screenInstances',{'name':project['name'],'screenInstances':existing+additions})
    print('Added canvas instances:',len(additions))
    print('Updated reviewed instances:',updated)
    print('Confirmed returned instances:',len(result.get('screenInstances',[])))
except urllib.error.HTTPError as error:
    print('Stitch REST status:',error.code)
    # Do not echo response bodies or request credentials.
    sys.exit(1)
except Exception as error:
    print('Stitch request failed:',type(error).__name__)
    sys.exit(1)
