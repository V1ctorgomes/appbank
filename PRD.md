PRD – Sistema Financeiro Pessoal

1. Visão Geral

Nome do Produto

Sistema Financeiro Pessoal

Objetivo

Permitir o gerenciamento financeiro pessoal através do controle de clientes, vendas, parcelamentos, recebimentos e movimentações financeiras em uma única plataforma.

O sistema deve ser simples, rápido, intuitivo e focado no uso individual.

⸻

2. Problema

O usuário precisa controlar:

* Gastos do dia a dia
* Entradas financeiras
* Pessoas que compram parcelado
* Parcelas pagas
* Parcelas pendentes
* Parcelas atrasadas
* Valores futuros a receber

Atualmente essas informações encontram-se dispersas ou sem controle centralizado.

⸻

3. Objetivos do Produto

Objetivos Principais

* Centralizar o controle financeiro pessoal
* Organizar vendas parceladas
* Facilitar o acompanhamento de recebimentos
* Permitir visualização rápida da situação financeira
* Manter histórico financeiro completo

⸻

4. Público-Alvo

Pessoa física que:

* Realiza vendas parceladas para conhecidos ou clientes
* Precisa controlar receitas e despesas
* Deseja acompanhar valores futuros a receber
* Busca simplicidade e praticidade

⸻

5. Escopo da Versão 1

Dashboard

O Dashboard deve apresentar:

* Saldo atual
* Entradas do mês
* Saídas do mês
* Total a receber
* Parcelas atrasadas
* Próximos recebimentos

Próximos Recebimentos

Exibir:

* Cliente
* Valor
* Data de vencimento

⸻

Clientes

Cadastro e gerenciamento de clientes.

Campos

* Nome
* Telefone
* CPF
* Observações

Funcionalidades

* Criar cliente
* Editar cliente
* Excluir cliente
* Consultar histórico do cliente
* Consultar saldo devedor

⸻

Vendas

Cadastro de vendas.

Modalidade 1 – Venda por Itens

Cada venda poderá possuir múltiplos itens.

Campos do item:

* Nome
* Quantidade
* Valor unitário

O sistema calculará automaticamente:

* Valor total do item
* Valor total da venda

⸻

Modalidade 2 – Venda por Valor Direto

Campos:

* Descrição
* Valor total

⸻

Campos Gerais da Venda

* Cliente
* Data da venda
* Observação
* Valor total

⸻

Parcelamento

Toda venda poderá ser:

* À vista
* Parcelada

Parcelamento Automático

Usuário informa:

* Quantidade de parcelas
* Primeiro vencimento

O sistema gera automaticamente:

* Número da parcela
* Valor da parcela
* Data de vencimento

⸻

Parcelamento Manual

Usuário informa:

* Valor de cada parcela
* Data de vencimento de cada parcela

O sistema valida se a soma das parcelas corresponde ao valor total da venda.

⸻

Campos da Parcela

* Número da parcela
* Valor
* Data de vencimento
* Status

Status

* Pendente
* Pago
* Atrasado
* Cancelado

⸻

Recebimentos

Permitir registrar pagamentos de parcelas.

Campos

* Data do pagamento
* Valor recebido
* Observação

Comportamento

Ao registrar um pagamento:

* A parcela é marcada como paga
* Uma movimentação financeira de entrada é criada automaticamente
* O Dashboard é atualizado
* O saldo do cliente é atualizado

⸻

Movimentações Financeiras

Tela única para registrar e consultar movimentações.

Tipos

* Entrada
* Saída

Origens

* Manual
* Recebimento de parcela

Campos

* Tipo
* Descrição
* Categoria
* Valor
* Data
* Observação

⸻

Categorias

O usuário poderá criar categorias personalizadas para entradas e saídas.

⸻

Exemplos de Entradas

* Salário
* Freelance
* Presente
* Empréstimo recebido

⸻

Exemplos de Saídas

* Mercado
* Aluguel
* Internet
* Gasolina
* Alimentação

⸻

Filtros

* Período
* Tipo
* Categoria
* Pesquisa textual

⸻

Relatórios

Resumo Financeiro

Exibir:

* Total de entradas
* Total de saídas
* Resultado do período

⸻

Contas a Receber

Exibir:

* Cliente
* Valor pendente
* Quantidade de parcelas pendentes
* Próximo vencimento

⸻

Histórico Financeiro

Exibir todas as movimentações registradas no período selecionado.

⸻

6. Regras de Negócio

RN001

Toda venda deve possuir valor maior que zero.

RN002

Toda parcela deve possuir data de vencimento.

RN003

A soma das parcelas deve ser igual ao valor total da venda.

RN004

Parcelas pagas não podem ser removidas sem confirmação.

RN005

Ao registrar o pagamento de uma parcela, uma movimentação de entrada deve ser criada automaticamente.

RN006

Parcelas vencidas e não pagas devem ser classificadas automaticamente como atrasadas.

RN007

Uma venda pode existir sem itens.

RN008

Movimentações financeiras manuais são independentes das vendas.

RN009

O saldo atual deve ser calculado por:

Saldo Atual = Total de Entradas − Total de Saídas

RN010

Recebimentos de parcelas devem compor automaticamente o saldo financeiro.

RN011

O CPF deve ser único para cada cliente.

RN012

O sistema deve validar o CPF antes do cadastro.

RN013

O telefone deve ser armazenado com DDD.

RN014

Não deve ser permitido cadastrar clientes sem nome.

RN015

Clientes não devem ser removidos fisicamente do banco de dados.

Deve ser utilizada exclusão lógica (Soft Delete) para preservar o histórico financeiro.

⸻

7. Estrutura de Navegação

* Dashboard
* Clientes
* Vendas
* Movimentações
* Relatórios
* Configurações

⸻

8. Requisitos Básicos de Segurança

Autenticação

RS001

O sistema deve exigir login para acesso.

RS002

As senhas devem ser armazenadas utilizando hash seguro.

⸻

Proteção de Dados

RS003

Credenciais e chaves devem ser armazenadas em variáveis de ambiente.

RS004

O banco de dados não deve ser exposto publicamente.

⸻

Validação

RS005

Os dados enviados para a API devem ser validados antes do processamento.

RS006

CPF e telefone devem ser validados antes do cadastro.

⸻

Histórico

RS007

Clientes, vendas, parcelas e movimentações devem utilizar exclusão lógica (Soft Delete).

RS008

Nenhuma informação financeira deve ser apagada permanentemente por operações comuns do sistema.

⸻

9. Critérios de Sucesso

O sistema será considerado bem-sucedido quando permitir:

* Registrar uma venda em menos de 1 minuto
* Registrar entradas e saídas rapidamente
* Consultar parcelas pendentes facilmente
* Identificar clientes com valores em aberto
* Saber quanto ainda falta receber
* Visualizar o saldo atual em tempo real
* Centralizar toda a gestão financeira pessoal em um único sistema

⸻

10. Diretrizes Técnicas

Framework

* Next.js 16
* React 19
* TypeScript

Backend

* Next.js Route Handlers
* Server Actions

Banco de Dados

* PostgreSQL

ORM

* Prisma ORM

Autenticação

* Auth.js

Hospedagem

* Vercel

Responsividade

O sistema deve funcionar em:

* Desktop
* Tablet
* Smartphone