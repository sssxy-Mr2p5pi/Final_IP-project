import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const storyFormat = JSON.parse(fs.readFileSync(path.join(root, 'tools.lock.json'), 'utf8')).storyFormat;
const src = path.join(root, 'src', 'story.twee');
const dist = path.join(root, 'dist');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const read = file => fs.readFileSync(file, 'utf8');
function save(file, data) { fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, data); }
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {cwd:root, encoding:'utf8', windowsHide:true, ...options});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed (${result.status}): ${result.stderr || result.stdout}`);
  return result.stdout;
}
export function passages(text) {
  const headers = [...text.matchAll(/^:: ([^\r\n]+)\r?$/gm)];
  return headers.map((h, i) => {
    const header = h[1];
    const name = header.split(/\s*[\[{]/, 1)[0].trim();
    const tags = header.match(/\[([^\]]*)\]/)?.[1].split(/\s+/) || [];
    const body = text.slice(h.index+h[0].length, headers[i+1]?.index ?? text.length).replace(/\r\n/g,'\n').trim();
    return {name, tags, body};
  });
}
function contentMap(text) {
  return Object.fromEntries(passages(text).filter(p => p.tags.includes('author-text')).map(p => [p.name,hash(p.body)]));
}
function manifest() { return JSON.parse(read(path.join(root, 'assets', 'manifest.json'))); }
function assetPath(relative) {
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(path.join(root,'assets') + path.sep)) throw new Error('Asset path escapes assets directory');
  return resolved;
}
export function check() {
  const text = read(src);
  const list = passages(text);
  const names = new Set(list.map(p=>p.name));
  if (names.size !== list.length) throw new Error('Duplicate passage names');
  for (const required of ['StoryTitle','StoryData','StoryInit','Start','ViewA','ViewB','TextShort','TextLong']) {
    if (!names.has(required)) throw new Error('Missing passage: '+required);
  }
  const data = JSON.parse(list.find(p=>p.name==='StoryData').body);
  if (data.format !== storyFormat.name || data['format-version'] !== storyFormat.version) throw new Error('Unexpected story format');
  for (const match of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const target = match[1].includes('->') ? match[1].split('->').at(-1) : match[1].includes('<-') ? match[1].split('<-')[0] : match[1].includes('|') ? match[1].split('|').at(-1) : match[1];
    if (!names.has(target.trim())) throw new Error('Broken passage link: '+target);
  }
  for (const entry of manifest()) {
    if (!fs.existsSync(assetPath(entry.path))) throw new Error('Missing asset: '+entry.path);
    if (!entry.author || !entry.license || !entry.source) throw new Error('Incomplete asset credit: '+entry.path);
  }
  const report = {checkedAt:new Date().toISOString(),status:'passed',passages:list.length,sourceSha256:hash(text),authorText:contentMap(text),assets:manifest().map(a=>({path:a.path,sha256:hash(fs.readFileSync(assetPath(a.path)))}))};
  save(path.join(root,'evidence/tests/source-check.json'),JSON.stringify(report,null,2)+'\n');
  return report;
}
function runtimeFiles() { return ['index.html','README.txt','CREDITS.txt',...manifest().map(a=>a.path)]; }
export function build() {
  check();
  const compiler = path.join(root,'.tools/tweego/tweego.exe');
  const formats = path.join(root,'.tools/storyformats');
  if (!fs.existsSync(compiler)) throw new Error('Tweego is missing. Run 00-setup.cmd.');
  const formatFile = path.join(formats,storyFormat.compilerId,'format.js');
  if (!fs.existsSync(formatFile) || hash(fs.readFileSync(formatFile)) !== storyFormat.sha256) throw new Error('The pinned Harlowe format is missing. Run 00-setup.cmd.');
  fs.mkdirSync(dist,{recursive:true});
  const temporary = path.join(root,'.local','build-'+crypto.randomUUID()+'.html');
  fs.mkdirSync(path.dirname(temporary),{recursive:true});
  run(compiler,['-f',storyFormat.compilerId,'-o',temporary,src],{env:{...process.env,TWEEGO_PATH:formats}});
  fs.copyFileSync(temporary,path.join(dist,'index.html'));
  for (const entry of manifest()) {
    const target = path.join(dist,entry.path); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.copyFileSync(assetPath(entry.path),target);
    // Twine Play writes HTML into scratch. Keep relative asset paths usable there.
    for (const folder of ['.local/twine-scratch', '.local/twine-library']) {
      const previewAsset = path.join(root,folder,entry.path);
      fs.mkdirSync(path.dirname(previewAsset),{recursive:true});
      fs.copyFileSync(assetPath(entry.path),previewAsset);
    }
  }
  for (const name of ['README.txt','CREDITS.txt']) fs.copyFileSync(path.join(root,'delivery',name),path.join(dist,name));
  return path.join(dist,'index.html');
}
function psQuote(value) { return "'"+value.replaceAll("'","''")+"'"; }
function pack() {
  build();
  const packageRoot=path.join(root,'.local','package-'+crypto.randomUUID());
  for(const file of runtimeFiles()) {
    const target=path.join(packageRoot,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(dist,file),target);
  }
  const target=path.join(root,'releases/final-ip-technical-prototype.zip');fs.mkdirSync(path.dirname(target),{recursive:true});
  run('powershell.exe',['-NoProfile','-Command',`$ErrorActionPreference='Stop'; Compress-Archive -Path ${psQuote(path.join(packageRoot,'*'))} -DestinationPath ${psQuote(target)} -Force`]);
  save(path.join(root,'evidence/tests/package.json'),JSON.stringify({createdAt:new Date().toISOString(),sha256:hash(fs.readFileSync(target)),files:runtimeFiles(),sourceSha256:hash(read(src)),status:'packaged; browser verification is separate'},null,2)+'\n');
  return target;
}
function checkpoint() {
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const folder=path.join(root,'.local/handoffs',stamp);fs.mkdirSync(folder,{recursive:true});fs.copyFileSync(src,path.join(folder,'story.twee'));
  save(path.join(root,'.local/author-checkpoint.json'),JSON.stringify({createdAt:new Date().toISOString(),backup:path.relative(root,folder),passages:contentMap(read(src))},null,2)+'\n');
  return 'Saved author text checkpoint: '+folder;
}
function compare() {
  const file=path.join(root,'.local/author-checkpoint.json');
  if(!fs.existsSync(file)) throw new Error('No checkpoint exists. Run the checkpoint command before a technical edit.');
  const previous=JSON.parse(read(file)).passages,current=contentMap(read(src));
  const changes=[...new Set([...Object.keys(previous),...Object.keys(current)])].filter(name=>previous[name]!==current[name]);
  const result={checkedAt:new Date().toISOString(),status:changes.length?'author text changed':'passed',changedPassages:changes};
  save(path.join(root,'evidence/tests/author-text-check.json'),JSON.stringify(result,null,2)+'\n');
  if(changes.length) throw new Error('Author text changed: '+changes.join(', ')+'. Return these changes to the author.');
  return 'Author text matches the checkpoint.';
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const action=process.argv[2] || 'check';
    if(action==='check') console.log(JSON.stringify(check(),null,2));
    else if(action==='build') console.log(build());
    else if(action==='package') console.log(pack());
    else if(action==='checkpoint') console.log(checkpoint());
    else if(action==='compare') console.log(compare());
    else if(action==='preview') {
      const file=build();
      const child=spawn('explorer.exe',[file],{windowsHide:true,stdio:'ignore'});child.unref();console.log(file);
    } else throw new Error('Unknown command: '+action);
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
