## O que vai mudar

### 1. Organizador de campos (global do quadro)
Um popover de "Configurar card" no topo do Kanban onde você arrasta a ordem dos campos e liga/desliga visibilidade. Todos os cards do quadro passam a renderizar nessa ordem, novos cards já nascem nesse padrão.

Campos organizáveis (título fica sempre fixo no topo):
- Etiquetas, Descrição, Responsável, Prioridade, Status, Prazo, Subtarefas, Observações, Arquivos, Interrupções

Cada item tem: handle de arrastar + olho de mostrar/ocultar (igual ao seu print do Notion).

### 2. Interrupções (substitui o botão neon)
- Chip compacto (pequeno, discreto) mostrando o contador.
- Clique no chip → modal "Por que parou?" → você escreve o motivo e salva.
- Cada interrupção registrada vira item numa seção dobrável "Interrupções" dentro do card, com data/hora + motivo. Editável e removível.
- Cor de destaque do chip e da seção é configurável via color picker livre (hex), salva nas preferências do quadro.

### 3. Persistência
Nova tabela `board_preferences` (por usuário) guarda:
- `field_order` (array ordenado dos campos)
- `hidden_fields` (array dos ocultos)
- `interruption_color` (hex)

Nova tabela `task_interruptions` (por tarefa) guarda cada motivo:
- `task_id`, `reason`, `created_at`
A coluna `interruptions` (contador) é mantida como cache, atualizada por trigger.

## Detalhes técnicos

- Migração: criar `board_preferences` e `task_interruptions` com RLS, GRANTs e trigger pra manter `tasks.interruptions = count(task_interruptions)`.
- `use-data.ts`: novo hook `useBoardPreferences()` + `useTaskInterruptions(taskId)` + mutations.
- `TaskCard.tsx`:
  - Refatorar render em um map sobre `field_order` filtrando `hidden_fields`.
  - Trocar bloco neon atual por `<InterruptionChip>` compacto com cor dinâmica.
  - Adicionar `<InterruptionReasonDialog>` (modal) e seção dobrável "Interrupções" listando os motivos.
- `kanban.tsx`: novo botão "Configurar card" abrindo `<CardFieldsPopover>` (drag&drop com @dnd-kit já presente no projeto, + color picker pra cor de interrupção).
- Remover estilo neon atual (`Zap` + gradiente pink/fuchsia) do contador antigo.

## Fora do escopo
- Override por card (você escolheu global).
- Paleta pronta (você escolheu picker livre).
- Mexer em outras telas (lista, calendário) — só Kanban.