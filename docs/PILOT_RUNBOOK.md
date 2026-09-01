# Piloto controlado

## Antes de começar

1. Criar um projeto Supabase separado e aplicar as migrações `001` a `005`.
2. Criar apenas contas fictícias para gestor, dentista e recepcionista.
3. Copiar `.env.pilot.example` e preencher exclusivamente com as chaves do projeto de teste.
4. Conferir URLs de callback no Supabase e nunca reutilizar a chave administrativa de produção.
5. Executar `006_pilot_seed.sql` depois de informar o UUID do gestor fictício.
6. Executar `npm run verify` e `npm run build`.
7. Executar `npm run pilot:preflight -- .env.local` e preencher [PILOT_EXECUTION.md](PILOT_EXECUTION.md).

## Roteiro diário

- consultar `/api/health` e registrar indisponibilidades ou latência anormal;
- verificar Auth, banco, Storage e consumo no painel do Supabase;
- testar cadastro de paciente, agenda, prontuário, documento e fechamento de consulta;
- registrar dificuldade, impacto, usuário, horário e passos para reprodução;
- não inserir dados pessoais ou clínicos reais durante a preparação.

## Canal e severidade

Defina um único canal de suporte e uma pessoa responsável por acompanhar os registros.

- Crítico: vazamento, perda de dados ou acesso indevido — suspender o piloto.
- Alto: fluxo clínico ou login indisponível — corrigir antes de continuar.
- Médio: operação possível com contorno.
- Baixo: melhoria visual ou de usabilidade.

## Registro de ocorrência

- Data e horário:
- Ambiente e usuário fictício:
- Tela/ação:
- Resultado esperado:
- Resultado observado:
- Evidência sem dados pessoais:
- Severidade:
- Responsável e situação:

## Saída do piloto

O piloto só avança quando os fluxos críticos permanecem estáveis, os incidentes críticos e altos estão resolvidos e uma restauração de backup foi testada no ambiente separado.

O acompanhamento diário, as evidências e a aprovação final ficam em [PILOT_EXECUTION.md](PILOT_EXECUTION.md).

As atividades de desempenho e custos foram registradas no mesmo documento como **Fase 6 — Otimização baseada em dados** e só devem começar após a aprovação do piloto.
