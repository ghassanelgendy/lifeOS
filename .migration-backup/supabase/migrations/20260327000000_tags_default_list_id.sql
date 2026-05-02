-- Tag -> default list mapping for task creation
-- Lets users set e.g. tag "ischool" => default list "Work".
alter table tags
  add column if not exists default_list_id uuid references task_lists(id) on delete set null;

