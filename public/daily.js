export function nzDay(value=new Date()){
  const parts=new Intl.DateTimeFormat('en-NZ',{timeZone:'Pacific/Auckland',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
  const get=type=>parts.find(p=>p.type===type).value;
  return get('year')+'-'+get('month')+'-'+get('day');
}
export function tripDay(trip){return trip.trip_date||nzDay(trip.created_at);}
export function dailyTotals(trips){
  let km=0,minutes=0,litres=0,cost=0,fuelTrips=0;
  for(const trip of trips){
    const distance=trip.actual_km??trip.estimated_km,time=trip.actual_minutes??trip.estimated_minutes;
    if(Number.isFinite(distance))km+=distance;
    if(Number.isFinite(time))minutes+=time;
    if(Number.isFinite(distance)&&Number.isFinite(trip.fuel_rate)&&Number.isFinite(trip.fuel_price)){const fuel=distance*trip.fuel_rate/100;litres+=fuel;cost+=fuel*trip.fuel_price;fuelTrips++;}
  }
  return {km,minutes,litres,cost,fuelTrips};
}
