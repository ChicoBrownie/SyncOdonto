# Evolução do SyncOdonto para abastecimento de insumos odontológicos

Documento de planejamento interno elaborado em 19/10/2026. Não é uma proposta pronta para submissão e não comprova funcionalidades implementadas. Contém a identificação do produto; não enviar como conteúdo técnico de avaliação cega.

## Decisão recomendada

Acrescentar ao SyncOdonto um módulo de abastecimento para pequenas clínicas odontológicas, mantendo Next.js, Netlify e Supabase. O problema a validar é a dificuldade de perceber antecipadamente faltas, vencimentos e dependência de fornecedores para materiais necessários ao atendimento.

As clínicas são a ponta consumidora da cadeia. A aderência à temática de resiliência de insumos críticos precisa ser demonstrada com consumo, reposição, prazos e alternativas de fornecimento. Um cadastro de estoque isolado ou a presença de um chatbot não bastam para sustentar essa proposta. A aceitação do recorte odontológico depende da avaliação da ABDI.

## Fontes e limites

- Edital fornecido: `C:/Users/USER/Downloads/SEI_0186712_Edital_005_2026.pdf`, 30 páginas inspecionadas visualmente.
- TCC fornecido: `C:/Users/USER/Documents/TCC II/TCC Francisco 1.0.docx`, texto e tabelas extraídos para análise de conteúdo.
- Código e documentação local: README, contexto técnico e organização das rotas.
- A página oficial da ABDI de 14/10/2026 confirma inscrições até 23/10/2026: https://www.abdi.com.br/desafio-de-inovacao-nib-segue-com-inscricoes-abertas/
- A plataforma oficial lista uma errata e um edital retificado: https://prosas.com.br/editais/19307-concurso-desafio-de-inovacao-conexoes-produtivas . Os links dos anexos retornaram erro nesta consulta; a comparação integral da retificação permanece pendente. Os detalhes abaixo se referem ao PDF fornecido, salvo indicação contrária.
- O proponente forneceu transcrições de oito áudios com dicas sobre domínio, hospedagem, arquitetura e uso do Codex. Essas dicas são tratadas como orientação informal, não como comprovação técnica ou requisito do edital.
- O proponente informou ainda não ter CNPJ e pretender abrir Inova Simples. Elegibilidade documental permanece pendente de comprovação.

## Dicas recebidas sobre infraestrutura e uso do Codex

As transcrições dos áudios enviados pelo proponente foram incorporadas como orientação informal de desenvolvimento. Elas não são requisitos do edital e não substituem testes técnicos.

- O projeto atual é um monorepo: frontend, rotas do backend e integração com Supabase vivem na mesma aplicação Next.js. A publicação conjunta na Netlify é coerente com essa arquitetura; não há motivo técnico imediato para separar dois repositórios ou duas hospedagens.
- O domínio pode continuar sendo administrado separadamente da hospedagem. A troca de domínio ou registrador não altera a arquitetura do produto. Antes de publicar, revisar DNS, URL pública e redirecionamentos do Supabase Auth.
- Netlify, Supabase e serviços gratuitos são adequados para um fluxo inicial pequeno, mas devem ser observados durante o piloto. Registrar latência, falhas, limites, consumo e comportamento após períodos sem acesso.
- VPS, outro provedor de backend ou outra solução de banco só devem ser considerados quando houver evidência de que o volume, a latência, a disponibilidade ou os limites atuais justificam a migração. Migrar apenas por percepção de que uma VPS é mais profissional acrescentaria custo e risco operacional.
- Cloudflare, Vercel, Render, Koyeb, Neon e Cloudinary foram citados pelo amigo como experiências pessoais. Não serão adotados automaticamente: a solução atual já possui Netlify, Supabase e armazenamento privado integrado, e qualquer troca precisa ser comparada por custo, segurança, suporte, migração e aderência ao edital.
- O fluxo de trabalho com Codex deve começar por contexto verificável do projeto, revisão do módulo escolhido, identificação de requisições duplicadas, revisão de autorização e testes. Cada alteração deve ser conferida no código e em testes, especialmente porque o sistema trata dados sensíveis.

O conselho sobre infraestrutura será usado como hipótese de operação: começar pequeno, medir o piloto e escalar quando os dados justificarem. O conselho sobre Codex será usado como método: manter contexto atualizado, trabalhar por módulo, revisar segurança e validar cada alteração.

O TCC relata duas clínicas em teste do sistema de gestão, sem resultados quantitativos consolidados. Esse relato não comprova adesão das clínicas ao novo módulo nem validação de abastecimento.

