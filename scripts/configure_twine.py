"""Configure this project's new Twine profile without overwriting existing stories."""
from pathlib import Path
import json, os, shutil, time
root=Path(__file__).resolve().parents[1]
profile=root/'.local/twine-editor'
profile.mkdir(parents=True,exist_ok=True)
prefs=profile/'prefs.json'
values=json.loads(prefs.read_text(encoding='utf-8')) if prefs.exists() else {}
values.update(locale='en-us',storyFormat={'name':'Harlowe','version':'3.3.9'})
# Keep the onboarding screen on a fresh installation.
prefs.write_text(json.dumps(values,ensure_ascii=False),encoding='utf-8')
library=root/'.local/twine-library'
library.mkdir(parents=True,exist_ok=True)
app_prefs={'storyLibraryFolderPath':str(library),'backupFolderPath':str(root/'.local/twine-backups'),'scratchFolderPath':str(root/'.local/twine-scratch')}
(profile/'app-prefs.json').write_text(json.dumps(app_prefs,ensure_ascii=False),encoding='utf-8')
template=library/'Final IP — Technical Prototype.html'
if (root/'dist/index.html').exists() and not template.exists():
    shutil.copyfile(root/'dist/index.html',template)
print('Project Twine profile configured in English with Harlowe 3.3.9.')
print('Existing editor stories are preserved. Use 05-open-twine.cmd to open this profile.')
