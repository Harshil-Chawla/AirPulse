# Query explanations and expected results

Execute with run-queries.mjs, which installs the fixture, runs queries.sql inside the same transaction and rolls it back. Do not run queries.sql alone against the production public schema.

The following are EXPECTED results from the deterministic fixture, not execution receipts:

| Query | Purpose / SQL concept | Expected fixture result |
|---|---|---|
| Q01 | Select mobile stations in Delhi; WHERE | Station 2 |
| Q02 | Recent history; ORDER BY/LIMIT | Reading IDs 4, 3, 2 |
| Q03 | Attribute measurements to stations; INNER JOIN | Four observation rows |
| Q04 | Historical summaries; LEFT JOIN, COUNT, AVG, MAX, GROUP BY | Fixed: count 1/avg 165; mobile: count 2/avg 195/max 200; drone: count 1/avg 135 |
| Q05 | Repeated elevated readings; HAVING | Station 2, elevated_count 2 |
| Q06 | Compare latest reporting values; DISTINCT ON | Station AQIs 165, 200, 135 |
| Q07 | Find above-own-average observations; correlated subquery | Reading 4, AQI 200 |
| Q08 | Retrieve a measurement interval; inclusive time filters | Reading 4 |
| Q09 | Register a temporary monitoring asset; INSERT RETURNING | Station 900 |
| Q10 | Correct station identity; UPDATE RETURNING | Corrected name on station 900 |
| Q11 | Append an observation; INSERT with FK | Reading 900 references station 900 |
| Q12 | Retire test asset; DELETE plus cascade check | Station 900 deleted; zero remaining readings for 900 |

Fixed AQI thresholds here are selection criteria for a demonstration, not health advice. Grouped averages summarize stored history; they are not official regional AQIs. MAX in Q04 is the maximum historical observation, distinct from the dashboard's highest latest-station value. RecordedAt and id are both used for deterministic ordering where applicable.

Expected results are useful for explaining the query but do not replace the mandatory actual execution output in evidence/query-execution.txt.
