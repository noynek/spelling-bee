'use client';
import {useEffect,useRef,useState} from 'react';

type Stage='idle'|'opening'|'recording'|'sending';
type Props={transcript:string;onTranscript:(text:string)=>void;onLetters:(s:string)=>void;onBusy:(busy:boolean)=>void;onStart:()=>void};
export default function Speech(props:Props){
  const [provider,setProvider]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [status,setStatus]=useState('');
  const [stage,setStage]=useState<Stage>('idle');
  const [seconds,setSeconds]=useState(0);
  const callbacks=useRef(props);callbacks.current=props;
  const recorder=useRef<MediaRecorder|null>(null);
  const stream=useRef<MediaStream|null>(null);
  const operation=useRef<AbortController|null>(null);
  const generation=useRef(0);
  const timer=useRef<ReturnType<typeof setInterval>|undefined>(undefined);
  function stopTracks(){stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;clearInterval(timer.current);}
  function cancel(){
    generation.current++;operation.current?.abort();
    if(recorder.current){recorder.current.onstop=null;if(recorder.current.state!=='inactive')recorder.current.stop();recorder.current=null;}
    stopTracks();setStage('idle');setSeconds(0);setStatus('Recording discarded. You can try again.');
    callbacks.current.onBusy(false);callbacks.current.onLetters('');
  }
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/api/transcribe',{signal:controller.signal}).then(r=>r.json()).then(d=>setProvider(d.provider??null))
      .catch(()=>{if(!controller.signal.aborted)setStatus('Could not check speech availability. Reload to retry.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>{
      controller.abort();generation.current++;operation.current?.abort();clearInterval(timer.current);
      if(recorder.current){recorder.current.onstop=null;if(recorder.current.state!=='inactive')recorder.current.stop();}
      stream.current?.getTracks().forEach(t=>t.stop());callbacks.current.onBusy(false);
    };
  },[]);
  async function record(){
    if(stage!=='idle')return;
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){
      setStatus('Microphone recording needs HTTPS (or localhost) and Safari or Chrome. You can type below.');return;
    }
    const id=++generation.current;
    const controller=new AbortController();operation.current=controller;
    const valid=()=>id===generation.current&&!controller.signal.aborted;
    setStage('opening');setStatus('Allow microphone access to spell aloud.');setSeconds(0);
    callbacks.current.onBusy(true);callbacks.current.onStart();
    try{
      const mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
      if(!valid()){mic.getTracks().forEach(t=>t.stop());return;}
      stream.current=mic;
      const supported=['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
      const current=new MediaRecorder(mic,supported?{mimeType:supported}:undefined);recorder.current=current;
      const chunks:Blob[]=[];let bytes=0,tooLarge=false;
      current.ondataavailable=e=>{
        if(e.data.size){chunks.push(e.data);bytes+=e.data.size;}
        if(bytes>4*1024*1024){tooLarge=true;if(current.state==='recording')current.stop();}
      };
      current.onstop=async ()=>{
        stopTracks();recorder.current=null;
        if(!valid())return;
        setStage('sending');setStatus('Listening back to your letters…');
        try{
          if(tooLarge)throw new Error('Recording is too large. Try a shorter spelling.');
          const blob=new Blob(chunks,{type:current.mimeType||chunks[0]?.type});
          if(!blob.size)throw new Error('No audio was recorded. Try again.');
          const response=await fetch('/api/transcribe',{method:'POST',headers:{'Content-Type':blob.type},body:blob,
            signal:AbortSignal.any([controller.signal,AbortSignal.timeout(70_000)])});
          const data=await response.json(),result=data.results?.[0];
          if(!valid())return;
          if(!response.ok||result?.error)throw new Error(data.error??result?.error??'Could not recognize letters.');
          callbacks.current.onTranscript(result?.transcript??'');
          if(!result?.letters){
            setStatus('Could not confidently identify individual letters. Record again, or type exactly what you spelled below.');return;
          }
          if(result.letters.length>512)throw new Error('That spelling is too long. Record a shorter attempt.');
          callbacks.current.onLetters(result.letters);
          setStatus('');
        }catch(error){
          if(valid())setStatus(error instanceof Error&&error.name==='TimeoutError'?'Recognition timed out. Please try again.':error instanceof Error?error.message:'Could not transcribe audio.');
        }finally{if(valid()){setStage('idle');callbacks.current.onBusy(false);}}
      };
      current.onerror=()=>{
        if(!valid())return;
        current.onstop=null;if(current.state!=='inactive')current.stop();stopTracks();recorder.current=null;
        setStage('idle');callbacks.current.onBusy(false);setStatus('Recording failed. Try again or type your answer.');
      };
      current.start(250);setStage('recording');setStatus('Say each letter separately. Tap Done when you finish.');
      const started=Date.now();
      timer.current=setInterval(()=>{
        const elapsed=Math.floor((Date.now()-started)/1000);setSeconds(elapsed);
        if(elapsed>=45&&current.state==='recording')current.stop();
      },250);
    }catch(error){
      if(valid()){
        stopTracks();
        setStage('idle');callbacks.current.onBusy(false);
        setStatus(error instanceof DOMException&&error.name==='NotAllowedError'
          ?'Microphone access was denied. Allow it in your browser settings, or type your answer.'
          :'Could not access a microphone. Connect one and try again, or type your answer.');
      }
    }
  }
  if(loading)return <p className="muted" role="status">Checking spoken practice…</p>;
  if(!provider)return <div className="speech-panel"><h2>Spell aloud</h2><p className="muted">Recording is unavailable. You can type your spelling below.</p>{status&&<p role="status">{status}</p>}</div>;
  const name=provider==='assemblyai'?'AssemblyAI':provider==='openai'?'OpenAI':'Deepgram';
  return <section className={'speech-panel '+(stage==='recording'?'is-recording':'')} aria-label="Spoken spelling">
    <h2>Spell aloud</h2><p className="muted">Say English letter names one at a time, including every repeated letter.</p>
    <div className="actions">
      <button className={'record-button '+(props.transcript&&stage==='idle'?'':'primary')} type="button" disabled={stage==='opening'||stage==='sending'}
        onClick={()=>stage==='recording'?recorder.current?.stop():void record()}>
        {stage==='recording'?'■ Finish recording':stage==='sending'?'Recognizing…':stage==='opening'?'Opening microphone…':props.transcript?'Record again':'● Record my spelling'}
      </button>
      {stage!=='idle'&&<button type="button" onClick={cancel}>{stage==='sending'?'Cancel recognition':'Cancel'}</button>}
      {stage==='recording'&&<span className="recording-time" role="timer">{seconds}s / 45s</span>}
    </div>
    {status&&<p role="status">{status}</p>}
    <p className="privacy-note">Recording sends audio to {name}. This app does not save recordings.</p>
  </section>;
}
