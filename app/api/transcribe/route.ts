import {speechQuota} from '../../../lib/shared-limits.ts';
import {timingSafeEqual} from 'node:crypto';
import {enabled,names,transcribe,productionProvider,type Provider} from '../../../lib/providers.ts';
import {parseLetters} from '../../../lib/letters.ts';
import {sameOrigin} from '../../../lib/speech-server.ts';

const maxBytes=4*1024*1024;
const respond=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
let windowStart=Date.now(), requests=0, running=0;
const active=productionProvider;
export function GET(){return respond({provider:active()??null});}

export async function POST(request:Request){
  if(!sameOrigin(request))return respond({error:'Cross-site requests are not allowed.'},403);
  const lab=request.headers.get('x-speech-lab');
  let providers:Provider[];
  if(lab!==null){
    const expected=Buffer.from(process.env.SPEECH_LAB_TOKEN??'');
    const supplied=Buffer.from(lab);
    if(!expected.length||expected.length!==supplied.length||!timingSafeEqual(expected,supplied))return respond({error:'Speech lab token is invalid.'},403);
    providers=names.filter(enabled);
  }else{
    const provider=active();
    providers=provider?[provider]:[];
  }
  if(!providers.length)return respond({error:'Spoken practice needs an AssemblyAI API key on the server. You can type your spelling for now.'},503);
  const type=(request.headers.get('content-type')??'').split(';')[0].toLowerCase();
  if(!/^audio\/(webm|mp4|x-m4a|mpeg|wav|x-wav|ogg|flac)$/.test(type))return respond({error:'Choose a supported audio format.'},415);
  if(Number(request.headers.get('content-length'))>maxBytes)return respond({error:'Audio exceeds 4 MB.'},413);
  if(Date.now()-windowStart>=60_000){windowStart=Date.now();requests=0;}
  if(running>=3||requests>=20)return respond({error:'Speech is busy. Try again shortly.'},429);
  requests++;running++;
  try{
    const reader=request.body?.getReader();
    if(!reader)return respond({error:'Audio is required.'},400);
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(60_000)]);
    const cancel=()=>{void reader.cancel().catch(()=>{});};
    signal.addEventListener('abort',cancel,{once:true});
    const chunks:Uint8Array<ArrayBuffer>[]=[];
    let size=0;
    try{
      while(true){
        const {value,done}=await reader.read();
        if(done)break;
        size+=value.byteLength;
        if(size>maxBytes){cancel();return respond({error:'Audio exceeds 4 MB.'},413);}
        chunks.push(new Uint8Array(value));
      }
    }finally{signal.removeEventListener('abort',cancel);}
    if(signal.aborted)return respond({error:'Audio upload timed out.'},408);
    if(!size)return respond({error:'Audio is required.'},400);
    const blocked=await speechQuota(providers.length);
    if(blocked)return blocked;
    const audio=new Blob(chunks,{type});
    const results=await Promise.all(providers.map(async provider=>{
      const start=performance.now();
      try{
        const transcript=(await transcribe(provider,audio,signal)).slice(0,4096);
        return {provider,transcript,letters:parseLetters(transcript),latencyMs:Math.round(performance.now()-start)};
      }catch{return {provider,error:'Transcription failed or timed out.',latencyMs:Math.round(performance.now()-start)};}
    }));
    return respond({results});
  }catch{return respond({error:'Could not read the recording.'},400);}
  finally{running--;}
}
