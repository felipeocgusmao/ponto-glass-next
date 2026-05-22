create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  unique (employee_id)
);
