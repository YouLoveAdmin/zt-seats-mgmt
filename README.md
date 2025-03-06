Use Secret list for,
1. ACCOUNT_ID
2. API_KEY
3. USER_EMAIL

Commands used for Secret list:

wrangler secret put ACCOUNT_ID
wrangler secret put API_KEY
wrangler secret put USER_EMAIL

- Hard coded 5 days and batch execution of 50 in code.
- Defined cron in the Wrangler.jsonc file to run every day 8:01 AM UTC. Manual triggering supported as well.
