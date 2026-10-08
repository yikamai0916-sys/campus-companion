import test from 'node:test';
import assert from 'node:assert/strict';
import { CollaborationError,TaskCandidate } from '../src/collaboration.js';

test('TaskCandidate keeps evidence and rejects a second transition',()=>{
  const candidate=new TaskCandidate({title:'Analyse scheduling algorithm',due:null,evidence:{title:'Kai handles the scheduling algorithm.'}});
  assert.equal(candidate.title,'Analyse scheduling algorithm');
  assert.deepEqual(candidate.evidence,{title:'Kai handles the scheduling algorithm.'});
  assert.equal(candidate.confirm(),'confirmed');
  assert.throws(()=>candidate.reject(),error=>error instanceof CollaborationError&&error.status===409);
});

test('TaskCandidate does not invent missing deadlines',()=>{
  const candidate=new TaskCandidate({title:'Prepare slides',evidence:{title:'Prepare the presentation slides.'}});
  assert.equal(candidate.due,null);
});