## Exigências que orientam o desenvolvimento

| Exigência no PDF fornecido | Referência | Consequência prática |
| --- | --- | --- |
| Pessoa jurídica brasileira, CNPJ ativo e atividade compatível | 3.1 a 3.1.3 | Conferir cadastro, atividade, documento constitutivo aplicável e documentação de habilitação. |
| Solução em validação com MVP ou protótipo funcional | 5.15 e Anexo I, seção 3 | Demonstrar o núcleo de abastecimento; não usar apenas a existência do sistema clínico como evidência. |
| Condição existente até o encerramento das inscrições | Anexo I, 3.2 | Preservar versão, data, demonstração e testes; desenvolvimento posterior não supre requisito inicial ausente. |
| Anonimato no conteúdo técnico da Etapa II | 8.2.3 e 8.2.4 | Revisar nomes, marcas, domínio, imagens, links, créditos e metadados da submissão. Não alterar os campos cadastrais obrigatórios da plataforma. |
| Uma proposta por proponente | 8.2.6 e 8.2.7 | Concentrar a candidatura em uma solução coerente. |
| Diagnóstico e impacto com evidências | 8.3.3, páginas 10 e 11 | Coletar dados reais do problema e estabelecer indicadores com metas justificadas. |
| Pitch presencial de cinco minutos | 8.5.2 | Preparar demonstração curta e explicação do problema, diferenciais e validação. |
| Ambiente da PoC depende de aprovação e anuência | 8.9.3 e 8.9.3.1 | As clínicas são ambientes candidatos; não afirmar que já estão aprovadas pela ABDI. |

No PDF, a Etapa II atribui pesos 2 à coerência, 3 ao diagnóstico, 2 ao impacto regional e 3 ao impacto social, econômico e/ou ambiental. Na Etapa IV, os pesos são 3 para inovação, 2 para plano de validação, 3 para viabilidade e 2 para escalabilidade. A proposta não dependerá de inteligência artificial; a inovação será demonstrada pelo recorte de abastecimento e pelas evidências do piloto.

O encerramento indicado no PDF é 23/10, às 18h de Brasília. A notícia oficial atual confirma a data; conferir eventuais alterações e o horário no formulário antes de submeter. A premiação de R$ 50 mil corresponde às duas primeiras colocações gerais e está vinculada à PoC, não a todos os selecionados.

## Escopo inicial funcional

1. **Materiais e criticidade:** nome, unidade de controle, conversão explícita de embalagem, estoque mínimo e importância atribuída pelo responsável da clínica. Não presumir equivalência entre materiais ou marcas.
2. **Movimentações e lotes:** saldo inicial, entrada, saída, ajuste justificado e descarte; lote e validade quando aplicáveis. Registrar autoria e data. Não permitir saldo negativo por operações concorrentes.
3. **Fornecimento:** fornecedores, materiais atendidos, prazo informado, data da informação e fornecedor alternativo cadastrado. Distinguir prazo informado de prazo observado.
4. **Painel de abastecimento:** materiais abaixo do mínimo, lotes próximos do vencimento, compras pendentes e materiais com uma única fonte cadastrada. Mostrar motivo, dados e última atualização de cada alerta.
5. **Reposição sob revisão:** lista de itens para conferência, registro manual de cotações, comparação de preço, embalagem, frete e prazo, sem compra automática.
6. **Reposição sob revisão humana:** lista de itens para conferência e geração de uma solicitação de cotação baseada em modelo fixo, sem decisão ou envio automático.

Começar com 10 a 20 materiais escolhidos pela clínica. A quantidade é uma proposta de escopo do piloto, não uma exigência do edital. Luvas, máscaras, materiais de esterilização e outros consumíveis são exemplos para discussão; a criticidade deve ser definida pelos responsáveis locais.

## Evolução que fortalece o diferencial

- Kits de consumo por tipo de procedimento, configurados e revisados pela clínica.
- Estimativa de necessidade a partir de contagens agregadas da agenda e dos kits, com premissas visíveis. Agendamento não gera baixa automática no estoque.
- Cobertura estimada com histórico suficiente. Sem consumo confiável, mostrar informação insuficiente e usar mínimo manual.
- Cenários de atraso de entrega e aumento de demanda, apresentados como simulações condicionais.
- Registro de pedidos e recebimentos para medir atrasos e dependência de fornecedores.
- Participação de um distribuidor na validação posterior, se houver disponibilidade. Não condicionar o primeiro piloto a essa parceria.

