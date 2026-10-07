import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from './errors.js';
test('Application errors preserve status and code',()=>{
  const error=new AppError(405,'METHOD_NOT_ALLOWED','Unsupported method.');
  assert.equal(error.status,405);
  assert.equal(error.code,'METHOD_NOT_ALLOWED');
  assert.equal(error.message,'Unsupported method.');
});
