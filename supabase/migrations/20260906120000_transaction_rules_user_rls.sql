-- transaction_rules had RLS enabled but no policies, so only the service-role key (used by
-- the process-sms edge function) could read it and no client code could ever write to it.
-- This adds owner-scoped policies so the client can learn categorization rules from a user's
-- manual transaction corrections (see useUpdateTransaction in src/hooks/useFinance.ts).

create policy "Users can view their own transaction rules"
  on public.transaction_rules for select
  using (auth.uid() = user_id);

create policy "Users can insert their own transaction rules"
  on public.transaction_rules for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own transaction rules"
  on public.transaction_rules for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own transaction rules"
  on public.transaction_rules for delete
  using (auth.uid() = user_id);

-- One rule per (user, exact entity pattern) so learning from a correction updates the
-- existing rule for that merchant instead of accumulating duplicates.
create unique index if not exists transaction_rules_user_entity_pattern_key
  on public.transaction_rules (user_id, entity_pattern)
  where entity_pattern is not null;
