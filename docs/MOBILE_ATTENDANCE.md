# Atendimento móvel do SyncOdonto

## Entrega

Entrada em `/atendimento`, com busca de paciente ou cadastro rápido. O cadastro exige nome, nascimento e CPF; o caminho rápido valida também o formato de 11 dígitos do CPF, sem afirmar verificar sua autenticidade. Um CPF já presente na mesma clínica reaproveita o paciente, sem alterar silenciosamente seu cadastro.

Após identificar o paciente, é possível atender agora, reservar um horário ou preparar a ficha. Consultas da agenda são reaproveitadas e conflitos por paciente/profissional são verificados também no banco, incluindo requisições simultâneas. “Atender agora” usa a data e hora de Fortaleza para uma nova consulta; a escolha de agendamento e os campos do horário permanecem no rascunho.

O percurso inclui saúde e alertas, odontograma, orçamento, proposta assinada e financeiro. O seletor de etapa permite acesso direto e as etapas clínicas podem ficar para depois. Exames abrem em um painel sobre o atendimento sem mudar sua etapa. Uma ação principal aparece na barra inferior, com alternativas contextuais apenas quando úteis; os controles de edição permanecem na etapa correspondente. Na anamnese, cinco perguntas iniciais aparecem antes dos grupos completos, que ficam recolhidos até serem abertos. Elas incluem alergias, medicações, acompanhamento médico, sangramentos e reação à anestesia; não substituem a revisão clínica integral.

O orçamento importa os procedimentos desta consulta e planos ainda sem consulta, preservando dentes, regiões e valores revisados. Uma nova importação não duplica fontes nem substitui os valores ajustados. A proposta precisa ser revisada e a consulta iniciada antes da assinatura. O documento armazena texto completo, itens, total, assinatura desenhada, instante, revisão do rascunho e SHA-256 do conteúdo/versionamento. A versão assinada é imutável. Não há certificação digital ou alegação de validação jurídica adicional.

Procedimentos importados ainda sem consulta são vinculados à consulta ao assinar. Itens que já têm uma cobrança própria são rejeitados, para impedir que sejam cobrados novamente junto da consulta. O valor desta consulta é confirmado separadamente do total da proposta, que pode incluir mais de uma sessão. A cobrança usa `source_appointment_id`; o recebimento continua no financeiro existente. O link final abre a cobrança daquela consulta, respeitando a permissão financeira atual.

## Rascunhos e privacidade

- `encounter_drafts` contém cadastro incompleto, anamnese (inclusive perguntas ainda não respondidas), notas, planejamento, formulário de procedimento, orçamento, opção/horário de agenda e última etapa.
- O salvamento acontece após 500 ms sem edição, ao trocar de etapa e antes de navegar ou sair da conta. Há uma fila para preservar digitação ocorrida durante uma requisição. A mudança de visibilidade é apenas uma proteção adicional.
- “Rascunho salvo” só aparece depois da confirmação do servidor. Falhas de conexão mantêm a edição em memória e exibem erro; retorno da conexão e o botão de tentar novamente permitem repetir o salvamento.
- A comparação do rascunho ignora a ordem das chaves devolvidas pelo JSONB do PostgreSQL. Uma resposta com os mesmos dados não dispara outro PATCH; assim, confirmar o prontuário não fica aguardando um ciclo interminável de salvamentos.
- Falhas de ações confirmadas (iniciar, agendar, assinar, concluir) têm mensagens próprias, independentes do salvamento do rascunho. “Rascunho salvo” pode aparecer junto de “Não foi possível iniciar a consulta”: o rascunho existe, mas o início não foi confirmado. Uma edição com autosave não apaga o erro da ação; repetir a ação permite tentar novamente.
- Atualizações usam revisão esperada e bloqueio de linha. Uma aba antiga recebe 409 e não sobrescreve dados. Carregar a versão do servidor exige confirmar a substituição das edições locais.
- Não são usados localStorage, sessionStorage, IndexedDB ou cache de service worker para dados clínicos. O cache de leitura é restrito à instância do layout, evitando mostrar o cache de uma sessão anterior ao entrar novamente.
- APIs derivam clínica e usuário da sessão, verificam paciente/consulta e filtram cada leitura. Os rascunhos são pessoais: outro funcionário da mesma clínica não recebe acesso a eles. O prontuário e os documentos já confirmados continuam compartilhados conforme o padrão existente da clínica.
- Fechar o aviso ou escolher “Agora não” não exclui nada. Retomar atendimento continua acessível. Descartar exige confirmação e preserva pacientes, consultas e registros já confirmados. Rascunhos com documento assinado devem ser concluídos e preservados.
- A assinatura ainda não confirmada fica apenas em memória. Após atualizar a página antes de confirmar, é necessário colhê-la novamente. Isso evita salvar automaticamente uma assinatura sem autorização explícita.

