'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../components/extractor');
const ctx={Date,console,document:{addEventListener(){}},addEventListener(){},NKPIImport:require(root+'/numeric_import.js')};ctx.window=ctx;vm.createContext(ctx);
for(const name of ['app.js','extraction_integrity.js'])vm.runInContext(fs.readFileSync(root+'/'+name,'utf8'),ctx,{filename:name});
const same={dateMatched:true,fieldReadings:{ARTmax:[296,296]}};
let rows=ctx.sourceEvidence('ARTmax',{labeledPanelARTmax:236,exactBoxARTmax:236,progressionTable:296},same);
let d=ctx.integrityDecision('ARTmax',236,rows,296);
assert.equal(d.autoConfirmed,false);assert.equal(d.statusLabel,'Conflict');assert(d.derivedConflict);
// Multiple transforms of the identical printed field count once.
rows=ctx.sourceEvidence('ARTmax',{labeledPanelARTmax:236,exactBoxARTmax:236},{});
d=ctx.integrityDecision('ARTmax',236,rows);assert.equal(d.autoConfirmed,false);assert.equal(d.independentSources.length,1);
// A single/derived value is retained, never silently declared verified.
d=ctx.integrityDecision('ARTmax',296,[],296);assert.equal(d.autoConfirmed,false);
// Matching direct report cells agree; derived conflict overrides that agreement.
rows=ctx.sourceEvidence('ARTmax',{labeledPanelARTmax:296,exactBoxARTmax:296,progressionTable:296},same);
assert.equal(ctx.integrityDecision('ARTmax',296,rows,296).autoConfirmed,true);
assert.equal(ctx.integrityDecision('ARTmax',296,rows,236).autoConfirmed,false);
// Full-row/cell disagreements cannot be erased by overwriting the selected read.
rows=ctx.sourceEvidence('ARTmax',{labeledPanelARTmax:236,progressionTable:236},{dateMatched:true,fieldReadings:{ARTmax:[296,236]}});
assert.equal(ctx.integrityDecision('ARTmax',236,rows).autoConfirmed,false);
// Even a smaller digit error exceeds printed precision, not broad clinical tolerance.
assert.equal(ctx.integrityDecision('ARTmax',296,[{family:'A',value:296},{family:'B',value:298}]).autoConfirmed,false);
for(const key of ['A','B','C','Kmax','BAD_D']) {
 const v={A:7.57,B:6.16,C:471,Kmax:45.3,BAD_D:2.31}[key];
 assert.equal(ctx.integrityDecision(key,v,[{family:'A',value:v},{family:'A',value:v}]).autoConfirmed,false);
 assert.equal(ctx.integrityDecision(key,v,[{family:'A',value:v},{family:'B',value:v}]).autoConfirmed,true);
 assert.equal(ctx.integrityDecision(key,v,[{family:'A',value:v},{family:'B',value:v+1}]).autoConfirmed,false);
}
const date=new Date(2026,5,19,11,52,28);
assert.equal(ctx.matchedProgressionDateIndex([new Date(2026,2,31),date],date),1);
assert.equal(ctx.matchedProgressionDateIndex([new Date(2026,5,18)],date),null);
assert.equal(ctx.matchedProgressionDateIndex([new Date(2026,5,19,10),new Date(2026,5,19,12)],date),null);
assert.equal(ctx.matchedProgressionDateIndex([date,date],date),null);
assert.equal(ctx.matchedProgressionDateIndex([date],null),null);
assert.equal(ctx.matchedProgressionDateIndex([null],date),null);
// Severe readings previously rejected by extraction bounds.
for(const [key,value] of [['ARTmax',30],['ARTmax',29],['PPImax',10.66],['BAD_D',21.25],['C',239]])assert(ctx.plausible(key,value));
assert.equal(ctx.parseProgressionIndexMax('ARTmax: 296\nMax: 1.60'),1.6);
assert.equal(ctx.parseProgressionIndexMax('ARTmax: 296'),null);
assert.equal(ctx.parsePanelValue('ARTmax: | 340',/ART\s*MAX/i,'ARTmax'),340);
assert.equal(ctx.parsePanelValue('ARTmax: | 359',/ART\s*MAX/i,'ARTmax'),359);
assert.equal(ctx.parsePanelValue('ARTmax: |',/ART\s*MAX/i,'ARTmax'),null);
assert.equal(ctx.parseLabeledNumericLine('Min: 0.83 Max: | 1.56',[/\bMax\s*:/i],'PPImax'),1.56);
assert.equal(ctx.chooseCandidate([{text:'296',confidence:85},{text:'296',confidence:80},{text:'236',confidence:99}],'ARTmax').value,296);
const estimated=ctx.selectArtmaxStandard({printedARTmax:2,printedSource:'isolated OCR',progressionARTmax:null,calculatedARTmax:27,calculationConfidence:'candidate',printedReliable:false});
assert.equal(estimated.value,27);assert.equal(estimated.derived,true);
assert.equal(ctx.integrityDecision('ARTmax',27,[{family:'Belin ARTmax',value:2}],27).autoConfirmed,false);
const noGuess=ctx.selectArtmaxStandard({printedARTmax:null,progressionARTmax:null,calculatedARTmax:null,calculationConfidence:'none'});
assert.equal(noGuess.value,null);
const printed=ctx.selectArtmaxStandard({printedARTmax:359,printedSource:'labeled report',progressionARTmax:399,calculatedARTmax:132,calculationConfidence:'single'});
assert.equal(printed.value,359);assert.equal(printed.derived,false);
const ppi=ctx.directSourceConsensus('PPImax',[{name:'Belin labeled panel',value:1.47,weight:8},{name:'labeled Max row',value:4,weight:6}]);
assert.equal(ppi.value,1.47);

console.log('PASS extraction integrity: wrong ARTmax blocked; source independence, disagreements, derived checks, date matching, severe ranges, PPI label and repeated literal OCR.');
