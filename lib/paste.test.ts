import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parsePaste,wordWarnings} from './paste.ts';
test('default line parsing preserves spaces, punctuation, accents and duplicates',()=>{
  assert.deepEqual(parsePaste(" ice cream\r\ncan't\nco-operate\nrésumé\ncolor, colour\ncat\ncat\n",'lines',true).words,
    ['ice cream',"can't",'co-operate','résumé','color, colour','cat','cat']);
});
test('numbers and bullets are removable without stripping meaningful prefixes',()=>{
  const source='1. garden\n2) kitten\n• rainbow\n- yellow\n* blue\n3D\n-ize';
  assert.deepEqual(parsePaste(source,'lines',true).words,['garden','kitten','rainbow','yellow','blue','3D','-ize']);
  assert.equal(parsePaste(source,'lines',false).words[0],'1. garden');
});
test('comma parsing supports new lines and quoted commas',()=>{
  assert.deepEqual(parsePaste('apple, pear\n"color, colour", ice cream','commas',true).words,
    ['apple','pear','color, colour','ice cream']);
  assert.ok(parsePaste('"apple, pear','commas',true).error);
});
test('flags duplicates across existing and pasted words without changing spellings',()=>{
  const source=['cat','cat','Cat','ice cream','1. dog','this is a very long sentence',''];
  const flags=wordWarnings(source);
  assert.deepEqual(flags[0],['Duplicate']);
  assert.deepEqual(flags[1],['Duplicate']);
  assert.deepEqual(flags[2],[]);
  assert.deepEqual(flags[3],[]);
  assert.deepEqual(flags[4],['Check formatting']);
  assert.deepEqual(flags[5],['Check: long phrase']);
  assert.deepEqual(flags[6],['Empty word']);
});
