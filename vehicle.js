import { AppError } from './errors.js';
export function initializeVehicle(db){db.exec('CREATE TABLE IF NOT EXISTS vehicle_profile (id INTEGER PRIMARY KEY CHECK(id=1), plate TEXT NOT NULL, description TEXT NOT NULL, fuel_rate REAL NOT NULL, fuel_price REAL NOT NULL, tank_litres REAL, source TEXT NOT NULL)');}
export function validateVehicle(body){
  if(typeof body.plate!=='string'||(body.plate.trim()&&!/^[A-Z0-9]{1,10}$/.test(body.plate.toUpperCase().replace(/\s/g,''))))throw new AppError(400,'INVALID_PLATE','Enter a valid NZ number plate or leave it blank for a manual profile.');
  if(typeof body.description!=='string'||!body.description.trim()||body.description.length>150)throw new AppError(400,'INVALID_VEHICLE','Enter your car make, model and year.');
  for(const field of ['fuel_rate','fuel_price'])if(!Number.isFinite(body[field])||body[field]<=0||body[field]>100)throw new AppError(400,'INVALID_FUEL','Enter positive fuel consumption and price values (up to 100).');
  if(body.tank_litres!==null&&(!Number.isFinite(body.tank_litres)||body.tank_litres<=0||body.tank_litres>1000))throw new AppError(400,'INVALID_TANK','Enter tank capacity in litres or leave it blank.');
  if(typeof body.source!=='string'||body.source.length>500)throw new AppError(400,'INVALID_SOURCE','Enter a source of up to 500 characters.');
  return {...body,plate:body.plate.toUpperCase().replace(/\s/g,''),description:body.description.trim()};
}
const escapeXml=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export async function lookupVehicle(plate,{username=process.env.REGCHECK_USERNAME,fetcher=fetch}={}){
  if(typeof plate!=='string'||!/^[A-Z0-9]{1,10}$/.test(plate.toUpperCase().replace(/\s/g,'')))throw new AppError(400,'INVALID_PLATE','Enter a valid NZ number plate.');
  if(!username?.trim())throw new AppError(503,'PLATE_LOOKUP_NOT_CONFIGURED','Automatic plate lookup is not configured.','Use Rightcar and enter your car details manually, or set REGCHECK_USERNAME in the server .env after creating a provider trial account.');
  const normalized=plate.toUpperCase().replace(/\s/g,'');
  let response;
  try{response=await fetcher('https://www.regcheck.org.uk/api/reg.asmx',{method:'POST',headers:{'Content-Type':'text/xml; charset=utf-8','SOAPAction':'"http://regcheck.org.uk/CheckNewZealand"'},body:`<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><CheckNewZealand xmlns="http://regcheck.org.uk"><RegistrationNumber>${normalized}</RegistrationNumber><username>${escapeXml(username)}</username></CheckNewZealand></soap:Body></soap:Envelope>`,signal:AbortSignal.timeout(15000)});}catch{throw new AppError(502,'PLATE_LOOKUP_UNREACHABLE','Cannot reach the vehicle lookup provider.','Try again later or enter the details manually.');}
  const text=await response.text();
  if(!response.ok||text.includes('<soap:Fault>'))throw new AppError(502,'PLATE_LOOKUP_FAILED','The provider could not complete this lookup.','Check your provider account and remaining trial credits, or enter your car manually.');
  const encoded=text.match(/<(?:\w+:)?vehicleJson\b[^>]*>([\s\S]*?)<\/(?:\w+:)?vehicleJson>/i)?.[1];
  if(!encoded)throw new AppError(404,'VEHICLE_NOT_FOUND','No vehicle details were returned.','Check the plate or enter your car manually.');
  let data;
  try{data=JSON.parse(encoded.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/,'$1').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'));}catch{throw new AppError(502,'INVALID_VEHICLE_RESPONSE','The provider returned unreadable vehicle details.');}
  const description=typeof data.Description==='string'?data.Description.trim():'';
  if(!description)throw new AppError(404,'VEHICLE_NOT_FOUND','No vehicle identification was returned.');
  return {plate:normalized,description:description.slice(0,150)};
}
