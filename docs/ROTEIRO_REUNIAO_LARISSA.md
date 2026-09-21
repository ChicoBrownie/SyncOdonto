# Roteiro da reunião de transição com Larissa

Tempo sugerido: 1h30 a 2h. Gravar a reunião, com autorização dela, sem exibir senhas ou chaves na gravação.

## Antes da reunião

- adicionar Larissa ao GitHub, Netlify e Supabase com conta própria;
- separar `.env.example` e `docs/GUIA_TRANSICAO_LARISSA.md`;
- confirmar que ela instalou Git, Node.js 22 ou superior e Visual Studio Code;
- deixar os segredos em um gerenciador de senhas, nunca no chat ou na gravação;
- usar somente pacientes fictícios durante a demonstração.

## 1. Explicar o negócio — 10 minutos

Falar:

> O SyncOdonto administra pacientes, agenda, prontuário, odontograma, documentos e financeiro de clínicas. Ele guarda dados pessoais e de saúde, por isso segurança e preservação dos registros são prioridades.

Explicar a divisão:

- gestor: vendas, gestão e marketing;
- Thalita: suporte, implantação, treinamento e vídeos;
- Larissa: desenvolvimento, testes, banco e publicação.

## 2. Mostrar onde cada parte funciona — 10 minutos

- GitHub guarda o código;
- Visual Studio Code é onde o código é alterado;
- Supabase guarda usuários, banco e documentos;
- Netlify publica o sistema;
- Resend envia e-mails;
- reCAPTCHA protege ações sensíveis;
- Evolution API integra WhatsApp, quando ativa.

## 3. Preparar o projeto no computador — 20 minutos

Pedir para Larissa executar pessoalmente:

```powershell
git clone https://github.com/ChicoBrownie/SyncOdonto.git
cd SyncOdonto
npm install
Copy-Item .env.example .env.local
```

Mostrar como abrir a pasta no Visual Studio Code.

## 4. Explicar as variáveis — 20 minutos

Abrir `.env.example`, nunca compartilhar o `.env.local` na gravação.

Explicar:

- `NEXT_PUBLIC_` significa que o valor pode chegar ao navegador;
- `SUPABASE_SERVICE_ROLE_KEY` é administrativa e nunca pode ser pública;
- as variáveis locais ficam em `.env.local`;
- as de produção ficam no painel da Netlify;
- URLs de login também precisam estar autorizadas no Supabase;
- mudar uma variável exige reiniciar o ambiente local ou publicar novamente.

Entregar os valores reais por meio seguro depois de encerrar ou pausar a gravação.

## 5. Executar o sistema localmente — 10 minutos

```powershell
git switch dev
npm run dev
```

Abrir `http://localhost:3000` e fazer login somente com conta fictícia.

## 6. Fazer uma pequena mudança de treinamento — 15 minutos

Escolher uma alteração sem risco, como um texto de ajuda. Mostrar o ciclo:

1. alterar;
2. visualizar localmente;
3. revisar arquivos modificados;
4. testar;
5. criar commit na `dev`;
6. enviar ao GitHub;
7. revisar antes de colocar na `main`.

Não usar banco, exclusões ou permissões como primeiro exercício.

## 7. Executar as verificações — 10 minutos

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Explicar: se algo falhar, a mudança não está pronta. Não remover a verificação apenas para publicar.

## 8. Explicar banco e migrações — 10 minutos

- mudanças no banco recebem novo arquivo numerado em `scripts/`;
- testar primeiro em um Supabase separado;
- fazer backup antes da produção;
- nunca apagar tabelas para “começar novamente”;
- guardar confirmação de qual migração foi executada;
- `006_pilot_seed.sql` serve somente para dados fictícios.

## 9. Explicar segurança — 10 minutos

Mostrar `docs/SECURITY.md` e reforçar:

- nunca enviar segredos ou dados de pacientes para IA;
- toda API precisa validar usuário, clínica e permissão;
- links de documentos devem ser temporários;
- alterações em login, prontuário, financeiro e exclusão exigem testes adicionais;
- preservar evidências e seguir o plano se houver incidente.

## 10. Ensinar a pedir ajuda para IA — 10 minutos

Modelo de pedido:

> Analise primeiro o funcionamento atual. Preciso alterar [tela]. Hoje acontece [situação]. O resultado esperado é [resultado]. Preserve as mudanças existentes, não use dados reais, não faça push nem altere serviços externos sem autorização. Atualize os testes e execute lint, TypeScript, testes e build. Se precisar alterar o banco, crie uma migração numerada e explique como aplicá-la com segurança.

Antes de aceitar uma mudança da IA, Larissa deve perguntar:

- quais arquivos foram alterados?
- houve mudança no banco?
- há risco de perder ou expor dados?
- quais testes foram executados?
- existe alguma etapa manual na Netlify ou Supabase?

## Encerramento

Pedir para Larissa realizar sem ajuda:

- iniciar o sistema localmente;
- explicar onde ficam as variáveis;
- localizar as migrações;
- executar os quatro comandos de verificação;
- explicar a diferença entre `dev` e `main`;
- dizer o que faria antes de uma mudança no banco;
- localizar o plano de incidentes.

Se ela conseguir completar essa lista, a transição técnica básica foi compreendida. Agendar uma segunda reunião depois da primeira mudança real para revisar dúvidas.
