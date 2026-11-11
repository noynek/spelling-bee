'use client';
import {useState} from 'react';
import {word,type Word} from '../lib/core';
import {parsePaste,wordWarnings,type Separator} from '../lib/paste';
export default function PasteWords({entries,existing,onChange,onError}:{entries:Word[];existing:Word[];onChange:(entries:Word[])=>void;onError:(error:string|undefined)=>void}){
  const [source,setSource]=useState('');
  const [separator,setSeparator]=useState<Separator>('lines');
  const [markers,setMarkers]=useState(true);
  function parse(text:string,format:Separator,strip:boolean){
    const {words,error}=parsePaste(text,format,strip);
    onChange(words.map(word));onError(error);
  }
  const warnings=wordWarnings([...existing,...entries].map(w=>w.spelling)).slice(existing.length);
  const duplicates=warnings.filter(w=>w.includes('Duplicate')).length;
  const suspicious=warnings.filter(w=>w.some(message=>message!=='Duplicate')).length;
  return <section className="paste-panel" aria-labelledby="paste-heading">
    <span className="eyebrow">START HERE</span><h2 id="paste-heading">Paste a word list</h2>
    <p className="muted">Copy words from a school email, document, or notes. Review them below, then save.</p>
    <label>Words to paste<textarea className="paste-input" rows={7} value={source} autoCapitalize="off" autoCorrect="off" spellCheck={false}
      placeholder={'Paste your words here…\n\n1. garden\n2. kitten\n3. rainbow'}
      onChange={e=>{setSource(e.target.value);parse(e.target.value,separator,markers);}}/></label>
    <div className="paste-options"><label>Separate words by<select value={separator} onChange={e=>{const value=e.target.value as Separator;setSeparator(value);parse(source,value,markers);}}>
      <option value="lines">New lines (default)</option><option value="commas">Commas and new lines</option></select></label>
      <label className="check"><input type="checkbox" checked={markers} onChange={e=>{setMarkers(e.target.checked);parse(source,separator,e.target.checked);}}/>Remove list numbers and bullets</label>
    </div>
    {separator==='lines'&&source.includes(',')&&<p className="format-tip">Comma-separated list? Choose “Commas and new lines” above. Spaces and punctuation are kept as part of each word.</p>}
    {entries.length>0&&<><div className="preview-summary" role="status"><strong>{entries.length} pasted {entries.length===1?'word':'words'}</strong>
      {duplicates>0&&<span>{duplicates} duplicate {duplicates===1?'entry':'entries'} · kept</span>}
      {suspicious>0&&<span>{suspicious} to check</span>}</div>
      <p className="muted">Edit any spelling below. Duplicates stay unless you choose to merge them.</p>
      <ol className="paste-preview">{entries.map((entry,i)=><li key={entry.id}>
        <div className="preview-entry"><label className="sr-only" htmlFor={'pasted-'+entry.id}>Pasted word {i+1}</label>
        <input id={'pasted-'+entry.id} value={entry.spelling} autoCapitalize="off" autoCorrect="off" spellCheck={false}
          onChange={e=>onChange(entries.map(w=>w.id===entry.id?{...w,spelling:e.target.value}:w))}/>
        <button aria-label={'Remove pasted word '+(i+1)} onClick={()=>onChange(entries.filter(w=>w.id!==entry.id))}>×</button></div>
        {warnings[i].length>0&&<small className="word-warning">{warnings[i].join(' · ')}</small>}
      </li>)}</ol>
      <p className="muted">Changing the source text or format refreshes this preview.</p>
    </>}
  </section>;
}
