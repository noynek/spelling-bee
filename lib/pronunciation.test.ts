import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Pronunciation} from './pronunciation.ts';
function setup(){
  const spoken:SpeechSynthesisUtterance[]=[];
  const messages:string[]=[];
  const calls:string[]=[];
  const voices=[
    {lang:'fr-FR',localService:true},
    {lang:'en-US',localService:false},
    {lang:'en-US',localService:true},
  ] as SpeechSynthesisVoice[];
  const synth={getVoices:()=>voices,paused:true,speaking:false,pending:false,
    cancel:()=>calls.push('cancel'),resume:()=>{calls.push('resume');synth.paused=false;},
    speak:(u:SpeechSynthesisUtterance)=>{calls.push('speak');spoken.push(u);},
  };
  const player=new Pronunciation(synth as unknown as SpeechSynthesis,
    text=>({text} as SpeechSynthesisUtterance),m=>messages.push(m));
  return {player,synth,spoken,messages,calls,voices};
}
test('selects a local language voice and resumes before speaking',()=>{
  const {player,spoken,calls,voices}=setup();
  player.speak('garden');
  assert.deepEqual(calls,['resume','speak']);
  assert.equal(spoken[0].voice,voices[2]);
  assert.equal(spoken[0].text,'garden');
  assert.equal(spoken[0].volume,1);
  player.stop();
});
test('replacement ignores old cancellation events and respects override/speed',()=>{
  const {player,spoken,messages,synth}=setup();
  player.speak('old');
  synth.speaking=true;
  player.speak('bonjour','fr-FR',.65);
  spoken[0].onerror?.call(spoken[0],{error:'canceled'} as SpeechSynthesisErrorEvent);
  assert.equal(messages.at(-1),'Starting pronunciation…');
  assert.equal(spoken[1].lang,'fr-FR');
  assert.equal(spoken[1].rate,.65);
  player.stop();
});
test('silent engines time out with actionable feedback',t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {player,messages}=setup();
  player.speak('garden');
  t.mock.timers.tick(4001);
  assert.match(messages.at(-1)!,/did not start/);
  player.stop();
});
test('blocked playback is reported without revealing the word',()=>{
  const {player,spoken,messages}=setup();
  player.speak('secret');
  spoken[0].onerror?.call(spoken[0],{error:'not-allowed'} as SpeechSynthesisErrorEvent);
  assert.match(messages.at(-1)!,/Playback was blocked/);
  assert.equal(messages.join(' ').includes('secret'),false);
  player.stop();
});
