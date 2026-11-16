-- Only Constructions v1. Run once in a NEW Supabase project's SQL Editor.
-- No sample users, fake reviews or sample listings are inserted into the live database.
begin;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  city text not null default '' check (char_length(city) <= 80),
  bio text not null default '' check (char_length(bio) <= 1500),
  role text not null default 'customer' check (role in ('customer','professional')),
  created_at timestamptz not null default now()
);
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('service','request')),
  title text not null check (char_length(btrim(title)) between 8 and 100),
  description text not null check (char_length(btrim(description)) between 30 and 5000),
  category text not null check (category in ('renovation','electric','plumbing','tile','painting','building','roof','design')),
  city text not null check (char_length(btrim(city)) between 2 and 80),
  price numeric check (price >= 0 and price <= 100000000),
  unit text not null default 'об’єкт' check (char_length(unit) <= 20),
  images text[] not null default '{}' check (cardinality(images) <= 6),
  team_name text not null default '' check (char_length(team_name) <= 100),
  status text not null default 'active' check (status in ('active','closed','hidden')),
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
create index listings_search_idx on public.listings(kind, city, category, created_at desc) where status = 'active' and moderation_status = 'approved';
create index listings_owner_idx on public.listings(owner_id);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_a uuid not null references public.profiles(id) on delete cascade,
  participant_b uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (participant_a < participant_b),
  unique (listing_id, participant_a, participant_b)
);
create index conversations_a_idx on public.conversations(participant_a, updated_at desc);
create index conversations_b_idx on public.conversations(participant_b, updated_at desc);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 4000),
  image_path text,
  created_at timestamptz not null default now(),
  check (char_length(btrim(body)) > 0 or image_path is not null),
  check (image_path is null or image_path like conversation_id::text || '/' || sender_id::text || '/%')
);
create index messages_chat_idx on public.messages(conversation_id, created_at desc);
create index messages_sender_idx on public.messages(sender_id, created_at desc);
create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  primary key (user_id, listing_id)
);
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create table public.message_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete cascade,
  reported_id uuid references public.profiles(id) on delete set null,
  listing_id uuid references public.listings(id) on delete set null,
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  status text not null default 'new' check (status in ('new','resolved','dismissed')),
  created_at timestamptz not null default now()
);
create index reports_queue_idx on public.reports(created_at) where status = 'new';

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,name)
  values(new.id, left(coalesce(nullif(new.raw_user_meta_data->>'full_name',''), nullif(new.raw_user_meta_data->>'name',''), 'Новий учасник'),80))
  on conflict(id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.profiles(id,name)
select id,left(coalesce(nullif(raw_user_meta_data->>'full_name',''),nullif(raw_user_meta_data->>'name',''),'Новий учасник'),80) from auth.users on conflict(id) do nothing;

create function public.are_blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() in(a,b) and exists(select 1 from public.blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a))
$$;
create function public.is_chat_member(cid uuid, uid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select uid=auth.uid() and exists(select 1 from public.conversations where id=cid and uid in (participant_a,participant_b))
$$;
create function public.can_message(cid uuid, uid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select uid=auth.uid() and exists(select 1 from public.conversations where id=cid and uid in (participant_a,participant_b) and not public.are_blocked(participant_a,participant_b))
$$;
create function public.start_conversation(target_listing uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  owner uuid;
  cid uuid;
begin
  if uid is null then raise exception 'Потрібно увійти'; end if;
  select owner_id into owner from public.listings where id=target_listing and status='active' and moderation_status='approved';
  if owner is null then raise exception 'Оголошення недоступне'; end if;
  if uid=owner then raise exception 'Не можна написати самому собі'; end if;
  if public.are_blocked(uid,owner) then raise exception 'Користувач недоступний'; end if;
  if (select count(*) from public.conversations where uid in(participant_a,participant_b) and created_at > now()-interval '1 minute') >= 10 then
    raise exception 'Забагато нових чатів. Спробуйте через хвилину';
  end if;
  insert into public.conversations(participant_a,participant_b,listing_id)
    values(least(uid,owner),greatest(uid,owner),target_listing)
    on conflict(listing_id,participant_a,participant_b) do update set updated_at=public.conversations.updated_at
    returning id into cid;
  return cid;
end $$;
create function public.message_before_insert() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_message(new.conversation_id,new.sender_id) then raise exception 'Немає доступу до чату'; end if;
  if (select count(*) from public.messages where sender_id=new.sender_id and created_at > now()-interval '1 minute') >= 30 then
    raise exception 'Забагато повідомлень. Спробуйте через хвилину';
  end if;
  new.created_at := now();
  return new;
end $$;
create trigger message_validate before insert on public.messages for each row execute function public.message_before_insert();
create function public.message_after_insert() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set updated_at=new.created_at where id=new.conversation_id;
  return new;
end $$;
create trigger message_activity after insert on public.messages for each row execute function public.message_after_insert();
create function public.listing_moderation() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='INSERT' then
    new.created_at := now();
    new.moderation_status := 'pending';
  elsif row(new.title,new.description,new.images,new.team_name,new.category) is distinct from row(old.title,old.description,old.images,old.team_name,old.category) then
    new.moderation_status := 'pending';
  end if;
  return new;
end $$;
create trigger listing_review before insert or update on public.listings for each row execute function public.listing_moderation();

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.favorites enable row level security;
alter table public.blocks enable row level security;
alter table public.message_reads enable row level security;
alter table public.reports enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated using (id=(select auth.uid())) with check(id=(select auth.uid()));
create policy listings_read on public.listings for select to authenticated using (
  owner_id=(select auth.uid()) or (status='active' and moderation_status='approved' and not public.are_blocked((select auth.uid()),owner_id))
);
create policy listings_insert on public.listings for insert to authenticated with check(owner_id=(select auth.uid()));
create policy listings_update on public.listings for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy conversations_read on public.conversations for select to authenticated using((select auth.uid()) in(participant_a,participant_b));
create policy messages_read on public.messages for select to authenticated using(public.is_chat_member(conversation_id,(select auth.uid())));
create policy messages_insert on public.messages for insert to authenticated with check(sender_id=(select auth.uid()) and public.can_message(conversation_id,(select auth.uid())));
create policy favorites_read on public.favorites for select to authenticated using(user_id=(select auth.uid()));
create policy favorites_insert on public.favorites for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.listings where id=listing_id));
create policy favorites_delete on public.favorites for delete to authenticated using(user_id=(select auth.uid()));
create policy blocks_read on public.blocks for select to authenticated using(blocker_id=(select auth.uid()));
create policy blocks_insert on public.blocks for insert to authenticated with check(blocker_id=(select auth.uid()));
create policy blocks_delete on public.blocks for delete to authenticated using(blocker_id=(select auth.uid()));
create policy reads_all on public.message_reads for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and public.is_chat_member(conversation_id,(select auth.uid())));
create policy reports_read on public.reports for select to authenticated using(reporter_id=(select auth.uid()));
create policy reports_insert on public.reports for insert to authenticated with check(reporter_id=(select auth.uid()));

