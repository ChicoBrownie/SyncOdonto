# Retenção, exportação e exclusão de dados

Este documento é uma base operacional e deve ser validado pelo responsável jurídico e pelo encarregado de dados antes do uso com pacientes reais.

## Princípios

- guardar apenas dados necessários para atendimento, obrigação legal e defesa profissional;
- registrar a finalidade e o fundamento de cada categoria de dado;
- não excluir prontuários automaticamente sem validar os prazos legais aplicáveis;
- manter documentos e backups protegidos durante todo o período de retenção;
- atender solicitações de titulares com confirmação de identidade e registro da decisão.

## Fluxo implementado

O gestor pode baixar uma exportação JSON imediata na página Minha Conta. O arquivo inclui cadastros, dados clínicos e financeiros, metadados de documentos, equipe e auditoria. Como os arquivos binários de documentos e exames podem ser grandes, eles são entregues separadamente durante a saída da clínica.

O gestor também pode abrir solicitações de `export` ou `deletion` pela página Minha Conta e pela API `/api/account/data-requests`. A solicitação entra como `pending` e é auditada. Nenhuma exclusão clínica é executada automaticamente: isso evita apagar prontuários que precisem ser preservados por obrigação legal.

### Saída da clínica

1. confirmar a autoridade do gestor e registrar a data de encerramento;
2. congelar alterações administrativas, sem interromper o acesso clínico antes da data combinada;
3. gerar a exportação JSON e o pacote separado de documentos e exames;
4. conferir quantidades por categoria e realizar teste de leitura dos arquivos;
5. entregar por canal protegido, com senha enviada separadamente e prazo de expiração;
6. obter confirmação de recebimento da clínica;
7. bloquear novos acessos e revogar sessões e integrações;
8. aplicar retenção, anonimização ou exclusão conforme decisão jurídica documentada;
9. registrar o tratamento das cópias de backup e sua data prevista de expiração;
10. concluir a solicitação e preservar somente os comprovantes necessários.

## Procedimento operacional

1. confirmar a identidade e a autoridade do solicitante;
2. identificar os dados e pacientes abrangidos;
3. verificar obrigações de retenção com o responsável jurídico;
4. aprovar, rejeitar ou limitar a solicitação com justificativa;
5. para exportação, gerar pacote criptografado e URL temporária;
6. para exclusão, anonimizar ou remover somente o que puder ser legalmente eliminado;
7. registrar conclusão, responsável e data na solicitação e na auditoria;
8. considerar cópias em backups e definir a expiração correspondente.

## Revisão periódica

Revisar trimestralmente solicitações pendentes, contas inativas, documentos órfãos, logs, códigos OTP expirados e registros de rate limit. Testar restauração de backup antes de qualquer exclusão em massa.
