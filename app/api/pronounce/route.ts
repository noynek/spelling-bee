import {createHash} from 'node:crypto';
import {createLimiter,readLimited,sameOrigin} from '../../../lib/speech-server.ts';
import {synthesize,ttsLanguage} from '../../../lib/tts.ts';

export const runtime='nodejs';
const limit=createLimiter();
const cache=new Map<string,{audio:Uint8Array<ArrayBuffer>;expires:number}>();
const pending=new Map<string,Promise<Uint8Array<ArrayBuffer>>>();
let bytes=0;
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export function GET(){return reply({provider:process.env.ASSEMBLYAI_API_KEY?'assemblyai':null});}
export async function POST(request:Request){
  if(!sameOrigin(request))return reply({error:'Cross-site requests are not allowed.'},403);
  if(!process.env.ASSEMBLYAI_API_KEY)return reply({error:'Cloud pronunciation needs an AssemblyAI API key.'},503);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'JSON is required.'},415);
  const release=limit();
  if(!release)return reply({error:'Pronunciation is busy. Try again shortly.'},429);
  try{
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(25_000)]);
    const input=JSON.parse(await (await readLimited(request,4096,signal)).text());
    if(!input||typeof input!=='object'||typeof input.text!=='string'||!input.text.trim()||input.text.length>512||typeof input.language!=='string')return reply({error:'Provide text up to 512 characters and a language code.'},400);
    const language=ttsLanguage(input.language);
    if(!language)return reply({error:'This language uses the device voice.'},422);
    const voice=process.env.ASSEMBLYAI_TTS_VOICE||'aai-audrey';
    const id=createHash('sha256').update(JSON.stringify([input.text,language,voice])).digest('hex');
    const cached=cache.get(id);
    let audio=cached&&cached.expires>Date.now()?cached.audio:undefined;
    if(!audio){
      let task=pending.get(id);
      if(!task){
        // Shared generation has its own deadline; one cancelled replay must not
        // cancel synthesis for another student requesting the same pronunciation.
        task=synthesize(input.text,language,voice,AbortSignal.timeout(20_000)).then(result=>{
          const old=cache.get(id);if(old){bytes-=old.audio.byteLength;cache.delete(id);}
          while(cache.size&&(cache.size>=128||bytes+result.byteLength>20*1024*1024)){
            const oldest=cache.keys().next().value!;bytes-=cache.get(oldest)!.audio.byteLength;cache.delete(oldest);
          }
          cache.set(id,{audio:result,expires:Date.now()+86_400_000});bytes+=result.byteLength;
          return result;
        }).finally(()=>pending.delete(id));
        pending.set(id,task);
      }
      audio=await task;
    }
    return new Response(audio,{headers:{'Content-Type':'audio/wav','Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff'}});
  }catch(error){
    if(error instanceof SyntaxError)return reply({error:'Invalid JSON.'},400);
    if(error instanceof Error&&error.message==='too-large')return reply({error:'Request exceeds 4 KB.'},413);
    return reply({error:'Cloud pronunciation is unavailable. Try the device voice.'},502);
  }finally{release();}
}
