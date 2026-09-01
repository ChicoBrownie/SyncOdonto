# Plano de resposta a incidentes de segurança

Este plano deve ser validado pelo responsável jurídico e pelo encarregado de dados antes do uso com pacientes reais. Ele cobre indisponibilidade, acesso indevido, vazamento, alteração ou perda de dados e comprometimento de contas ou fornecedores.

## Papéis mínimos

Antes de entrar em produção, registre nomes, telefones e substitutos para:

- coordenador do incidente: decide prioridades, mantém a linha do tempo e encerra o incidente;
- responsável técnico: contém a falha, preserva evidências, corrige e recupera o serviço;
- encarregado de dados/jurídico: avalia LGPD, titulares e comunicações obrigatórias;
- responsável da clínica: valida impacto assistencial e comunicação com profissionais e pacientes;
- comunicação: prepara mensagens consistentes e impede divulgação de dados desnecessários.

As funções podem ser acumuladas em equipes pequenas, mas nenhuma pode ficar sem responsável definido.

## Classificação inicial

| Severidade | Exemplo | Resposta inicial |
| --- | --- | --- |
| Crítica | vazamento confirmado de dados de saúde, conta administrativa comprometida, perda ampla de dados | imediata |
| Alta | acesso indevido provável, alteração de prontuário, indisponibilidade que impede atendimento | até 1 hora |
| Média | tentativa limitada, falha com alternativa operacional, exposição sem confirmação | no mesmo dia |
| Baixa | evento sem impacto comprovado ou melhoria preventiva | próximo ciclo de trabalho |

## Fluxo operacional

### 1. Detectar e registrar

- abrir um registro único com data, pessoa que detectou, sistemas envolvidos e sintomas;
- guardar capturas, alertas, IDs de auditoria e horários no fuso America/Fortaleza;
- não copiar dados de pacientes para chats ou ferramentas não autorizadas;
- classificar a severidade inicial e nomear o coordenador.

### 2. Conter sem destruir evidências

- desativar contas, integrações ou rotas afetadas;
- revogar sessões e links temporários;
- rotacionar primeiro as chaves comprovadamente expostas e depois as relacionadas;
- bloquear escrita quando houver risco de alteração de prontuários;
- preservar logs, configuração e cópia do estado afetado antes de corrigir ou restaurar.

### 3. Investigar o alcance

- determinar início, duração, causa e último momento conhecido como seguro;
- identificar clínicas, pacientes, profissionais, categorias de dados e quantidade de registros envolvidos;
- diferenciar acesso, cópia, alteração, indisponibilidade e destruição;
- verificar auditoria do SyncOdonto, autenticação, Supabase, Storage, hospedagem, e-mail e demais fornecedores;
- registrar fatos e hipóteses separadamente.

### 4. Erradicar e recuperar

- corrigir a causa raiz e revisar acessos equivalentes;
- restaurar somente de backup previamente verificado e em ambiente isolado;
- validar contagens, vínculos de pacientes, documentos, assinaturas e prontuários antes de liberar;
- testar login, isolamento entre clínicas, agenda, prontuário, odontograma, financeiro e documentos;
- monitorar intensivamente após a retomada e manter alternativa manual para o atendimento.

### 5. Avaliar e comunicar

- o encarregado/jurídico determina obrigações, conteúdo, prazo e destinatários conforme o caso concreto;
- qualquer comunicação deve informar o ocorrido, dados possivelmente afetados, riscos, medidas tomadas e canal de suporte, sem especulação;
- registrar a decisão de comunicar ou não comunicar e os fundamentos usados;
- preservar comprovantes de envio e respostas recebidas.

### 6. Encerrar e aprender

- encerrar somente depois de conter, recuperar, validar e definir todas as comunicações;
- produzir relatório com linha do tempo, causa raiz, impacto, decisões e evidências;
- criar ações corretivas com responsável e prazo;
- realizar revisão em até 10 dias úteis e testar novamente os controles alterados.

## Checklist de prontidão

- contatos e substitutos revisados trimestralmente;
- backups automáticos ativos, criptografados e com teste de restauração documentado;
- logs com horário correto e retenção definida;
- procedimento testado de revogação de sessões e rotação de chaves;
- canal alternativo para continuar atendimentos sem o sistema;
- modelo de registro do incidente e de comunicação aprovado;
- exercício simulado realizado pelo menos uma vez por ano;
- lista atualizada de fornecedores e contatos de emergência.

## Registro mínimo do incidente

O registro deve conter: identificador, severidade, status, responsável, data de detecção, período provável, sistemas, clínicas e titulares afetados, categorias e volume de dados, evidências, decisões, ações executadas, comunicações, restauração utilizada, validações e data de encerramento.
