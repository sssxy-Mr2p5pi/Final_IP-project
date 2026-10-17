"""Extract the pinned, unmodified Harlowe format from the official Twine app."""
from pathlib import Path
import hashlib
import json
import os
import struct
import argparse


def install(twine_directory=None):
    root = Path(__file__).resolve().parents[1]
    spec = json.loads((root / 'tools.lock.json').read_text(encoding='utf-8'))['storyFormat']
    target = root / '.tools/storyformats' / spec['compilerId'] / 'format.js'
    if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == spec['sha256']:
        print('Ready: Harlowe ' + spec['version'])
        return
    app = Path(twine_directory) if twine_directory else Path(os.environ['LOCALAPPDATA']) / 'Programs/Twine'
    archive = app / 'resources/app.asar'
    with archive.open('rb') as stream:
        _, header_size, _, json_size = struct.unpack('<4I', stream.read(16))
        entry = json.loads(stream.read(json_size))
        for part in spec['bundledPath'].split('/'):
            entry = entry['files'][part]
        stream.seek(8 + header_size + int(entry['offset']))
        payload = stream.read(entry['size'])
    if hashlib.sha256(payload).hexdigest() != spec['sha256']:
        raise RuntimeError('Harlowe checksum mismatch. Install the pinned Twine version.')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(payload)
    print('Ready: Harlowe ' + spec['version'] + ' from official Twine bundle')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--twine-directory', type=Path)
    install(parser.parse_args().twine_directory)
