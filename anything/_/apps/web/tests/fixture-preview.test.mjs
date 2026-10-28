import test from 'node:test';
import assert from 'node:assert/strict';
import {addCase,loadCases} from '../src/preview/fixtureStore.ts';
const memory = () => {const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};};
test('only the fixed synthetic target can be persisted',()=>{const s=memory();assert.throws(()=>addCase(s,'test','example.com','unmatched.example'),/Only the prefilled/);assert.deepEqual(loadCases(s,'test','example.com'),[]);});
test('case creation survives a subsequent storage read',()=>{const s=memory();const rows=addCase(s,'test','example.com','example.com');assert.equal(rows[0].status,'fixture-ready');assert.deepEqual(loadCases(s,'test','example.com'),rows);});
test('foreign targets and corrupt storage fail explicitly',()=>{const s=memory();s.setItem('test',JSON.stringify([{id:'fixture-x',target:'unmatched.example',created_at:'x',status:'fixture-ready'}]));assert.throws(()=>loadCases(s,'test','example.com'),/invalid/);s.setItem('test','broken');assert.throws(()=>loadCases(s,'test','example.com'));});
test('storage failures propagate instead of claiming saved success',()=>{assert.throws(()=>addCase({getItem:()=>null,setItem:()=>{throw Error('Storage unavailable')}},'test','example.com','example.com'),/Storage unavailable/);});
