import http from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { AppError } from './errors.js';
import { requestGoogle } from './google-maps.js';
import { initializeHistory, recordTrip } from './trip-history.js';
import { initializeVehicle,validateVehicle,lookupVehicle } from './vehicle.js';
mkdirSync('data',{recursive:true});
const db=new DatabaseSync('data/places.sqlite');
db.exec('CREATE TABLE IF NOT EXISTS places (id INTEGER PRIMARY KEY, place_id TEXT UNIQUE NOT NULL, label TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)');
initializeHistory(db);
initializeVehicle(db);
http.createServer(async (req,res) => {
  const send = (status,data) => {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try {
    const path = new URL(req.url,'http://localhost').pathname;
    const methods={'/api/maps/status':['GET'],'/api/search':['POST'],'/api/route':['POST'],'/api/places':['GET','POST','DELETE'],'/api/trips':['GET','PATCH','DELETE'],'/api/vehicle':['GET','POST'],'/api/vehicle/lookup':['POST']};
    if(methods[path]) {
      if(!methods[path].includes(req.method)) {res.setHeader('Allow',methods[path].join(', '));throw new AppError(405,'METHOD_NOT_ALLOWED','This request method is not supported.');}
      let raw='';for await(const chunk of req) {raw+=chunk;if(Buffer.byteLength(raw)>10000)throw new AppError(413,'REQUEST_TOO_LARGE','Request too large.');}
      let body;try {body=raw?JSON.parse(raw):{};} catch {throw new AppError(400,'INVALID_JSON','Request contains invalid JSON.');}
      if(!body||typeof body!=='object'||Array.isArray(body))throw new AppError(400,'INVALID_BODY','Request must contain a JSON object.');
      if(path==='/api/maps/status')return send(200,{configured:!!process.env.GOOGLE_MAPS_API_KEY?.trim()});
      if(path==='/api/vehicle/lookup')return send(200,await lookupVehicle(body.plate));
      if(path==='/api/vehicle'){
        if(req.method==='GET')return send(200,db.prepare('SELECT * FROM vehicle_profile WHERE id=1').get()||null);
        const v=validateVehicle(body);
        db.prepare('INSERT INTO vehicle_profile (id,plate,description,fuel_rate,fuel_price,tank_litres,source) VALUES (1,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET plate=excluded.plate,description=excluded.description,fuel_rate=excluded.fuel_rate,fuel_price=excluded.fuel_price,tank_litres=excluded.tank_litres,source=excluded.source').run(v.plate,v.description,v.fuel_rate,v.fuel_price,v.tank_litres,v.source);
        return send(200,{saved:true});
      }
      if(path==='/api/trips') {
        if(req.method==='GET')return send(200,db.prepare('SELECT * FROM trip_history ORDER BY id DESC').all());
        if(!Number.isSafeInteger(body.id)||body.id<1)throw new AppError(400,'INVALID_INPUT','Select a valid history entry.');
        if(req.method==='PATCH') {
          const labels={actual_km:'Distance (km)',actual_minutes:'Time spent (minutes)',fuel_rate:'Fuel consumption (L/100 km)',fuel_price:'Fuel price (NZ$/litre)'};
          for(const [field,label] of Object.entries(labels))if(body[field]!==null&&(!Number.isFinite(body[field])||body[field]<0||body[field]>1000000))throw new AppError(400,'INVALID_INPUT',label+' must be a number between 0 and 1,000,000, or left blank.');
          if(typeof body.trip_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body.trip_date)||!Number.isFinite(Date.parse(body.trip_date))||new Date(body.trip_date).toISOString().slice(0,10)!==body.trip_date)throw new AppError(400,'INVALID_INPUT','Enter a valid trip date.');
          const result=db.prepare('UPDATE trip_history SET actual_km=?,actual_minutes=?,fuel_rate=?,fuel_price=?,trip_date=? WHERE id=?').run(body.actual_km,body.actual_minutes,body.fuel_rate,body.fuel_price,body.trip_date,body.id);
          if(!result.changes)throw new AppError(404,'NOT_FOUND','History entry not found.');
          return send(200,{saved:true});
        }
        if(!db.prepare('DELETE FROM trip_history WHERE id=?').run(body.id).changes)throw new AppError(404,'NOT_FOUND','History entry not found.');
        return send(200,{deleted:true});
      }
      if(path==='/api/search') {
        if(typeof body.query!=='string'||!body.query.trim()||body.query.length>200)throw new AppError(400,'INVALID_INPUT','Enter a destination of up to 200 characters.');
        return send(200,await requestGoogle('search',{textQuery:body.query.trim(),pageSize:5}));
      }
      if(path==='/api/route') {
        const o=body.origin;
        const namedOrigin=typeof o?.placeId==='string'&&!!o.placeId.trim()&&o.placeId.length<=300;
        const coordinateOrigin=o&&Number.isFinite(o.lat)&&Number.isFinite(o.lng)&&Math.abs(o.lat)<=90&&Math.abs(o.lng)<=180;
        if(!namedOrigin&&!coordinateOrigin)throw new AppError(400,'LOCATION_REQUIRED','Your starting point is not ready.','Search and select a starting place, or click Use my location.');
        if(typeof body.placeId!=='string'||!body.placeId.trim()||body.placeId.length>300)throw new AppError(400,'DESTINATION_REQUIRED','No valid destination selected.','Search for a place and click one of the results before calculating your drive.');
        if(body.tripLabel!==undefined&&(typeof body.tripLabel!=='string'||!body.tripLabel.trim()||body.tripLabel.length>200))throw new AppError(400,'INVALID_INPUT','Enter a trip label of up to 200 characters.');
        if(body.historyId!==undefined){
          if(!Number.isSafeInteger(body.historyId)||body.historyId<1)throw new AppError(400,'INVALID_INPUT','Select a valid history entry.');
          if(!db.prepare('SELECT id FROM trip_history WHERE id=? AND place_id=?').get(body.historyId,body.placeId))throw new AppError(404,'NOT_FOUND','History entry no longer matches this destination.');
        }
        const data=await requestGoogle('route',{origin:namedOrigin?{placeId:o.placeId}:{location:{latLng:{latitude:o.lat,longitude:o.lng}}},destination:{placeId:body.placeId},travelMode:'DRIVE',routingPreference:'TRAFFIC_AWARE',departureTime:new Date(Date.now()+60_000).toISOString()});
        let historySaved=false;
        const vehicle=db.prepare('SELECT * FROM vehicle_profile WHERE id=1').get();
        try {
          db.exec('BEGIN');
          historySaved=recordTrip(db,body.placeId,body.tripLabel?.trim()||'Trip destination',data,body.historyId);
          if(historySaved&&vehicle){const id=body.historyId??Number(db.prepare('SELECT last_insert_rowid() AS id').get().id);db.prepare('UPDATE trip_history SET fuel_rate=COALESCE(fuel_rate,?),fuel_price=COALESCE(fuel_price,?) WHERE id=?').run(vehicle.fuel_rate,vehicle.fuel_price,id);}
          db.exec('COMMIT');
        } catch {db.exec('ROLLBACK');console.error('[Spikta] Trip history could not be saved.');historySaved=false;}
        const km=data.routes?.[0]?.distanceMeters/1000;
        return send(200,{...data,historySaved,fuel:vehicle&&Number.isFinite(km)?{litres:km*vehicle.fuel_rate/100,cost:km*vehicle.fuel_rate*vehicle.fuel_price/100,costPerKm:vehicle.fuel_rate*vehicle.fuel_price/100}:null});
      }
      if(req.method==='GET')return send(200,db.prepare('SELECT * FROM places ORDER BY id DESC').all());
      if(req.method==='POST') {
        if(typeof body.placeId!=='string'||!body.placeId.trim()||body.placeId.length>300||typeof body.label!=='string'||!body.label.trim()||body.label.length>150)throw new AppError(400,'INVALID_INPUT','Select a place and enter your own label of up to 150 characters.');
        db.prepare('INSERT INTO places (place_id,label) VALUES (?,?) ON CONFLICT(place_id) DO UPDATE SET label=excluded.label').run(body.placeId,body.label.trim());return send(200,{saved:true});
      }
      if(!Number.isSafeInteger(body.id)||body.id<1)throw new AppError(400,'INVALID_INPUT','Select a valid saved place.');
      if(!db.prepare('DELETE FROM places WHERE id=?').run(body.id).changes)throw new AppError(404,'NOT_FOUND','Saved place not found.');
      return send(200,{deleted:true});
    }
    if (req.method !== 'GET') {res.setHeader('Allow','GET');throw new AppError(405,'METHOD_NOT_ALLOWED','This request method is not supported.');}
    if (path === '/api/status') return send(200,{ready:true});
    if (path.startsWith('/api/')) return send(404,{error:'Endpoint not found.',code:'NOT_FOUND'});
    const files = {'/':['road-trip.html','text/html'],'/dashboard':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css'],'/road-trip':['road-trip.html','text/html'],'/road-trip.js':['road-trip.js','text/javascript'],'/history':['history.html','text/html'],'/history.js':['history.js','text/javascript'],'/car':['car.html','text/html'],'/car.js':['car.js','text/javascript'],'/daily.js':['daily.js','text/javascript'],'/day-dashboard.js':['day-dashboard.js','text/javascript']};
    const file = files[path];
    if (!file) return send(404,{error:'Page not found.',code:'NOT_FOUND'});
    res.writeHead(200,{'Content-Type':file[1]+'; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'"});
    res.end(readFileSync(new URL('./public/'+file[0],import.meta.url)));
  } catch(error) {
    const known = error instanceof AppError;
    if(known&&error.status===400)console.error('[Spikta validation]',JSON.stringify({path:new URL(req.url,'http://localhost').pathname,code:error.code,message:error.message}));
    if(!known)console.error('[Spikta] Unexpected server error:',error.name);
    send(known?error.status:500,{error:known?error.message:'The server could not complete the request.',code:known?error.code:'INTERNAL_ERROR',action:known?error.action:'Try again later.'});
  }
}).listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log('Spikta is ready at http://localhost:'+(process.env.PORT||3000)));
