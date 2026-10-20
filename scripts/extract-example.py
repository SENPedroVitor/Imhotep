"""Extract the approved Orbit artboard into the limited v1 node model.
Icons use a local Lucide catalog; effects, constraints, paths and image fills are omitted.
This is a one-off fixture extractor, not a general Pencil importer.
"""
import json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
source=json.loads((root/'design/Imhotep.pen').read_text())
canvas=next(n for n in source['children'][0]['children'] if n.get('name')=='Infinite canvas')
frame=next(n for n in canvas['children'] if n.get('name')=='Desktop · Orbit chatbot')
nodes=[]
icons={}
def walk(n,parent=None):
    if n.get('enabled') is False: return
    t=n['type']
    if t not in ['frame','rectangle','text','ellipse','icon']: return
    text=n.get('content','◇' if t=='icon' else '')
    size=n.get('fontSize',14 if t=='icon' else 12)
    result=dict(id=n['id'],type=t,name=n.get('name',t),x=n.get('x',0) if parent else 0,y=n.get('y',0) if parent else 0,width=n.get('width',max(1,max(map(len,text.split('\n')))*size*.65)),height=n.get('height',max(1,size*1.4*len(text.split('\n')))))
    if parent: result['parentId']=parent
    for key in ['fill','opacity','strokeWidth']:
        if isinstance(n.get(key),(str,int,float)) and not isinstance(n.get(key),bool): result[key]=n[key]
    if isinstance(n.get('stroke'),str): result['stroke']=n['stroke']
    if isinstance(n.get('cornerRadius'),(int,float)): result['radius']=n['cornerRadius']
    if t=='text':
        result.update(text=text,fontSize=size,fontFamily=n.get('fontFamily','Inter'),fontWeight=int(n.get('fontWeight','400')) if str(n.get('fontWeight','400')).isdigit() else 400)
    if t=='icon':
        import re
        name=n['icon']
        svg=(root/'node_modules/lucide-static/icons'/f'{name}.svg').read_text()
        icons[name]=re.search(r'<svg[^>]*>(.*)</svg>',svg,re.S).group(1).strip()
        result['icon']=name
    nodes.append(result)
    for child in n.get('children',[]): walk(child,n['id'])
walk(frame)
(root/'examples/orbit.json').write_text(json.dumps(dict(schemaVersion=1,name='Orbit — Chat experience',nodes=nodes),ensure_ascii=False,indent=2)+'\n')
(root/'public/icons.js').write_text('// Lucide icons, ISC license. See THIRD_PARTY_NOTICES.md.\nexport const icons = '+json.dumps(icons)+';\n')
print(f'Extracted {len(nodes)} nodes')
