export class CloudPronunciation {
  private context:AudioContext|null=null;
  private source:AudioBufferSourceNode|null=null;
  private request:AbortController|null=null;
  private generation=0;
  private buffers=new Map<string,AudioBuffer>();
  private report:(message:string)=>void;
  constructor(report:(message:string)=>void){this.report=report;}
  stop(){
    this.generation++;this.request?.abort();this.request=null;
    if(this.source){this.source.onended=null;try{this.source.stop();}catch{}this.source=null;}
  }
  dispose(){this.stop();void this.context?.close();this.context=null;this.buffers.clear();}
  async speak(text:string,language:string,rate:number,fallback:()=>void){
    this.stop();
    const generation=this.generation;
    const controller=new AbortController();this.request=controller;
    try{
      this.context??=new AudioContext();
      // Resume immediately during the click, before fetching audio (iPhone Safari).
      await this.context.resume();
      if(generation!==this.generation)return;
      const id=JSON.stringify([text,language]);
      this.report('Loading pronunciation…');
      let buffer=this.buffers.get(id);
      if(!buffer){
        const response=await fetch('/api/pronounce',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({text,language}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30_000)])});
        if(!response.ok)throw new Error('Cloud pronunciation failed');
        buffer=await this.context.decodeAudioData(await response.arrayBuffer());
        if(this.buffers.size>=64)this.buffers.delete(this.buffers.keys().next().value!);
        this.buffers.set(id,buffer);
      }
      if(generation!==this.generation)return;
      const source=this.context.createBufferSource();this.source=source;
      source.buffer=buffer;source.playbackRate.value=rate;source.connect(this.context.destination);
      source.onended=()=>{if(generation===this.generation){this.source=null;this.report('');}};
      source.start();this.report('Playing AssemblyAI pronunciation.');
    }catch{
      if(generation!==this.generation)return;
      fallback();
    }
  }
}
