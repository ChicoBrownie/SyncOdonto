# Estratégia de testes

## Execução local

- `npm test`: testes automatizados.
- `npm run verify`: lint sem erros, TypeScript e todos os testes.
- `npm run build`: compilação de produção.
- `npm run pilot:preflight -- .env.local`: valida a separação e as URLs do ambiente piloto sem imprimir segredos.
- `npm run pilot:smoke -- https://URL-DO-PILOTO`: testa saúde, ambiente, login e latência após a publicação.

O comando de build da Netlify executa `npm run verify` antes da compilação. Uma publicação é interrompida se alguma dessas verificações falhar.

## Cobertura crítica automatizada

- login, cadastro, normalização de e-mail e limite de tentativas;
- permissões de gestor, dentista e recepcionista;
- isolamento de pacientes entre duas clínicas fictícias;
- conflito de horários e ciclo de início/conclusão da consulta;
- criação única da pendência financeira ao concluir atendimento;
- validação das entradas de pacientes, agenda, equipe e documentos;
- download de documentos limitado à clínica e com link temporário.

## Testes que exigem ambiente integrado

Recuperação de senha, entrega real de convites/e-mails, upload no Storage e confirmação de callbacks devem ser executados em um projeto Supabase separado, usando apenas dados fictícios. Eles não devem apontar para produção nem depender de pacientes reais.
