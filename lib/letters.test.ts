import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseLetters,scoreSpeech} from './letters.ts';
test('speech parsing keeps repeated and intentionally wrong letters',()=>{
  assert.equal(parseLetters('El, ee, tee, tee, ar.'),'lettr');
  assert.equal(parseLetters('Double you, ay, doubleyou'),'waw');
  assert.equal(parseLetters('l-e-t-t-e-r'),'letter');
  assert.equal(parseLetters('letter'),null);
  assert.equal(parseLetters('l, unclear, r'),null);
});
test('benchmark distinguishes false accepts and rejects from spelling errors',()=>{
  assert.equal(scoreSpeech('lettr','letter',['letter']).falseAccept,true);
  assert.equal(scoreSpeech('letter',null,['letter']).falseReject,true);
  assert.equal(scoreSpeech('lettr','lettr',['letter']).exact,true);
});
