export function sameOrigin(request:Request){
  const origin=request.headers.get('origin');
  return request.headers.get('sec-fetch-site')!=='cross-site'&&(!origin||origin===new URL(request.url).origin);
}
export function createLimiter(max=30,concurrency=3){
  let start=Date.now(),requests=0,running=0;
  return ()=>{
    if(Date.now()-start>=60_000){start=Date.now();requests=0;}
    if(requests>=max||running>=concurrency)return null;
    requests++;running++;
    let released=false;
    return ()=>{if(!released){released=true;running--;}};
  };
}
export async function readLimited(request:Request,max:number,signal:AbortSignal){
  if(Number(request.headers.get('content-length'))>max)throw new Error('too-large');
  const reader=request.body?.getReader();
  if(!reader)throw new Error('empty');
  const cancel=()=>{void reader.cancel().catch(()=>{});};
  const chunks:Uint8Array<ArrayBuffer>[]=[];
  let size=0;
  signal.throwIfAborted();
  signal.addEventListener('abort',cancel,{once:true});
  try{
    while(true){
      const {value,done}=await reader.read();
      signal.throwIfAborted();
      if(done)break;
      size+=value.byteLength;
      if(size>max){cancel();throw new Error('too-large');}
      chunks.push(new Uint8Array(value));
    }
    if(!size)throw new Error('empty');
    return new Blob(chunks);
  }finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
}
