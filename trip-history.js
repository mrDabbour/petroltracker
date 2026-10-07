export function initializeHistory(db) {
  db.exec('CREATE TABLE IF NOT EXISTS trip_history (id INTEGER PRIMARY KEY, place_id TEXT NOT NULL, label TEXT NOT NULL, created_at TEXT NOT NULL)');
  const columns=new Set(db.prepare('PRAGMA table_info(trip_history)').all().map(c=>c.name));
  for(const name of ['actual_km','actual_minutes','fuel_rate','fuel_price','estimated_km','estimated_minutes'])if(!columns.has(name))db.exec(`ALTER TABLE trip_history ADD COLUMN ${name} REAL`);
  if(!columns.has('trip_date'))db.exec('ALTER TABLE trip_history ADD COLUMN trip_date TEXT');
}
export function recordTrip(db,placeId,label,data,historyId) {
  const route=data?.routes?.[0];
  if(!route||!Number.isFinite(route.distanceMeters)||route.distanceMeters<0||typeof route.duration!=='string'||!/^\d+(\.\d+)?s$/.test(route.duration))return false;
  const seconds=parseFloat(route.duration);
  if(!Number.isFinite(seconds))return false;
  if(historyId!==undefined){
    return !!db.prepare('UPDATE trip_history SET estimated_km=?,estimated_minutes=? WHERE id=? AND place_id=?').run(route.distanceMeters/1000,seconds/60,historyId,placeId).changes;
  }
  db.prepare('INSERT INTO trip_history (place_id,label,created_at,estimated_km,estimated_minutes) VALUES (?,?,?,?,?)').run(placeId,label,new Date().toISOString(),route.distanceMeters/1000,seconds/60);
  return true;
}
