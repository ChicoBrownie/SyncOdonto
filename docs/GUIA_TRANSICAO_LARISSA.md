# Guia de transição do SyncOdonto para Larissa

Este documento explica como assumir o desenvolvimento e a operação técnica do SyncOdonto. Ele foi escrito para quem ainda não tem muita experiência com programação.

## 1. O que precisa ser transferido

Larissa deve receber acesso próprio, sem compartilhar senhas, ao GitHub (`ChicoBrownie/SyncOdonto`), Netlify, Supabase, domínio/DNS, Resend, Google reCAPTCHA, Evolution API e respectivas contas de cobrança, quando esses serviços estiverem ativos.

Ativar autenticação em dois fatores nas contas principais. Depois da transferência, substituir chaves antigas que não precisem continuar válidas. Não enviar senhas ou chaves por WhatsApp, e-mail, documentos ou conversas com inteligência artificial. Usar um gerenciador de senhas.

## 2. Preparar o computador

Instalar Git, Node.js 22 ou superior e Visual Studio Code. Depois, no terminal do Windows:

```powershell
git clone https://github.com/ChicoBrownie/SyncOdonto.git
cd SyncOdonto
npm install
```

Se o repositório for privado, entrar no GitHub com a conta da Larissa, previamente adicionada ao projeto.

## 3. Criar as variáveis de ambiente locais

Na pasta do projeto:

```powershell
Copy-Item .env.example .env.local
```

Abrir `.env.local` no Visual Studio Code e preencher os valores. Esse arquivo contém segredos, funciona somente no computador e nunca deve ser enviado ao GitHub.

### Variáveis obrigatórias

| Variável | Para que serve | Onde obter |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | endereço do projeto | configurações de API do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave pública do navegador | configurações de API do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | chave administrativa somente do servidor | configurações de API do Supabase |
| `NEXT_PUBLIC_SITE_URL` | endereço do sistema | local: `http://localhost:3000`; produção: URL da Netlify ou domínio |
| `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` | retorno do login | URL do sistema terminada em `/auth/callback` |

`SUPABASE_SERVICE_ROLE_KEY` é o segredo mais sensível. Nunca deve começar com `NEXT_PUBLIC_`, aparecer no navegador ou ser colada em uma IA.

### Variáveis opcionais

| Variável | Uso |
| --- | --- |
| `RESEND_API_KEY` e `EMAIL_FROM` | envio de e-mails e remetente autorizado |
| `PHONE_OTP_SECRET` | proteção dos códigos de alteração de telefone |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` e `RECAPTCHA_SECRET_KEY` | proteção reCAPTCHA |
| `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e `EVOLUTION_INSTANCE` | integração de WhatsApp |

Para gerar um novo `PHONE_OTP_SECRET`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copiar o resultado para `.env.local` e para a variável correspondente na Netlify. Não guardar o resultado em arquivo público.

## 4. Configurar produção na Netlify

As variáveis de produção ficam nas configurações de ambiente do site na Netlify e não são copiadas automaticamente de `.env.local`.

Para cada variável, cadastrar o mesmo nome de `.env.example`, usar o valor correto de produção e fazer uma nova publicação. Variáveis `NEXT_PUBLIC_` podem aparecer no navegador e nunca devem conter segredos.

Depois de qualquer alteração, testar login, recuperação de senha, documentos e encerramento da consulta.

## 5. Configurar o Supabase

Conferir URLs permitidas de login e callback, políticas RLS, bucket privado `documentos-clinica`, backups, usuários, permissões e migrações aplicadas.

Os arquivos SQL ficam em `scripts/`. As migrações de estrutura devem ser executadas em ordem numérica. O arquivo `006_pilot_seed.sql` é somente para dados fictícios de piloto.

Antes de executar uma migração em produção:

1. fazer backup;
2. ler o arquivo completo;
3. testar em um Supabase separado;
4. executar no SQL Editor;
5. confirmar que não houve erro;
6. testar as telas afetadas.

Nunca apagar tabelas nem reaplicar tudo cegamente para tentar corrigir um erro.

## 6. Trabalhar no sistema

Antes de começar:

```powershell
git switch dev
git pull origin dev
npm install
npm run dev
```

Abrir `http://localhost:3000`. A versão local mostra as mudanças feitas no computador.

Fluxo recomendado:

