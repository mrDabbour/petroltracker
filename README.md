# Spikta V1

A personal progress dashboard with a 90s desktop style, turquoise navigation and charcoal background. Starting Point is your current baseline/progress inside Spikta.

Requires Node.js 24. Run `npm start` and visit http://localhost:3000. Road Trip is the homepage; the progress Dashboard is at http://localhost:3000/dashboard and requires no external APIs. The server binds to localhost.

Enter your baseline and press Save Starting Point. The snapshot updates immediately and persists in this browser's local storage. This is device-local storage, not cloud sync. Firebase is unchanged.

Road Trip is at http://localhost:3000/ (also available at /road-trip). It uses Places API (New) Text Search and Routes API Compute Routes, through server-only `/api/search` and `/api/route` endpoints. Set `GOOGLE_MAPS_API_KEY` in your local `.env` and restart. `.env` is ignored by Git; never commit or share the key. Enable Places API (New), Routes API and billing in the key's Google Cloud project. Restrict the key to these two APIs and the server's public outbound IP, not website/referrer restrictions. Google usage can incur charges.

Saved places reuse `data/places.sqlite`, preserving previous entries. Only the Google place ID, your own label and creation date are stored; current location and live search/route results are not persisted. Location is requested only on the Road Trip page when you press Use my location. All browser requests stay on the local server. Provider error diagnostics are logged server-side with API keys redacted; frontend messages contain no provider credentials. Public deployment requires authentication, HTTPS and request limits.

Run `npm run check` and `npm test` for checks.

My Car at `/car` saves a vehicle profile and calculates fuel-only NZ$/km and optional full-tank cost. New route calculations snapshot that profile's fuel consumption and price into history, so changing prices later does not rewrite previous trips. Enter verified L/100 km and your own fuel price; no consumption figure is guessed from make/model.

The homepage has three sections: My Car, trip planner and Today's Trips. Today's totals group trips by Pacific/Auckland calendar date (or your manually entered trip date), automatically starting a new day at midnight. Previous days remain in History with a date selector, distance, driving time and fuel-cost totals. Calculations are planned trips; actual readings override route estimates. Trips without vehicle fuel data are excluded from fuel-cost totals and their coverage is shown.

Optional NZ plate lookup uses the documented RegCheck SOAP `CheckNewZealand` operation server-side. Set `REGCHECK_USERNAME` in `.env` to your provider account username and restart. The provider offers trial credits; no account or credits are bundled. Lookup returns vehicle identification only; enter fuel consumption separately because the documented NZ response does not supply it. Manual profiles do not need a provider account. Source: https://www.carregistrationapi.nz/data/api-docs.aspx