Não incluir no primeiro escopo marketplace, compras coletivas, integração automática com distribuidores, transferências entre clínicas, substituição terapêutica, diagnóstico por imagem ou previsão por aprendizado de máquina.

## Arquitetura proposta

- Reutilizar a aplicação Next.js publicada na Netlify.
- Usar Supabase para materiais, lotes, movimentações, fornecedores, cotações e parâmetros da clínica.
- Reutilizar autenticação e resolução do escopo da clínica; aplicar permissões no servidor e políticas no banco.
- Fazer cálculos operacionais em funções determinísticas e testáveis.
- Habilitar o novo módulo gradualmente por clínica, sem exigir mudança na rotina clínica existente.
- Preparar migração incremental e ambiente de teste antes de aplicar alterações ao banco usado pelas clínicas.

Antes de implementar código Next.js, ler os guias locais pertinentes em `node_modules/next/dist/docs/`, conforme `AGENTS.md`.

## Validação nas clínicas

Confirmar adesão específica ao teste de abastecimento e indicar uma pessoa responsável por registrar movimentações. O aceite anterior para gestão clínica não equivale a esse novo compromisso.

Começar pelo diagnóstico: entrevistar quem compra, registrar itens cuja falta compromete a rotina, consultar registros disponíveis de compras emergenciais e descartes, e identificar fornecedores e prazos. Separar relato retrospectivo de dado documental. Se não houver histórico, iniciar uma linha de base prospectiva; não reconstruir números por suposição.

| Indicador | Coleta proposta |
| --- | --- |
| Qualidade dos saldos | Comparar contagem física com saldo registrado, por item. |
| Faltas de materiais | Registrar item, data, duração e consequência informada, inclusive quando não houve interrupção. |
| Compras emergenciais | Quantidade e motivo das compras classificadas como emergenciais. |
| Perdas por vencimento | Quantidade e valor registrado dos descartes, sem estimar preços ausentes. |
| Prazo de fornecimento | Dias entre pedido e recebimento, distinguindo entregas parciais. |
| Tempo de reposição | Tempo entre identificação do alerta e registro da solicitação de cotação. |

Um piloto de quatro a seis semanas é uma sugestão posterior, sujeita à disponibilidade das clínicas e ao plano aprovado. Duas clínicas permitem avaliar viabilidade e uso inicial; não demonstram eficácia em toda a cadeia nacional. Definir metas depois de conhecer a linha de base e separar metas de resultados.

## Leitura dos sete critérios e posicionamento de mercado

O mercado já possui sistemas odontológicos que anunciam compras, fornecedores, inventário, ordens de compra, lotes, validade, kits e alertas de estoque. O ControleODONTO publica recursos de fornecedores, requisições, produtos, inventário e ordens de compra; o Octor publica catálogo, lotes, movimentações, fornecedores, alertas, kits e vínculo com atendimentos. Isso significa que apenas “ter estoque” não será uma inovação suficiente. Fontes consultadas: https://controleodonto.com.br/compras-e-estoque/ e https://www.octor.com.br/estoque/ .

O espaço defensável para o SyncOdonto é começar pequeno, conectado ao fluxo já existente de clínicas odontológicas e orientado à resiliência: criticidade definida pela clínica, fornecedor alternativo, prazo informado versus observado, registro de interrupções, cenários de atraso e evidência de continuidade do atendimento. Essa é uma hipótese de posicionamento que precisa ser confirmada nas entrevistas.

### 1. Clareza do problema

**O que já temos:** um produto existente para clínicas, duas clínicas conhecidas e um contexto concreto para observar.

**O que falta:** transformar “gestão de compras” em uma frase mensurável. A formulação recomendada é: pequenas clínicas odontológicas perdem visibilidade sobre materiais críticos porque estoque, validade, fornecedores e prazos ficam em planilhas, mensagens e anotações separadas; isso aumenta o risco de compras emergenciais, desperdício e interrupção de atendimentos.

**Evidência necessária:** relatos de quem compra, exemplos anonimizados de falta ou compra urgente, itens mais críticos, número de fontes de fornecimento e tempo gasto para conferir o estoque.

### 2. Qualidade do diagnóstico

**O que já temos:** acesso potencial às clínicas e um sistema que já conhece pacientes, consultas, tratamentos e financeiro.

**O que falta:** dados estruturados e recentes sobre abastecimento. O TCC registra a ausência de indicadores consolidados; não devemos apresentar estimativas como fatos.

