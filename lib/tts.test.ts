import {test} from 'node:test';
import {env} from './test-env.ts';
import assert from 'node:assert/strict';
import {synthesize,ttsLanguage} from './tts.ts';
import {POST,GET} from '../app/api/pronounce/route.ts';
const wav=()=>{const data=new Uint8Array(48);data.set(new TextEncoder().encode('RIFF'),0);data.set(new TextEncoder().encode('WAVE'),8);return data;};
const request=(text:string,language='en-US')=>new Request('http://localhost/api/pronounce',{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,language}),
});
test('maps supported locales without silently treating foreign words as English',()=>{
  assert.equal(ttsLanguage('fr-FR'),'french');
  assert.equal(ttsLanguage('pt_BR'),'portuguese');
  assert.equal(ttsLanguage('ja-JP'),undefined);
});
test('synthesis uses server authentication and requests a WAV with an explicit voice',async t=>{
  env(t,'ASSEMBLYAI_API_KEY','secret-test-key');
  t.mock.method(globalThis,'fetch',async(url:string,init:RequestInit)=>{
    assert.equal(url,'https://tts.us.assemblyai.com/v1/speech');
    assert.equal((init.headers as Record<string,string>).Authorization,'secret-test-key');
    assert.deepEqual(JSON.parse(init.body as string),{text:'garden',voice_id:'aai-audrey',language:'english',container:'wav'});
    return new Response(wav());
  });
  assert.equal((await synthesize('garden','english','aai-audrey',AbortSignal.timeout(1000))).length,48);
});
test('pronunciation endpoint caches the same text/language/voice and rejects cross-site calls',async t=>{
  env(t,'ASSEMBLYAI_API_KEY','test-key');
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(wav());});
  assert.equal((await POST(request('cache test'))).status,200);
  assert.equal((await POST(request('cache test'))).status,200);
  assert.equal(calls,1);
  assert.equal((await POST(request('cache test','fr-FR'))).status,200);
  assert.equal(calls,2);
  const cross=request('another word');cross.headers.set('origin','https://other.example');
  assert.equal((await POST(cross)).status,403);
  assert.equal(calls,2);
});
test('missing key and invalid or unsupported requests fail before contacting provider',async t=>{
  env(t,'ASSEMBLYAI_API_KEY','');
  assert.deepEqual(await GET().json(),{provider:null});
  assert.equal((await POST(request('word'))).status,503);
  env(t,'ASSEMBLYAI_API_KEY','test-key');
  assert.equal((await POST(request('word','ja-JP'))).status,422);
  assert.equal((await POST(request('x'.repeat(513)))).status,400);
  assert.equal((await POST(new Request('http://localhost/api/pronounce',{method:'POST',headers:{'Content-Type':'application/json'},body:'null'}))).status,400);
});
test('invalid provider audio is not returned as a successful pronunciation',async t=>{
  env(t,'ASSEMBLYAI_API_KEY','test-key');
  t.mock.method(globalThis,'fetch',async()=>new Response('not audio'));
  await assert.rejects(synthesize('word','english','aai-audrey',AbortSignal.timeout(1000)),/Invalid WAV/);
});
