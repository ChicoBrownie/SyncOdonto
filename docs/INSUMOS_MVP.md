# Planejamento inicial de insumos

O módulo `/insumos` é um piloto de planejamento para clínicas odontológicas. Ele estima a necessidade de materiais nos próximos 14 dias a partir dos tipos de procedimento na agenda. Não realiza compras, substitui insumos nem toma decisões clínicas automaticamente.

## Preparação

1. Aplique `scripts/018_supply_planning.sql` no Supabase de teste após as migrações anteriores. Não aplique diretamente no banco das clínicas sem backup e revisão.
2. Acesse como gestor. Funcionários ativos podem visualizar o planejamento, mas somente o gestor pode alterá-lo nesta primeira versão.
3. Cadastre alguns materiais escolhidos pela clínica. Informe a quantidade **utilizável conferida**, o mínimo manual e, quando conhecidos, fornecedores e prazos em dias corridos.
4. Vincule cada material ao nome exato de um tipo de procedimento da agenda e à quantidade estimada por atendimento. A lista sugere procedimentos cadastrados e agendados, mas a equipe define a regra.
5. Registre pedidos e suas datas prometidas. Ao receber, marque o pedido como recebido e atualize o saldo utilizável após conferir o material. O recebimento não dá entrada automática para evitar dupla contagem.

## Migração rápida de materiais

Na tela de Insumos, o gestor pode usar **Importar planilha**. O modelo CSV disponibilizado na janela contém as colunas reconhecidas. Também é possível enviar um arquivo Excel `.xlsx` com os mesmos cabeçalhos na primeira aba. O envio aceita até 500 materiais e 2 MB por vez. A prévia mostra materiais novos, já cadastrados e linhas com erro; somente após confirmar os novos materiais são gravados. Nomes já existentes, inclusive arquivados, são ignorados para preservar os dados atuais. A importação inclui nome, unidade, saldo utilizável, mínimo, indicação de essencial, fornecedores e prazos. Pedidos e regras de consumo por procedimento são cadastrados individualmente.

## Como o aviso funciona

- Consultas ativas de hoje até o décimo quarto dia entram na estimativa. Consultas canceladas, concluídas ou faltas ficam fora.
- Pedidos pendentes com prazo já vencido não são tratados como estoque futuro confiável. Uma entrega prometida no dia do atendimento também não é considerada disponível para esse atendimento, pois a hora de chegada é desconhecida.
- Quando uma regra de consumo não foi cadastrada, o módulo mostra **Configure o consumo** e não afirma cobertura da agenda.
- A data sugerida para pedir usa o prazo principal informado e um dia adicional de margem para receber antes do atendimento. Ela é conservadora, não uma garantia do fornecedor.
- A solicitação de cotação é apenas copiada para revisão e envio manual. Preço, disponibilidade e prazo precisam de confirmação do fornecedor.

## Limites conhecidos

- O saldo é informado manualmente; ainda não há lotes, validade, baixa por atendimento ou conciliação de movimentações. A clínica precisa excluir do saldo unidades vencidas, reservadas ou inadequadas.
- Regras por tipo de procedimento representam consumo estimado e podem variar conforme o caso. O cálculo não usa dados de pacientes.
- O prazo principal é informado pela clínica; datas prometidas e recebidas ficam registradas, mas ainda não há ajuste automático do prazo a partir do histórico.
- O piloto não conecta distribuidores por API, não faz previsão estatística e não comprova redução de faltas sem uso real e linha de base.
- A migração cria tabelas com RLS para os proprietários. As rotas da aplicação usam o escopo da clínica e reservam alterações ao gestor.
