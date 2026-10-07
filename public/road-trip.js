import { refreshDay } from './day-dashboard.js';
const $=id=>document.getElementById(id);
let origin,selected,busy=false,tripLabel='Trip destination',historyId;
async function api(path,body,method=body?'POST':'GET') {
  let response;
  try {response=await fetch('/api/'+path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});}
  catch(error){throw Error(error.name==='TimeoutError'?'The request timed out. Try again.':'Cannot reach Spikta. Check that the local server is running.');}
  let data;try {data=await response.json();} catch {throw Error('The server returned an unreadable response.');}
  if(!response.ok)throw Error([data.error||'Request failed.',data.action].filter(Boolean).join(' '));
  return data;
}
function status(text,error=false){$('status').textContent=text;if(error)$('status').dataset.error='true';else $('status').removeAttribute('data-error');}
function buttons(){ $('drive').disabled=busy||!origin||!selected;$('save').disabled=busy||!selected; }
function clearRoute(){ $('distance').textContent='— km';$('duration').textContent='— min';$('route-note').textContent='Calculate your drive for a fresh estimate.'; }
function select(id){selected=id;historyId=undefined;clearRoute();buttons();}
$('origin-search').onsubmit=async event=>{
  event.preventDefault();if(busy)return;busy=true;origin=null;buttons();clearRoute();const button=$('origin-search').querySelector('button');button.disabled=true;$('origin-results').replaceChildren();status('Searching for your starting place…');
  try {
    const data=await api('search',{query:$('starting-place').value});
    for(const place of data.places||[]){const result=document.createElement('button');result.type='button';result.className='result';result.textContent=place.displayName?.text||'Place';const address=document.createElement('small');address.textContent=place.formattedAddress||'';result.append(address);result.onclick=()=>{if(busy)return;origin={placeId:place.id};$('origin').textContent=place.displayName?.text||'Starting place selected';$('origin-results').querySelectorAll('.result').forEach(b=>b.classList.remove('selected'));result.classList.add('selected');clearRoute();buttons();status('Starting place selected. Choose your destination and calculate your drive.');};$('origin-results').append(result);}
    status(data.places?.length?'Choose your starting place below.':'No starting places found. Try a more specific name.');
  }catch(error){status(error.message,true);}finally{busy=false;button.disabled=false;buttons();}
};
$('starting-place').oninput=()=>{origin=null;$('origin').textContent='Select a starting place';$('origin-results').replaceChildren();clearRoute();buttons();};
$('search').onsubmit=async event=>{
  event.preventDefault();if(busy)return;busy=true;selected=null;buttons();clearRoute();const button=$('search').querySelector('button');button.disabled=true;$('results').replaceChildren();status('Searching Google Maps…');
  try {const data=await api('search',{query:$('destination').value});for(const place of data.places||[]){const button=document.createElement('button');button.className='result';button.textContent=place.displayName?.text||'Place';const address=document.createElement('small');address.textContent=place.formattedAddress||'';button.append(address);button.onclick=()=>{select(place.id);tripLabel=$('destination').value.trim();document.querySelectorAll('.result').forEach(b=>b.classList.remove('selected'));button.classList.add('selected');status('Destination selected. Enter your own label to save it.');};$('results').append(button);}status(data.places?.length?'Choose your destination below.':'No places found. Try a more specific name.');}
  catch(error){status(error.message,true);}finally{busy=false;button.disabled=false;buttons();}
};
$('locate').onclick=()=>{
  if(busy)return;
  if(!navigator.geolocation)return status('Your browser does not support location.',true);
  $('locate').disabled=true;status('Waiting for location permission…');
  navigator.geolocation.getCurrentPosition(position=>{origin={lat:position.coords.latitude,lng:position.coords.longitude};clearRoute();$('origin').textContent='Current location is ready';$('locate').disabled=false;buttons();status('Starting location ready.');},error=>{origin=null;clearRoute();$('origin').textContent='Location unavailable';$('locate').disabled=false;buttons();status(error.code===1?'Location permission denied. Allow access in your browser and try again.':error.code===3?'Location request timed out. Try again.':'Your location is unavailable. Try again.',true);},{timeout:15000,maximumAge:0});
};
$('drive').onclick=async()=>{
  if(busy||!origin||!selected)return;busy=true;buttons();clearRoute();status('Calculating with current traffic…');
  try {const data=await api('route',{origin,placeId:selected,tripLabel,historyId});const route=data.routes?.[0];if(!route)throw Error('No driving route found.');const seconds=parseFloat(route.duration);if(!Number.isFinite(seconds)||!Number.isFinite(route.distanceMeters))throw Error('Google Maps returned an incomplete route.');const minutes=Math.ceil(seconds/60);$('distance').textContent=(route.distanceMeters/1000).toFixed(1)+' km';$('duration').textContent=minutes<60?minutes+' min':Math.floor(minutes/60)+'h '+minutes%60+'m';$('route-note').textContent='Leave now · Arrive around '+new Date(Date.now()+seconds*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+(data.fuel?' · Fuel: '+data.fuel.litres.toFixed(2)+' L · '+new Intl.NumberFormat('en-NZ',{style:'currency',currency:'NZD'}).format(data.fuel.cost):' · Add My Car for a fuel estimate');await refreshDay();status(data.historySaved?'Your drive is ready and saved in History. Travel time is an estimate.':'Your drive is ready, but history could not be saved. Travel time is an estimate.');}
  catch(error){status(error.message,true);}finally{busy=false;buttons();}
};
async function loadSaved(){
  const places=await api('places');$('saved').replaceChildren();
  if(!places.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='Your collection starts here. Search for a place and save it for another day.';$('saved').append(empty);}
  for(const place of places){const card=document.createElement('div');card.className='saved-card';const title=document.createElement('strong');title.textContent=place.label;const use=document.createElement('button');use.textContent='PLAN DRIVE ↗';use.onclick=()=>{if(busy)return;select(place.place_id);tripLabel=place.label;$('results').replaceChildren();status('Saved destination selected: '+place.label);};const remove=document.createElement('button');remove.className='secondary';remove.textContent='REMOVE';remove.onclick=async()=>{remove.disabled=true;try{await api('places',{id:place.id},'DELETE');await loadSaved();}catch(error){status(error.message,true);remove.disabled=false;}};card.append(title,use,remove);$('saved').append(card);}
}
$('save').onclick=async()=>{if(busy||!selected)return;busy=true;buttons();try{await api('places',{placeId:selected,label:$('label').value});await loadSaved();status('Place saved to your collection.');}catch(error){status(error.message,true);}finally{busy=false;buttons();}};
$('clock').textContent=new Date().toLocaleDateString([],{month:'short',day:'numeric'}).toUpperCase();
try {const config=await api('maps/status');status(config.configured?'Ready. Search for your next destination.':'Set GOOGLE_MAPS_API_KEY in .env and restart to enable live searches.');}catch(error){status(error.message,true);}
try {await loadSaved();}catch(error){status(error.message,true);}

const revisit=new URLSearchParams(location.search); if(revisit.get('placeId') && revisit.get('placeId').length<=300){select(revisit.get('placeId'));tripLabel=(revisit.get('label')||'Trip destination').slice(0,200);const previousId=Number(revisit.get('historyId'));if(Number.isSafeInteger(previousId)&&previousId>0)historyId=previousId;status('Plan again: '+tripLabel+'. Select a starting place or use your location to update this trip with fresh estimates.');}
await refreshDay();
