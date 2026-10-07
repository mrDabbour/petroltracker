const $=id=>document.getElementById(id);
function status(text,error=false){$('status').textContent=text;if(error)$('status').dataset.error='true';else $('status').removeAttribute('data-error');}
async function api(path,body){let response;try {response=await fetch('/api/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});}catch{throw Error('Cannot reach the server. Try again.');}const data=await response.json();if(!response.ok)throw Error([data.error,data.action].filter(Boolean).join(' '));return data;}
const money=value=>new Intl.NumberFormat('en-NZ',{style:'currency',currency:'NZD'}).format(value);
const aquaSource='Toyota catalog: https://toyota.jp/ucar/catalog/brand-TOYOTA/car-AQUA/201305/10083143/ — pre-Dec 2013 JC08 laboratory rating 35.4 km/L; real-world use varies.';
function updateEstimates(){
  const rate=Number($('rate').value),price=Number($('price').value),tank=Number($('tank').value);
  const ready=rate>0&&price>0;
  $('per-km').textContent=ready?money(rate*price/100):'Enter petrol price';
  $('tank-cost').textContent=price>0&&tank>0?money(tank*price):'Enter petrol price';
  $('per-100').textContent=ready?money(rate*price):'Enter petrol price';
  $('tank-range').textContent=rate>0&&tank>0?Math.round(tank/rate*100)+' km':'Not set';
}
function aquaPreset(){
  $('description').value='Toyota Aqua 2013 1.5 petrol hybrid (pre-December specification)';
  $('rate').value=(100/35.4).toFixed(4);$('tank').value='36';$('source').value=aquaSource;
  updateEstimates();status('Aqua preset loaded: 35.4 km/L laboratory rating, 36 L tank. Confirm your build date, enter petrol price, then save. Actual consumption can be higher.');
}
$('aqua-preset').onclick=aquaPreset;
for(const id of ['rate','price','tank'])$(id).addEventListener('input',updateEstimates);
function render(v){$('plate').value=v.plate;$('description').value=v.description;$('rate').value=v.fuel_rate;$('price').value=v.fuel_price;$('tank').value=v.tank_litres??'';$('source').value=v.source;$('per-km').textContent=money(v.fuel_rate*v.fuel_price/100);$('tank-cost').textContent=v.tank_litres?money(v.tank_litres*v.fuel_price):'Not set';}
$('car-form').onsubmit=async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{const v={plate:$('plate').value,description:$('description').value,fuel_rate:Number($('rate').value),fuel_price:Number($('price').value),tank_litres:$('tank').value?Number($('tank').value):null,source:$('source').value};await api('vehicle',v);render(v);status('Car saved. New trip calculations will include fuel estimates.');}catch(error){status(error.message,true);}finally{button.disabled=false;}};
$('lookup').onclick=async()=>{const button=$('lookup');button.disabled=true;status('Looking up your car…');try{const v=await api('vehicle/lookup',{plate:$('plate').value});$('description').value=v.description;$('source').value='RegCheck vehicle identification; fuel consumption entered separately';$('rate').value='';$('tank').value='';status('Car identified. Verify and enter fuel consumption and fuel price, then save.');}catch(error){status(error.message,true);}finally{button.disabled=false;}};
try{const v=await api('vehicle');if(v){render(v);updateEstimates();status('Your saved car is ready.');}else aquaPreset();}catch(error){status(error.message,true);}
