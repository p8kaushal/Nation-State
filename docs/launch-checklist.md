# Launch checklist

Work through this checklist against the exact commit intended for production.

## Cloud saves and accounts

- Back up the Supabase database. Apply `supabase/migrations/202611030001_save_conflict_protection.sql` before deploying the client, and verify that the migration succeeded. New projects can use `supabase/schema.sql` instead.
- Check the live table grants and row-level security policies against the schema. With two test accounts, verify that neither can read, change, or delete the other's saves, run history, or achievements.
- With two browsers signed in to the same account, load the same save, advance on both, and verify the second upload reports a conflict. Verify both the local and cloud copies remain intact, and test the restore action. Repeat with an interrupted network connection and after refreshing the page.
- Test guest play, signing in during a guest game, signing out, switching accounts on one browser, deleting a save, and clearing run history. Existing unscoped local data remains in the guest storage keys; there is no automatic migration into an account.
- Decide and document the procedure for account deletion, data retention, backup restoration, and support requests. Do not promise an in-app account deletion feature until one exists.

## Sign-in and deployment

- Configure the Google consent screen, audience, production publishing status, branding and any required verification. Add the Supabase callback URL in Google Cloud; configure the production site and redirect URLs in Supabase.
- Set the public Supabase URL and publishable/anon key in the deployment environment. Keep the Google client secret and Supabase service-role key out of the browser and Git.
- Test sign-in and sign-out on the production domain with a Google account outside the test-user list; test declined consent and a failed network request.
- Confirm the production deployment uses the intended commit, Node version, build command and environment variables. Test the deployment on desktop and mobile, including a full game, page reload, save, loss and win report cards.
- Publish an accurate privacy policy and a way to contact support. Configure error monitoring, uptime checks, database backups and a rollback procedure.

## Known limits

- The client uses browser storage for offline progress. Browser storage can be cleared or unavailable; do not represent it as a guaranteed backup.
- Save conflict protection requires the migration and a real integration test. Concurrent tabs on the same browser share local storage, so verify or restrict that usage before promising safe multi-tab play.
- The simulation and achievements run on the client. Players can modify their own results; do not treat them as a trusted leaderboard or competitive record.
