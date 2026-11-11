'use client';
import {useEffect,useRef,useState} from 'react';
import {grade,merge,missed,word,type List,type Student,type Word} from '../lib/core';
import {importFile} from '../lib/imports';
import Speech from './speech';
import PasteWords from './paste-words';
import {wordWarnings} from '../lib/paste';
import {Pronunciation} from '../lib/pronunciation';
import {CloudPronunciation} from '../lib/cloud-pronunciation';

type Store={lists:List[];students:Student[];active:string};
const starter:Store={lists:[{id:'starter',name:'First flight',words:[
  {id:'garden',spelling:'garden',alternatives:[],definition:'A place where flowers, fruit, or vegetables are grown.'},
  {id:'kitten',spelling:'kitten',alternatives:[],definition:'A young cat.'},
  {id:'rainbow',spelling:'rainbow',alternatives:[],definition:'An arc of colors sometimes seen after rain.'},
  {id:'yellow',spelling:'yellow',alternatives:[],definition:'The color of a ripe lemon.'},
]}],students:[{id:'default',name:'Student',attempts:[]}],active:'default'};
const key='spelling-bee:v1';
export default function Page(){
  const [data,setData]=useState(starter);
  const [ready,setReady]=useState(false);
  const [tab,setTab]=useState('Practice');
  const [selected,setSelected]=useState('starter');
  const [mode,setMode]=useState('Sequential');
  const [from,setFrom]=useState('1');
  const [to,setTo]=useState('');
  const [length,setLength]=useState('');
  const [draft,setDraft]=useState<List>();
  const [pastedWords,setPastedWords]=useState<Word[]>([]);
  const [pasteError,setPasteError]=useState<string>();
  const [pasteVersion,setPasteVersion]=useState(0);
  const [profile,setProfile]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [answer,setAnswer]=useState('');
  const [transcript,setTranscript]=useState('');
  const [recordingVersion,setRecordingVersion]=useState(0);
  const [hint,setHint]=useState(false);
  const [speechBusy,setSpeechBusy]=useState(false);
  const uploadId=useRef(0);
  const resultHeading=useRef<HTMLHeadingElement>(null);
  const pronunciation=useRef<Pronunciation|null>(null);
  const [playback,setPlayback]=useState('');
  const cloud=useRef<CloudPronunciation|null>(null);
  const [cloudEnabled,setCloudEnabled]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    const player=new CloudPronunciation(setPlayback);cloud.current=player;
    fetch('/api/pronounce',{signal:controller.signal}).then(r=>r.json()).then(data=>setCloudEnabled(data.provider==='assemblyai')).catch(()=>{});
    return ()=>{controller.abort();player.dispose();cloud.current=null;};
  },[]);
  useEffect(()=>{
    if(!window.speechSynthesis||!window.SpeechSynthesisUtterance)return;
    const player=new Pronunciation(window.speechSynthesis,text=>new SpeechSynthesisUtterance(text),setPlayback);
    pronunciation.current=player;
    return ()=>{player.stop();pronunciation.current=null;};
  },[]);
  useEffect(()=>{
    pronunciation.current?.stop();cloud.current?.stop();setPlayback('');
  },[data.active,tab]);
  useEffect(()=>{
    try {
      const saved=localStorage.getItem(key);
      if(saved) {const store=JSON.parse(saved) as Store;setData(store);setSelected(store.lists[0]?.id??'');}
    }catch{setNotice('Saved data could not be read.');}
    setReady(true);
  },[]);
  useEffect(()=>{
    if(ready) try{localStorage.setItem(key,JSON.stringify(data));}catch{setNotice('Local storage is full or unavailable. Changes may not survive a reload.');}
  },[data,ready]);
  const student=data.students.find(s=>s.id===data.active)??data.students[0];
  const session=student.session;
  const entry=session?.words[session.index];
  const result=entry&&session?.result!==undefined?grade(entry,session.result):undefined;
  useEffect(()=>{
    resultHeading.current?.focus();
  },[session?.result,session?.index,student.id,tab]);
  const list=data.lists.find(l=>l.id===selected);
  const misses=missed(student.attempts);
  const first=student.attempts.filter(a=>!a.retry);
  const draftWarnings=wordWarnings([...(draft?.words??[]),...pastedWords].map(w=>w.spelling));
  function updateStudent(change:(s:Student)=>Student){
    setData(d=>({...d,students:d.students.map(s=>s.id===student.id?change(s):s)}));
  }
  function resetAnswer(){setAnswer('');setTranscript('');setHint(false);setNotice('');}
  function deviceVoice(w:Word,rate=1){
    if(!pronunciation.current){setPlayback('Pronunciation is unavailable in this browser. Open this page directly in Safari or Chrome.');return;}
    pronunciation.current.speak(w.pronunciation||w.spelling,w.language||'en-US',rate);
  }

  function say(w:Word,rate=1){
    pronunciation.current?.stop();cloud.current?.stop();
    if(cloudEnabled&&cloud.current){
      void cloud.current.speak(w.pronunciation||w.spelling,w.language||'en-US',rate,()=>{
        setNotice('Cloud pronunciation could not play. Trying the device voice; you can also tap Use device voice.');
        deviceVoice(w,rate);
      });
    }else deviceVoice(w,rate);
  }
  function begin(){
    if(!list)return;
    let words=list.words.slice(Number(from||1)-1,to?Number(to):undefined);
    if(mode==='Missed words') words=words.filter(w=>misses.has(w.id));
    if(mode==='Random') for(let i=words.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[words[i],words[j]]=[words[j],words[i]];}
    if(length) words=words.slice(0,Number(length));
    if(!words.length){setNotice('No words match this selection.');return;}
    resetAnswer();
    updateStudent(s=>({...s,session:{name:list.name,words,index:0,retry:false,correct:0}}));
    say(words[0]);
  }
  function submit(spelling:string,spokenResult=false){
    if(!entry||!session||result||!spelling||spelling.length>512)return;
    pronunciation.current?.stop();cloud.current?.stop();setPlayback('');
    const correct=grade(entry,spelling).correct;
    updateStudent(s=>({...s,session:{...session,result:spelling,spokenResult},attempts:[...s.attempts,{wordId:entry.id,spelling:entry.spelling,correct,retry:session.retry,at:Date.now()}]}));
    setHint(false);
  }
  function checkRecording(letters:string){
    setAnswer(letters);
    if(letters)submit(letters,true);
  }
  function correctTranscript(){
    if(!session?.spokenResult||session.result===undefined)return;
    setAnswer(session.result);
    updateStudent(s=>({
      ...s,
      session:{...session,result:undefined,spokenResult:false},
      attempts:s.attempts.slice(0,-1),
    }));
  }
  function next(){
    if(!session||!result)return;
    const index=session.index+1;
    updateStudent(s=>({...s,session:{...session,index,retry:false,result:undefined,spokenResult:false,correct:session.correct+Number(result.correct)}}));
    resetAnswer();
    if(session.words[index])say(session.words[index]);
  }
  function edit(list?:List){
    uploadId.current++;setBusy(false);setPastedWords([]);setPasteError(undefined);setPasteVersion(v=>v+1);setNotice('');
    setDraft(list??{id:crypto.randomUUID(),name:'',words:[]});
  }
  function patchWord(id:string,patch:Partial<Word>){setDraft(d=>d&&({...d,words:d.words.map(w=>w.id===id?{...w,...patch}:w)}));}
  function move(index:number,offset:number){
    setDraft(d=>{
      if(!d)return d;
      const words=[...d.words],other=index+offset;
      [words[index],words[other]]=[words[other],words[index]];
      return {...d,words};
    });
  }
  function save(practice=false){
    const words=[...(draft?.words??[]),...pastedWords];
    if(pasteError){setNotice(pasteError);return;}
    if(!draft||!draft.name.trim()||!words.length||words.some(w=>!w.spelling.trim()||w.spelling.length>512||w.alternatives.some(a=>a.length>512))) {
      setNotice('Enter a list name and at least one word. Spellings must be 1–512 characters.');return;
    }
    if(practice&&session&&!confirm('Replace your current round with this list? Recorded attempts will be kept.'))return;
    const saved={...draft,name:draft.name.trim(),words};
    setData(d=>({...d,lists:d.lists.some(l=>l.id===saved.id)?d.lists.map(l=>l.id===saved.id?saved:l):[...d.lists,saved]}));
    setDraft(undefined);setPastedWords([]);setPasteError(undefined);setSelected(saved.id);
    setFrom('1');setTo('');setLength('');
    if(practice){
      resetAnswer();setMode('Sequential');setTab('Practice');
      updateStudent(s=>({...s,session:{name:saved.name,words:saved.words,index:0,retry:false,correct:0}}));
    }else setNotice('Word list saved.');
  }
  const transcriptView=<div className="recognizer-output">
    <h2>What the recognizer heard</h2>
    <p className={transcript?'transcript':'muted'} aria-live="polite">
      {transcript || (speechBusy?'Waiting for your recording to finish…':'No transcript yet.')}
    </p>
  </div>;
  return <div className="shell">
    <header><a className="brand" href="./"><span className="mark">✦</span><span>Spelling Bee<small>PRACTICE STUDIO</small></span></a>
      <label className="profile">Student<select aria-label="Active student" value={student.id} onChange={e=>{const active=e.target.value;setData(d=>({...d,active}));resetAnswer();}}>{data.students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    </header>
    <nav aria-label="Main navigation">{['Practice','Word lists','Progress'].map(t=><button key={t} aria-current={tab===t?'page':undefined} onClick={()=>{setTab(t);setNotice('');}}>{t}</button>)}</nav>
    <main>
    {playback&&<p className="notice" role="status">{playback}</p>}
    {!ready?<p>Loading your studio…</p>:<>
    {notice&&<p className="notice" role="status">{notice}</p>}
    {tab==='Practice'&&<>
      {!session?<><div className="hero"><span className="eyebrow">THE PRACTICE STUDIO</span><h1>Ready, set, spell.</h1><p>Listen closely, spell it your way, and get a little better with every round.</p></div>
      <form className="card" onSubmit={e=>{e.preventDefault();begin();}}>
        <h2>Set up a round</h2>
        {data.lists.length?<><div className="grid"><label>Word list<select value={selected} onChange={e=>{setSelected(e.target.value);setFrom('1');setTo('');setLength('');}}>{!list&&<option value="">Choose a list</option>}{data.lists.map(l=><option key={l.id} value={l.id}>{l.name} · {l.words.length} words</option>)}</select></label>
        <label>Order<select value={mode} onChange={e=>setMode(e.target.value)}>{['Sequential','Random','Missed words'].map(m=><option key={m}>{m}</option>)}</select></label></div>
        <details><summary>Choose a range or round length</summary><div className="grid"><label>From word<input type="number" min="1" max={list?.words.length} value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Through word<input type="number" min={from||'1'} max={list?.words.length} placeholder="Last word" value={to} onChange={e=>setTo(e.target.value)}/></label><label>Maximum words<input type="number" min="1" placeholder="All" value={length} onChange={e=>setLength(e.target.value)}/></label></div></details>
        <button className="primary" disabled={!list}>Start practice →</button></>:<button type="button" className="primary" onClick={()=>{edit();setTab('Word lists');}}>Paste a word list</button>}
      </form></>:entry?<div className="card practice">
        <div className="between"><span className="eyebrow">{session.name}</span><button className="quiet" onClick={()=>{if(confirm('End this round? Your recorded attempts will be kept.')){updateStudent(s=>({...s,session:undefined}));resetAnswer();}}}>End round</button></div>
        <progress value={session.index+Number(!!result)} max={session.words.length}/><p className="muted">Word {session.index+1} of {session.words.length}</p>
        {result?<section className={`spelling-result ${result.correct?'correct':'incorrect'}`} aria-labelledby="spelling-outcome">
          <div className="result-heading">
            <span className="result-icon" aria-hidden="true">{result.correct?'✓':'×'}</span>
            <h1 id="spelling-outcome" ref={resultHeading} tabIndex={-1}>{result.correct?'Correct!':'Incorrect'}</h1>
          </div>
          <p className="result-spelling">Correct spelling <strong>{result.expected}</strong></p>
          {!result.correct&&<>
            <p>Your answer <strong>{session.result}</strong></p>
            <ul>{result.changes.map((change,index)=><li key={index}>{change}</li>)}</ul>
          </>}
        </section>:<>
        <h1>Listen and spell</h1><div className="actions"><button className="primary" disabled={speechBusy} onClick={()=>say(entry)}>▶ Hear word</button><button disabled={speechBusy} onClick={()=>say(entry,.65)}>Play slowly</button>{cloudEnabled&&<button disabled={speechBusy} onClick={()=>{cloud.current?.stop();deviceVoice(entry);}}>Use device voice</button>}{(entry.definition||entry.example)&&<button onClick={()=>setHint(!hint)}>{hint?'Hide hint':'Show hint'}</button>}</div>
        {hint&&<div className="hint">{[entry.definition,entry.example].filter(Boolean).map((value,i)=><p key={i}>{[entry.spelling,...entry.alternatives].sort((a,b)=>b.length-a.length).reduce((s,w)=>s.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'giu'),'[…]'),value!)}</p>)}</div>}
        <form onSubmit={e=>{e.preventDefault();if(!speechBusy)submit(answer);}}>
          <Speech key={student.id+':'+entry.id+':'+session.index+':'+recordingVersion}
            transcript={transcript} onTranscript={setTranscript} onLetters={checkRecording}
            onBusy={setSpeechBusy} onStart={()=>{
              pronunciation.current?.stop();cloud.current?.stop();setPlayback('');
              setAnswer('');setTranscript('');
            }}/>
          <div className="spelling-review">
            {transcriptView}
            <label>Your spelling
              <input value={answer} disabled={speechBusy} maxLength={512}
                onChange={e=>setAnswer(e.target.value)} autoComplete="off" autoCapitalize="off"
                autoCorrect="off" spellCheck={false} placeholder="Type your spelling here"/>
            </label>
            {transcript&&<p className="review-note muted">Edit any letters the recognizer misheard before confirming.</p>}
            <div className="actions">
              <button className="primary" disabled={!answer||speechBusy}>Confirm spelling</button>
              {(answer||transcript)&&<button type="button" disabled={speechBusy} onClick={()=>{
                resetAnswer();setRecordingVersion(version=>version+1);
              }}>Clear attempt</button>}
            </div>
          </div>
        </form></>}
        {result&&transcriptView}
        {result&&<div className="actions"><button className="primary" onClick={next}>{session.index+1===session.words.length?'Finish round':'Next word →'}</button>{session.spokenResult&&<button onClick={correctTranscript}>Correct misheard letters</button>}{!result.correct&&<button onClick={()=>{updateStudent(s=>({...s,session:{...session,retry:true,result:undefined,spokenResult:false}}));resetAnswer();say(entry);}}>Try again</button>}</div>}
      </div>:<div className="card"><span className="eyebrow">ROUND COMPLETE</span><h1>Good work, {student.name}!</h1><p>You finished {session.words.length} words. You got {session.correct} correct by the end of the round.</p><button className="primary" onClick={()=>{updateStudent(s=>({...s,session:undefined}));resetAnswer();}}>Start another round</button></div>}
    </>}
    {tab==='Word lists'&&<>
      <div className="between title"><div><span className="eyebrow">YOUR LIBRARY</span><h1>Word lists</h1></div>{!draft&&<button className="primary" onClick={()=>edit()}>Paste a word list</button>}</div>
      {!draft?data.lists.map(l=><article className="card between list" key={l.id}><div><h2>{l.name}</h2><p className="muted">{l.words.length} words</p></div><div className="actions"><button onClick={()=>edit(l)}>Edit</button><button onClick={()=>{if(confirm(`Delete “${l.name}”?`)){setData(d=>({...d,lists:d.lists.filter(x=>x.id!==l.id)}));if(selected===l.id)setSelected(data.lists.find(x=>x.id!==l.id)?.id??'');}}}>Delete</button></div></article>):<section className="card">
        <label>List name<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="e.g. Friday spelling"/></label>
        <PasteWords key={draft.id+':'+pasteVersion} entries={pastedWords} existing={draft.words} onChange={setPastedWords} onError={setPasteError}/>
        {pasteError&&<p role="alert" className="format-tip">{pasteError}</p>}
        <div className="actions editor-save"><button className="primary" disabled={busy||!!pasteError} onClick={()=>save(true)}>Save and practice →</button><button disabled={busy||!!pasteError} onClick={()=>save()}>Save list</button></div>
        <details className="file-import"><summary>Import a file instead</summary>
        <div><label>Import a file<input type="file" accept=".txt,.csv,.tsv,.xlsx,.pdf,.docx,.json,image/*" disabled={busy} onChange={async e=>{
          const file=e.target.files?.[0];e.target.value='';if(!file)return;
          const id=++uploadId.current;setBusy(true);setNotice('Reading file…');
          try{const entries=await importFile(file);if(id!==uploadId.current)return;
            setDraft(d=>d&&({...d,words:[...d.words,...entries]}));
            setNotice(entries.length?`Review ${entries.length} imported entries before saving.`:'No text found. For scanned PDFs, import page images.');
          }catch(error){if(id===uploadId.current)setNotice(error instanceof Error?error.message:'Could not read that file.');}
          finally{if(id===uploadId.current)setBusy(false);}
        }}/></label><p className="muted">TXT, CSV, TSV, XLSX, PDF, DOCX, JSON or photo.</p></div></details>
        <div className="between"><h2>{pastedWords.length?'Existing and imported words':'Review words'} ({draft.words.length})</h2><button disabled={busy||!!pasteError} onClick={()=>{setDraft({...draft,words:merge([...draft.words,...pastedWords])});setPastedWords([]);setPasteError(undefined);setPasteVersion(v=>v+1);}}>Merge duplicates</button></div>
        {draft.words.map((w,i)=><div key={w.id} className="word"><div className="between"><label>Word {i+1}<input aria-label={`Word ${i+1}`} value={w.spelling} maxLength={512} onChange={e=>patchWord(w.id,{spelling:e.target.value})}/></label><div className="actions"><button aria-label={`Move word ${i+1} up`} disabled={!i} onClick={()=>move(i,-1)}>↑</button><button aria-label={`Move word ${i+1} down`} disabled={i===draft.words.length-1} onClick={()=>move(i,1)}>↓</button><button aria-label={`Remove word ${i+1}`} onClick={()=>setDraft({...draft,words:draft.words.filter(x=>x.id!==w.id)})}>×</button></div></div>
        {draftWarnings[i].length>0&&<small className="word-warning">{draftWarnings[i].join(' · ')}</small>}
        <details><summary>Alternatives and word details</summary><div className="grid"><label>Accepted alternatives (one per line)<textarea defaultValue={w.alternatives.join('\n')} onChange={e=>patchWord(w.id,{alternatives:e.target.value.split(/\r?\n/).filter(a=>a.trim())})}/></label>{(['definition','example','pronunciation','language','difficulty','notes'] as const).map(k=><label key={k}>{k==='language'?'Language code (e.g. fr-FR)':k[0].toUpperCase()+k.slice(1)}<input value={w[k]??''} onChange={e=>patchWord(w.id,{[k]:e.target.value})}/></label>)}</div></details></div>)}
        <div className="actions"><button onClick={()=>setDraft({...draft,words:[...draft.words,word('')]})}>+ Add word</button><button onClick={()=>{uploadId.current++;setBusy(false);setDraft(undefined);setNotice('');}}>Cancel</button></div>
      </section>}
    </>}
    {tab==='Progress'&&<><div className="title"><span className="eyebrow">YOUR LEARNING JOURNEY</span><h1>Progress</h1></div><div className="stats">
      <div className="card"><strong>{student.attempts.length}</strong><span>Attempts</span></div><div className="card"><strong>{first.length?Math.round(100*first.filter(a=>a.correct).length/first.length)+'%':'—'}</strong><span>First try accuracy</span></div><div className="card"><strong>{misses.size}</strong><span>Missed words</span></div></div>
      <section className="card"><h2>Recent attempts</h2>{!student.attempts.length?<p className="muted">Finish an attempt to see it here.</p>:<ul className="history">{student.attempts.slice(-30).reverse().map((a,i)=><li key={i}><span>{a.spelling} {a.retry&&<small>· Retry</small>}</span><span>{a.correct?'Correct':'Missed'} · {new Date(a.at).toLocaleDateString()}</span></li>)}</ul>}</section>
      <form className="card" onSubmit={e=>{e.preventDefault();if(!profile.trim())return;const id=crypto.randomUUID();setData(d=>({...d,active:id,students:[...d.students,{id,name:profile.trim(),attempts:[]}]}));setProfile('');resetAnswer();}}><h2>Add a student</h2><label>Display name<input required maxLength={40} value={profile} onChange={e=>setProfile(e.target.value)}/></label><button className="primary">Add student</button></form></>}
    </>}
    </main>
    <footer>✦ &nbsp; Small steps make strong spellers. <span>Lists and progress stay in this browser.</span></footer>
  </div>;
}
