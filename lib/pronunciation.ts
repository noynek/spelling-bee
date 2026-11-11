// Retain the utterance until playback completes and keep all speak calls inside
// the original click handler (Safari requires user activation).
export class Pronunciation {
  private current:SpeechSynthesisUtterance|null=null;
  private watchdog:ReturnType<typeof setTimeout>|undefined;
  private synth:SpeechSynthesis;
  private create:(text:string)=>SpeechSynthesisUtterance;
  private report:(message:string)=>void;
  constructor(synth:SpeechSynthesis,create:(text:string)=>SpeechSynthesisUtterance,report:(message:string)=>void){
    this.synth=synth;this.create=create;this.report=report;
    synth.getVoices(); // Start asynchronous voice discovery before the first click.
  }
  stop(){
    clearTimeout(this.watchdog);
    this.current=null; // Ignore late cancellation/error events from older requests.
    if(this.synth.speaking||this.synth.pending)this.synth.cancel();
  }
  speak(text:string,language='en-US',rate=1){
    this.stop();
    try{
      const voices=this.synth.getVoices();
      const lang=language.replaceAll('_','-').toLowerCase();
      const matching=voices.filter(v=>v.lang.replaceAll('_','-').toLowerCase()===lang);
      const sameLanguage=voices.filter(v=>v.lang.toLowerCase().split('-')[0]===lang.split('-')[0]);
      const candidates=matching.length?matching:sameLanguage;
      const voice=candidates.find(v=>v.localService)??candidates[0];
      const utterance=this.create(text);
      this.current=utterance;
      utterance.lang=voice?.lang??language;
      if(voice)utterance.voice=voice;
      utterance.rate=rate;utterance.volume=1;
      const valid=()=>this.current===utterance;
      utterance.onstart=()=>{
        if(!valid())return;
        clearTimeout(this.watchdog);this.report('Playing pronunciation. If it is silent, check your device volume and audio output.');
      };
      utterance.onend=()=>{if(valid()){clearTimeout(this.watchdog);this.current=null;this.report('');}};
      utterance.onerror=(event)=>{
        if(!valid())return;
        clearTimeout(this.watchdog);this.current=null;
        this.report(event.error==='not-allowed'
          ?'Playback was blocked. Tap Hear word again, or open this page directly in Safari or Chrome.'
          :event.error==='voice-unavailable'||event.error==='language-unavailable'
          ?'No usable voice is installed for this language. Add a voice in your device settings, then reload.'
          :'Pronunciation could not play. Try Hear word again or open this page directly in Safari or Chrome.');
      };
      this.report('Starting pronunciation…');
      this.watchdog=setTimeout(()=>{
        if(!valid())return;
        this.report('Pronunciation did not start. Try Hear word again. If it stays silent, open this page directly in Safari or Chrome and check that a voice is installed.');
        this.stop();
      },4000);
      // cancel() does not clear the paused state.
      if(this.synth.paused)this.synth.resume();
      this.synth.speak(utterance);
      if(this.synth.paused)this.synth.resume();
    }catch{
      this.stop();
      this.report('Pronunciation is unavailable. Try opening this page directly in Safari or Chrome.');
    }
  }
}
