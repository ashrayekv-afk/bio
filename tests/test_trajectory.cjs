'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),T=require('../components/trajectory/trajectory_core.js'),M=require('../models/release_model_baseline.json');
const base={A:5.83,B:4.60,C:423,BAD_D:12.18,ARTmax:155,Kmax:64.7},last={A:5.81,B:4.53,C:418,BAD_D:12.96,ARTmax:168,Kmax:64.5};
const raw=()=>({type:'nkpi:trajectory:context',version:2,session:'test',revision:1,eyes:[{eye:'OD',mode:'longitudinal',age:34,interval_days:189,verified:true,first:{...base},latest:{...last},treatment:'untreated',scan_quality:{first:'ok',latest:'ok'}}]});
const calculate=r=>T.calculate(T.cleanContext(r).eyes[0],M);
let r=raw(),d=calculate(r);assert.equal(d.status,'ready');assert.equal(d.points.length,4);
for(const p of d.points){for(const f of T.fields){const expected=last[f.key]+(last[f.key]-base[f.key])/(189/365.2425)*(p.month/12);assert(Math.abs(p.trend[f.key]-expected)<1e-10);assert.equal(p.hold[f.key],last[f.key]);}assert(Math.abs(p.age-(34+189/365.2425+p.month/12))<1e-10);assert.equal(p.holdScore.value,d.currentScore.value);}
assert.equal(d.points[0].trendScore.value,d.currentScore.value);
assert(Math.abs(d.points[2].trend.C-(418-5*365.2425/189))<1e-10);
assert(d.points[2].trendAgeScore.value<d.points[2].trendScore.value);
// Age changes the score sensitivity only, never the measurement scenario.
assert.equal(d.points[2].trend.C,calculate(raw()).points[2].trend.C);
const coefficient=M.coefficients[0]/M.scale[0],logit=p=>Math.log(p/(100-p));assert(Math.abs(logit(d.points[2].trendAgeScore.value)-logit(d.points[2].trendScore.value)-coefficient)<1e-10);
for(const mutate of [r=>r.eyes[0].verified=false,r=>r.sourceDirty=true,r=>r.eyes[0].interval_days=30,r=>r.eyes[0].interval_days=0,r=>r.eyes[0].interval_days=1.5,r=>r.eyes[0].treatment='treated',r=>r.eyes[0].scan_quality.latest='warning',r=>r.eyes[0].mode='baseline']){r=raw();mutate(r);d=calculate(r);assert.equal(d.status,'held');assert.equal(d.points.length,0);}
r=raw();r.eyes[0].treatment='treated';assert.equal(calculate(r).currentScore.value,null);
r=raw();r.eyes[0].first.B='';d=calculate(r);assert.equal(d.status,'ready');assert(d.points.every(p=>p.trend.B===null&&p.trendScore.value===null));assert(d.points.every(p=>p.trend.C!==null));
r=raw();r.eyes[0].age=null;d=calculate(r);assert(d.points.every(p=>p.trendScore.value===null));assert(d.points.every(p=>p.trend.C!==null));
r=raw();r.eyes[0].first.C=790;r.eyes[0].latest.C=220;d=calculate(r);assert.equal(d.points.at(-1).trend.C,null);assert(d.points.at(-1).unavailable.includes('C'));
r=raw();r.eyes[0].latest.Kmax=99;d=calculate(r);assert(d.points.at(-1).unavailable.includes('Kmax'));
for(const v of ['',null,true,{},NaN,Infinity,'abc']){r=raw();r.eyes[0].first.A=v;assert.equal(calculate(r).rows.find(f=>f.key==='A').rate,null);}
r=raw();r.eyes[0].latest={...base};d=calculate(r);assert(d.points.every(p=>p.trendScore.value===p.holdScore.value));assert(d.points.every(p=>p.trend.C===423));
r=raw();r.eyes.push({...r.eyes[0]});assert.throws(()=>T.cleanContext(r));r=raw();r.version=1;assert.throws(()=>T.cleanContext(r));
r=raw();r.eyes[0].patient_name='never_export';assert(!JSON.stringify(T.cleanContext(r)).includes('never_export'));
const modelContext={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'components/trajectory/model_data.js'),'utf8'),modelContext);assert.deepEqual(JSON.parse(JSON.stringify(modelContext.window.NKPIBaselineArtifact)),M);
// Execute the actual parent numeric bridge, not a copied implementation.
const source=fs.readFileSync(path.join(root,'components/app.js'),'utf8'),section=source.slice(source.indexOf('function viewerContext()'),source.indexOf('function invalidate('));let sent;
const env={cases:{OD:{...raw().eyes[0],enabled:true},OS:{enabled:false}},S:{finite:v=>T.number(v)!==null},F:T.fields,session:'test',revision:2,sourceDirty:false,importedEyes:new Set(['OD']),window:{location:{origin:'https://local.example'}},$:()=>({contentWindow:{postMessage:(data,origin)=>sent={data,origin}}})};vm.createContext(env);vm.runInContext(section+';resetViewer();',env);assert.equal(sent.origin,'https://local.example');assert.equal(calculate(JSON.parse(JSON.stringify(sent.data))).status,'ready');assert(!('maps' in sent.data));
console.log('PASS: observed-rate arithmetic, all 6 inputs and 4 times, fixed-value reference, age separation/logit effect, source/quality/treatment gates, missing data, no clipping, frozen artifact parity and production parent bridge.');