## Migração e aplicação manual

Arquivo: `scripts/014_mobile_encounters.sql`, depois das migrações existentes até 013. **Nada foi aplicado a um serviço externo.**

### Correção de horário para instalações que já receberam 014

`scripts/015_encounter_appointment_time.sql` substitui somente a função `perform_encounter_action`, convertendo explicitamente o horário vindo do JSON para `TIME`. A primeira versão de 014 enviava esse valor como texto, o que impedia criar a consulta quando `appointments.time` era `time without time zone`. O tipo foi confirmado por consulta apenas à estrutura do Supabase; nenhum registro de paciente foi lido ou alterado. A falha foi reproduzida e a correção verificada no PostgreSQL descartável.

- Se 014 já foi aplicada, executar somente **015** no SQL Editor do Supabase. Não reaplicar 014: ela cria tabelas e índices que já existem.
- Em uma instalação nova, a 014 deste workspace já contém a conversão correta; 015 pode ser aplicada em seguida para manter a sequência de migrações.
- A 015 preserva rascunhos, consultas, documentos, registros clínicos e cobranças; não recria tabelas e pode ser reaplicada. Ela mantém os privilégios restritos a `service_role`.
- Depois de aplicar, retomar o rascunho existente e tocar em “Atender agora”. Testar também “Agendar horário” com dados fictícios. Não é necessário descartar o rascunho ou cadastrar o paciente novamente.

### Estruturas e cuidados da instalação inicial

A migração cria `encounter_drafts`, `encounter_guide_visits`, funções de salvamento/ações e índices de revisão/retomada; adiciona referências de versão/hash aos documentos e a unicidade da cobrança por consulta. Instala proteção de horários, documento assinado imutável e criação financeira transacional. RLS permanece ativada e tabelas/funções novas não são acessíveis por anon/authenticated; somente as APIs autenticadas utilizam service_role.

A API antiga de encerramento também passa a depender da migração 014: o lançamento financeiro nasce no trigger da mesma transação, evitando a compensação entre duas escritas separadas. Sem a migração, o encerramento retorna 503 em vez de concluir uma consulta sem cobrança.

Consultas já concluídas não podem ter paciente, valor ou status substituídos por uma atualização atrasada. Correções financeiras continuam no financeiro, preservando a associação original.

O bootstrap `001_create_tables.sql` difere do esquema operacional já utilizado pelas APIs: por exemplo, `birth_date` versus `date_of_birth`, `start_time` versus `date/time`, `transaction_type` versus `type`, e ausência da tabela `anamnesis_records`. A migração 014 verifica essas condições e **aborta** sobre uma base criada somente com 001. Ela não tenta converter dados existentes. Para uma base nova, primeiro é necessário reconciliar esse esquema de maneira deliberada; para uma base operacional, conferir as colunas usadas pelas APIs antes de aplicar.

Antes de aplicar em um ambiente fictício:

