# Financeiro Pessoal

Sistema de gestão financeira pessoal conforme PRD — controle de clientes, vendas, parcelamentos, recebimentos e movimentações.

## Stack

- **Next.js 15** + React 19 + TypeScript
- **PostgreSQL** + Prisma ORM
- **Auth.js** (NextAuth v5) — autenticação com credenciais
- **Tailwind CSS 4**

## Pré-requisitos

- Node.js 18+
- PostgreSQL

## Configuração

1. Instale as dependências:

```bash
npm install
```

2. Copie o arquivo de ambiente:

```bash
copy .env.example .env
```

3. Configure `DATABASE_URL` e `AUTH_SECRET` no `.env`:

```
DATABASE_URL="postgresql://usuario:senha@localhost:5432/financeiro_pessoal"
AUTH_SECRET="sua-chave-secreta"
AUTH_URL="http://localhost:3000"
```

4. Crie o banco e aplique o schema:

```bash
npm run db:push
```

5. Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) e crie sua conta.

### Produção (Vercel)

- App: [https://appbank-nu.vercel.app](https://appbank-nu.vercel.app)
- Consulta de parcelas (clientes): [https://appbank-nu.vercel.app/consulta](https://appbank-nu.vercel.app/consulta)

Na Vercel, configure `AUTH_URL=https://appbank-nu.vercel.app` (sem barra no final).

## Módulos implementados (v0.1)

- Autenticação (login/registro)
- Dashboard com métricas principais
- Clientes (CRUD completo com validação de CPF/telefone)
- Vendas (por itens ou valor direto, à vista ou parcelada)
- Recebimentos (registro de pagamentos com movimentação automática)
- Movimentações (entradas/saídas manuais com filtros)
- Categorias personalizadas (Configurações)
- Relatórios (resumo financeiro, contas a receber, histórico)
- Consulta pública por CPF (`/consulta`)
- Navegação responsiva

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run db:push` | Sincroniza schema com o banco |
| `npm run db:studio` | Interface visual do Prisma |
