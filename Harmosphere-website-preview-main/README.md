# Harmosphere

Versão local: visual escuro e dourado, quiz anônimo de 30 perguntas, cadastro/login no final, perfil gratuito e autorização do relatório completo por compra. Blog com editor e publicação, coleção de materiais gratuitos e recuperação/verificação de conta. Inglês padrão; português brasileiro e espanhol incluídos.

**Ainda não é uma publicação de produção.** Consulte [CHECKLIST.md](CHECKLIST.md) para o escopo completo, verificações e pendências. Vendas de PDFs privados, streaming/LMS e gateways homologados permanecem pendentes. Os materiais gratuitos para impressão não substituem a entrega protegida dos futuros produtos pagos.

## Executar rapidamente, sem Docker

Pré-requisito: Node.js 22 ou superior com npm. Nesta máquina o Node foi encontrado em `C:\Program Files\nodejs`; um terminal antigo pode precisar ser reaberto para atualizar o PATH.

```powershell
npm install
npm run setup
npm run dev:local
```

Abra http://localhost:3000. O setup cria `.env` com um segredo aleatório e preserva arquivos existentes. Nunca publique esse arquivo.

`dev:local` usa PGlite, um engine PostgreSQL embutido para desenvolvimento, persistido em `.tools/dev-database`. Usa os mesmos repositories e migrations da API. **Este modo recusa produção e pagamentos habilitados.** Não há botão de pagamento falso, token universal ou endpoint de desbloqueio.

O quiz começa sem conta. Responda, recarregue para retomar, conclua, cadastre-se e veja o perfil gratuito. O relatório completo continuará bloqueado enquanto não houver confirmação válida de pagamento.

O modo local aplica novas migrations sem apagar respostas ou contas existentes. Em 28/09 foram adicionados blog e materiais, conta/verificação e recuperação de senha. Veja [o guia das funções locais](docs/LOCAL-FEATURES.md).

Rotas úteis: `/en/journal`, `/en/resources`, `/en/account`, `/en/forgot-password` e `/en/studio`. Troque `en` por `pt-BR` ou `es` para mudar o idioma.

## PostgreSQL convencional

```powershell
npm run setup
docker compose up -d
npm run db:migrate
npm run dev
```

`compose.yaml` é apenas para desenvolvimento: credenciais locais, porta vinculada a loopback. Em produção, use banco gerenciado, conexão TLS validada, segredos no ambiente e usuário com privilégios mínimos.

API: http://127.0.0.1:4000/api. O frontend encaminha `/api` à API; cookies permanecem na mesma origem. O listener da API é restrito a loopback nesta configuração. Em contêineres separados será necessário configurar a rede interna e o destino do proxy.

## Comandos de verificação

```powershell
npm run typecheck
npm test
npm run build
# Com o frontend e a API de desenvolvimento rodando:
npx playwright install chromium
npm run test:e2e
```

No Windows com Edge instalado, não é necessário baixar Chromium:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:e2e
```

Os testes de backend executam migrations e consultas em PGlite, sem mocks das regras de acesso. Eles não substituem validação contra a versão de PostgreSQL de produção. Os testes de navegador criam contas de teste locais e preservam screenshots em `test-results/`.

## Organização

```text
apps/api/src/
  auth/          controllers, services e repository de identidade
  content/       artigos, materiais gratuitos, rascunhos e publicação
  quiz/          controller, service, repository, definição e scoring
  payments/      controller, service, repository e adapters dos provedores
  common/        cookies, CSRF/origem, rate limiting e erros
  database/      pool, transações e migrations
apps/api/migrations/
apps/web/src/
  app/[locale]/  páginas e layout
  features/      quiz, identidade e resultados
  i18n/          idiomas e carregamento de mensagens
  lib/           cliente HTTP, refresh coordenado
apps/web/messages/  en, pt-BR, es
tests/e2e/         jornada no navegador
```

O acesso ao PostgreSQL usa `pg` e SQL parametrizado em repositories, em vez do Prisma inicialmente sugerido. Isso mantém transações e bloqueios explícitos, elimina dependência de geração de cliente e permite testar as mesmas queries no engine embutido. Services aplicam regras; repositories mantêm SQL e transações. Veja `docs/ARCHITECTURE.md`.

## Pagamentos

Leia [docs/PAYMENTS.md](docs/PAYMENTS.md). Os adapters Stripe e Mercado Pago estão implementados, mas **não foram certificados em sandbox com suas contas**. `PAYMENTS_ENABLED=false` é o padrão. Não coloque credenciais no chat, no código ou no git.

## Conteúdo e limitações

- As 30 perguntas e cinco dimensões são conteúdo editorial inicial. Não são teste psicológico, de inteligência ou percentis validados.
- Os pesos e o relatório completo nunca são enviados no payload público de perguntas.
- Confirmação de e-mail e recuperação de senha funcionam com mensagens em `.tools/mailbox` no modo local. Não há envio externo de e-mail; uma integração de produção ainda precisa ser implementada.
- Sem cookie anônimo, não é possível recuperar a tentativa apenas conhecendo seu ID. O cookie expira em 30 dias.
- Dados locais e screenshots podem conter e-mails usados nos testes: estão ignorados pelo git.
- Preços atuais são exemplos em centavos; valide mínimos, taxas e moedas antes de habilitar o gateway.

## Fontes técnicas

- [NestJS](https://docs.nestjs.com/)
- [Next.js](https://nextjs.org/docs/app)
- [next-intl](https://next-intl.dev/docs/routing/setup)
- [Stripe webhooks](https://docs.stripe.com/webhooks)
- [Mercado Pago webhooks](https://www.mercadopago.com.br/developers/en/docs/checkout-pro-preferences/additional-content/notifications/webhooks)
- [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
