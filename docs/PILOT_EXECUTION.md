# Execução e evidências das fases 4 e 5

Este arquivo é o controle de aprovação do piloto. Use somente dados fictícios até a autorização formal para dados reais.

## 1. Preparação do ambiente

- [ ] Projeto Supabase exclusivo do piloto criado.
- [ ] Site Netlify exclusivo do piloto criado, sem domínio de produção.
- [ ] Migrações `001` a `005` aplicadas em ordem e `006` preenchida com o UUID fictício.
- [ ] Variáveis baseadas em `.env.pilot.example` cadastradas separadamente na Netlify.
- [ ] `npm run pilot:preflight -- .env.local` aprovado.
- [ ] `npm run verify` e `npm run build` aprovados.
- [ ] Bucket `documentos-clinica` confirmado como privado.

Evidência/data/responsável:

## 2. Teste funcional assistido

Execute com gestor, dentista e recepcionista fictícios. Marque cada cenário e anexe evidência sem dados pessoais.

| Cenário | Resultado esperado | Situação |
| --- | --- | --- |
| Login e recuperação de senha | acesso/callback apenas no domínio piloto | [ ] |
| Convite e bloqueio de funcionário | perfil correto; desativado perde acesso | [ ] |
| Paciente fictício | criar, editar, localizar e impedir acesso por outra clínica | [ ] |
| Agenda | criar, alterar, detectar conflito, iniciar e concluir | [ ] |
| Prontuário/anamnese/odontograma | dados persistem e ficam isolados por clínica | [ ] |
| Documento | upload privado e download por URL temporária | [ ] |
| Financeiro | conclusão gera uma única pendência | [ ] |
| Exclusão/exportação | solicitação registrada, sem exclusão automática indevida | [ ] |

Evidência/data/responsável:

## 3. Segurança entre clínicas

Crie Clínica A e Clínica B. Tente consultar e alterar, com usuários da B, os IDs de paciente, consulta, documento, prontuário e financeiro da A. Todos devem resultar em acesso negado ou recurso não encontrado, sem revelar conteúdo.

- [ ] APIs testadas nos três perfis.
- [ ] Storage testado com caminho e URL de outra clínica.
- [ ] Logs não exibem tokens, chaves, conteúdo clínico ou dados pessoais.
- [ ] Rate limit testado em login, recuperação e OTP.

Evidência/data/responsável:

## 4. Disponibilidade e desempenho

Após publicar, execute diariamente:

```text
npm run pilot:smoke -- https://SEU-SITE-PILOTO.netlify.app
```

Registre no monitor externo uma consulta a `/api/health` a cada 5 minutos. Alerta sugerido: 2 falhas consecutivas ou resposta acima de 3 segundos. O endpoint deve responder `environment: pilot`; qualquer outro valor reprova o teste.

| Data/hora | Disponibilidade | p95 | Erros | Supabase DB/Storage/Egress | Responsável |
| --- | ---: | ---: | ---: | --- | --- |
| | | | | | |

## 5. Backup e restauração

Não considere o backup testado apenas porque ele aparece no painel.

- [ ] Backup automático habilitado e retenção anotada.
- [ ] Backup escolhido com data/hora e identificador registrados.
- [ ] Restauração feita em um terceiro projeto isolado, nunca sobre o piloto ativo.
- [ ] Contagens de pacientes, consultas, documentos e lançamentos comparadas.
- [ ] Amostra fictícia aberta e validada; referências e arquivos conferidos.
- [ ] Projeto restaurado destruído ou bloqueado após guardar as evidências.
- [ ] RTO (tempo de restauração) e RPO (perda máxima medida) registrados.

Evidência/data/RTO/RPO/responsável:

## 6. Suporte, incidentes e experiência real

Canal único: **a definir**
Responsável primário: **a definir**
Substituto: **a definir**

| ID | Data | Perfil | Fluxo | Dificuldade/erro | Severidade | Evidência | Responsável | Situação |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | |

Crítico (perda, vazamento ou acesso indevido) suspende imediatamente o piloto. Alto bloqueia o fluxo clínico e precisa ser corrigido antes da continuidade.

## 7. Domínio e operação profissional

- [ ] Domínio comprado em nome da organização e renovação automática habilitada.
- [ ] DNS e HTTPS da Netlify validados.
- [ ] `NEXT_PUBLIC_SITE_URL`, callbacks do Supabase e links de e-mail atualizados.
- [ ] Login, recuperação e convite retestados no domínio final.
- [ ] E-mails institucionais, SPF, DKIM e DMARC validados.
- [ ] Monitor de disponibilidade e rastreamento de erros ativos, sem dados clínicos nos eventos.
- [ ] Política de privacidade, termos e consentimentos revisados por profissional qualificado.
- [ ] Responsável técnico, encarregado de dados e processo de incidentes formalizados.

## Critério de saída

Período assistido: ____/____/____ a ____/____/____ (mínimo definido pela equipe: ____ semanas).

- [ ] Zero incidente aberto crítico ou alto.
- [ ] Zero perda, vazamento ou inconsistência sem explicação e correção.
- [ ] Restauração comprovada.
- [ ] Métricas dentro das metas acordadas.
- [ ] Dificuldades dos usuários triadas e correções prioritárias retestadas.
- [ ] Aprovação assinada pelo responsável técnico e pela clínica piloto.

Decisão: [ ] aprovado  [ ] prolongar piloto  [ ] suspenso
Data, nomes e assinaturas:

## Fase 6 — Otimização baseada em dados (tarefa futura)

**Estado:** aguardando a conclusão e aprovação do piloto. Não iniciar otimizações estruturais antes de existirem métricas reais de uso.

- [ ] Medir tempo de carregamento das telas e duração das requisições mais utilizadas.
- [ ] Identificar chamadas duplicadas ou desnecessárias feitas pelo navegador.
- [ ] Analisar consultas lentas, planos de execução e índices do Supabase/PostgreSQL.
- [ ] Implementar paginação nas listagens que crescerem durante o uso real.
- [ ] Aplicar cache somente onde houver ganho mensurável e dados puderem ser atualizados com segurança.
- [ ] Registrar consumo e limites de banco, Storage, transferência, funções e Netlify.
- [ ] Comparar o custo observado com os planos pagos da Netlify e do Supabase.
- [ ] Avaliar VPS somente se as métricas demonstrarem vantagem de custo ou desempenho.
- [ ] Definir responsável por atualizações, segurança, backups e incidentes antes de considerar VPS.
- [ ] Repetir testes funcionais, de isolamento e restauração após cada otimização relevante.

### Métricas de referência

Preencher depois do piloto, antes de decidir qualquer migração:

| Métrica | Valor atual | Meta | Período medido | Decisão |
| --- | ---: | ---: | --- | --- |
| Tempo p95 das páginas principais | | | | |
| Tempo p95 das APIs principais | | | | |
| Taxa de erros | | | | |
| Chamadas por fluxo crítico | | | | |
| Uso do banco e conexões | | | | |
| Storage e transferência mensal | | | | |
| Consumo/custo da Netlify | | | | |
| Consumo/custo do Supabase | | | | |

### Critério de conclusão

A fase termina quando os gargalos comprovados tiverem sido tratados, as metas acordadas forem atingidas e as mudanças não causarem regressão funcional, perda, vazamento ou inconsistência de dados.
