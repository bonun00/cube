-- 기록 세우기 순위표 (Supabase → SQL Editor 에 붙여 넣고 Run)
--
-- 사이트가 다 맞춘 기록(닉네임, 시간, 돌린 수)을 공개 키로 records 표에 바로 넣고,
-- 순위표는 best_records 뷰(사람마다 역대 최고 기록 한 줄)로 읽는다. 서버 함수는 없다.
--
-- 기록이 진짜인지 서버가 다시 확인하지 않는다(사용자 결정: 단순하게). 그래서 공개 키로 가짜 기록을
-- 넣을 수 있다. 아래 check 제약으로 사람이 낼 수 없는 기록(초당 15수 넘게, 15수 미만)만 DB 가 거절한다.
--
-- 공개 키로 할 수 있는 건 records 에 "넣기"뿐이다. 표를 직접 읽거나 고치거나 지우지는 못한다.

-- 앞선 버전을 실행했었다면 정리한다. 데이터가 쌓이기 전에 바뀌었으니 지워도 된다.
drop view  if exists public.daily_best;
drop table if exists public.solves;
drop view  if exists public.best_records;
drop table if exists public.records;
drop table if exists public.attempts;

create table public.records (
  id          bigint      generated always as identity primary key,
  client_id   uuid        not null,     -- 브라우저마다 만든 무작위 id (사람마다 최고 기록을 묶는 단위)
  nickname    text        not null check (char_length(nickname) between 2 and 12),
  time_ms     integer     not null check (time_ms between 1 and 3 * 3600 * 1000),  -- 첫 수부터 마지막 수까지
  moves_count integer     not null check (moves_count between 15 and 2000),        -- 뒤집기(x2) 뺀 수
  created_at  timestamptz not null default now(),
  -- 사람 속도: 평균 초당 15수를 넘으면 거절 (15수 = 1000ms)
  constraint human_speed check (time_ms * 15 >= (moves_count - 1) * 1000)
);
create index records_time_idx   on public.records (time_ms);
create index records_client_idx on public.records (client_id, created_at desc);

alter table public.records enable row level security;
-- 넣기만 허용. 읽기·고치기·지우기 정책은 만들지 않는다.
create policy "누구나 기록 넣기" on public.records for insert to anon, authenticated with check (true);
grant insert on public.records to anon, authenticated;

-- 역대 순위: 기기마다 가장 빠른 기록 한 줄. 이름은 그 기기가 가장 최근에 쓴 닉네임
-- (닉네임을 바꾸면 다음 기록부터 순위표 이름도 바뀐다). 기기 id 는 보여주지 않는다.
create view public.best_records as
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
