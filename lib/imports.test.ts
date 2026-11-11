import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importFile} from './imports.ts';
test('CSV preserves quoted fields, order and explicitly listed variants',async()=>{
  const result=await importFile(new File(['spelling,definition,alternatives\ncolor,"a shade, or hue",colour\nletter,,\ncolor,,'], 'words.csv'));
  assert.deepEqual(result.map(w=>w.spelling),['color','letter','color']);
  assert.equal(result[0].definition,'a shade, or hue');
  assert.deepEqual(result[0].alternatives,['colour']);
});
test('JSON retains authoritative whitespace and metadata',async()=>{
  const result=await importFile(new File([JSON.stringify({words:[{spelling:' résumé ',language:'fr-FR',alternatives:['resumé']}]})],'words.json'));
  assert.equal(result[0].spelling,' résumé ');
  assert.equal(result[0].language,'fr-FR');
});
test('invalid structured imports fail without silently dropping words',async()=>{
  await assert.rejects(importFile(new File(['["apple", {"definition":"No spelling"}]'],'words.json')),/Row 2/);
});
test('oversized imports fail early',async()=>{
  await assert.rejects(importFile(new File([new Uint8Array(20*1024*1024+1)],'large.txt')),/20 MB/);
});
