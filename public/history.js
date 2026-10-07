import {tripDay,dailyTotals,nzDay} from './daily.js';
const $=id=>document.getElementById(id);
function inputDate(value){const date=new Date(value);return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');}
function status(text,error=false){$('status').textContent=text;if(error)$('status').dataset.error='true';else $('status').removeAttribute('data-error');}
function updateTotals(trips){
  let kilometres=0,minutes=0,distanceCount=0,timeCount=0;
  for(const trip of trips){
    const km=trip.actual_km??trip.estimated_km;
    const time=trip.actual_minutes??trip.estimated_minutes;
    if(Number.isFinite(km)&&km>=0){kilometres+=km;distanceCount++;}
    if(Number.isFinite(time)&&time>=0){minutes+=time;timeCount++;}
  }
  $('total-distance').textContent=new Intl.NumberFormat('en-NZ',{maximumFractionDigits:2}).format(kilometres)+' km';
  const roundedMinutes=Math.round(minutes);
  $('total-time').textContent=Math.floor(roundedMinutes/60)+' h '+roundedMinutes%60+' min';
  $('totals-note').textContent='Saved route estimates are summed; actual readings override estimates when entered. Distance available for '+distanceCount+' of '+trips.length+' trips · Time available for '+timeCount+' of '+trips.length+' trips. Missing values are excluded.';
}
async function request(method='GET',body){
  let response;
  try {response=await fetch('/api/trips',{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});} catch {throw Error('Cannot load history. Check that the server is running, then refresh.');}
  const data=await response.json();if(!response.ok)throw Error(data.error||'History request failed.');return data;
}
async function load(){
  $('refresh').disabled=true;status('Loading your history…');
  try {
    const all=await request();const selectedDay=$('history-day').value;
    $('history-day').replaceChildren();const any=document.createElement('option');any.value='';any.textContent='All days';$('history-day').append(any);
    for(const day of [...new Set(all.map(tripDay))].sort().reverse()){const option=document.createElement('option');option.value=day;option.textContent=day+(day<nzDay()?' — Finished':day===nzDay()?' — Today':'');$('history-day').append(option);}
    $('history-day').value=selectedDay;
    const trips=selectedDay?all.filter(t=>tripDay(t)===selectedDay):all;
    updateTotals(trips);const fuel=dailyTotals(trips);$('history-cost').textContent=new Intl.NumberFormat('en-NZ',{style:'currency',currency:'NZD'}).format(fuel.cost)+' · '+fuel.fuelTrips+' trips with fuel data';
    $('history-list').replaceChildren();$('count').textContent=trips.length+' '+(trips.length===1?'trip':'trips');
    if(!trips.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='No trips yet. Calculate a drive on Road Trip to start your history.';$('history-list').append(empty);}
    for(const trip of trips){
      const card=document.createElement('article');card.className='saved-card';const title=document.createElement('strong');title.textContent=trip.label;
      const date=document.createElement('p');const time=document.createElement('time');time.dateTime=trip.created_at;time.textContent=new Date(trip.created_at).toLocaleString();date.append(time);
      const metrics=document.createElement('p');
      const km=trip.actual_km??trip.estimated_km;
      const minutes=trip.actual_minutes??trip.estimated_minutes;
      const litres=Number.isFinite(km)&&trip.fuel_rate!==null?km*trip.fuel_rate/100:null;
      const cost=litres!==null&&trip.fuel_price!==null?litres*trip.fuel_price:null;
      metrics.textContent='Date: '+(trip.trip_date||inputDate(trip.created_at))+' · Distance: '+(Number.isFinite(km)?km.toFixed(2)+' km'+(trip.actual_km===null?' (estimated)':''):'Not recorded')+' · Driving time: '+(Number.isFinite(minutes)?Math.round(minutes)+' min'+(trip.actual_minutes===null?' (estimated)':''):'Not recorded')+' · Fuel estimate: '+(litres===null?'Not set':litres.toFixed(2)+' L')+' · Cost estimate: '+(cost===null?'Not set':new Intl.NumberFormat('en-NZ',{style:'currency',currency:'NZD'}).format(cost));
      const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Edit trip details';details.append(summary);
      const form=document.createElement('form');const inputs={};
      for(const [field,label,type,value] of [
        ['trip_date','Trip date','date',trip.trip_date||inputDate(trip.created_at)],
        ['actual_km','Actual distance (km)','number',trip.actual_km],
        ['actual_minutes','Actual time spent (minutes)','number',trip.actual_minutes],
        ['fuel_rate','Your car’s fuel consumption (L/100 km)','number',trip.fuel_rate],
        ['fuel_price','Fuel price (NZ$/litre)','number',trip.fuel_price],
      ]){
        const labelElement=document.createElement('label');labelElement.textContent=label;const input=document.createElement('input');input.type=type;input.value=value??'';
        if(type==='number'){input.min='0';input.max='1000000';input.step='any';}else input.required=true;
        labelElement.append(input);form.append(labelElement);inputs[field]=input;
      }
      const note=document.createElement('p');note.className='small';note.textContent='Enter your actual trip readings. Fuel and cost are estimates from your distance, fuel consumption and price.';
      const save=document.createElement('button');save.textContent='SAVE TRIP DETAILS';save.type='submit';form.append(note,save);details.append(form);
      form.onsubmit=async event=>{event.preventDefault();save.disabled=true;try{const values={id:trip.id};for(const [field,input] of Object.entries(inputs))values[field]=field==='trip_date'?input.value:input.value.trim()===''?null:Number(input.value);await request('PATCH',values);await load();status('Trip details saved.');}catch(error){status(error.message,true);save.disabled=false;}};
      const plan=document.createElement('a');plan.textContent='UPDATE ROUTE ESTIMATES ↗';plan.href='/?'+new URLSearchParams({placeId:trip.place_id,label:trip.label,historyId:trip.id});
      const remove=document.createElement('button');remove.className='secondary';remove.textContent='REMOVE';remove.onclick=async()=>{remove.disabled=true;try {await request('DELETE',{id:trip.id});await load();}catch(error){status(error.message,true);remove.disabled=false;}};
      card.append(title,date,metrics,details,plan,document.createTextNode(' '),remove);$('history-list').append(card);
    }
    status(trips.length?'Your trip history is up to date.':'Ready for your first trip.');
  }catch(error){status(error.message,true);}finally{$('refresh').disabled=false;}
}
$('refresh').onclick=load;
$('history-day').onchange=load;
await load();
