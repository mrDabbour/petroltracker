import test from 'node:test';
import assert from 'node:assert/strict';
import { requestGoogle } from './google-maps.js';
test('Missing key fails before any provider request',async()=>{
  await assert.rejects(requestGoogle('search',{}, {key:'',fetcher:()=>assert.fail('Unexpected request')}),e=>e.status===503&&e.code==='MAPS_NOT_CONFIGURED');
});
test('Permission error logs provider details but redacts key',async()=>{
  const key='test-secret-value';const logs=[];
  const data={error:{code:403,status:'PERMISSION_DENIED',message:'Denied '+key,details:[{reason:'API_KEY_IP_ADDRESS_BLOCKED',metadata:{key}}]}};
  await assert.rejects(requestGoogle('search',{textQuery:'test'},{key,logger:(...args)=>logs.push(args.join(' ')),fetcher:async()=>new Response(JSON.stringify(data),{status:403})}),e=>e.status===403&&e.code==='GOOGLE_PERMISSION_DENIED'&&!e.message.includes(key));
  assert.ok(logs[0].includes('API_KEY_IP_ADDRESS_BLOCKED'));
  assert.ok(logs[0].includes('PERMISSION_DENIED'));
  assert.ok(!logs[0].includes(key));
});
test('Server request uses correct provider URL, headers and mask',async()=>{
  for(const [service,url,mask] of [['search','https://places.googleapis.com/v1/places:searchText','places.id,places.displayName,places.formattedAddress'],['route','https://routes.googleapis.com/directions/v2:computeRoutes','routes.distanceMeters,routes.duration']]){
    const body={test:true};const result=await requestGoogle(service,body,{key:'unit-test-key',fetcher:async(actual,options)=>{assert.equal(actual,url);assert.equal(options.headers['X-Goog-Api-Key'],'unit-test-key');assert.equal(options.headers['X-Goog-FieldMask'],mask);assert.deepEqual(JSON.parse(options.body),body);return new Response('{}');}});
    assert.deepEqual(result,{});
  }
});
test('Quota and network failures return useful statuses',async()=>{
  await assert.rejects(requestGoogle('search',{}, {key:'test',logger:()=>{},fetcher:async()=>new Response('{"error":{"message":"Quota exceeded"}}',{status:429})}),e=>e.status===429);
  await assert.rejects(requestGoogle('route',{}, {key:'test',logger:()=>{},fetcher:async()=>{throw new TypeError('fetch failed');}}),e=>e.status===502);
});
