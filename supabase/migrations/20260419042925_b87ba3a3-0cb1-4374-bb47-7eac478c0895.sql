-- Enums
create type public.network_type as enum ('VISA', 'MC', 'AMEX', 'DISCOVER', 'OTHER');
create type public.dispute_reason as enum (
  'unauthorized','product_not_received','product_not_as_described',
  'duplicate_charge','cancelled_recurring','credit_not_processed','other'
);
create type public.case_status as enum ('intake','classified','routed','committed','failed');
create type public.case_priority as enum ('low','normal','high','urgent');
create type public.audit_event_type as enum (
  'session_started','field_captured','classified','completeness_scored','routed','committed','verified'
);

create table public.vendor_registry (
  id text primary key,
  name text not null,
  description text,
  supports_networks public.network_type[] not null default '{}',
  supports_reasons public.dispute_reason[] not null default '{}',
  reason_code_map jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.routing_rules (
  id text primary key,
  priority int not null,
  network public.network_type,
  reason public.dispute_reason,
  min_amount_cents int,
  max_amount_cents int,
  vendor_id text not null references public.vendor_registry(id),
  reason_code text,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index routing_rules_priority_idx on public.routing_rules(priority);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status public.case_status not null default 'intake',
  priority public.case_priority not null default 'normal',
  network public.network_type,
  amount_cents int,
  currency text default 'USD',
  merchant text,
  transaction_date date,
  last4 text,
  customer_name text,
  customer_contact_masked text,
  description text,
  dispute_reason public.dispute_reason,
  classification_confidence numeric,
  completeness_score numeric,
  missing_fields text[] default '{}',
  routed_vendor_id text references public.vendor_registry(id),
  routed_rule_id text references public.routing_rules(id),
  routed_reason_code text,
  scored_alternatives jsonb default '[]'::jsonb,
  raw_transcript text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cases_user_id_idx on public.cases(user_id);
create index cases_status_idx on public.cases(status);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null,
  seq int not null,
  event_type public.audit_event_type not null,
  payload jsonb not null default '{}'::jsonb,
  prev_hash text,
  hash text not null,
  created_at timestamptz not null default now(),
  unique (case_id, seq)
);
create index audit_events_case_idx on public.audit_events(case_id, seq);

alter table public.cases enable row level security;
alter table public.audit_events enable row level security;
alter table public.vendor_registry enable row level security;
alter table public.routing_rules enable row level security;

create policy "cases_select_own" on public.cases for select to authenticated using (auth.uid() = user_id);
create policy "cases_insert_own" on public.cases for insert to authenticated with check (auth.uid() = user_id);
create policy "cases_update_own" on public.cases for update to authenticated using (auth.uid() = user_id);

create policy "audit_select_own" on public.audit_events for select to authenticated using (auth.uid() = user_id);
create policy "audit_insert_own" on public.audit_events for insert to authenticated with check (auth.uid() = user_id);

create policy "vendors_read_all" on public.vendor_registry for select to authenticated using (true);
create policy "rules_read_all" on public.routing_rules for select to authenticated using (true);

create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger cases_updated_at before update on public.cases
  for each row execute function public.tg_set_updated_at();

insert into public.vendor_registry (id, name, description, supports_networks, supports_reasons, reason_code_map) values
  ('V01','Visa TC40 Direct','Visa fraud/dispute filing channel', ARRAY['VISA']::public.network_type[],
    ARRAY['unauthorized','product_not_received','product_not_as_described','duplicate_charge','cancelled_recurring','credit_not_processed']::public.dispute_reason[],
    '{"unauthorized":"10.4","product_not_received":"13.1","product_not_as_described":"13.3","duplicate_charge":"12.6.1","cancelled_recurring":"13.2","credit_not_processed":"13.6"}'::jsonb),
  ('V02','Visa VROL','Visa Resolve Online dispute portal', ARRAY['VISA']::public.network_type[],
    ARRAY['unauthorized','product_not_received','product_not_as_described','duplicate_charge']::public.dispute_reason[],
    '{"unauthorized":"10.4","product_not_received":"13.1","product_not_as_described":"13.3","duplicate_charge":"12.6.1"}'::jsonb),
  ('M01','Mastercard SAFE','Mastercard fraud reporting', ARRAY['MC']::public.network_type[],
    ARRAY['unauthorized','duplicate_charge','product_not_received','cancelled_recurring']::public.dispute_reason[],
    '{"unauthorized":"4837","product_not_received":"4855","duplicate_charge":"4834","cancelled_recurring":"4841"}'::jsonb),
  ('C01','Chargeback911','Multi-network dispute management', ARRAY['VISA','MC','AMEX','DISCOVER']::public.network_type[],
    ARRAY['unauthorized','product_not_received','product_not_as_described','duplicate_charge','cancelled_recurring','credit_not_processed','other']::public.dispute_reason[],
    '{}'::jsonb),
  ('I01','Internal Ops Queue','Manual review by internal operations', ARRAY['VISA','MC','AMEX','DISCOVER','OTHER']::public.network_type[],
    ARRAY['unauthorized','product_not_received','product_not_as_described','duplicate_charge','cancelled_recurring','credit_not_processed','other']::public.dispute_reason[],
    '{}'::jsonb);

insert into public.routing_rules (id, priority, network, reason, min_amount_cents, max_amount_cents, vendor_id, reason_code, description) values
  ('R01', 10, 'VISA','unauthorized', 10000, null, 'V01','10.4','VISA unauthorized >= $100 → TC40'),
  ('R02', 20, 'VISA', null, null, null, 'V02', null, 'VISA other → VROL'),
  ('R03', 30, 'MC',   null, null, null, 'M01', null, 'Mastercard → SAFE'),
  ('R04', 90, null,   null, null, null, 'C01', null, 'Fallback → Chargeback911');