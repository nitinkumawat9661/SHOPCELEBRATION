import ts from 'typescript'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const roots = ['app','features','lib','config'].map((p)=>join(process.cwd(),p))
const errors=[]
async function walk(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const p=join(dir,entry.name)
    if(entry.isDirectory()) await walk(p)
    else if(/\.tsx?$/.test(entry.name)){
      const source=await readFile(p,'utf8')
      const result=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true,fileName:p})
      for(const d of result.diagnostics||[]){
        const msg=ts.flattenDiagnosticMessageText(d.messageText,' ')
        errors.push(`${relative(process.cwd(),p)}: ${msg}`)
      }
    }
  }
}
for(const root of roots) await walk(root)
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('TypeScript syntax check passed.')
