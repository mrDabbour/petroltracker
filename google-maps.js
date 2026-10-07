import { AppError } from './errors.js';
const endpoints = {
  search: ['https://places.googleapis.com/v1/places:searchText', 'places.id,places.displayName,places.formattedAddress'],
  route: ['https://routes.googleapis.com/directions/v2:computeRoutes', 'routes.distanceMeters,routes.duration'],
};
function redact(value, key) {
  return JSON.stringify(value).split(key).join('[REDACTED]').replace(/AIza[\w-]+/g, '[REDACTED]');
}
export async function requestGoogle(service, body, {key=process.env.GOOGLE_MAPS_API_KEY, fetcher=fetch, logger=console.error}={}) {
  if (!key?.trim()) throw new AppError(503,'MAPS_NOT_CONFIGURED','Google Maps is not configured.','Set GOOGLE_MAPS_API_KEY in .env and restart the server.');
  const [url, mask] = endpoints[service];
  let response;
  try {
    response = await fetcher(url, {method:'POST', headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':mask},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  } catch (error) {
    const timeout = ['TimeoutError','AbortError'].includes(error.name);
    logger('[Google Maps]', JSON.stringify({service,code:timeout?'TIMEOUT':'NETWORK_ERROR'}));
    throw new AppError(timeout?504:502,timeout?'GOOGLE_TIMEOUT':'GOOGLE_UNREACHABLE',timeout?'Google Maps took too long to respond.':'The server could not reach Google Maps.','Check connectivity and try again.');
  }
  let data;
  try {data=await response.json();} catch {
    logger('[Google Maps]', JSON.stringify({service,httpStatus:response.status,code:'INVALID_RESPONSE'}));
    throw new AppError(502,'GOOGLE_INVALID_RESPONSE','Google Maps returned an unreadable response.','Try again later.');
  }
  if (!response.ok) {
    const e=data?.error||{};
    // Log provider diagnostics, never request headers, credentials, or request bodies.
    logger('[Google Maps]', redact({service,httpStatus:response.status,error:{code:e.code,status:e.status,message:e.message,details:e.details}},key));
    const reasons=(e.details||[]).map(d=>d.reason||'').join(' ');
    const context=reasons+' '+(e.message||'');
    if (response.status===429) throw new AppError(429,'GOOGLE_QUOTA_EXCEEDED','Google Maps usage limit reached.','Check your project quotas and try again later.');
    if (/BILLING|billing/i.test(context)) throw new AppError(403,'GOOGLE_BILLING_REQUIRED','Google Maps billing is not active.','Activate billing in the project that owns your API key.');
    if (/SERVICE_DISABLED|API.*disabled/i.test(context)) throw new AppError(403,'GOOGLE_API_DISABLED','The required Google Maps API is disabled.','Enable Places API (New) for search and Routes API for driving estimates.');
    if (/API_KEY_INVALID|API key not valid/i.test(context)||response.status===401) throw new AppError(403,'GOOGLE_KEY_INVALID','Google Maps rejected the API key.','Check GOOGLE_MAPS_API_KEY in .env and restart.');
    if (response.status===403) throw new AppError(403,'GOOGLE_PERMISSION_DENIED','Google Maps denied access to this request.','Check active billing, enabled APIs, and key restrictions in the same project. Use server IP restrictions, not website/referrer restrictions.');
    throw new AppError(502,'GOOGLE_SERVICE_ERROR','Google Maps could not complete the request.','See the server terminal for provider diagnostics.');
  }
  return data;
}
