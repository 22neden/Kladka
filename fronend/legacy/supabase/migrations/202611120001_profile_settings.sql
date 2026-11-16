-- Apply AFTER 202611110001_initial.sql. Public profile extensions + private settings.
alter table public.profiles
  add column avatar_url text not null default '' check (length(avatar_url) <= 2048),
  add column specialties text[] not null default '{}' check (specialties <@ array['renovation','electric','plumbing','tile','painting','building','roof','design']::text[]),
  add column experience_years integer not null default 0 check (experience_years between 0 and 80),
  add column availability text not null default 'available' check (availability in ('available','busy'));
grant update(avatar_url,specialties,experience_years,availability) on public.profiles to authenticated;

create table public.account_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text not null default '' check (length(phone)<=24),
  newsletter_opt_in boolean not null default false,
  newsletter_changed_at timestamptz not null default now()
);
alter table public.account_settings enable row level security;
revoke all on public.account_settings from anon,authenticated;
grant select on public.account_settings to authenticated;
grant update(phone,newsletter_opt_in) on public.account_settings to authenticated;
create policy own_settings_read on public.account_settings for select to authenticated using(user_id=(select auth.uid()));
create policy own_settings_update on public.account_settings for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create function public.create_account_settings() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.account_settings(user_id,newsletter_opt_in) values(new.id, coalesce(new.raw_user_meta_data->>'newsletter_opt_in','false')='true');
 return new;
end; $$;
create trigger settings_for_new_user after insert on auth.users for each row execute function public.create_account_settings();
insert into public.account_settings(user_id,newsletter_opt_in) select id, coalesce(raw_user_meta_data->>'newsletter_opt_in','false')='true' from auth.users on conflict do nothing;
create function public.settings_timestamp() returns trigger language plpgsql set search_path='' as $$
begin
 if new.newsletter_opt_in is distinct from old.newsletter_opt_in then new.newsletter_changed_at=now(); end if;
 return new;
end; $$;
create trigger settings_consent_time before update on public.account_settings for each row execute function public.settings_timestamp();
revoke all on function public.create_account_settings(),public.settings_timestamp() from public;
