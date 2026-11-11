import {test} from 'node:test';
import {env} from './test-env.ts';
import assert from 'node:assert/strict';
import {GET,POST} from '../app/api/transcribe/route.ts';

test('transcription route uses only audio and returns ungraded letters',async t=>{
  env(t,'ASSEMBLYAI_API_KEY','test-key');env(t,'SPEECH_PROVIDER','assemblyai');
  assert.deepEqual(await GET().json(),{provider:'assemblyai'});
  t.mock.method(globalThis,'fetch',async(url:string,init:RequestInit={})=>{
    if(url.endsWith('/upload'))return Response.json({upload_url:'https://upload.example/audio'});
    if(url.endsWith('/transcript'))return Response.json({id:'job'});
    if(init.method==='DELETE')return Response.json({});
    return Response.json({status:'completed',text:'L E T T R'});
  });
  const response=await POST(new Request('http://localhost/api/transcribe',{method:'POST',headers:{'Content-Type':'audio/mp4'},body:'audio'}));
  const data=await response.json();
  assert.equal(data.results[0].letters,'lettr');
  assert.equal(Object.hasOwn(data.results[0],'correct'),false);
});
test('transcription endpoint rejects unsupported uploads and cross-site requests',async t=>{
  env(t,'ASSEMBLYAI_API_KEY','test-key');env(t,'SPEECH_PROVIDER','assemblyai');
  assert.equal((await POST(new Request('http://localhost/api/transcribe',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"answer":"letter"}'}))).status,415);
  assert.equal((await POST(new Request('http://localhost/api/transcribe',{method:'POST',headers:{'Content-Type':'audio/mp4','Origin':'https://other.example'},body:'audio'}))).status,403);
});
