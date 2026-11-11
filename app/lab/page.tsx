'use client';
import {useState} from 'react';
import {scoreSpeech} from '../../lib/letters';

type Row={provider:string; transcript?:string; letters?:string|null; latencyMs:number; error?:string; score?:ReturnType<typeof scoreSpeech>};
export default function Lab(){
  const [token,setToken]=useState('');
  const [spoken,setSpoken]=useState('');
  const [accepted,setAccepted]=useState('');
  const [file,setFile]=useState<File>();
  const [runs,setRuns]=useState<Row[][]>([]);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  const rows=runs.flat();
  const providers=[...new Set(rows.map(r=>r.provider))];
  const pct=(n:number,d:number)=>d?`${(100*n/d).toFixed(1)}%`:'—';
  return <main className="shell"><a href="/">← Practice studio</a><h1>Speech lab</h1>
  <p>Send the same recording to each configured provider. Enter the letters actually spoken, including any mistakes. Reference answers stay in this browser and are used only for scoring.</p>
  <form className="card" onSubmit={async e=>{
    e.preventDefault();if(!file||busy)return;setBusy(true);setStatus('Comparing configured providers…');
    try{
      const response=await fetch('/api/transcribe',{method:'POST',headers:{'Content-Type':file.type,'X-Speech-Lab':token},body:file});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error);
      const variants=accepted.split(/\r?\n/).filter(Boolean);
      setRuns(history=>[...history,data.results.map((row:Row)=>({...row,score:row.error?undefined:scoreSpeech(spoken,row.letters??null,variants)}))]);setStatus('Comparison complete.');
    }catch(e){setStatus(e instanceof Error?e.message:'Comparison failed.');}finally{setBusy(false);}
  }}>
    <label>Lab token<input type="password" autoComplete="off" required value={token} onChange={e=>setToken(e.target.value)}/></label>
    <label>Recording<input type="file" accept="audio/*" required onChange={e=>setFile(e.target.files?.[0])}/></label>
    <label>Actual letter sequence<input required value={spoken} maxLength={512} onChange={e=>setSpoken(e.target.value)}/></label>
    <label>Accepted spellings, one per line<textarea required value={accepted} onChange={e=>setAccepted(e.target.value)}/></label>
    <p className="muted">Audio is sent to every configured provider. Use recordings you have permission to share.</p>
    <button className="primary" disabled={busy}>Compare providers</button>
  </form>{status&&<p role="status">{status}</p>}
  {providers.map(provider=>{
    const all=rows.filter(r=>r.provider===provider), scored=all.filter(r=>r.score);
    return <section className="card" key={provider}><h2>{provider}</h2>
      <p>{all.length} runs · {all.length-scored.length} provider failures · Mean latency {Math.round(all.reduce((sum,r)=>sum+r.latencyMs,0)/all.length)} ms</p>
      <p>Exact sequences: {pct(scored.filter(r=>r.score!.exact).length,scored.length)} · Letter error rate: {pct(scored.reduce((n,r)=>n+r.score!.errors,0),scored.reduce((n,r)=>n+r.score!.letters,0))}</p>
      <p>False accepts: {scored.filter(r=>r.score!.falseAccept).length} · False rejects: {scored.filter(r=>r.score!.falseReject).length} · False grading rate: {pct(scored.filter(r=>r.score!.falseAccept||r.score!.falseReject).length,scored.length)}</p>
      <ul>{all.map((r,i)=><li key={i}>{r.error??`“${r.transcript}” → ${r.letters??'Unparsed'}`} · {r.latencyMs} ms</li>)}</ul>
    </section>;
  })}
  </main>;
}
