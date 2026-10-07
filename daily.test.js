import test from 'node:test';
import assert from 'node:assert/strict';
import {nzDay,tripDay,dailyTotals} from './public/daily.js';
test('Daily grouping uses Auckland midnight and daylight saving',()=>{
  assert.equal(nzDay('2026-10-06T10:59:59Z'),'2026-10-06');
  assert.equal(nzDay('2026-10-06T11:00:00Z'),'2026-10-07');
  assert.equal(nzDay('2026-07-06T12:00:00Z'),'2026-07-07');
  assert.equal(tripDay({trip_date:'2026-10-05',created_at:'2026-10-06T11:00:00Z'}),'2026-10-05');
});
test('Daily totals use trip fuel snapshots and actual overrides',()=>{
  const total=dailyTotals([{estimated_km:100,estimated_minutes:80,actual_km:50,actual_minutes:60,fuel_rate:4,fuel_price:3},{estimated_km:10,estimated_minutes:10,fuel_rate:null,fuel_price:null}]);
  assert.equal(total.km,60);assert.equal(total.minutes,70);assert.equal(total.litres,2);assert.equal(total.cost,6);assert.equal(total.fuelTrips,1);
});
