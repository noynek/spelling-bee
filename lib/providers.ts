export const names=['openai','assemblyai','deepgram'] as const;
export type Provider=typeof names[number];
const keys:Record<Provider,string>={openai:'OPENAI_API_KEY',assemblyai:'ASSEMBLYAI_API_KEY',deepgram:'DEEPGRAM_API_KEY'};
export const spellingPrompt='Transcribe isolated English letter names as individual letters separated by spaces. Preserve every audible letter in order, including repeated letters and intentional spelling mistakes. Never infer a word, correct a spelling, remove repeated letters, or add unspoken letters. Mark uncertain audio as [unclear].';
export function productionProvider():Provider|undefined{
  const selected=process.env.SPEECH_PROVIDER||'assemblyai';
  return names.find(name=>name===selected&&enabled(name));
}
export function enabled(name:Provider){return Boolean(process.env[keys[name]]);}
async function json<T>(url:string,signal:AbortSignal,init:RequestInit={}):Promise<T>{
  const response=await fetch(url,{...init,signal,cache:'no-store'});
  if(!response.ok)throw new Error('Provider request failed');
  return response.json();
}
export async function transcribe(provider:Provider,audio:Blob,signal:AbortSignal):Promise<string>{
  const key=process.env[keys[provider]];
  if(!key)throw new Error('Provider is not configured');
  if(provider==='openai'){
    const form=new FormData();
    const extension=audio.type.split('/')[1].split(';')[0].replace('mpeg','mp3').replace('x-wav','wav').replace('x-m4a','m4a');
    form.set('file',audio,`attempt.${extension}`);
    form.set('model',process.env.OPENAI_TRANSCRIPTION_MODEL||'gpt-transcribe');
    form.set('prompt','The speaker says isolated letter names. Transcribe each audible letter separately, preserving the order and repetitions. Do not guess a word or fix the spelling.');
    return (await json<{text:string}>('https://api.openai.com/v1/audio/transcriptions',signal,{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form})).text;
  }
  if(provider==='deepgram'){
    const response=await json<{results?:{channels?:{alternatives?:{transcript:string}[]}[]}}>('https://api.deepgram.com/v1/listen?model=nova-3&language=multi&smart_format=false&punctuate=false',signal,{method:'POST',headers:{Authorization:`Token ${key}`,'Content-Type':audio.type},body:audio});
    return response.results?.channels?.[0]?.alternatives?.[0]?.transcript??'';
  }
  const base='https://api.assemblyai.com/v2';
  const headers={authorization:key};
  const {upload_url}=await json<{upload_url:string}>(base+'/upload',signal,{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream'},body:audio});
  const {id}=await json<{id:string}>(base+'/transcript',signal,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({audio_url:upload_url,speech_models:[process.env.ASSEMBLYAI_STT_MODEL||'universal-3-5-pro'],language_code:'en',prompt:spellingPrompt,format_text:false,punctuate:false})});
  try {
    while(!signal.aborted){
      const result=await json<{text?:string;status:string}>(base+'/transcript/'+encodeURIComponent(id),signal,{headers});
      if(result.status==='completed')return result.text??'';
      if(result.status==='error')throw new Error('Transcription failed');
      await new Promise(resolve=>setTimeout(resolve,850));
    }
    throw new Error('Transcription timed out');
  }finally{
    await fetch(base+'/transcript/'+encodeURIComponent(id),{method:'DELETE',headers,signal:AbortSignal.timeout(3000)}).catch(()=>{});
  }
}
