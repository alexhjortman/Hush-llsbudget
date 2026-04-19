# Supabase setup (gör detta EN gång)

Gå till ditt Supabase-projekt → SQL Editor → klistra in detta och kör:

```sql
create table budget (
  id integer primary key,
  month_data jsonb default '{}'::jsonb,
  year_data jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

insert into budget (id) values (1);
```
