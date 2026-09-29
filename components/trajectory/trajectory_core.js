/* Deterministic conditional scenarios. No treatment effects, outcome probabilities or learned aging law. */
(function(root){'use strict';
const fields=[{key:'Kmax',name:'Maximum keratometry',unit:'D',digits:1,low:20,high:100},{key:'C',name:'Thinnest pachymetry',unit:'µm',digits:0,low:200,high:800},{key:'B',name:'Posterior radius',unit:'mm',digits:2,low:2.5,high:12.5},{key:'A',name:'Anterior radius',unit:'mm',digits:2,low:2.5,high:12.5},{key:'BAD_D',name:'BAD-D',unit:'',digits:2,low:-5,high:60},{key:'ARTmax',name:'ARTmax',unit:'',digits:1,low:1,high:1000}];
const number=(v,lo=-Infinity,hi=Infinity)=>['number','string'].includes(typeof v)&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=lo&&Number(v)<=hi?Number(v):null;
const values=v=>Object.fromEntries(fields.map(f=>[f.key,number(v?.[f.key],f.low,f.high)]));
function cleanContext(raw){
 if(raw?.type!=='nkpi:trajectory:context'||raw.version!==2||typeof raw.session!=='string'||!raw.session||raw.session.length>120||!Number.isSafeInteger(raw.revision)||raw.revision<0||!Array.isArray(raw.eyes)||raw.eyes.length>2)throw new Error('Invalid context');
 const seen=new Set();const eyes=raw.eyes.map(c=>{if(!c||!['OD','OS'].includes(c.eye)||seen.has(c.eye)||!['baseline','longitudinal'].includes(c.mode))throw new Error('Invalid eye/visit');seen.add(c.eye);
  const days=number(c.interval_days,1,36525),quality=c.scan_quality||{};
  return {eye:c.eye,mode:c.mode,age:number(c.age,18,100),interval_days:Number.isInteger(days)?days:null,first:values(c.first),latest:c.mode==='longitudinal'?values(c.latest):null,
   verified:c.verified===true&&raw.sourceDirty!==true,demo:c.demo===true,imported:c.imported===true,treatment:['treated','untreated','unknown'].includes(c.treatment)?c.treatment:'unknown',scan_quality:{first:['ok','warning'].includes(quality.first)?quality.first:'unknown',latest:['ok','warning'].includes(quality.latest)?quality.latest:'unknown'}};
 });return {session:raw.session,revision:raw.revision,eyes};
}
function score(v,age,m,{holdOutsideTraining=false}={}){
 if(!m||m.format!=='standardized_logistic_v1'||!Number.isFinite(age))return {value:null,outside:[],reason:'Model or age unavailable'};
 let logit=m.intercept;const outside=[];
 for(let i=0;i<m.features.length;i++){
  const name=m.features[i],spec=m.feature_spec[name],x=spec.source==='age'?age:v?.[spec.key],f=fields.find(f=>f.key===spec.key);
  if(!Number.isFinite(x)||!Number.isFinite(m.scale[i])||m.scale[i]<=0||(f&&(x<f.low||x>f.high))||(!f&&(x<18||x>100)))return {value:null,outside:[],reason:'Missing or out-of-bounds inputs'};
  const z=x*(spec.direction??1);logit+=(z-m.center[i])/m.scale[i]*m.coefficients[i];
  const range=m.feature_stats[name];if(z<range.min||z>range.max)outside.push(spec.source==='age'?'Age':spec.key);
 }
 if(holdOutsideTraining&&outside.length)return {value:null,outside,reason:'Outside development range: '+outside.join(', ')};
 return {value:logit>=0?100/(1+Math.exp(-logit)):100*Math.exp(logit)/(1+Math.exp(logit)),outside,reason:null};
}
function calculate(c,m){
 if(!c)return {status:'held',reason:'Import or enter an eye above.',rows:[],points:[]};
 const paired=c.mode==='longitudinal',years=paired&&c.interval_days?c.interval_days/365.2425:null;
 const rows=fields.map(f=>({...f,first:c.first[f.key],latest:paired?c.latest[f.key]:null,delta:paired&&c.verified&&years&&c.first[f.key]!==null&&c.latest[f.key]!==null?c.latest[f.key]-c.first[f.key]:null}));
 rows.forEach(r=>r.rate=r.delta!==null&&years?r.delta/years:null);
 const holds=[];
 if(!c.verified)holds.push('Verify source values and visit order above.');
 if(!paired)holds.push('Two visits are needed to calculate an observed rate.');
 if(paired&&!years)holds.push('Confirm the interval between visits.');
 if(years&&c.interval_days<90)holds.push('The scenario engine requires at least 90 days between visits; short-interval differences can be dominated by variability.');
 if(c.treatment==='treated')holds.push('Post-CXL scenarios are outside the existing model’s intended use.');
 if(Object.values(c.scan_quality).includes('warning'))holds.push('Resolve the recorded scan-quality warning before projecting.');
 const currentAge=c.age!==null?c.age+(years||0):null;
 const ready=!holds.length&&rows.some(r=>r.rate!==null);
 if(!holds.length&&!ready)holds.push('No complete measurement pair is available.');
 const mayScore=c.verified&&c.treatment!=='treated'&&!Object.values(c.scan_quality).includes('warning');
 const withheld={value:null,outside:[],reason:'Source, treatment or scan quality needs review'};
 const result={status:ready?'ready':'held',reason:holds.join(' '),c,rows,years,currentAge,points:[],baselineScore:mayScore?score(c.first,c.age,m):withheld,currentScore:mayScore?score(paired?c.latest:c.first,currentAge,m):withheld,notes:[]};
 if(c.treatment==='unknown')result.notes.push('Treatment history is unknown. Scenarios assume neither visit follows CXL.');
 if(Object.values(c.scan_quality).includes('unknown'))result.notes.push('Scan quality has not been confirmed in the calculator.');
 if(!ready)return result;
 for(const month of [0,6,12,24]){
  const horizon=month/12,age=currentAge!==null?currentAge+horizon:null,trend={},hold={},unavailable=[];
  for(const r of rows){const value=r.rate===null?null:r.latest+r.rate*horizon;trend[r.key]=value!==null&&value>=r.low&&value<=r.high?value:null;hold[r.key]=r.latest;if(value!==null&&trend[r.key]===null)unavailable.push(r.key);}
  const opts={holdOutsideTraining:month>0};
  result.points.push({month,age,trend,hold,unavailable,extensionFactor:month===0?0:horizon/years,
   trendScore:score(trend,currentAge,m,opts),holdScore:score(hold,currentAge,m,opts),
   trendAgeScore:score(trend,age,m,opts),holdAgeScore:score(hold,age,m,opts)});
 }
 return result;
}
const api={fields,number,values,cleanContext,score,calculate};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NKPITrajectory=api;
})(typeof window!=='undefined'?window:globalThis);
