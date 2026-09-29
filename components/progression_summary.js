/* SOURCE P0175, pp. 3–4: prespecified domain thresholds, not a validated diagnosis.
 * These calculations do not read, weight or modify the NKPI score.
 */
(function(root){'use strict';
const S=typeof module!=='undefined'&&module.exports?require('./schema.js'):root.NKPI;
const E=S.esc;
const RULES=Object.freeze([
  {key:'anterior',name:'Anterior curvature',components:[{key:'A',direction:-1,threshold:.106,rule:'ARC decrease >0.106 mm'},{key:'Kmax',direction:1,threshold:1,rule:'Kmax increase >1.0 D'}]},
  {key:'posterior',name:'Posterior curvature',components:[{key:'B',direction:-1,threshold:.085,rule:'PRC decrease >0.085 mm'}]},
  {key:'pachymetric',name:'Pachymetric',components:[{key:'C',direction:-1,threshold:2,percent:true,rule:'Thickness decrease >2% of baseline'},{key:'ARTmax',direction:-1,threshold:44.24,rule:'ARTmax decrease >44.24 units'}]},
  {key:'composite',name:'Composite deviation',components:[{key:'BAD_D',direction:1,threshold:.42,rule:'BAD-D increase >0.42 units'}]}
]);
// Exact decimal arithmetic prevents an equality (e.g. 2.00 → 2.42) from
// crossing a strict threshold because of binary floating-point subtraction.
function decimal(v){const [mantissa,exp='0']=String(v).toLowerCase().split('e'),parts=mantissa.split('.');return {n:BigInt(parts.join('')),places:(parts[1]||'').length-Number(exp)};}
function exactIntegers(values){const d=values.map(decimal),places=Math.max(0,...d.map(x=>x.places));return d.map(x=>x.n*10n**BigInt(places-x.places));}
function crossed(first,latest,rule){const [a,b,t]=exactIntegers([first,latest,rule.threshold]);return rule.percent?100n*(a-b)>BigInt(rule.threshold)*a:(b-a)*BigInt(rule.direction)>t;}
const clean=v=>Number(v.toFixed(12));
const fmt=(v,d)=>Number(v).toFixed(Math.max(d,Math.min(10,decimal(v).places)));
const signed=(v,d)=>(v>0?'+':v<0?'−':'')+fmt(Math.abs(v),d);

function summarize(current,result,sourceDirty=false){
  const out={eye:current.eye,kind:'waiting',title:'Awaiting calculation',reason:'Verify the visit measurements and calculate NKPI above.',rows:[],domains:[],crossed:null,demo:false};
  if(!current.enabled)return {...out,kind:'excluded',title:'Eye not included',reason:'Enable this eye above to include its measurements.'};
  if(sourceDirty)return {...out,kind:'review',title:'Source changed',reason:'Verify and reimport the selected source before reviewing change.'};
  if(!result)return out;
  if(result.eye!==current.eye||S.stable(S.canonical(current))!==S.stable(result.case))return {...out,kind:'review',title:'Recalculation needed',reason:'The measurements changed. Verify and calculate again.'};
  const c=result.case;
  out.demo=c.demo===true;
  if(c.verified!==true||!['ready','held'].includes(result.status)||(result.errors||[]).length)return {...out,kind:'review',title:'Comparison needs review',reason:(result.errors||[]).concat(result.holds||[]).join(' ')||'Confirm comparable source measurements before reviewing change.'};
  if(result.status==='held'&&!(c.treatment==='treated'&&(result.holds||[]).length>0&&(result.holds||[]).every(h=>h==='Prior CXL is outside this model’s intended use.')))return {...out,kind:'review',title:'Comparison needs review',reason:(result.holds||[]).join(' ')||'Resolve the held assessment before reviewing change.'};
  if(c.mode!=='longitudinal')return {...out,kind:'single',title:'A second visit is needed',reason:'One visit describes the eye, but cannot show change between visits.'};
  if(!Number.isInteger(c.interval_days)||c.interval_days<1||!c.first||!c.latest)return {...out,kind:'review',title:'Comparison incomplete',reason:'Two verified visits and their interval are required.'};
  if(['first','latest'].some(v=>c.scan_quality?.[v]==='warning'))return {...out,kind:'review',title:'Scan quality needs review',reason:'A scan has a recorded quality or alignment warning. Domain assessment is withheld until comparable quality measurements are available.'};
  // Missing/invalid components never become a negative vote or a stable result.
  for(const f of S.features){
    const first=c.first[f.key],latest=c.latest[f.key];
    if(!Number.isFinite(first)||!Number.isFinite(latest)||first<f.low||first>f.high||latest<f.low||latest>f.high)return {...out,rows:[],kind:'review',title:'Comparison incomplete',reason:'All six reliable measurements are required at both visits. Missing values are not treated as unchanged.'};
    out.rows.push({...f,first,latest,change:clean(latest-first)});
  }
  out.domains=RULES.map(domain=>{
    const components=domain.components.map(rule=>{const row=out.rows.find(r=>r.key===rule.key);return {...row,...rule,crossed:crossed(row.first,row.latest,rule),percentDecrease:rule.percent?100*(row.first-row.latest)/row.first:null};});
    return {key:domain.key,name:domain.name,components,crossed:components.some(r=>r.crossed)};
  });
  out.crossed=out.domains.filter(d=>d.crossed).length;
  out.structuralCrossed=out.domains.slice(0,3).filter(d=>d.crossed).length;
  out.criterionMet=out.crossed>=2;
  out.kind='thresholds';
  out.title=out.criterionMet?'Multiple domains cross thresholds':out.crossed===1?'One domain crosses its threshold':'No domain thresholds crossed';
  out.reason=out.criterionMet?'The numerical SOURCE criterion (at least 2 of 4 domains) is met. Review comparison eligibility below.':'The numerical SOURCE criterion (at least 2 of 4 domains) is not met. This does not establish stability.';
  out.intervalDays=c.interval_days;
  out.scope=[];
  if(!Number.isFinite(c.age)||c.age<18||c.age>50)out.scope.push('Baseline age is outside the SOURCE study range of 18–50 years.');
  // Six calendar months span 181–184 days. The calculator retains interval
  // days, not examination dates. Do not substitute a false 180/183-day rule.
  if(c.interval_days<181)out.scope.push('The '+c.interval_days+'-day interval is shorter than the SOURCE minimum of six months.');
  else if(c.interval_days<184)out.scope.push('Check the examination dates: '+c.interval_days+' days alone cannot establish six calendar months.');
  if(!['first','latest'].every(v=>c.scan_quality?.[v]==='ok'))out.scope.push('Acceptable scan quality has not been established for both visits.');
  if(c.treatment==='treated')out.scope.push('Prior or interval corneal treatment is recorded; this comparison is outside the pretreatment SOURCE protocol.');
  else if(c.treatment!=='untreated')out.scope.push('The absence of CXL or other corneal procedures before and between these visits has not been established.');
  out.scopeTitle=out.scope.length?'SOURCE classification not assigned':'Recorded comparison requirements met';
  out.scopeNote=out.scope.length?'Threshold crossings are shown, but the study classification cannot be assigned from this comparison.':'Age, interval, quality and recorded treatment status fit the comparison requirements. Full study eligibility and clinical progression still require review.';
  out.conflicts=[];
  const a=out.rows.find(r=>r.key==='A'),k=out.rows.find(r=>r.key==='Kmax');
  if((a.change<0)!==(k.change>0)&&(a.change<0||k.change>0))out.conflicts.push('ARC and Kmax do not show the same worsening direction. Anterior curvature can cross its threshold through either measurement; this disagreement remains relevant.');
  return out;
}

function changeLabel(r){return signed(r.change,r.key==='A'||r.key==='B'?3:r.decimals)+' '+(r.unit||'units')+(r.percent?' ('+Math.abs(r.percentDecrease).toFixed(2)+'% '+(r.percentDecrease>0?'thinner':r.percentDecrease<0?'thicker':'change')+')':'');}
function render(out){
  const eye=out.eye==='OD'?'OD · Right eye':'OS · Left eye';
  const header='<div class="progression-eye-heading"><h3>'+eye+'</h3>'+(out.demo?'<span class="badge">SYNTHETIC EXAMPLE</span>':'')+'</div>';
  const status='<div class="progression-status">'+E(out.title)+'</div><p class="progression-reason">'+E(out.reason)+'</p>';
  if(!out.domains.length)return '<article class="progression-eye" data-progression-eye="'+E(out.eye)+'">'+header+status+'</article>';
  const domains=out.domains.map(d=>'<section class="progression-domain"><div class="progression-domain-title"><b>'+E(d.name)+'</b><span class="progression-domain-status '+(d.crossed?'crossed':'not-crossed')+'">'+(d.crossed?'Threshold crossed':'Not crossed')+'</span></div>'+d.components.map(r=>'<div class="progression-component"><span>'+E(r.label)+'</span><strong>'+E(changeLabel(r))+'</strong><small>'+E(r.rule)+(d.components.length>1?' · OR rule':'')+'</small><span class="progression-component-result">'+(r.crossed?'Crossed':'Not crossed')+'</span></div>').join('')+'</section>').join('');
  const rows=out.rows.map(r=>'<tr><th scope="row">'+E(r.label)+'<small>'+E(r.unit||'units')+'</small></th><td>'+fmt(r.first,r.decimals)+'</td><td>'+fmt(r.latest,r.decimals)+'</td><td>'+signed(r.change,r.key==='A'||r.key==='B'?3:r.decimals)+'</td></tr>').join('');
  const tally=out.domains.map(d=>'<span class="'+(d.crossed?'is-crossed':'')+'" title="'+E(d.name+': '+(d.crossed?'crossed':'not crossed'))+'"></span>').join('');
  return '<article class="progression-eye" data-progression-eye="'+E(out.eye)+'">'+header+status+
    '<div class="progression-count"><b>'+out.crossed+'<span> / 4</span></b><span>domains crossing their prespecified thresholds</span></div><div class="progression-tally" aria-hidden="true">'+tally+'</div>'+domains+
    '<p class="progression-meta">2 selected visits · '+out.intervalDays+' days · Latest minus baseline</p>'+
    '<div class="progression-evidence"><b>'+E(out.scopeTitle)+'</b><span>'+E(out.scopeNote)+'</span>'+(out.scope.length?'<ul>'+out.scope.map(t=>'<li>'+E(t)+'</li>').join('')+'</ul>':'')+'</div>'+
    out.conflicts.map(t=>'<p class="progression-caution">'+E(t)+'</p>').join('')+
    '<details class="progression-values"><summary>Measurements, structural check &amp; SOURCE rules</summary><div class="progression-structural"><b>'+out.structuralCrossed+' / 3 structural domains cross thresholds</b><p>Sensitivity check: '+(out.structuralCrossed>=2?'the ≥2-of-3 structural criterion is met.':'the ≥2-of-3 structural criterion is not met.')+' This uses anterior curvature (ARC or Kmax), posterior curvature and pachymetry (thickness or ARTmax). BAD-D is excluded because it overlaps these measurements.</p></div><div class="table-wrap"><table><caption class="sr-only">'+eye+' baseline and latest measurements</caption><thead><tr><th>Measurement</th><th>Baseline</th><th>Latest</th><th>Change</th></tr></thead><tbody>'+rows+'</tbody></table></div><p>Thickness decrease = 100 × (baseline − latest) / baseline. Each domain contributes at most one point. Strict greater-than thresholds are applied to the entered values before display rounding. A value exactly at the threshold does not cross it. Raw radii are used, not ABCD stage scores.</p><p>SOURCE P0175 resubmission, pages 3–4: the research endpoint requires ≥2 of 4 domains in an eligible comparison. The 0–1 domain result means the threshold criterion is not met; missing or unreliable values are indeterminate, not stable.</p><p>Study comparisons require baseline age 18–50, acceptable same-eye pretreatment scans at least six calendar months apart, and all six verified measurements. Prior corneal procedures, scans across treatment, documented scarring >1 mm and other protocol exclusions need source-record review. Scarring, contact-lens washout and full study enrollment eligibility are not assessed here. Missing information is not evidence of absence.</p><p>Prespecified research criteria, not a validated diagnosis, progression probability or CXL recommendation. The thresholds have not been validated here for post-CXL monitoring. Neither age nor interval adds domain points. This panel does not change NKPI or its PDF/JSON exports.</p></details></article>';
}
const api={summarize,render};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NKPIProgression=api;
})(typeof window!=='undefined'?window:globalThis);
