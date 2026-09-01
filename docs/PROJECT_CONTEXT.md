# Contexto do projeto SyncOdonto

## Objetivo

O SyncOdonto é uma aplicação de gestão odontológica multiusuário. Cada conta principal representa uma clínica. Funcionários convidados acessam os dados da clínica por meio de uma linha em `clinic_staff`, que referencia o usuário principal em `user_id`.

## Organização técnica

- `app/`: páginas, layouts e rotas HTTP;
- `app/api/`: backend da aplicação;
- `components/`: interfaces e módulos funcionais;
- `lib/hooks/use-data.ts`: acesso do frontend às APIs;
- `lib/supabase/`: clientes Supabase, sessão e resolução do escopo da clínica;
- `lib/permissions.ts`: regras puras de permissões;
- `lib/security/`: validação de escopo, campos protegidos, OTP e reCAPTCHA;
- `lib/validation/`: esquemas explícitos dos corpos aceitos pelas APIs;
- `scripts/`: estrutura e alterações do banco;
- `docs/`: contexto operacional e decisões de segurança.

## Fluxo de autenticação e clínica

1. O middleware valida a sessão do Supabase.
2. `getClinicScopedClient` identifica se o usuário é proprietário ou funcionário.
3. Para o proprietário, `ownerId` é seu próprio UUID e o perfil é `gestor`.
4. Para funcionários, `ownerId` vem de `clinic_staff.user_id`.
5. Funcionários desativados recebem resposta 403.
6. As rotas filtram leituras e alterações por `ownerId`.

O cliente administrativo do Supabase é usado no servidor para permitir o compartilhamento interno da clínica. Como ele ignora RLS, toda rota que o utiliza deve validar autenticação, escopo e permissões antes de acessar os dados.

## Perfis e permissões

- `gestor`: acesso total e administração da equipe;
- `dentista`: acesso clínico, com financeiro, relatórios e configurações bloqueados por padrão;
- `recepcionista`: padrão igualmente restritivo, com liberações explícitas pelo gestor.

Valores de perfil desconhecidos falham de forma restritiva e não recebem privilégios de gestor.

## Fluxos críticos

### Consulta

Uma consulta deve pertencer a um paciente da mesma clínica. Conflitos são verificados por paciente e profissional. Ao concluir uma consulta, o servidor cria a pendência financeira associada e tenta compensar a alteração caso o lançamento falhe.

O fuso operacional atual é `America/Fortaleza`.

### Documentos

Arquivos ficam no bucket privado `documentos-clinica`. O download utiliza URLs assinadas de curta duração. Documentos gerados pelo sistema são armazenados sob a pasta da clínica.

### Equipe

Somente o gestor pode criar, alterar ou remover funcionários. A vinculação do primeiro acesso usa o e-mail e o identificador da clínica gravado no convite; ela não procura convites de outras clínicas.

## Estado das verificações

- TypeScript estrito e obrigatório no build;
- ESLint configurado;
- Vitest configurado;
- testes unitários iniciais para permissões, isolamento e agenda;
- rate limits persistidos no banco para login, cadastro, convites, documentos e solicitações LGPD;
- auditoria de prontuários, documentos, equipe e financeiro;
- build de produção disponível por `npm run build`.

## Próximas prioridades

1. gerar tipos do banco diretamente do Supabase e reduzir usos de `any`;
2. criar testes de integração das rotas com duas clínicas isoladas;
3. adicionar testes de navegador para login, convite, agenda, prontuário e financeiro;
4. formalizar migrações versionadas, backup e restauração;
5. ampliar a auditoria para leituras de alto risco e automatizar o tratamento das solicitações LGPD;
6. monitorar erros, latência e consumo dos provedores durante o piloto.
