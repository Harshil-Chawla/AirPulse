# Evidence still to capture

Automated-tests.txt is an actual local test run. It is NOT proof of a live PostgreSQL connection. If the live API test is skipped, record that limitation.

Run DE/run-queries.mjs from server to create query-execution.txt with actual database outputs. Until that file exists and confirms successful rollback, the SQL execution requirement is pending. The query guide's expected outputs must not be passed off as actual results.

Capture in normal-mode application:
- Database table browser showing Station and Reading, with no secrets visible.
- Reading count and newest row before and after a mobile simulation click.
- Corresponding station map/history update and persistence after browser reload.
- API db-health and station listing responses.
- Required video recording; use ../07-video-script.md as the sequence.

No browser screenshots, live query output or video were fabricated for this pack. This environment may block live networking or PostgreSQL. The student's earlier reports of successful hosted operation are not substituted for actual saved evidence.
