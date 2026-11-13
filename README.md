# AirPulse

Student prototype for comparing fixed, mobile and drone pollution readings around Delhi. Movement creates simulated measurements. No physical sensors or external provider feed is connected.

## Frontend preview

Run with standalone in-memory demo data (no database or backend required):

```sh
cd client
npm ci
cp .env.example .env
# Set VITE_DEMO_MODE=true in .env, or pass directly:
VITE_DEMO_MODE=true npm run dev
```

Demo mode uses in-memory data and makes no backend requests. Reloading resets the preview. Select a mobile or drone station before using its movement button. Map tiles still require internet. Normal mode uses the API; failed API calls never silently substitute sample data.

## Full application

Install dependencies with `npm ci` in both client and server. Copy `server/.env.example` to `server/.env` and set DATABASE_URL to a dedicated PostgreSQL database. ENABLE_SIMULATION must be true to enable the demo write routes. These routes have no user authentication, so disable them for public hosting. CLIENT_ORIGIN controls browser CORS and is not authentication.

For an isolated local database, if PostgreSQL is installed and these paths do not already contain a cluster:

```sh
initdb -D "$HOME/Documents/PROJECTS/AirPulse-db" -A trust -U airpulse
pg_ctl -D "$HOME/Documents/PROJECTS/AirPulse-db" -l "$HOME/Documents/PROJECTS/AirPulse-db.log" -o '-h 127.0.0.1 -p 5433' start
createdb -h 127.0.0.1 -p 5433 -U airpulse airpulse
```

The example URL matches this local database. Trust authentication is for this local-only development cluster.

From server:

```sh
npx prisma generate
npx prisma migrate deploy
npm run seed
npm start
```

From client in a second terminal:

```sh
npm run dev
```

Vite proxies /api to localhost:3000. For separate hosting set VITE_API_URL before building. A same-origin production deployment must forward /api to the API server.

## Checks

```sh
node --test server/test/*.test.js client/test/*.test.js
npm --prefix client run build
npm --prefix client run lint
```

Once the API and seeded database are running:

```sh
AIRPULSE_TEST_URL=http://localhost:3000 node --test server/test/live.test.js
```

The live check reads real station/history endpoints and database health. It does not insert or delete records. Manually select and move both a mobile and drone station, verify history/coordinates update, export history, and stop the API to check the refresh error display. Check keyboard station selection and switch stations while requests are pending.

## Data behavior

- History defaults to the latest 200 records, with a maximum limit of 1000. An optional `since` query filters by timestamp.
- Simulated pollutant values use the original reading as their baseline to avoid compounding drift. Unknown AQI remains null. Drone steps are larger than mobile steps.
- Area summaries group the latest reading from each station into approximate 1 km cells around Delhi. Only readings from the last hour are included. The average and spread are exploratory comparisons, not an official area AQI or a validated spatial model. Different measurement times and sparse coverage still limit representativeness.
- CSV exports only displayed history. Potential spreadsheet formulas are neutralized.
- The demo retains at most 200 readings per station in memory. Real database history is retained until explicitly maintained; API limits do not delete it.

## Verification record: 2026-11-13

Passed: frontend production build, ESLint, server JavaScript syntax, and 11 automated tests for history validation, simulation, coordinate bounds, missing data, area freshness, CSV and demo behavior.

Not verified: actual API/PostgreSQL integration or browser interaction. One live test is deliberately skipped unless AIRPULSE_TEST_URL is supplied. This session cannot resolve the npm registry or GitHub, cannot initialize PostgreSQL shared memory, and cannot bind the Vite localhost port. The build warns about the main JavaScript chunk exceeding 500 kB; the map is loaded separately, but chart code still contributes to the main bundle.

## Source and commit transfer

The latest ZIP identifies upstream commit d15d5269022bfe0b1c36ee95fc7da09aba54625c. Its files were preserved in local snapshot commit 7fc2468 before the 15 improvement commits. The teammate's refresh button and baseline simulation changes were retained. Remote Git history could not be fetched here.

Do not force-push the snapshot over team history. From a network-enabled terminal, fetch and confirm the ZIP commit belongs to current remote main, then rebase only the 15 improvement commits onto it:

```sh
git fetch origin &&
git merge-base --is-ancestor d15d5269022bfe0b1c36ee95fc7da09aba54625c origin/main &&
git branch backup-airpulse-before-sync &&
git rebase --onto origin/main 7fc2468 main
```

If there is a conflict, stop and review it with the teammate. Run the full application checks above before `git push origin main`. This preserves remote history and excludes the local ZIP snapshot commit. If remote main changes again, fetch and rebase again rather than force-pushing.