1. Fazer backup e confirmar o esquema operacional e as migrações 003, 005, 008–010, 012 e 013 conforme os recursos usados pela clínica. O script 011 é um reset específico preexistente; não executá-lo como parte desta entrega.
2. Verificar se há cobranças repetidas com o mesmo `user_id/source_appointment_id`. O índice novo aborta se encontrar duplicidades históricas; não apaga nem mescla registros financeiros.
3. Verificar conflitos de horários já existentes. A proteção nova impede novas sobreposições, mas não reorganiza a agenda histórica.
4. Aplicar 014 manualmente no ambiente de teste, com autorização do responsável.
5. Executar o roteiro abaixo. Só depois avaliar a aplicação em produção.

## Guias e aparência móvel

O botão Ajuda reabre guias contextuais. A primeira visita de cada área é registrada por clínica/usuário no servidor. O restante da tela fica escuro e a função em foco permanece visível. O guia acompanha rolagem/viewport, possui foco contido, descrição para leitores de tela, Escape e opção de pular. As áreas centrais existentes também recebem ajuda, sem redesenhar relatórios, paperless, administração ou configurações.

A navegação inferior traz agenda, atendimento e pacientes. Dentro do atendimento, os controles globais Iniciar/Retomar cedem espaço ao conteúdo e ficam disponíveis nas demais telas. Quando o teclado móvel abre, a navegação inferior e a barra de ações se recolhem, a área usa a altura visível e o campo focado rola para a região livre. As ações retornam ao fechar o teclado. Ações de toque e campos nas áreas clínicas são maiores em telas pequenas, sem zoom automático dos campos no iOS; o layout usa altura dinâmica e bordas seguras. O manifesto permite adicionar à tela inicial nos navegadores compatíveis. Não há funcionamento clínico offline nem cache clínico persistente.

## Verificações automatizadas

- `npm run verify`: lint sem erros, tipos e Vitest.
- `npm run build`: build de produção.
- `npm run test:mobile`: Playwright com Chrome instalado. O servidor de teste usa um Supabase fictício em loopback, cookies sintéticos e respostas de API controladas. Não usa o Supabase da clínica nem dados reais.
- Testes PostgreSQL via PGlite executam as migrações sobre um esquema operacional mínimo e descartável, com `appointments.time` do tipo `TIME`: retomada/revisão, acesso de outra clínica/usuário, privilégios, início e agendamento, atualização de 014 antiga para 015 sem perda de rascunhos, publicação clínica, assinatura imutável, retries, pendência única, rollback financeiro e importação de planos já cobrados.
- Testes de rotas verificam autenticação, clínica/usuário derivados da sessão, rejeição de campos de escopo, conflitos e confirmação de assinatura/financeiro.
- Testes no navegador verificam anamnese/orçamento após navegação e atualização, aviso dispensável, ausência de dados clínicos no armazenamento persistente, erro de rede/conflito, toque duplo, confirmação financeira, guia/Escape, exames sem perder etapa e larguras 320/390/768.

As respostas de Supabase/Storage são simuladas nos testes de navegador. O banco embutido comprova as transações SQL, mas não substitui a validação integrada de sessões, Storage e banco operacional no piloto.

Neste ambiente, o Vitest pode emitir um aviso de demora no encerramento após os testes passarem, com código de saída zero. O Next também mantém o aviso preexistente de migração futura de `middleware` para `proxy`. Nenhum desses avisos impediu as verificações.

## Roteiro manual com dados fictícios

