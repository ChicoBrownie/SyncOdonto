# SyncOdonto

Sistema web para gestão de clínicas odontológicas. O projeto reúne frontend e backend em uma única aplicação Next.js e utiliza Supabase para banco de dados, autenticação e armazenamento privado de documentos.

## Funcionalidades

- cadastro e acompanhamento de pacientes;
- agenda e controle do ciclo das consultas;
- prontuário, anamnese e odontograma;
- tratamentos e evolução clínica;
- documentos, orçamentos, TCLE e assinatura digital;
- gestão financeira e relatórios;
- equipe com perfis de gestor, dentista e recepcionista;
- notificações por e-mail e integração opcional com WhatsApp;
- visualização de imagens, PDF, DICOM e malhas 3D.

## Arquitetura resumida

| Camada | Tecnologia |
| --- | --- |
| Interface | Next.js 16, React 19 e Tailwind CSS |
| Backend | Route Handlers do Next.js em `app/api` |
| Banco e autenticação | Supabase/PostgreSQL e Supabase Auth |
| Arquivos | Supabase Storage, bucket privado `documentos-clinica` |
| E-mail | Resend |
| Publicação | Netlify com `@netlify/plugin-nextjs` |

O projeto é um monorepositório de aplicação única: páginas e APIs são publicadas juntas. Supabase e os demais provedores permanecem como serviços externos.

Mais detalhes estão em [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) e [docs/SECURITY.md](docs/SECURITY.md).

## Preparação local

Requisitos:

- Node.js 22 ou superior;
- projeto Supabase configurado;
- credenciais dos serviços opcionais conforme `.env.example`.

Instale as dependências e prepare as variáveis:

```bash
npm install
copy .env.example .env.local
```

Preencha `.env.local` sem publicar esse arquivo no Git. Em seguida:

```bash
npm run dev
```

## Banco de dados

Os scripts SQL estão em `scripts/` e devem ser aplicados em ordem numérica:

1. `001_create_tables.sql`
2. `002_phone_change_otps.sql`
3. `003_paperless_management.sql`
4. `004_paperless_templates.sql`
5. `005_security_hardening.sql`

Antes de executar os scripts em uma base existente, faça backup e revise as diferenças no Supabase. Os scripts não substituem uma estratégia formal de migrações e não devem ser reaplicados cegamente em produção.

## Verificações obrigatórias

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

O build não ignora mais erros de TypeScript. O lint possui algumas advertências legadas não bloqueantes, que devem ser reduzidas gradualmente.

## Publicação

O arquivo `netlify.toml` já configura o build Next.js na Netlify. Configure no painel as mesmas variáveis usadas localmente, além das URLs autorizadas no Supabase Auth.

Para usar o painel global `/admin`, cadastre explicitamente o usuário na tabela privada `platform_admins`, conforme a instrução ao final de `005_security_hardening.sql`.

Ao conectar um domínio próprio:

1. adicione o domínio ao projeto da Netlify;
2. configure os registros DNS solicitados;
3. ajuste `NEXT_PUBLIC_SITE_URL`;
4. atualize as URLs de redirecionamento no Supabase Auth;
5. teste login, recuperação de senha, convite de equipe e HTTPS.

## Dados sensíveis

O SyncOdonto manipula dados pessoais, clínicos e financeiros. Não utilize dados reais antes de revisar permissões, backup, retenção, auditoria, política de privacidade e os requisitos aplicáveis da LGPD.
