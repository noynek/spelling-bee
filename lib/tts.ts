export const ttsLanguages:Record<string,string>={en:'english',es:'spanish',fr:'french',de:'german',it:'italian',pt:'portuguese'};
export function ttsLanguage(locale:string){return ttsLanguages[locale.toLowerCase().split(/[-_]/)[0]];}
export async function synthesize(text:string,language:string,voice:string,signal:AbortSignal){
  const response=await fetch('https://tts.us.assemblyai.com/v1/speech',{
    method:'POST',cache:'no-store',signal,
    headers:{Authorization:process.env.ASSEMBLYAI_API_KEY!,'Content-Type':'application/json'},
    body:JSON.stringify({text,voice_id:voice,language,container:'wav'}),
  });
  if(!response.ok)throw new Error('Pronunciation service failed.');
  const reader=response.body?.getReader();
  if(!reader)throw new Error('No audio returned.');
  const chunks:Uint8Array<ArrayBuffer>[]=[];let size=0;
  try{
    while(true){
      const {value,done}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>4*1024*1024){await reader.cancel();throw new Error('Audio too large.');}
      chunks.push(new Uint8Array(value));
    }
  }finally{reader.releaseLock();}
  const audio=new Uint8Array(await new Blob(chunks).arrayBuffer());
  if(audio.length<44||String.fromCharCode(...audio.slice(0,4))!=='RIFF'||String.fromCharCode(...audio.slice(8,12))!=='WAVE')throw new Error('Invalid WAV audio.');
  return audio;
}
