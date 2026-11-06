"""Import reviewed HTML/PNG pairs through the endpoint used by Google's Stitch SDK."""
import base64, hashlib, json, os, pathlib, sys, tomllib, urllib.request, urllib.error
root=pathlib.Path(__file__).resolve().parent.parent
cfg=tomllib.loads((pathlib.Path(os.environ.get('CODEX_HOME',str(pathlib.Path.home()/'.codex')))/'config.toml').read_text(encoding='utf-8'))['mcp_servers']['stitch']
key=cfg.get('http_headers',{}).get('X-Goog-Api-Key') or os.environ.get(cfg.get('env_http_headers',{}).get('X-Goog-Api-Key','STITCH_API_KEY'))
if not key: sys.exit('Stitch credential unavailable.')
manifest=json.loads((root/'design/stitch-screens.json').read_text(encoding='utf-8'))
requested=next((arg for arg in sys.argv[1:] if not arg.startswith('--')),None)
selected=[s for s in manifest['screens'] if not requested or s['id']==requested]
image_mode='--image' in sys.argv
result_file=root/'design/stitch-imported.json'
results=json.loads(result_file.read_text(encoding='utf-8')) if result_file.exists() else []
for screen in selected:
    html=(root/'design/stitch'/f"{screen['id']}.html").read_bytes()
    png=(root/'design/stitch'/f"{screen['id']}.png").read_bytes() if image_mode else b''
    input_hash=hashlib.sha256(html+png).hexdigest()
    if any(r['originalId']==screen['id'] and r.get('imageMode',False)==image_mode and r.get('inputHash')==input_hash for r in results):
        print('Already imported:',screen['title']);continue
    data={'title':screen['title'],'screenType':'DOCUMENT','isCreatedByClient':True,'deviceType':screen['deviceType'],'width':str(round(screen['width']*2)),'htmlCode':{'mimeType':'text/html','fileContentBase64':base64.b64encode(html).decode()}}
    if image_mode:
        data['screenType']='IMAGE'
        data['screenshot']={'mimeType':'image/png','fileContentBase64':base64.b64encode(png).decode()}
    body={'parent':'projects/'+manifest['projectId'],'requests':[{'screen':data}],'createScreenInstances':False}
    request=urllib.request.Request('https://stitch.googleapis.com/v1/projects/'+manifest['projectId']+'/screens:batchCreate',data=json.dumps(body).encode(),headers={'Content-Type':'application/json','X-Goog-Api-Key':key},method='POST')
    try:
        with urllib.request.urlopen(request,timeout=90) as response: payload=json.load(response)
    except urllib.error.HTTPError as error:
        try: reason=str(json.loads(error.read()).get('error',{}).get('message','Invalid request')).replace(key,'[redacted]')[:800]
        except Exception: reason='Invalid request'
        print('Import failed:',screen['title'],'HTTP',error.code,reason);sys.exit(1)
    except Exception as error:
        print('Import uncertain:',screen['title'],type(error).__name__);sys.exit(1)
    created=payload.get('results',[{}])[0].get('screen',{})
    if not created.get('name'): print('Missing screen reference; stop without retry.');sys.exit(1)
    results.append({'originalId':screen['id'],'title':screen['title'],'imageMode':image_mode,'inputHash':input_hash,'screen':created})
    result_file.write_text(json.dumps(results,indent=2),encoding='utf-8')
    print('Imported:',screen['title'],created['name'])
