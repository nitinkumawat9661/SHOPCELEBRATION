import { readdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"
const roots=["app","features","lib","config"].map((p)=>join(process.cwd(),p))
const errors=[]
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())await walk(p);else if(/\.tsx?$/.test(e.name)){const lines=(await readFile(p,"utf8")).split("\n").filter((l)=>l.startsWith("import "));const seen=new Set();for(const line of lines){if(seen.has(line))errors.push(`${relative(process.cwd(),p)} duplicate import: ${line}`);seen.add(line)}}}}
for(const root of roots)await walk(root)
if(errors.length){console.error(errors.join("\n"));process.exit(1)}
console.log("Duplicate import audit passed.")
