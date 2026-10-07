import {nzDay,tripDay,dailyTotals} from './daily.js';
const $=id=>document.getElementById(id);
const money=value=>new Intl.NumberFormat('en-NZ',{style:'currency',currency:'NZD'}).format(value);
let activeDay=nzDay();
export async function refreshDay(){
  $('day-date').textContent=activeDay=nzDay();
  try {
    const results=await Promise.all(['/api/vehicle','/api/trips'].map(async path=>{const response=await fetch(path,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Could not load your daily dashboard.');return response.json();}));
    const [vehicle,all]=results;
    $('day-car').textContent=vehicle?.description||'No car saved yet';
    $('day-car-rate').textContent=vehicle?vehicle.fuel_rate.toFixed(2)+' L/100 km':'Set fuel consumption in My Car';
    $('day-car-price').textContent=vehicle?money(vehicle.fuel_price)+' / litre':'Set your petrol price';
    $('day-car-km').textContent=vehicle?money(vehicle.fuel_rate*vehicle.fuel_price/100)+' / km':'—';
    $('day-car-tank').textContent=vehicle?.tank_litres?vehicle.tank_litres+' L · '+money(vehicle.tank_litres*vehicle.fuel_price):'Tank capacity not set';
    const trips=all.filter(t=>tripDay(t)===activeDay),total=dailyTotals(trips);
    $('day-trip-count').textContent=trips.length+' '+(trips.length===1?'TRIP':'TRIPS')+' TODAY';
    $('day-cheer').textContent=trips.length===0?'A fresh day. A blank road.':trips.length===1?'First stop in the books. Where next?':'Your day is going places. '+total.km.toFixed(1)+' km and counting.';
    $('day-distance').textContent=total.km.toFixed(2)+' km';const minutes=Math.round(total.minutes);$('day-time').textContent=Math.floor(minutes/60)+' h '+minutes%60+' min';
    $('day-fuel').textContent=total.fuelTrips?total.litres.toFixed(2)+' L':'Not available';
    $('day-cost').textContent=total.fuelTrips?money(total.cost):trips.length?'Set fuel details':money(0);
    $('day-note').textContent=trips.length+' trips today · Fuel cost available for '+total.fuelTrips+' trips. Totals include estimates; actual readings override them.';
    $('day-trips').replaceChildren();
    for(const trip of trips){const card=document.createElement('article');card.className='saved-card';const title=document.createElement('strong');title.textContent=trip.label;const summary=document.createElement('p');const km=trip.actual_km??trip.estimated_km,min=trip.actual_minutes??trip.estimated_minutes;summary.textContent=(Number.isFinite(km)?km.toFixed(2)+' km':'Distance missing')+' · '+(Number.isFinite(min)?Math.round(min)+' min':'Time missing');card.append(title,summary);$('day-trips').append(card);}
    if(!trips.length){const empty=document.createElement('p');empty.textContent='No trips today. Calculate a drive to add your first trip.';$('day-trips').append(empty);}
  }catch(error){$('day-note').textContent=error.message;}
}
$('day-refresh').onclick=refreshDay;
setInterval(()=>{if(nzDay()!==activeDay)refreshDay();},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDay();});