**Evidência necessária:** formulário padronizado aplicado às clínicas, linha de base prospectiva de quatro a seis semanas, contagem física comparada ao saldo registrado, compras emergenciais, descartes por validade e prazos de entrega.

### 3. Impacto

**O que já temos:** possibilidade de medir a operação sem alegar benefício clínico.

**O que falta:** separar impacto esperado de impacto comprovado.

**Metas iniciais para o piloto:** reduzir divergências entre estoque físico e registrado; aumentar a antecedência dos alertas; reduzir compras emergenciais; reduzir perdas por vencimento; registrar fornecedores alternativos para itens críticos. Os valores das metas devem ser definidos depois da linha de base.

**Impacto regional:** uma ferramenta acessível a clínicas pequenas do interior pode melhorar a continuidade de serviços sem exigir uma plataforma hospitalar complexa. Isso é uma hipótese de impacto regional, que precisa ser apoiada por número de clínicas alcançáveis, entrevistas e custos de adoção.

### 4. Inovação

**O que já temos:** plataforma clínica própria, multiusuário, com autenticação, escopo por clínica e módulos integrados.

**O que falta:** uma diferença clara em relação aos módulos de estoque já vendidos no mercado.

**Diferencial recomendado:** um “mapa de resiliência do abastecimento” para clínicas pequenas, que combina criticidade do material, cobertura estimada, validade, prazo observado, dependência de fornecedor e histórico de interrupções. O sistema deve explicar por que um item foi priorizado e permitir revisão humana.

Não afirmar inovação por usar IA, aplicativo ou nuvem. O diferencial é o método operacional, a rastreabilidade e a validação em clínicas pequenas.

### 5. Viabilidade

**O que já temos:** Next.js, Supabase e Netlify em uso; autenticação e isolamento por clínica já fazem parte do sistema.

**O que falta:** esquema de dados, telas, permissões e testes específicos de estoque. Também será necessário confirmar o CNPJ, CNAE, ambiente de demonstração e adesão das clínicas ao piloto.

**Recorte viável:** começar com materiais, lotes, movimentações, fornecedores, alertas e solicitações de cotação. Deixar marketplace, integração automática com distribuidores, compras coletivas, transferência entre clínicas e previsão estatística para uma fase posterior.

### 6. Plano de validação

O plano deve testar uma hipótese, não apenas mostrar telas. Hipótese recomendada: “ao registrar criticidade, saldo, validade, fornecedores e prazo observado em um único fluxo, a clínica identifica riscos de abastecimento com mais antecedência e organiza a reposição com menos retrabalho”.

O teste deve incluir cenário inicial, treinamento curto, uso real supervisionado, contagem física periódica, registro de falhas, entrevista final e comparação com a linha de base. Os resultados podem confirmar, limitar ou rejeitar a hipótese; qualquer um desses resultados é válido se o método e as evidências forem entregues.

### 7. Escalabilidade

**O que já temos:** arquitetura multi-tenant e separação por clínica, que permitem adicionar contas sem criar uma instalação nova para cada cliente.

**O que falta:** catálogo inicial, importação, suporte, planos de uso, observabilidade, backup e regras para volumes maiores.

**Caminho de expansão:** validar em duas clínicas odontológicas; criar modelos de materiais por especialidade; oferecer importação de planilha; ampliar para clínicas médicas e pequenos centros de diagnóstico; depois conectar distribuidores e redes de clínicas, mantendo a separação dos dados e os parâmetros locais.

A escalabilidade deve ser apresentada como capacidade técnica e plano de replicação, não como promessa de atender toda a cadeia de saúde imediatamente.

## Ordem de execução e evidências

1. Conferir retificação, documentação do Inova Simples e elegibilidade temporal.
2. Definir os materiais e o problema operacional com as clínicas.
3. Implementar materiais, lotes, movimentações e fornecedores.
4. Implementar alertas verificáveis e lista de reposição sob revisão.
5. Implementar a geração de solicitação de cotação por modelo fixo e revisão humana.
6. Testar isolamento entre clínicas, permissões, saldos concorrentes, unidades, validade e falhas de salvamento.
7. Registrar demonstração do núcleo funcional com dados fictícios, versão e data; preparar evidências anônimas apropriadas à etapa.
8. Redigir candidatura coerente com o que existe e com a validação ainda planejada.

O prazo próximo exige um recorte pequeno. Não prometer a entrega completa sem verificação prática nem afirmar que funções ainda planejadas já estão em validação. A submissão, a abertura do CNPJ e o aceite das clínicas são ações próprias do responsável pelo projeto; este documento não realiza nenhuma delas.