1. Criar duas clínicas de teste e usuários distintos. Cadastrar uma pessoa fictícia ou iniciar o cadastro rápido, preencher parcialmente e esperar “Rascunho salvo”. Atualizar, fechar o navegador e retomar em outra sessão. Confirmar nome/nascimento/CPF antes de criar o cadastro.
2. Criar um horário fictício na agenda. Entrar por Iniciar, conferir o paciente e atender agora. Repetir o toque, atualizar e retomar: deve existir somente uma consulta. Tentar sobrepor paciente ou profissional em outra aba e conferir o erro de conflito.
3. Preencher anamnese, observações e planejamento; sair imediatamente para pacientes, dispensar o aviso e usar Retomar atendimento. Confirmar que campos e última etapa voltam. Repetir para o orçamento.
4. Abrir duas abas do mesmo rascunho. Salvar uma alteração na primeira; editar a segunda. A segunda deve informar conflito e não substituir a primeira. Recarregar a versão salva apenas após confirmar a perda das edições locais.
5. Desconectar a rede durante edição: deve aparecer “Não foi possível salvar”. Voltar a conectar e tentar novamente. Não fechar o aparelho enquanto houver edição ainda não confirmada pelo servidor.
6. Adicionar procedimento com dente e múltiplas regiões. Ir ao orçamento e revisar o valor/desconto. Importar novamente e confirmar que o item não duplica nem perde o preço revisado. Tentar importar um procedimento com cobrança própria e verificar a recusa antes da assinatura.
7. Durante outra etapa, anexar um exame fictício pelo controle Exames. Fechar e confirmar que o atendimento permanece na etapa anterior. Validar o upload e a abertura do arquivo no bucket privado.
8. Ler a proposta inteira, assinar com o dedo e confirmar concordância. Repetir o toque e atualizar. Deve haver um documento, com itens/total/versão corretos. Abrir a proposta assinada e imprimir/salvar em PDF pelo navegador; conferir texto completo e assinatura.
9. Confirmar o valor desta consulta e encaminhar. Repetir a requisição: deve existir uma pendência por consulta. Entrar pelo link financeiro e registrar recebimento no fluxo existente. Com usuário sem permissão financeira, confirmar encaminhamento e bloqueio de acesso ao caixa.
10. Usar conta de outra clínica e outro usuário da mesma clínica para tentar consultar o ID do rascunho. Nenhum deve receber os campos pessoais. Conferir separadamente o acesso compartilhado ao prontuário já confirmado.
11. Em celular real, abrir cada guia, rolar, usar teclado, pular e reabrir com Ajuda. Validar o anúncio em leitor de tela e testar instalação na tela inicial conforme o navegador.

## Limites e decisões concretas

- Salvamento progressivo cobre o atendimento guiado. Formulários legados fora desse percurso, como a criação avulsa de orçamento para contatos na gestão paperless, foram preservados. Para rascunhos retomáveis de orçamento, usar a etapa Orçamento do atendimento.
- Colhe-se a assinatura da proposta de tratamento. Termos de consentimento existentes continuam disponíveis no prontuário; esta entrega não transforma um orçamento em consentimento clínico.
- A proposta assinada é uma página protegida para leitura/impressão, com texto completo e imagem da assinatura. Não foi criada uma integração de assinatura certificada nem um PDF anexado automaticamente ao Storage. Envio por e-mail do documento gerado por este novo fluxo requer produzir esse arquivo pelo mecanismo existente antes de enviar.
- Fechamento abrupto antes de receber confirmação do servidor pode perder os últimos caracteres. Não há como prometer persistência de uma edição que nunca chegou ao servidor; o sistema mostra salvamento em andamento/erro e alerta ao sair com alterações pendentes.
- Compartilhamento/transferência de rascunho entre profissionais exige uma decisão de permissão específica; por padrão, cada pessoa retoma apenas seus próprios rascunhos.
- O navegador de teste usa Chrome instalado; toque em Android/iOS, instalação e leitores de tela precisam do piloto manual. A impressão e o bucket privado também precisam de teste integrado.

## Arquivos principais

Páginas: `app/atendimento/**`, `app/manifest.ts`. APIs: `app/api/encounters/**`, `app/api/encounter-guides`, impressão protegida em `app/api/documents/[id]/print`; ajustes de agenda e filtro financeiro nas APIs existentes.

Interface e persistência: `components/encounters/**`, `lib/encounters/**`; integrações pontuais em layout/header, agenda, prontuário/anamnese, odontograma, captura de assinatura e financeiro. Testes: `lib/encounters/*.test.ts`, `app/api/encounters/routes.test.ts`, `tests/mobile/**`, `playwright.config.ts`, `vitest.config.ts`. Dependências de teste: PGlite e Playwright. As alterações preexistentes de odontograma e segurança foram preservadas.
