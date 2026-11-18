-- Deleting an account must remove everything the user owns. These two tables were the only ones
-- whose user_id foreign key did not cascade, so deleting the auth user would have failed.
alter table public.bank_senders drop constraint bank_senders_user_id_fkey,
  add constraint bank_senders_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.transaction_rules drop constraint transaction_rules_user_id_fkey,
  add constraint transaction_rules_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
