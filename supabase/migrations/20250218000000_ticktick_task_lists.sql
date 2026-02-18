-- Mirror TickTick projects as LifeOS task lists: add ticktick_project_id to task_lists
-- so pull can upsert lists by TickTick project id and set tasks.list_id correctly.

alter table task_lists
  add column if not exists ticktick_project_id text;

create unique index if not exists task_lists_user_ticktick_project_idx
  on task_lists (user_id, ticktick_project_id)
  where ticktick_project_id is not null;

comment on column task_lists.ticktick_project_id is 'TickTick project id when list was created from TickTick sync; used to mirror lists.';
