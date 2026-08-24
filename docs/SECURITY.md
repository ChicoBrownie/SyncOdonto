# Segurança e operação

## Regras obrigatórias de desenvolvimento

- Nunca enviar `SUPABASE_SERVICE_ROLE_KEY`, chaves de e-mail ou WhatsApp ao navegador.
- Nunca versionar `.env.local`.
- Toda rota deve autenticar o usuário antes de acessar dados.
- Toda operação clínica deve filtrar por `ownerId`.
- IDs recebidos do cliente não comprovam propriedade: paciente e recursos relacionados devem ser consultados dentro do escopo da clínica.
- `id`, `user_id`, `created_at` e `updated_at` não podem ser alterados pelo corpo de uma requisição.
- Permissão escondida na interface não substitui verificação no servidor.
- Funcionários desativados não podem acessar páginas ou APIs da clínica.

## Antes do piloto com dados reais

- revisar as políticas RLS e do Storage no Supabase;
- confirmar que o bucket de documentos é privado;
- configurar backups automáticos e executar um teste de restauração;
- definir retenção e descarte de documentos e prontuários;
- registrar acessos e mudanças relevantes em uma trilha de auditoria;
- configurar monitoramento de erros e disponibilidade;
- revisar termos, consentimentos, política de privacidade e responsabilidades da LGPD;
- executar teste de isolamento com pelo menos duas clínicas e três perfis de funcionário.

## Resposta a incidentes

Em suspeita de vazamento ou comprometimento:

1. interromper o acesso afetado;
2. rotacionar chaves e sessões;
3. preservar registros para investigação;
4. identificar titulares e dados envolvidos;
5. restaurar apenas a partir de backup verificado;
6. seguir o processo jurídico e regulatório aplicável.

## Dependências

Execute regularmente `npm audit` e avalie cada atualização. Não use correções forçadas que tragam mudanças incompatíveis sem revisar e testar o sistema completo.
