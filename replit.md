# ZapAuto — MRP Bot

## Overview

Backend completo para automação de consultas de MRP via WhatsApp. Usa Baileys para conexão WhatsApp real (WebSocket, sem Puppeteer), leitura de planilha Excel pesada (SD4) com lógica de consumo de estoque, e PostgreSQL para persistência.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **WhatsApp**: @whiskeysockets/baileys (WebSocket real, sem Puppeteer)
- **Planilha**: xlsx (leitura de .xlsx/.xls com batches async para não bloquear)
- **Upload**: multer (suporte a campo `file` e `spreadsheet`, até 50MB)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   └── api-server/         # Express API server (backend principal)
│       └── src/
│           ├── lib/
│           │   ├── whatsapp.ts    # Baileys: QR, conexão, mensagens
│           │   ├── spreadsheet.ts # Leitura SD4: índices, faltas, OPs
│           │   ├── query.ts       # Interpretação de texto livre
│           │   └── db.ts          # whitelist + query_history
│           └── routes/
│               ├── whatsapp.ts    # GET /status, GET /qr, POST /connect
│               ├── spreadsheet.ts # POST /upload, GET /status, /material/:cod
│               ├── relatorio.ts   # GET /faltas
│               └── whitelist.ts   # CRUD whitelist
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
└── artifacts/mockup-sandbox/  # UI HTML já pronta (interface do usuário)
```

## API Endpoints

### WhatsApp
- `GET /api/whatsapp/status` — status da conexão (`connected`, `qr_ready`, etc)
- `POST /api/whatsapp/connect` — inicia conexão (gera QR)
- `GET /api/whatsapp/qr` — retorna QR como base64 PNG (`{ qr: "..." }`)
- `POST /api/whatsapp/disconnect` — desconecta

### Planilha SD4
- `POST /api/spreadsheet/upload` — faz upload do .xlsx (campo `file` ou `spreadsheet`)
- `GET /api/spreadsheet/status` — stats da planilha carregada
- `GET /api/spreadsheet/material/:codigo` — busca material por código
- `GET /api/spreadsheet/op/:codigo` — busca OP por código

### Relatórios
- `GET /api/relatorio/faltas` — lista materiais com falta (sorted por qtdFalta desc)
  - `?status=critico|atencao|ok` — filtra por criticidade

### Whitelist
- `GET /api/whitelist` — lista contatos autorizados
- `POST /api/whitelist` — adiciona `{ phone, name }`
- `PATCH /api/whitelist/:id` — ativa/desativa `{ active: bool }`
- `DELETE /api/whitelist/:id` — remove

## Lógica SD4

**Colunas mapeadas por letra** (não por índice numérico):
- B → codigoMaterial, D → descricao, F → codigoOP, G → qtdEmpenho
- H → dataPlanejada, K → statusSetor, N → saldoAtual, O → qtdPC, P → dataChegada

**Filtros**: remove COMERCIAL, EXPEDIÇÃO, FINALIZADA, QUALIDADE, LOGISTICA, #N/D

**Consumo de estoque**:
1. `totalDisponivel = saldoAtual + qtdPC` (do primeiro registro do material)
2. OPs ordenadas por dataPlanejada ASC
3. Acumula qtdEmpenho — quando ultrapassa totalDisponivel → essa é a opCritica
4. `qtdFalta = max(0, totalEmpenho - totalDisponivel)`

## Banco de dados

Tabelas criadas automaticamente no start:
- `whitelist` (phone, name, active)
- `query_history` (phone, type, query, found, response)

## WhatsApp (Baileys)

- Usa WebSocket direto — funciona no Replit (sem Puppeteer/IP block)
- Credenciais salvas em `.baileys_auth/` (local)
- Reconecta automaticamente até 5 tentativas
- QR convertido para PNG base64 apenas na rota `/qr` (uma só vez)
- Processa mensagens apenas de números na whitelist
