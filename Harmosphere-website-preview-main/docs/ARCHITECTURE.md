# Arquitetura e decisões da primeira entrega

## Limites de confiança

Navegador → controller (HTTP/validação) → service (política) → repository (SQL parametrizado) → PostgreSQL. Módulos organizados por capacidade: auth, quiz e payments. Nesta primeira entrega são registrados em um composition root NestJS; a extração para módulos Nest independentes pode ocorrer sem mudar as regras de domínio.

Não existem rotas que recebam preço, dono da tentativa, perfil calculado ou status pago do cliente. O resultado completo exige sessão ativa, propriedade, entitlement não revogado e pedido pago em uma consulta.

## Quiz anônimo

- Cookie aleatório de 256 bits, HttpOnly, SameSite=Lax, Secure e prefixo __Host- em produção.
- Banco armazena apenas hash SHA-256 do token; validade de 30 dias.
- Respostas persistidas por pergunta. Um rascunho local guarda a última escolha pendente, sem cookies ou relatórios.
- Número de revisão detecta edição concorrente. Bloqueio de linha protege salvar/concluir/reivindicar.
- Conclusão valida todas as respostas e persiste um snapshot imutável do resultado.
- Login/cadastro ocorre depois da conclusão. Claim depende simultaneamente da conta autenticada e do cookie anônimo; o cookie é invalidado ao vincular.
- Não se aceita claim por ID da tentativa. Uma tentativa só pertence a uma conta.

## Modelagem implementada

`users` → `sessions` → `used_refresh_tokens`.

`quiz_versions` → `attempts` → `orders` → `entitlements`.

`payment_events` garante deduplicação por provedor/evento. `rate_limits` compartilha contadores no banco.

`quiz_versions.definition` guarda o questionário versionado em JSONB. `attempts.answers` e `result` são snapshots JSONB. Esta escolha atende uma versão inicial sem CMS, preserva isolamento da versão e permite criação posterior de tabelas normalizadas para edição e análise. Nunca editar uma versão publicada: criar outro ID, migrar/semear e manter tentativas antigas.

Foreign keys compostas reforçam que tentativa, pedido e entitlement pertencem à mesma conta. Valores monetários são inteiros; unicidade por tentativa impede pedidos concorrentes em dois gateways.

## Identidade

- Senhas: scrypt N=131072, r=8, p=1; salt aleatório; comparação em tempo constante.
- Access JWT: 10 minutos, emissor e audiência fixos, algoritmo permitido explicitamente.
- Refresh opaco: 30 dias, hash no banco, rotação transacional; reutilização revoga a sessão. A sessão é consultada em cada autorização para efetivar logout/revogação.
- Hashing de senha tem limite de concorrência por processo; rate limiting complementa a proteção.
- Cookies não ficam no localStorage. O frontend coordena refresh entre abas usando Web Locks quando disponível.

## Proteções atuais e limites

- Operações de navegador exigem origem exata, JSON e header customizado. Não se habilita CORS permissivo. Webhooks têm controllers separados e assinatura própria.
- Payload JSON limitado a 128 KiB; DTOs validados com Zod strict.
- Helmet na API; CSP com nonce na interface; React escapa os textos renderizados.
- Resultados e respostas da API usam Cache-Control private,no-store.
- Consultas parametrizadas; tokens, senhas e payloads de pagamentos não são registrados em logs.
- Rate limiting persistido: 15 mutações sensíveis/minuto e 180 requisições gerais/minuto por IP observado. Consultas de sessão não consomem a cota de mutações de autenticação. Contadores precisam de limpeza periódica antes de produção.
- Por segurança, não se confia em X-Forwarded-For recebido do cliente. Nesta configuração via proxy local, usuários podem compartilhar o limite do proxy. Antes de publicar: ingress que remova headers não confiáveis, lista exata de proxies confiáveis, política por conta+IP e testes contra spoofing.
- CSP, isolamento e testes não equivalem a auditoria OWASP completa. Recuperação de senha e confirmação de e-mail estão implementadas localmente; provedor de e-mail, MFA de administração, auditoria, retenção, reconciliação e backups continuam pendentes.

## Evolução local em 28/09/2026

`002_content_and_account_tokens.sql` acrescenta verificação de e-mail, tokens de uso único, outbox cifrada e conteúdo editorial versionado por revisão. Reset de senha bloqueia o usuário, consome o token e revoga sessões na mesma transação. A emissão de uma sessão compara novamente o hash de senha sob bloqueio para impedir que um login iniciado antes do reset crie uma sessão nova com a senha antiga.

`content` segue controller/service/repository. Conteúdo publicado é público; rascunhos só aparecem no editor local autenticado e com e-mail verificado. Textos e traduções são JSONB validados estritamente. Revisões controlam edição concorrente; o seed local nunca sobrescreve alterações. A interface renderiza os textos sem HTML interpretado.

O launcher local entrega a outbox em arquivos fora da pasta pública. Não há endpoint público para ler mensagens. A configuração dessas ferramentas falha em produção.

## Expansão ainda não implementada

- Blog: administração de produção com papéis, MFA, auditoria e edição rica; o fluxo local com texto simples já existe.
- Produtos: catálogo, preços por moeda, itens de pedido e direitos de acesso independentes.
- PDFs: objetos privados; geração assíncrona de cópias com marca d'água por compra; URLs assinadas curtas após autorização. Preferir ID da compra a CPF exposto.
- Cursos: courses/modules/lessons, progresso, assinaturas e entitlements com expiração.
- E-mail: provedor externo, monitoramento e chaves versionadas; outbox e tokens já funcionam localmente. Nunca enviar senhas em texto puro.
- Streaming: S3 privado com OAC + CloudFront signed cookies, ou serviço gerenciado. Proteger manifests, segmentos e chaves. Sessões por usuário/aula, curta duração, renovação autenticada e limites de concorrência.
- IP é controle complementar por causa das mudanças de rede. HLS e tokens não impedem captura de tela; avaliar DRM e marca d'água para material premium.

As tabelas dos módulos futuros ainda não são criadas por migrations para evitar um esquema não utilizado e não validado.
