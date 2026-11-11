import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {CloudPronunciation} from './cloud-pronunciation.ts';
function setup(t:TestContext){
  const started:number[]=[];
  let closed=false,stopped=0;
  class Context {
    destination={};
    resume(){return Promise.resolve();}
    decodeAudioData(){return Promise.resolve({} as AudioBuffer);}
    createBufferSource(){
      return {buffer:null,playbackRate:{value:1},onended:null,connect(){},
        start(){started.push(this.playbackRate.value);},stop(){stopped++;}};
    }
    close(){closed=true;return Promise.resolve();}
  }
  const previous=Object.getOwnPropertyDescriptor(globalThis,'AudioContext');
  Object.defineProperty(globalThis,'AudioContext',{value:Context,configurable:true,writable:true});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'AudioContext',previous);else Reflect.deleteProperty(globalThis,'AudioContext');});
  const messages:string[]=[];
  const player=new CloudPronunciation(message=>messages.push(message));
  t.after(()=>player.dispose());
  return {player,started,messages,closed:()=>closed,stopped:()=>stopped};
}
test('normal and slow playback reuse cached audio; dispose stops playback',async t=>{
  const {player,started,closed,stopped}=setup(t);
  let requests=0;
  t.mock.method(globalThis,'fetch',async()=>{requests++;return new Response(new Uint8Array([1,2]));});
  const fallback=()=>assert.fail('Unexpected fallback');
  await player.speak('garden','en-US',1,fallback);
  await player.speak('garden','en-US',.65,fallback);
  assert.equal(requests,1);
  assert.deepEqual(started,[1,.65]);
  player.dispose();
  assert.equal(stopped(),2);
  assert.equal(closed(),true);
});
test('cancelled synthesis cannot start playing later or invoke fallback',async t=>{
  const {player,started}=setup(t);
  let resolve:(response:Response)=>void=()=>{};
  let requested=false;
  t.mock.method(globalThis,'fetch',()=>{requested=true;return new Promise<Response>(r=>{resolve=r;});});
  const pending=player.speak('garden','en-US',1,()=>assert.fail('Cancelled request fell back'));
  await Promise.resolve();
  assert.equal(requested,true);
  player.stop();
  resolve(new Response(new Uint8Array([1,2])));
  await pending;
  assert.deepEqual(started,[]);
});
test('service errors fall back without trying to play invalid audio',async t=>{
  const {player,started}=setup(t);
  t.mock.method(globalThis,'fetch',async()=>new Response('Unavailable',{status:503}));
  let fallback=0;
  await player.speak('garden','en-US',1,()=>{fallback++;});
  assert.equal(fallback,1);assert.deepEqual(started,[]);
});
