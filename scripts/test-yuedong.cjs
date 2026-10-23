/* Tests the actual pure TS logic with synthetic landmarks, never production student footage. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const logicFile=path.resolve(__dirname,'../src/logic/yuedong.ts');
const tsCode=fs.readFileSync(logicFile,'utf8');
const js=ts.transpileModule(tsCode,{
 compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}
}).outputText;
const mod=new Module(logicFile,module);
mod.filename=logicFile;
mod.paths=module.paths;
mod._compile(js,logicFile);
const {analyzeLongJump,planFor,loadRecords,parseCentimeters,toCsv,cleanId}=mod.exports;
function skeleton(degrees){
 const lm=Array.from({length:33},()=>({x:0,y:0,visibility:0}));
 const theta=(180-degrees)*Math.PI/180;
 for(const [s,h,k,a,dx] of [[11,23,25,27,0],[12,24,26,28,1]]){
  lm[s]={x:dx,y:-1,visibility:1};
  lm[h]={x:dx,y:0,visibility:1};
  lm[k]={x:dx,y:1,visibility:1};
  lm[a]={x:dx+Math.sin(theta),y:1+Math.cos(theta),visibility:1};
 }
 return lm;
}
function video(pre,take,air,land){
 return {isComplete:true,frames:Array.from({length:100},(_,i)=>({
  timestamp:i/15,
  landmarks:skeleton(i<33?pre:i<40?take:i<68?air:land)
 }))};
}
const markers={takeoffFrame:35,landingFrame:68};
const reference=video(105,171,78,106);
const student=video(145,132,143,165);
const report=analyzeLongJump(student,markers,reference,markers);
assert.equal(report.status,'ready');
assert.deepEqual(report.findings.map(f=>f.code).sort(),['SLJ-01','SLJ-02','SLJ-03','SLJ-04']);
assert.equal(analyzeLongJump(reference,markers,reference,markers).findings.length,0);
const blank={...student,frames:student.frames.map(f=>({...f,landmarks:null}))};
assert.equal(analyzeLongJump(blank,markers,reference,markers).status,'insufficient');
assert.equal(analyzeLongJump(student,{takeoffFrame:90,landingFrame:20},reference,markers).status,'insufficient');
assert.equal(parseCentimeters('168.53'),168.5);
assert.equal(parseCentimeters(''),null);
assert.equal(parseCentimeters('unknown'),undefined);
assert.equal(parseCentimeters('999'),undefined);
assert.equal(cleanId('   '),'匿名学生');
assert.deepEqual(loadRecords('{invalid'),[]);
assert.equal(Array.isArray(loadRecords('{invalid')),true);
const plan=planFor(['SLJ-01','SLJ-02']);
assert.ok(plan.some(x=>x.tier==='foundation'));
assert.ok(plan.some(x=>x.tier==='improvement'));
assert.ok(plan.some(x=>x.tier==='challenge'));
const csv=toCsv([{id:'1',student:'S001',date:'2026-10-24',kind:'practice',findings:['SLJ-01'],taskIds:['f-swing'],measuredCm:168.5,note:'较好'}]);
assert.ok(csv.includes('168.5'));
assert.ok(csv.includes('S001'));
console.log('PASS: landmarks, four hints, insufficient data, tiers, records and CSV.');
