import {test} from 'node:test';
import assert from 'node:assert/strict';
import {align, grade, merge, word} from './core.ts';
test('only exact spellings and explicit alternatives pass',()=>{
  const w={...word('résumé'),alternatives:['resumé']};
  for(const s of ['résumé','resumé']) assert.equal(grade(w,s).correct,true);
  for(const s of ['Resume','resume','résumé ','résumé','']) assert.equal(grade(w,s).correct,false);
});
test('alignment preserves repeated letters and locates omissions',()=>{
  assert.deepEqual(align('letter','leter'),{distance:1,changes:['Missing “t” at position 3.']});
  assert.equal(align('猫','猫猫').distance,1);
});
test('merge keeps first position and combines explicit alternatives',()=>{
  const a={...word('color'),alternatives:['colour']};
  assert.deepEqual(merge([a,word('dog'),word('color')]).map(w=>[w.spelling,w.alternatives]),[['color',['colour']],['dog',[]]]);
});
