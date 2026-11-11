import {test} from 'node:test';
import {env} from './test-env.ts';
import assert from 'node:assert/strict';
import {productionProvider,transcribe,spellingPrompt} from './providers.ts';

test('defaults to AssemblyAI only when its server key is set',t=>{
  env(t,'SPEECH_PROVIDER','');
  env(t,'ASSEMBLYAI_API_KEY','test-key');
  assert.equal(productionProvider(),'assemblyai');
  env(t,'ASSEMBLYAI_API_KEY','');
  assert.equal(productionProvider(),undefined);
});
test('AssemblyAI sends audio and generic letter instructions, then deletes the transcript',async t=>{
  env(t,'ASSEMBLYAI_API_KEY','test-key');
  env(t,'ASSEMBLYAI_STT_MODEL','universal-3-5-pro');
  const calls:{url:string;init:RequestInit}[]=[];
  t.mock.method(globalThis,'fetch',async(url:string,init:RequestInit={})=>{
    calls.push({url,init});
    if(url.endsWith('/upload'))return Response.json({upload_url:'https://upload.example/audio'});
    if(url.endsWith('/transcript'))return Response.json({id:'job'});
    if(init.method==='DELETE')return Response.json({});
    return Response.json({status:'completed',text:'L E T T R'});
  });
  const result=await transcribe('assemblyai',new Blob(['audio'],{type:'audio/mp4'}),AbortSignal.timeout(1000));
  assert.equal(result,'L E T T R');
  const payload=JSON.parse(calls[1].init.body as string);
  assert.deepEqual(payload,{audio_url:'https://upload.example/audio',speech_models:['universal-3-5-pro'],
    language_code:'en',prompt:spellingPrompt,format_text:false,punctuate:false});
  assert.equal(calls.at(-1)!.init.method,'DELETE');
  assert.equal(Object.hasOwn(payload,'keyterms_prompt'),false);
});
test('AssemblyAI still deletes failed transcripts',async t=>{
  env(t,'ASSEMBLYAI_API_KEY','test-key');
  let deleted=false;
  t.mock.method(globalThis,'fetch',async(url:string,init:RequestInit={})=>{
    if(url.endsWith('/upload'))return Response.json({upload_url:'https://upload.example/audio'});
    if(url.endsWith('/transcript'))return Response.json({id:'job'});
    if(init.method==='DELETE'){deleted=true;return Response.json({});}
    return Response.json({status:'error'});
  });
  await assert.rejects(transcribe('assemblyai',new Blob(['audio']),AbortSignal.timeout(1000)),/failed/);
  assert.equal(deleted,true);
});