1. trabalhar em uma alteração pequena por vez;
2. pedir à IA para inspecionar o código antes de alterar;
3. revisar os arquivos modificados;
4. testar com dados fictícios;
5. executar todas as verificações;
6. criar o commit na `dev` e enviar ao GitHub;
7. revisar e mesclar `dev` na `main`;
8. acompanhar o deploy da Netlify e testar a produção.

Nunca desenvolver diretamente na `main`, pois ela representa a versão publicada.

## 7. Verificações obrigatórias

Antes de enviar qualquer mudança:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Se algum comando falhar, não publicar nem desativar a verificação para o deploy passar.

Também testar manualmente login, permissões, isolamento entre duas clínicas fictícias, pacientes, agenda, prontuário, odontograma, documentos, financeiro e exportação de dados.

## 8. Segurança obrigatória

- Dados reais podem existir somente no ambiente oficial usado pela clínica, com contrato, acessos e proteções definidos. Nunca copiar esses dados para desenvolvimento, banco de testes, vídeos, capturas de tela ou conversas com IA.
- Nunca mostrar `.env.local`, chaves, senhas, tokens ou dados de pacientes para uma IA.
- Nunca colocar `SUPABASE_SERVICE_ROLE_KEY` no código do navegador.
- Toda API deve verificar autenticação, clínica e permissão no servidor.
- Toda consulta clínica deve ser limitada ao `ownerId` da clínica.
- Botão escondido não substitui verificação de permissão no servidor.
- Documentos devem permanecer privados, acessíveis por links temporários.
- Mudanças em autenticação, prontuário, financeiro, exclusão e permissões exigem testes adicionais.
- Não apagar arquivos ou tabelas, reescrever o histórico do Git ou forçar atualizações sem compreender o impacto.

Consultar `docs/SECURITY.md`, `docs/INCIDENT_RESPONSE.md`, `docs/DATA_RETENTION.md`, `docs/TESTING.md` e `docs/PILOT_RUNBOOK.md`.

A divisão de responsabilidades e o fluxo com o suporte estão em `docs/OPERACAO_EQUIPE.md`. O encontro de transferência pode seguir `docs/ROTEIRO_REUNIAO_LARISSA.md`.

## 9. Backups, incidentes e saída de clínicas

- Confirmar regularmente que backups do Supabase estão ativos.
- Testar a restauração em ambiente separado; aparecer no painel não prova que o backup funciona.
- Em possível vazamento, preservar registros e seguir `docs/INCIDENT_RESPONSE.md`.
- Não apagar prontuários automaticamente quando uma clínica sair.
- Testar periodicamente a exportação e a leitura do arquivo gerado.

## 10. Atualizar dependências

Atualizar poucas bibliotecas por vez, executar todas as verificações e testar as funções principais. Revisar `npm audit`, mas nunca usar `npm audit fix --force` sem compreender as mudanças.

## 11. Ao pedir ajuda para uma IA

Informar objetivo, tela afetada, comportamento atual e esperado e mensagem completa do erro, sempre removendo segredos e dados de pacientes.

Pedir que a IA preserve alterações existentes, mantenha o isolamento entre clínicas, forneça migrações numeradas, atualize testes e execute lint, TypeScript, testes e build. Não autorizar `push`, merge, deploy ou alterações externas sem revisar o resultado.

## 12. Checklist da transição

- [ ] Larissa possui acesso próprio ao GitHub, Netlify e Supabase.
- [ ] Domínio, Resend, reCAPTCHA, WhatsApp e cobrança têm responsáveis definidos.
- [ ] Autenticação em dois fatores está ativa.
- [ ] Segredos foram entregues por meio seguro ou substituídos.
- [ ] Projeto funciona localmente com `.env.local`.
- [ ] Larissa consegue executar todas as verificações.
- [ ] Larissa consegue publicar uma mudança de teste pela `dev`.
- [ ] Migrações `001` a `007` foram conferidas.
- [ ] Backup e restauração foram testados.
- [ ] Plano de incidente possui responsáveis e contatos.
- [ ] Processo de suporte e prioridade foi definido.
- [ ] Nenhum segredo ou dado real está no GitHub ou em conversas com IA.

## Regra principal

Quando houver dúvida envolvendo dados, segurança ou exclusão, parar antes de executar. Fazer backup, testar em ambiente separado e pedir revisão. Uma entrega mais lenta é preferível a perder prontuários ou expor dados de pacientes.
