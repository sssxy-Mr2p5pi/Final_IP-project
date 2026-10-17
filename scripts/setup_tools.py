"""Install the locked tools locally. Read Windows proxy settings through urllib."""
from pathlib import Path
import hashlib, json, os, subprocess, urllib.request, zipfile
ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / '.tools'
DOWNLOADS = TOOLS / 'downloads'
DOWNLOADS.mkdir(parents=True, exist_ok=True)
records = json.loads((ROOT / 'tools.lock.json').read_text(encoding='utf-8'))['tools']
for item in records:
    destination = DOWNLOADS / item['filename']
    if not destination.exists():
        temporary = destination.with_suffix(destination.suffix + '.partial')
        request = urllib.request.Request(item['url'], headers={'User-Agent':'Mozilla/5.0'})
        print('Downloading ' + item['name'], flush=True)
        with urllib.request.urlopen(request,timeout=90) as response, temporary.open('wb') as stream:
            while chunk := response.read(1024*1024): stream.write(chunk)
        temporary.replace(destination)
    with destination.open('rb') as stream: actual=hashlib.file_digest(stream,'sha256').hexdigest()
    if actual != item['sha256']: raise RuntimeError('Checksum mismatch: '+item['name'])
    if item['extract']:
        folder=TOOLS/item['extract']
        marker=folder/'.installed-sha256'
        if not marker.exists() or marker.read_text().strip()!=actual:
            folder.mkdir(parents=True,exist_ok=True)
            with zipfile.ZipFile(destination) as archive:
                for entry in archive.infolist():
                    if not (folder/entry.filename).resolve().is_relative_to(folder.resolve()): raise RuntimeError('Unsafe archive path')
                archive.extractall(folder)
            marker.write_text(actual+'\n')
    else:
        executable=Path(os.environ['LOCALAPPDATA'])/'Programs'/'Twine'/'Twine.exe'
        query="(Get-Item -LiteralPath '"+str(executable).replace("'","''")+"').VersionInfo.ProductVersion"
        version=subprocess.run(['powershell.exe','-NoProfile','-Command',query],capture_output=True,text=True,creationflags=subprocess.CREATE_NO_WINDOW).stdout.strip() if executable.exists() else ''
        if not version.startswith(item['version']):
            subprocess.run([str(destination),'/S','/currentuser'],check=True,creationflags=subprocess.CREATE_NO_WINDOW)
    print('Ready: '+item['name']+' '+item['version'])

from install_harlowe import install
install()
