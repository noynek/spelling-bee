import Papa from 'papaparse';
export type Separator='lines'|'commas';
export function parsePaste(source:string,separator:Separator,removeMarkers:boolean){
  const parsed=separator==='commas'?Papa.parse<string[]>(source,{delimiter:',',skipEmptyLines:'greedy'}):null;
  const raw=parsed?parsed.data.flat():source.split(/\r\n?|\n/);
  const words=raw.map(value=>{
    const trimmed=value.trim();
    return removeMarkers?trimmed.replace(/^(?:\d+[.)]|[-*•‣▪])\s+/u,''):trimmed;
  }).filter(Boolean);
  return {words,error:parsed?.errors.length?'Check the quotation marks in your comma-separated list.':undefined};
}
export function wordWarnings(spellings:string[]){
  const counts=new Map<string,number>();
  for(const spelling of spellings)counts.set(spelling,(counts.get(spelling)??0)+1);
  return spellings.map(spelling=>{
    const warnings=[];
    if((counts.get(spelling)??0)>1)warnings.push('Duplicate');
    if(!spelling.trim())warnings.push('Empty word');
    if(spelling.length>512)warnings.push('Over 512 characters');
    if(/[\t,;]|^\d+[.)]\s|^[-*•‣▪]\s/u.test(spelling))warnings.push('Check formatting');
    if(spelling.trim().split(/\s+/u).length>4)warnings.push('Check: long phrase');
    return warnings;
  });
}
