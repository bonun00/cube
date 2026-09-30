-- 기록 세우기 순위표 (Supabase → SQL Editor 에 붙여 넣고 Run)
--
-- 여러 번 실행해도 된다 — 표·기록은 그대로 두고 없는 것만 만들거나 바꾼다.
-- (예전 버전의 "표 지우기" 줄은 기록이 쌓인 뒤라 뺐다)
--
-- 사이트가 다 맞춘 기록(닉네임, 시간, 돌린 수)을 공개 키로 records 표에 바로 넣고,
-- 순위표는 best_records 뷰(사람마다 역대 최고 기록 한 줄)로 읽는다. 서버 함수는 없다.
--
-- 기록이 진짜인지 서버가 다시 확인하지 않는다(사용자 결정: 단순하게). 그래서 공개 키로 가짜 기록을
-- 넣을 수 있다. 아래 check 제약으로 사람이 낼 수 없는 기록(초당 15수 넘게, 15수 미만)만 DB 가 거절한다.
--
-- 공개 키로 할 수 있는 것: records 에 넣기, 순위 뷰 읽기, rename_me 로 "내" 기록 이름 바꾸기.
-- 표를 직접 읽거나 남의 기록을 고치거나 지우지는 못한다.

create table if not exists public.records (
  id          bigint      generated always as identity primary key,
  client_id   uuid        not null,     -- 브라우저마다 만든 무작위 id (사람마다 최고 기록을 묶는 단위)
  nickname    text        not null check (char_length(nickname) between 2 and 12),
  time_ms     integer     not null check (time_ms between 1 and 3 * 3600 * 1000),  -- 첫 수부터 마지막 수까지
  moves_count integer     not null check (moves_count between 15 and 2000),        -- 되돌리기 포함, 통째 회전 제외
  created_at  timestamptz not null default now(),
  -- 사람 속도: 평균 초당 15수를 넘으면 거절 (15수 = 1000ms)
  constraint human_speed check (time_ms * 15 >= (moves_count - 1) * 1000)
);
create index if not exists records_time_idx   on public.records (time_ms);
create index if not exists records_client_idx on public.records (client_id, created_at desc);

alter table public.records enable row level security;
-- 넣기만 허용. 읽기·고치기·지우기 정책은 만들지 않는다.
drop policy if exists "누구나 기록 넣기" on public.records;
create policy "누구나 기록 넣기" on public.records for insert to anon, authenticated with check (true);
grant insert on public.records to anon, authenticated;

-- 역대 순위: 기기마다 가장 빠른 기록 한 줄. 이름은 그 기기가 가장 최근에 쓴 닉네임.
-- 기기 id 는 보여주지 않는다.
create or replace view public.best_records as
select
  (select r2.nickname from public.records r2
    where r2.client_id = b.client_id order by r2.created_at desc limit 1) as nickname,
  b.time_ms, b.moves_count, b.created_at
from (
  select distinct on (client_id) client_id, time_ms, moves_count, created_at
  from public.records
  order by client_id, time_ms asc, created_at asc
) b;
grant select on public.best_records to anon, authenticated;

-- 프로필 이름 바꾸기: 내 기기 id 의 기록 이름을 전부 바꿔서 순위표에 바로 반영한다.
-- 기기 id 는 그 브라우저 안에만 있으니, 남의 이름은 바꿀 수 없다. 바꾼 줄 수를 돌려준다.
create or replace function public.rename_me(p_client_id uuid, p_nickname text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
  nick text := trim(p_nickname);
begin
  if char_length(nick) not between 2 and 12 then
    raise exception using errcode = '23514', message = '닉네임은 2~12자';
  end if;
  update public.records set nickname = nick where client_id = p_client_id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.rename_me(uuid, text) from public;
grant execute on function public.rename_me(uuid, text) to anon, authenticated;
