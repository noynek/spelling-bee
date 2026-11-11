import {lines, word, type Word} from './core.ts';
const fields=['definition','example','pronunciation','language','difficulty','notes'] as const;
function structured(value:unknown):Word[] {
  const rows=Array.isArray(value)?value:(value as {words?:unknown}|null)?.words;
  if(!Array.isArray(rows)) throw new Error('Expected an array of words or an object with a words array.');
  return rows.map((row,i)=>{
    if(typeof row==='string'&&row.trim()) return word(row);
    if(!row||typeof row.spelling!=='string'||!row.spelling.trim()) throw new Error(`Row ${i+1} needs a spelling.`);
    const entry=word(row.spelling);
    for(const key of fields) if(typeof row[key]==='string') entry[key]=row[key];
    if(row.alternatives!==undefined) {
      if(!Array.isArray(row.alternatives)||!row.alternatives.every((v:unknown)=>typeof v==='string'&&v.trim())) throw new Error(`Row ${i+1} has invalid alternatives.`);
      entry.alternatives=row.alternatives;
    }
    return entry;
  });
}
function table(rows:unknown[][]) {
  const header=rows[0]?.map(v=>String(v??'').trim().toLowerCase())??[];
  const index=header.findIndex(v=>v==='word'||v==='spelling');
  return structured((index<0?rows:rows.slice(1)).flatMap<unknown>(row=>{
    const spelling=String(row[Math.max(0,index)]??'');
    if(!spelling.trim()) return [];
    if(index<0) return [spelling];
    return [{spelling,...Object.fromEntries(fields.map(key=>[key,row[header.indexOf(key)]])), alternatives:String(row[header.indexOf('alternatives')]??'').split('|').map(v=>v.trim()).filter(Boolean)}];
  }));
}
export async function importFile(file:File):Promise<Word[]> {
  const ext=file.name.split('.').at(-1)?.toLowerCase();
  if(file.size>20*1024*1024) throw new Error('Choose a file under 20 MB.');
  if(ext==='json') return structured(JSON.parse(await file.text()));
  if(ext==='csv'||ext==='tsv') {
    const {default: Papa}=await import('papaparse');
    const parsed=Papa.parse<string[]>((await file.text()).replace(/^\uFEFF/,''),{delimiter:ext==='csv'?',':'\t',skipEmptyLines:'greedy'});
    if(parsed.errors.length) throw new Error(parsed.errors[0].message);
    return table(parsed.data);
  }
  if(ext==='xlsx') {
    const {default: read}=await import('read-excel-file/browser');
    const sheets=await read(file);
    return sheets.flatMap(sheet=>table(sheet.data));
  }
  if(ext==='docx') {
    const mammoth=await import('mammoth');
    return lines((await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value).map(word);
  }
  if(ext==='pdf') {
    const pdf=await import('pdfjs-dist');
    pdf.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
    const task=pdf.getDocument({data:await file.arrayBuffer()});
    try {
      const doc=await task.promise;
      const pages=[];
      for(let n=1;n<=doc.numPages;n++) {
        const p=await doc.getPage(n);
        pages.push((await p.getTextContent()).items.map(item=>'str' in item?item.str+(item.hasEOL?'\n':' '):'').join(''));
      }
      return lines(pages.join('\n')).map(word);
    } finally {await task.destroy();}
  }
  if(file.type.startsWith('image/')||/^(png|jpe?g|webp|bmp)$/.test(ext??'')) {
    const {createWorker}=await import('tesseract.js');
    const worker=await createWorker('eng');
    try {return lines((await worker.recognize(file)).data.text).map(word);}
    finally {await worker.terminate();}
  }
  if(ext==='txt') return lines(await file.text()).map(word);
  throw new Error('Choose a TXT, CSV, TSV, XLSX, PDF, DOCX, JSON, or image file.');
}
