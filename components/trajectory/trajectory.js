(()=>{'use strict';
const $=id=>document.getElementById(id),T=window.NKPITrajectory,M=window.NKPIBaselineArtifact,R=window.NKPICohortReference;
const state={eye:'OD',metric:'Kmax',horizon:12,aging:false};let context={session:null,revision:-1,eyes:[]},result=null,lastHeight=0,queued=false;
const fmt=(v,d=1)=>v===null||!Number.isFinite(v)?'—':Number(v).toFixed(d);
const signed=(v,d=1)=>v===null||!Number.isFinite(v)?'—':(Math.abs(v)<.5*10**(-d)?'':v>0?'+':'−')+Math.abs(v).toFixed(d);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function post(type,extra={}){if(window.parent!==window)window.parent.postMessage({type,...extra},window.location.origin);}
function height(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;const h=Math.ceil($('trajectory-app').getBoundingClientRect().height)+4;if(h>0&&h!==lastHeight){lastHeight=h;post('nkpi:trajectory:height',{height:h});}});}
function definition(){return state.metric==='NKPI'?{key:'NKPI',name:'NKPI score scenario',unit:'points / 100',digits:1}:T.fields.find(f=>f.key===state.metric);}
function pointValue(p,key){return state.metric==='NKPI'?p[key+(state.aging?'AgeScore':'Score')].value:p[key][state.metric];}
function drawChart(){
 const f=definition(),svg=$('trajectory-chart'),ready=result?.status==='ready',points=ready?result.points:[];
 const valid=points.flatMap(p=>[pointValue(p,'trend'),pointValue(p,'hold')]).filter(Number.isFinite);
 const visible=ready&&valid.length>0;svg.hidden=!visible;$('chart-empty').hidden=visible;
 if(!visible){svg.innerHTML='';$('empty-reason').textContent=result?.reason||'The selected measurement needs a complete pair. NKPI also needs age and all six values.';return;}
 const width=Math.max(270,Math.round(svg.getBoundingClientRect().width||640)),H=width<410?300:340,L=state.metric==='NKPI'?39:48,E=17,top=33,bottom=43;
 let lo=Math.min(...valid),hi=Math.max(...valid),span=Math.max(hi-lo,f.key==='C'?5:f.key==='Kmax'?0.5:f.key==='A'||f.key==='B'?0.05:1);
 if(state.metric==='NKPI'){lo=0;hi=100;}else{const mid=(hi+lo)/2;lo=mid-span*.65;hi=mid+span*.65;}
 const x=m=>L+m/24*(width-L-E),y=v=>top+(hi-v)/(hi-lo)*(H-top-bottom);
 const path=key=>{let started=false;return points.map(p=>{const v=pointValue(p,key);if(!Number.isFinite(v)){started=false;return '';}const cmd=started?'L':'M';started=true;return cmd+x(p.month).toFixed(2)+','+y(v).toFixed(2);}).join(' ');};
 let s='<title>'+esc(f.name)+' conditional scenarios</title><desc>Two assumptions from the latest value: continuation of the observed rate and unchanged measurements. Not CXL outcomes.</desc><text x="'+L+'" y="15" font-size="10">'+esc(f.unit||f.name)+'</text>';
 for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;s+='<line x1="'+L+'" x2="'+(width-E)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#e7e3ee"/><text x="'+(L-9)+'" y="'+(y(v)+4)+'" text-anchor="end">'+fmt(v,state.metric==='NKPI'?0:f.digits)+'</text>';}
 s+='<path data-line="hold" d="'+path('hold')+'" fill="none" stroke="#8b6aba" stroke-width="2" stroke-dasharray="3 4"/><path data-line="trend" d="'+path('trend')+'" fill="none" stroke="#207f89" stroke-width="3" stroke-dasharray="7 4" stroke-linejoin="round"/>';
 s+='<line x1="'+x(state.horizon)+'" x2="'+x(state.horizon)+'" y1="'+top+'" y2="'+(H-bottom)+'" stroke="#beaccf" stroke-dasharray="3 4"/>';
 for(const p of points){s+='<text x="'+x(p.month)+'" y="'+(H-25)+'" text-anchor="middle">'+(p.month||'Latest')+'</text>';for(const [key,color]of [['hold','#8b6aba'],['trend','#207f89']]){const v=pointValue(p,key);if(Number.isFinite(v))s+='<circle cx="'+x(p.month)+'" cy="'+y(v)+'" r="'+(p.month===state.horizon?5:3)+'" fill="'+color+'" stroke="white" stroke-width="1.5"/>';}}
 s+='<text x="'+(L+(width-L-E)/2)+'" y="'+(H-5)+'" text-anchor="middle" font-size="10">Months after latest visit</text>';
 svg.setAttribute('viewBox','0 0 '+width+' '+H);svg.setAttribute('font-family','Arial, sans-serif');svg.setAttribute('font-size','11');svg.setAttribute('fill','#706d82');svg.innerHTML=s;
}
function render(){
 const c=context.eyes.find(c=>c.eye===state.eye);result=T.calculate(c,M);const f=definition(),paired=c?.mode==='longitudinal',p=result.points.find(p=>p.month===state.horizon),r=result.rows.find(r=>r.key===state.metric);
 for(const b of document.querySelectorAll('[data-eye]')){b.disabled=!context.eyes.some(c=>c.eye===b.dataset.eye);b.setAttribute('aria-pressed',String(b.dataset.eye===state.eye));}
 for(const b of document.querySelectorAll('[data-horizon]'))b.setAttribute('aria-pressed',String(Number(b.dataset.horizon)===state.horizon));
 $('metric-select').value=state.metric;$('age-sensitivity').checked=state.aging;$('age-sensitivity').disabled=result.status!=='ready'||result.currentAge===null;
 $('eye-title').textContent=(state.eye==='OD'?'Right eye · OD':'Left eye · OS')+' · Visit trajectory';
 $('context-label').textContent=c?(paired?c.interval_days+' days between visits':'Single visit')+' · '+(c.imported?'Imported measurements':'Entered measurements'):'Enter or import measurements above.';
 $('provenance').textContent=c?.demo?'SYNTHETIC CALCULATOR INPUT':c?.verified?'SOURCE VERIFIED':'CHECK SOURCE';
 $('context-banner').textContent=(c?.demo?'SYNTHETIC INPUTS · ':'')+(result.status==='ready'?'Scenarios are calculated from this eye’s verified visit pair. '+result.notes.join(' '):result.reason||'No available data.');
 $('chart-title').textContent=f.name;$('horizon-label').textContent='AT '+state.horizon+' MONTHS · CONDITIONAL';
 const projected=p?pointValue(p,'trend'):null,current=state.metric==='NKPI'?result.currentScore?.value:r?.latest;
 $('projected-value').textContent=fmt(projected,f.digits);$('projected-unit').textContent=f.unit;
 $('latest-value').textContent=fmt(current,f.digits);$('observed-rate').textContent=state.metric==='NKPI'?'Six input rates':r?.rate!==null&&r? signed(r.rate,f.digits)+(f.unit?' '+f.unit:''):'—';
 $('projected-change').textContent=projected!==null&&Number.isFinite(projected)&&Number.isFinite(current)?signed(projected-current,f.digits)+' '+(f.unit||'units')+' from the latest value':'Projection unavailable for the selected inputs.';
 const ref=R.rates[state.metric],refEligible=c&&c.age>=R.age_range[0]&&c.age<=R.age_range[1]&&result.years>=90/365.2425&&result.years<=5;
 $('cohort-median').textContent=ref&&refEligible?'Median '+signed(ref.median,f.digits)+' '+f.unit+' / year':state.metric==='NKPI'?'Frozen single-visit classifier':'Outside reference eligibility';
 $('cohort-range').textContent=ref&&refEligible?'Middle 50%: '+signed(ref.p25,f.digits)+' to '+signed(ref.p75,f.digits)+' · '+R.eyes+' eyes / '+R.patients+' patients':state.metric==='NKPI'?'301 development eyes · CXL-associated score, not future risk':'Reference uses baseline age 18–50 and intervals of 90 days to 5 years.';
 $('chart-caption').textContent=state.metric==='NKPI'?'Score scenarios use the frozen single-visit model. '+(state.aging?'Age is advanced as an association sensitivity only.':'Age is held at the latest-visit age to isolate measurement changes.')+' This can differ from the two-visit NKPI score above.':'The plotted segment is entirely future-facing. Dots at 6, 12 and 24 months are calculated scenarios; only the starting point is observed.';
 let warning=result.status==='ready'?'No treatment-effect or confidence band is implied.':result.reason;
 if(p?.extensionFactor>1)warning='This projects '+p.extensionFactor.toFixed(1)+'× the observed interval. Continuation of the measured rate has not been validated. '+warning;
 if(p?.unavailable.length)warning+=' Outside input bounds: '+p.unavailable.join(', ')+'.';
 if(p&&state.metric==='NKPI'){const score=p['trend'+(state.aging?'AgeScore':'Score')];if(score.reason)warning+=' '+score.reason+'.';}
 $('projection-warning').textContent=warning;
 $('age-title').textContent='Age '+fmt(result.currentAge,1)+' at latest → '+fmt(p?.age,1)+' at '+state.horizon+' months';
 $('age-description').textContent='Future age = age at first scan + observed interval + projection horizon. Measurements are never made to improve automatically with age.';
 const fixed=p?.trendScore.value,advanced=p?.trendAgeScore.value;
 $('age-effect').textContent=Number.isFinite(fixed)&&Number.isFinite(advanced)?'Age association alone changes the projected index by '+signed(advanced-fixed,1)+' points at this horizon. This is not proof of biological slowing.':'Age-score sensitivity requires all six projected values within the model’s development ranges.';
 $('value-head').innerHTML='<tr><th>Measurement</th><th>Baseline</th><th>Latest</th><th>Change / yr</th><th>6 mo*</th><th>12 mo*</th><th>24 mo*</th></tr>';
 $('value-rows').innerHTML=result.rows.map(v=>'<tr><td><b>'+esc(v.key==='C'?'Thickness':v.key.replace('_','-'))+'</b><small>'+esc(v.unit)+'</small></td><td>'+fmt(v.first,v.digits)+'</td><td>'+fmt(v.latest,v.digits)+'</td><td>'+signed(v.rate,v.digits)+'</td>'+[6,12,24].map(m=>'<td>'+fmt(result.points.find(p=>p.month===m)?.trend[v.key],v.digits)+'</td>').join('')+'</tr>').join('');
 $('table-subtitle').textContent='*If each observed measurement rate continues. Values at baseline/latest are observed; future columns are calculated.';
 $('validation-rows').innerHTML=R.validation.metrics.map(v=>{const f=T.fields.find(f=>f.key===v.feature);return '<tr><td>'+esc(v.feature)+'</td><td>'+fmt(v.selected_model_MAE,f.digits+1)+' '+esc(f.unit)+'</td><td>'+fmt(v.persistence_MAE,f.digits+1)+' '+esc(f.unit)+'</td></tr>';}).join('');
 $('download-scenarios').disabled=result.status!=='ready';drawChart();height();
}
for(const b of document.querySelectorAll('[data-eye]'))b.addEventListener('click',()=>{if(b.disabled)return;state.eye=b.dataset.eye;state.aging=false;render();});
for(const b of document.querySelectorAll('[data-horizon]'))b.addEventListener('click',()=>{state.horizon=Number(b.dataset.horizon);render();});
$('metric-select').addEventListener('change',e=>{if(!['NKPI',...T.fields.map(f=>f.key)].includes(e.target.value))return;state.metric=e.target.value;render();});
$('age-sensitivity').addEventListener('change',e=>{state.aging=e.target.checked;if(state.aging)state.metric='NKPI';render();});
$('download-scenarios').addEventListener('click',()=>{if(result?.status!=='ready')return;const data={kind:'conditional_scenarios_not_clinical_predictions',interface_version:'7.1.0',eye:result.c.eye,synthetic_inputs:result.c.demo,inputs:{age_first:result.c.age,interval_days:result.c.interval_days,first:result.c.first,latest:result.c.latest,verified:result.c.verified,treatment_history:result.c.treatment,scan_quality:result.c.scan_quality},assumptions:{trend:'linear continuation of each observed rate',reference:'measurements unchanged, not a CXL outcome',score:'frozen single-visit NKPI; source CXL-associated endpoint, not future risk',age_sensitivity_selected:state.aging,confidence_intervals:'not estimated'},points:result.points,notes:result.notes};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='NKPI_'+result.c.eye+'_conditional_scenarios.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
window.addEventListener('message',e=>{if(e.source!==window.parent||e.origin!==window.location.origin||e.data?.type!=='nkpi:trajectory:context')return;try{const next=T.cleanContext(e.data);if(next.session===context.session&&next.revision<context.revision)return;const changed=next.session!==context.session||next.revision!==context.revision;context=next;if(changed)state.aging=false;if(!context.eyes.some(c=>c.eye===state.eye))state.eye=context.eyes[0]?.eye||'OD';}catch(_){context={session:null,revision:-1,eyes:[]};state.aging=false;}render();});
window.addEventListener('resize',()=>{drawChart();height();});new ResizeObserver(height).observe($('trajectory-app'));render();post('nkpi:trajectory:ready');
})();
