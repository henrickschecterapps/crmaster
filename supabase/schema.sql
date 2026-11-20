-- ============================================================================
-- CRMaster — Henrique Matos Fotografia & Audiovisual (Belo Horizonte)
-- Schema completo (Fase 1 + Fase 2) para Supabase (PostgreSQL)
-- Execute este script no SQL Editor do seu projeto Supabase.
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. Configurações Gerais do Estúdio (Meta mensal, WhatsApp API, Pix, Radar)
create table if not exists public.studio_settings (
  id text primary key default 'default',
  monthly_goal numeric(12, 2) not null default 16000.00,
  studio_name text not null default 'Henrique Matos Studio',
  next_available_date text not null default '05/12/2026',
  whatsapp_provider text not null default 'evolution',
  whatsapp_api_url text not null default '',
  whatsapp_api_key text not null default '',
  whatsapp_instance text not null default '',
  admin_email text not null default '',
  pix_key text not null default '',
  pix_recipient_name text not null default 'Henrique Matos',
  pix_city text not null default 'BELO HORIZONTE',
  updated_at timestamptz not null default now()
);

alter table public.studio_settings add column if not exists whatsapp_provider text not null default 'evolution';
alter table public.studio_settings add column if not exists whatsapp_api_url text not null default '';
alter table public.studio_settings add column if not exists whatsapp_api_key text not null default '';
alter table public.studio_settings add column if not exists whatsapp_instance text not null default '';
alter table public.studio_settings add column if not exists admin_email text not null default '';
alter table public.studio_settings add column if not exists pix_key text not null default '';
alter table public.studio_settings add column if not exists pix_recipient_name text not null default 'Henrique Matos';
alter table public.studio_settings add column if not exists pix_city text not null default 'BELO HORIZONTE';

insert into public.studio_settings (id, monthly_goal, studio_name, next_available_date)
values ('default', 16000.00, 'Henrique Matos Studio', '05/12/2026')
on conflict (id) do nothing;

-- 2. Parceiros Indicadores (Modelos de Provador e Gerentes de Espaços de Eventos)
create table if not exists public.partners (
  id text primary key,
  name text not null,
  role text not null check (role in ('modelo_provador', 'gerente_espaco', 'outro')),
  company text,
  phone text,
  commission_rate numeric(5, 2) not null default 15.00,
  created_at timestamptz not null default now()
);

-- 3. Leads do CRM Multi-Funil (Fase 1 + Fase 2)
create table if not exists public.leads (
  id text primary key,
  company_name text not null,
  contact_name text not null,
  contact_role text,
  phone text not null,
  email text,
  instagram text,
  neighborhood text,
  address text,
  website text,
  funnel text not null check (funnel in ('festas_corporativas', 'lojas_barro_preto', 'retratos_lifestyle')),
  stage text not null check (stage in ('captado', 'contatado', 'proposta_aberta', 'follow_up', 'sinal_pago', 'fechado')),
  estimated_value numeric(12, 2) not null default 0,
  origin text not null default 'Cadastro Manual',
  partner_id text references public.partners(id) on delete set null,
  commission_paid boolean not null default false,
  payment_status text not null default 'pendente' check (payment_status in ('pendente', 'sinal_pago', 'quitado')),
  notes text default '',
  event_date text,
  cnpj text,
  cpf text,
  razao_social text,
  proposal_package text,
  proposal_addons jsonb default '[]'::jsonb,
  visualizada_em timestamptz,
  visualizacoes_proposta integer not null default 0,
  proposta_aprovada_em timestamptz,
  automacao_ativa boolean not null default true,
  respondeu boolean not null default false,
  followup_step integer not null default 0,
  tags jsonb not null default '[]'::jsonb,
  last_radar_alert_at timestamptz,
  contract_document jsonb,
  post_sale_checklist jsonb not null default '[]'::jsonb,
  ultima_interacao_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leads add column if not exists instagram text;
alter table public.leads add column if not exists cpf text;
alter table public.leads add column if not exists automacao_ativa boolean not null default true;
alter table public.leads add column if not exists respondeu boolean not null default false;
alter table public.leads add column if not exists followup_step integer not null default 0;
alter table public.leads add column if not exists tags jsonb not null default '[]'::jsonb;
alter table public.leads add column if not exists last_radar_alert_at timestamptz;
alter table public.leads add column if not exists contract_document jsonb;
alter table public.leads add column if not exists post_sale_checklist jsonb not null default '[]'::jsonb;

create index if not exists idx_leads_funnel on public.leads (funnel);
create index if not exists idx_leads_stage on public.leads (stage);
create index if not exists idx_leads_ultima_interacao on public.leads (ultima_interacao_em);
create index if not exists idx_leads_automacao on public.leads (automacao_ativa, stage);

-- 4. Histórico Cronológico de Interações do Lead
create table if not exists public.lead_interactions (
  id text primary key,
  lead_id text not null references public.leads(id) on delete cascade,
  type text not null check (type in ('nota', 'whatsapp', 'email', 'proposta_vista', 'proposta_aprovada', 'etapa', 'pagamento', 'sistema', 'radar', 'followup_auto', 'contrato', 'enriquecimento', 'pos_venda')),
  title text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_interactions_lead_id on public.lead_interactions (lead_id, created_at desc);

-- 5. Biblioteca de Templates / Scripts de Abordagem
create table if not exists public.script_templates (
  id text primary key,
  name text not null,
  funnel text not null check (funnel in ('festas_corporativas', 'lojas_barro_preto', 'retratos_lifestyle', 'geral')),
  channel text not null default 'ambos' check (channel in ('whatsapp', 'email', 'ambos')),
  subject text not null default '',
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.studio_settings enable row level security;
alter table public.partners enable row level security;
alter table public.leads enable row level security;
alter table public.lead_interactions enable row level security;
alter table public.script_templates enable row level security;

create policy if not exists "Allow all studio_settings" on public.studio_settings for all using (true) with check (true);
create policy if not exists "Allow all partners" on public.partners for all using (true) with check (true);
create policy if not exists "Allow all leads" on public.leads for all using (true) with check (true);
create policy if not exists "Allow all lead_interactions" on public.lead_interactions for all using (true) with check (true);
create policy if not exists "Allow all script_templates" on public.script_templates for all using (true) with check (true);
