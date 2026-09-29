/* OCR agreement is evidence, never a guarantee. All evidence stays local. */
'use strict';

function matchedProgressionDateIndex(dates, reference) {
  if (!(reference instanceof Date) || !Number.isFinite(reference.getTime())) return null;
  const sameDay = dates.map((date,index)=>({date,index})).filter(({date})=>
    date instanceof Date && date.getFullYear()===reference.getFullYear() &&
    date.getMonth()===reference.getMonth() && date.getDate()===reference.getDate());
  if (sameDay.length===1) return sameDay[0].index;
  // Repeated same-day examinations require an exact printed time match.
  const exact = sameDay.filter(({date})=>date.getHours()===reference.getHours() &&
    date.getMinutes()===reference.getMinutes() && date.getSeconds()===reference.getSeconds());
  return exact.length===1 ? exact[0].index : null;
}

const DIRECT_PRECISION = {A:.0051,B:.0051,C:.51,Kmax:.051,BAD_D:.0051,ARTmax:.51};
function sourceEvidence(variable, sources, progression) {
  const s=sources||{}, rows=[];
  const add=(family,name,value)=>{if(Number.isFinite(value)&&plausible(variable,value)) rows.push({family,name,value});};
  if (['A','B'].includes(variable)) {
    for(const k of ['fullLabeledPanel','labeledRow','exactBox']) add('KC staging',k,s[k]);
    if(progression?.dateMatched) add('Progression display','Progression '+variable,s['progressionRaw'+variable]);
  } else if(variable==='C') {
    add('KC staging','Staging value',s.stagingLabeledPanel);
    add('Topometric pachymetry','Topometric value',s.duplicateTopometricField);
    add('Belin display','Belin value',s.belinPanel);
    if(progression?.dateMatched) add('Progression display','Progression C',s.progressionRawC);
  } else if(variable==='Kmax') {
    add('Topometric','Topometric Kmax',s.topometricField);
    add('Belin display','Belin Kmax',s.belinPanel);
  } else if(variable==='BAD_D') {
    for(const k of ['belinFinalD','exactFinalDBox','dynamicColoredBox','bottomRow']) add('Belin final D',k,s[k]);
  } else if(variable==='ARTmax') {
    for(const k of ['labeledPanelARTmax','exactBoxARTmax','anchoredLabelARTmax']) add('Belin ARTmax',k,s[k]);
  }
  if(['Kmax','BAD_D','ARTmax'].includes(variable)&&progression?.dateMatched) {
    add('Progression display','Progression table',s.progressionTable);
    for(const value of progression.fieldReadings?.[variable]||[]) add('Progression display','Progression row/cell',value);
  }
  return rows;
}

function integrityDecision(variable, final, evidence, derivedCheck=null) {
  const tolerance=DIRECT_PRECISION[variable], finite=Number.isFinite(final);
  const groups=new Set(evidence.filter(e=>finite&&Math.abs(e.value-final)<=tolerance).map(e=>e.family));
  const conflicts=evidence.filter(e=>finite&&Math.abs(e.value-final)>tolerance);
  // C / rounded PPI is approximate and is never a second direct report read.
  const derivedConflict=variable==='ARTmax'&&finite&&Number.isFinite(derivedCheck)&&
    Math.abs(final-derivedCheck)>Math.max(2,Math.abs(final)*.015);
  const agreed=finite&&groups.size>=2&&!conflicts.length&&!derivedConflict;
  return {autoConfirmed:agreed,independentSources:[...groups],evidence,conflicts,
    derivedCheck,derivedConflict,statusLabel:!finite?'Missing':conflicts.length||derivedConflict?'Conflict':agreed?'Reports agree':'Review source',
    reason:!finite?'No readable value.':conflicts.length||derivedConflict?
      'Source readings disagree. Compare the printed values before calculating.':agreed?
      'Distinct printed sources agree. OCR agreement does not establish accuracy.':
      'Only one printed source supports this value; repeated OCR passes are not independent confirmation.'};
}

function enforceExtractionIntegrity(values,audit,progression) {
  for(const variable of NKPIImport.FIELDS) {
    const item=audit[variable]||{},s=item.sources||{};
    const evidence=sourceEvidence(variable,s,progression);
    const decision=integrityDecision(variable,values[variable],evidence,
      variable==='ARTmax'&&s.calculationConfidence!=='none'?s.calculatedFromSelectedPPImax:null);
    // A stronger reading can fill a missing value but conflicts never silently
    // replace the chosen input. The clinician sees both candidates.
    Object.assign(item,decision,{final:values[variable],quality:decision.autoConfirmed?'High':'Review'});
    if(['A','B'].includes(variable)&&!(values.A>values.B)) {item.autoConfirmed=false;item.statusLabel='Review source';}
    audit[variable]=item;
  }
}

