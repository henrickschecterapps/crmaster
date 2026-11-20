# CRMaster — Estúdio Henrique Matos (Belo Horizonte)

Aplicação web completa de **CRM Comercial Multi-Funil, Prospecção em Belo Horizonte, Disparador Inteligente e Propostas Web Rastreáveis**, desenvolvida sob medida para o estúdio de fotografia e audiovisual **Henrique Matos**.

## Stack Tecnológica

- **Next.js (App Router)** + **TypeScript**
- **Tailwind CSS v4** (Dark Mode sofisticado + alternância para Light Mode, Bento Grids, glassmorphism e tipografia geométrica *Plus Jakarta Sans* + *JetBrains Mono*)
- **Lucide React** para iconografia
- **Supabase (PostgreSQL)** com schema pronto em `supabase/schema.sql` e **fallback automático local** (`.data/crm-store.json` + espelho em `localStorage`) para testar imediatamente sem chaves de API.
- **Google Places API (New Text Search)** com modo demonstração BH integrado.
- **Resend API** para disparo de e-mails formatados com modo simulação integrado.

## Como Rodar Imediatamente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`. O sistema já inicia populado com **5 leads fictícios realistas de Belo Horizonte** distribuídos nos 3 funis, **3 parceiros (15%)** e os **3 scripts pré-cadastrados**.

## Configuração de Chaves (Opcional para Teste Imediato)

Copie `.env.example` para `.env.local` e preencha quando quiser ativar integrações ao vivo:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Execute `supabase/schema.sql` no SQL Editor do Supabase.
- `GOOGLE_PLACES_API_KEY` — Ativa busca real na Google Places API na aba **Captar Leads (BH)**.
- `RESEND_API_KEY` e `RESEND_FROM_EMAIL` — Ativa envio real de e-mails no **Disparador Inteligente**.
- `NEXT_PUBLIC_WHATSAPP_NUMBER` — Número do WhatsApp do estúdio que receberá as aprovações de proposta (somente dígitos, ex: `5531998427100`).

## Roteiro Rápido de Teste

1. **Dashboard Bento Grid:** Edite a meta mensal (padrão `R$ 16.000`), filtre pelas 3 frentes de receita e clique nos leads parados (+48h e +5 dias).
2. **CRM Kanban Multi-Funil:** Alterne entre *Festas Corporativas*, *Lojas Barro Preto* e *Retratos & Lifestyle*, arraste cards entre colunas e abra os detalhes para editar pagamentos (50% / 100%) e comissões de 15%.
3. **Proposta Rastreável:** Abra `http://localhost:3000/proposta/lead-bh-01` em outra aba. O sistema registra `visualizada_em`, incrementa visualizações e move automaticamente a **Vértice Engenharia** para **Proposta Aberta** no CRM!
4. **Disparador & Scripts:** Selecione a **Dra. Letícia Vasconcelos** (em `Captado`) e clique em **Enviar no WhatsApp (Modo Seguro)** para abrir o link `wa.me` preenchido e mover o card automaticamente para `Contatado`.
5. **Captação BH:** Busque `"confecção Barro Preto"` ou `"restaurante eventos Lourdes"` e veja a detecção automática de duplicidade (ex: *Bela Trama* já no CRM) e o envio em 1 clique para o Kanban.
