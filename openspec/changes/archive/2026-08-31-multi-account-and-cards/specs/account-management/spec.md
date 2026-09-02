## Purpose

Permite que os usuários cadastrem e gerenciem múltiplas contas bancárias e cartões de crédito dinamicamente.

## ADDED Requirements

### Requirement: CRUD de Contas e Cartões
The system SHALL allow users to create, list, edit, and delete instances of bank accounts and credit cards. Each account MUST have a name and a type (e.g., 'bank_account' or 'credit_card').

#### Scenario: Criar nova conta bancária
- **WHEN** user provides a name and selects 'Conta Corrente'
- **THEN** system creates a new bank account entity

#### Scenario: Criar novo cartão de crédito
- **WHEN** user provides a name and selects 'Cartão de Crédito'
- **THEN** system creates a new credit card entity
