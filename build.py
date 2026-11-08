import shutil, os, subprocess
src='src'; out='.'

html=open(f'{src}/index.html').read().replace('/*SCORING*/', open(f'{src}/scoring.js').read())
open(f'{out}/index.html','w').write(html)
for f in ['icon.svg','manifest.webmanifest','sw.js']:
    if os.path.exists(f'{src}/{f}'): shutil.copy(f'{src}/{f}', out)
for n in (180,192,512):
    subprocess.run(['rsvg-convert','-w',str(n),'-h',str(n),f'{src}/icon.svg','-o',f'{out}/icon-{n}.png'],check=True)
print('built')
