-- Add extended transaction fields: time, bank, transaction_type, entity, direction, account
-- (Date, Time, Cash Flow, Amount, Bank, Type, Entity, Direction, Account, Details, Category)

alter table transactions
  add column if not exists time time,
  add column if not exists bank text,
  add column if not exists transaction_type text,
  add column if not exists entity text,
  add column if not exists direction text,
  add column if not exists account text;

comment on column transactions.time is 'Time of day (e.g. 13:38)';
comment on column transactions.bank is 'Bank name (e.g. QNB)';
comment on column transactions.transaction_type is 'Transaction type (e.g. IPN Transfer)';
comment on column transactions.entity is 'Counterparty or entity name';
comment on column transactions.direction is 'In or Out';
comment on column transactions.account is 'Account identifier (e.g. ***50)';
