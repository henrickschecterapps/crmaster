# Design Spec — Adaptação Completa para ÚLTIMO QUADRO (Opção A: 5 Verticais)

**Data:** 2026-11-21  
**Fonte de verdade:** https://ultimo-quadro.vercel.app/  
**Abordagem aprovada:** Opção A — Espelho Completo das 5 Verticais do site com migração retrocompatível automática no Firestore.

## 1. Identidade Visual & Tipografia
- **Marca:** `ÚLTIMO QUADRO`
- **Subtítulo:** `Fotografia Autoral & Produção Audiovisual · Belo Horizonte & Nova Lima`
- **Tagline:** `A história termina. A imagem fica.`
- **Marca SVG oficial:** Componente reutilizável `UltimoQuadroMark` com os 3 quadros de película (`#4A4A4A`, `#4A4A4A`, `#CC551E`) + barra timeline 97% e ponto laranja queimado (`#CC551E`).
- **Paleta exata (Dark Mode padrão + Light Mode alternável):**
  - Canvas Obsidian: `#0C0C0C`
  - Superfície: `#121212` / vidro `rgba(18, 18, 18, 0.80)`
  - Superfície Elevada: `#171717`
  - Accent Principal (Laranja Queimado): `#CC551E` / hover `#DF6227` / soft `rgba(204, 85, 30, 0.14)`
  - Cinza Película: `#4A4A4A`
  - Texto Primário: `#F5F5F5`, Secundário: `#B8B8B8`, Muted: `#787878`
- **Tipografia:** `Montserrat` (weights 300–900, sem serifa geométrica) + `JetBrains Mono` (dados numéricos, preços, timestamps, 24FPS/97% metadata).
- **Contatos padrão:** WhatsApp `5531983997195` (`(31) 98399-7195`) · E-mail `ultimoquadrofilmes@gmail.com`.

## 2. Arquitetura das 5 Verticais (Opção A vs Opção B)
- **Opção A (Escolhida):** 5 verticais oficiais (`corporativo`, `estetica`, `nightlife`, `moda`, `gastronomia`) unificadas em `src/types/crm.ts` (`SERVICES_CATALOG`), alimentando Dashboard, Kanban, Captação BH (OpenStreetMap/Places), Scripts, Proposta Web dinâmica (`/proposta/[leadId]`), Contratos/Termos PDF e Checklists de Pós-Venda.
- **Opção B (Descartada):** Manter apenas 3 funis exigiria gestão manual para Gastronomia e Festas/Nightlife, quebrando a paridade com o site.
- **Compatibilidade retroativa (Zero perda no Firestore):** `normalizeFunnelId()` converte automaticamente leads já persistidos (`festas_corporativas` → `corporativo`, `lojas_barro_preto` → `moda`, `retratos_lifestyle` → `estetica`).

## 3. Catálogo de Propostas Dinâmico por Vertical (`/proposta/[leadId]`)
- Cada lead abre sua proposta já configurada na sua vertical oficial com os **pilares, pacotes, valores exatos e adicionais** do site:
  1. `corporativo`: Corporate Essencial (`R$ 1.350`) / Corporate Prime (`R$ 1.950`) + Hora Extra (`+R$ 350`), Real-Time (`+R$ 250`)
  2. `estetica`: Glow & Posicionamento (`R$ 1.190`) / Performance & Ads Prime (`R$ 1.890`) + Criativo/Reel Extra (`+R$ 240`), Hora Adicional (`+R$ 300`)
  3. `nightlife`: Lounge & Bar (`R$ 790`) / Club & Festival Prime (`R$ 1.390`) + Drop Real-Time (`+R$ 250`), Hora Extra (`+R$ 250`)
  4. `moda`: Drop & Provador Express (`R$ 690`) / Campanha & Lookbook Prime (`R$ 1.290`) + toggle *Projeto Impulso Moda BH* (`Social Start R$ 240` / `Social Impulso Prime R$ 450`) + Fashion Reel Adicional (`+R$ 220`), Hora Extra (`+R$ 250`)
  5. `gastronomia`: Menu & Delivery Essencial (`R$ 890`) / Chef's Table & Reels Prime (`R$ 1.490`) + Food Reel Extra (`+R$ 220`), Hora Extra (`+R$ 250`)
- Permite também alternar a vertical na proposta caso o cliente queira comparar outro formato.

## 4. Checklists Pós-Venda, PDFs, E-mails e Templates
- **PDFs (`pdfGenerator.ts`):** Cabeçalho oficial **ÚLTIMO QUADRO** (`#0C0C0C` + barra `#CC551E`), tagline, cláusulas alinhadas aos prazos do site (prévia no mesmo dia / 10h / 14h, galeria 2–3 dias úteis, backup duplo, NFS-e) e Termo de Imagem específico para Estética/Moda PF quando aplicável.
- **E-mails (Resend + Radar):** Visual `#0C0C0C` + `#121212` + botão `#CC551E`, assinatura `ÚLTIMO QUADRO · Fotografia Autoral & Produção Audiovisual · BH & Nova Lima`.
- **Scripts pré-cadastrados:** Atualizados com linguagem autoral da Último Quadro cobrindo Corporativo, Estética/Wellness, Moda/Provador (15% Pix), Gastronomia/iFood, Nightlife e Follow-ups Dia 2 / Dia 5.
- **Captação BH (OpenStreetMap/Places):** Mapeamento automático inteligente de categorias para todas as 5 verticais + sugestões rápidas BH & Nova Lima (`restaurante Lourdes`, `confecção Barro Preto`, `clínica estética Savassi`, `bar nightlife Savassi`, `espaço eventos Pampulha`).

## 5. Verificação Obrigatória
- `npm run typecheck` (`tsc --noEmit`) sem erros.
- `npm run build` (`next build`) sem erros.
- Push limpo para `origin/main` sem expor `.env.local`.
