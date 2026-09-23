import { readdir, readFile, stat } from 'node:fs/promises'
import { join, dirname, resolve, relative } from 'node:path'

const roots=['app','features','lib','config'].map((p)=>join(process.cwd(),p))
const errors=[]
async function exists(p){try{await stat(p);return true}catch{return false}}
async function resolveRelative(from,spec){
  const base=resolve(dirname(from),spec)
  const candidates=[base,`${base}.ts`,`${base}.tsx`,`${base}.json`,join(base,'index.ts'),join(base,'index.tsx')]
  return (await Promise.all(candidates.map(exists))).some(Boolean)
}
async function walk(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const p=join(dir,entry.name)
    if(entry.isDirectory()) await walk(p)
    else if(/\.tsx?$/.test(entry.name)){
      const text=await readFile(p,'utf8')
      const regex=/(?:from\s+|import\s*)["'](\.[^"']+)["']/g
      let m
      while((m=regex.exec(text))){if(!(await resolveRelative(p,m[1]))) errors.push(`${relative(process.cwd(),p)} -> ${m[1]}`)}
    }
  }
}
for(const root of roots) await walk(root)
if(errors.length){console.error('Missing relative imports:\n'+errors.join('\n'));process.exit(1)}
console.log('Relative import audit passed.')