// Prefer an unmodified numeric token supported by multiple preprocessing passes.
// Missing-decimal rescue remains available, but can no longer beat a literal
// reading solely through a range-conversion heuristic.
const legacyChooseCandidate=chooseCandidate;
chooseCandidate=function(results,variable,preferredValue=null) {
  const old=legacyChooseCandidate(results,variable,null);
  const counts=new Map();
  results.forEach((read,index)=>{
    for(const {token} of numericTokens(read.text)) {
      const value=Number(token);
      if(!plausible(variable,value)) continue;
      if(!counts.has(value)) counts.set(value,{value,reads:new Set(),confidence:0});
      const candidate=counts.get(value); candidate.reads.add(index);
      candidate.confidence=Math.max(candidate.confidence,Number(read.confidence)||0);
    }
  });
  const literal=[...counts.values()].sort((a,b)=>b.reads.size-a.reads.size||b.confidence-a.confidence);
  if(literal.length&&literal[0].reads.size>=2&&literal[0].confidence>=30) return {...old,value:literal[0].value};
  return old;
};

function ocrLines(blocks) {
  return (blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[]));
}

// Read ARTmax in context, then re-read only its actual printed value. This
// survives moved panels and avoids assuming the lower-right colored box is ART.
async function readAnchoredBelinFields(worker,bitmap) {
  const box=[540,240,920,445],scale=4;
  const base=makeCropCanvas(bitmap,box,scale),read=await recognize(worker,base,{psm:6});
  const output={raw:read,fields:{}};
  const patterns={ARTmax:/ART\s*max\s*:?/i,Kmax:/K\s*max\s*:?/i,PPImax:/\bMax\s*:/i};
  for(const [variable,pattern] of Object.entries(patterns)) {
    const lines=ocrLines(read.blocks).filter(l=>{const t=l.text||l.words?.map(w=>w.text).join(' ')||'';return pattern.test(t)&&(variable!=='PPImax'||!/(ART|K)\s*max/i.test(t));});
    if(lines.length!==1) continue;
    const line=lines[0],text=line.text||line.words.map(w=>w.text).join(' ');
    const label=text.match(pattern);
    const parsed=parseLabeledNumericLine(text,[pattern],variable);
    const words=line.words||[];
    let labelWord=words.find(w=>variable==='ARTmax'?/ART/i.test(w.text):variable==='PPImax'?/^Max/i.test(w.text):/^K/i.test(w.text));
    if(variable==='ARTmax'&&labelWord) {
      const next=words[words.indexOf(labelWord)+1];
      if(next?.bbox&&/^max/i.test(next.text)) labelWord={...labelWord,bbox:{...labelWord.bbox,x1:next.bbox.x1}};
    }
    let result={value:parsed,raw:[read],agreeingReads:0};
    if(labelWord?.bbox&&label) {
      const b=labelWord.bbox;
      const h=Math.max(10,(b.y1-b.y0)/scale),cy=box[1]+(b.y0+b.y1)/2/scale;
      // Include the full text height. Unlike the old fixed box, this region
      // follows the actual label and is not fractionally cropped again.
      const numericWord=words.find(w=>w.bbox&&w.bbox.x0>b.x1&&/\d/.test(w.text));
      const left=box[0]+b.x1/scale+(variable==='Kmax'?20:7);
      const valueBox=numericWord ? [box[0]+numericWord.bbox.x0/scale-2,
        box[1]+numericWord.bbox.y0/scale-2,box[0]+numericWord.bbox.x1/scale+2,
        box[1]+numericWord.bbox.y1/scale+2] : [left,cy-h*.8,left+48,cy+h*.8];
      const direct=await readAnchoredNumber(worker,bitmap,valueBox,variable);
      result={...direct,value:Number.isFinite(parsed)?parsed:direct.value,valueBox};
    }
    output.fields[variable]={...result,labeledValue:parsed};
  }
  return output;
}

async function readAnchoredNumber(worker,bitmap,box,variable) {
  const reads=[];
  // Numeric labels in these reports are small. Several moderate scales avoid
  // relying on one oversampled shape or treating a single glyph as a word.
  for(const scale of [4,7]) {
    const base=makeCropCanvas(bitmap,box,scale),gray=transformChannel(base,'gray',false);
    const variants=[gray,transformChannel(base,'max',false),lowSaturationLightInkCanvas(base),transformChannel(base,'g',false)];
    for(const [index,canvas] of variants.entries()) {
      reads.push(await recognize(worker,padCanvas(canvas,24,255),{psm:scale===4?7:8,whitelist:variable==='ARTmax'?'0123456789':'0123456789.-'}));
    }
  }
  const selected=chooseCandidate(reads,variable),agreeingReads=countAgreeingOcrReads(reads,variable,selected.value);
  const confident=reads.some(r=>r.confidence>=35&&numericTokens(r.text).some(t=>Number(t.token)===selected.value));
  return {...selected,value:agreeingReads>=2||confident?selected.value:null,raw:reads,agreeingReads};
}

const legacyReadBelinPanel=readBelinPanel;
readBelinPanel=async function(worker,bitmap) {
  const panel=await legacyReadBelinPanel(worker,bitmap);
  const anchored=await readAnchoredBelinFields(worker,bitmap);
  panel.anchored=anchored;
  panel.originalParsed={...panel.parsed};
  for(const [key,field] of Object.entries(anchored.fields))
    if(!Number.isFinite(panel.parsed[key])&&Number.isFinite(field.value)) panel.parsed[key]=field.value;
  return panel;
};