-- Supabase default privileges may include broad grants. Explicitly narrow them.
revoke all on public.profiles,public.listings,public.conversations,public.messages,public.favorites,public.blocks,public.message_reads,public.reports from anon, authenticated;
grant select on public.profiles,public.listings,public.conversations,public.messages,public.favorites,public.blocks,public.message_reads,public.reports to authenticated;
grant update(name,city,bio,role) on public.profiles to authenticated;
grant insert(id,owner_id,kind,title,description,category,city,price,unit,images,team_name,status,created_at) on public.listings to authenticated;
grant update(kind,title,description,category,city,price,unit,images,team_name,status) on public.listings to authenticated;
grant insert(id,conversation_id,sender_id,body,image_path,created_at) on public.messages to authenticated;
grant insert,delete on public.favorites,public.blocks to authenticated;
grant insert,update,delete on public.message_reads to authenticated;
grant insert(reporter_id,reported_id,listing_id,reason) on public.reports to authenticated;
revoke all on function public.handle_new_user(),public.are_blocked(uuid,uuid),public.is_chat_member(uuid,uuid),public.can_message(uuid,uuid),public.start_conversation(uuid),public.message_before_insert(),public.message_after_insert(),public.listing_moderation() from public;
grant execute on function public.are_blocked(uuid,uuid),public.is_chat_member(uuid,uuid),public.can_message(uuid,uuid),public.start_conversation(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('portfolio','portfolio',true,5242880,array['image/jpeg','image/png','image/webp']),
 ('chat-images','chat-images',false,5242880,array['image/jpeg'])
on conflict(id) do nothing;
create policy portfolio_insert on storage.objects for insert to authenticated with check(bucket_id='portfolio' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy portfolio_public_read on storage.objects for select to anon,authenticated using(bucket_id='portfolio');
create policy portfolio_delete on storage.objects for delete to authenticated using(bucket_id='portfolio' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy chat_images_read on storage.objects for select to authenticated using(bucket_id='chat-images' and public.is_chat_member(((storage.foldername(name))[1])::uuid,(select auth.uid())));
create policy chat_images_insert on storage.objects for insert to authenticated with check(
  bucket_id='chat-images' and (storage.foldername(name))[2]=(select auth.uid())::text
  and public.can_message(((storage.foldername(name))[1])::uuid,(select auth.uid()))
);

-- Enumerate only the caller's portfolio and media in conversations that will be deleted.
create function public.account_storage_paths() returns table(bucket_id text, name text) language sql stable security definer set search_path='' as $$
  select o.bucket_id,o.name from storage.objects o where
    (o.bucket_id='portfolio' and (storage.foldername(o.name))[1]=auth.uid()::text)
    or (o.bucket_id='chat-images' and (storage.foldername(o.name))[1] in (
      select id::text from public.conversations where auth.uid() in(participant_a,participant_b)
    ))
$$;
revoke all on function public.account_storage_paths() from public;
grant execute on function public.account_storage_paths() to authenticated;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='messages' and schemaname='public') then alter publication supabase_realtime add table public.messages; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='conversations' and schemaname='public') then alter publication supabase_realtime add table public.conversations; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='listings' and schemaname='public') then alter publication supabase_realtime add table public.listings; end if;
end $$;
commit;
