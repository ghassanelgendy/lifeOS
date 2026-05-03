-- Allow authenticated users to "claim" push_subscriptions that have user_id null
-- (e.g. created as anon before login). Required so prayer/task reminder dispatch can
-- find subscriptions by user_id after the user enables push and logs in.
create policy "Authenticated can claim null user push_subscriptions"
  on push_subscriptions for update
  to authenticated
  using (user_id is null)
  with check (user_id = auth.uid());
