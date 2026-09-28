# Configuração e validação de pagamentos

## Estado atual

Código dos dois adapters disponível; checkout desativado por padrão. Não há credenciais reais no projeto. Testes automatizados validam a política de liberação, deduplicação e assinaturas; testes reais de compra/sandbox permanecem pendentes.

Use PostgreSQL convencional (`npm run dev`), não `dev:local`, para os testes de gateway.

## Ambiente

Configure `.env` localmente, sem compartilhar valores:

- `PAYMENTS_ENABLED=true`
- `PAYMENTS_LIVE=false` durante homologação
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_COLLECTOR_ID`
- `PUBLIC_API_URL`: origem HTTPS pública que encaminha à API, sem `/api` no final
- `WEB_ORIGIN`: origem exata do frontend, sem barra final
- `STRIPE_PRICE_MINOR`, `STRIPE_CURRENCY`, `MERCADOPAGO_PRICE_MINOR`

Ambos os provedores precisam estar configurados quando os checkouts forem habilitados. O preço é selecionado no servidor e copiado ao pedido; o idioma não seleciona moeda automaticamente.

## Stripe

Endpoint: `POST /api/payments/webhooks/stripe`.

Assine eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`.

Corpo bruto é verificado com a assinatura do SDK. O adapter consulta o PaymentIntent e charge atuais para obter estado, valor e metadata criados pelo servidor. Um redirect não é prova de pagamento. Compras ainda pendentes não concedem direitos. Reembolsos parciais também revogam o relatório nesta política inicial.

## Mercado Pago

Endpoint: `POST /api/payments/webhooks/mercadopago`.

Checkout Pro Preferences API. Habilite notificações de `payment`; o adapter verifica `x-signature`, `x-request-id` e `data.id` da query, com HMAC SHA-256 e tolerância temporal de cinco minutos. O corpo recebido não é usado como prova do status. Após a assinatura, o pagamento é consultado em `/v1/payments/{id}` e confrontado com o collector esperado, ambiente, referência de pedido e metadata de usuário.

Validar no sandbox: propagação de `metadata.user_id` da preferência ao pagamento, notificações de atualização/reembolso/chargeback, comportamento de retries e assinatura por recurso. Notificações de outros tópicos não são implementadas nesta etapa; tratamento operacional de disputas é pendente. Pix depende da disponibilidade/configuração da conta e dos meios de pagamento do checkout; não há QR Code próprio implementado.

## Garantias locais

- Uma tentativa tem um único pedido e um gateway escolhido. Troca posterior exige reconciliação; não existe criação paralela em outro gateway.
- Stripe usa chave de idempotência pelo pedido. Mercado Pago usa uma reserva local transacional antes da criação da preferência.
- Se uma chamada de criação ficar ambígua por falha de rede, o pedido fica `UNCERTAIN`. Não é feita nova cobrança automaticamente. Operação/reconciliação precisa consultar o gateway e resolver antes de permitir nova criação. Checkouts expirados também requerem operação nesta versão.
- Webhook só recebe 200 depois da consulta ao provedor e da transação de concessão/revogação. Falha de API/banco retorna erro para retry do fornecedor. Ainda não existe inbox/worker assíncrono de reconciliação.
- Deduplicação e atualização do entitlement ocorrem na mesma transação.
- Estado REVOKED é terminal: evento antigo de pagamento não reativa o acesso. Recuperação após disputa ganha exige política operacional futura.

## Homologação antes de ativar produção

1. Compra aprovada em cada gateway e retorno antes/depois do webhook.
2. Pagamento assíncrono pendente, aprovado e falho.
3. Evento repetido e eventos fora de ordem.
4. Valor/moeda/comprador incorretos e assinatura adulterada.
5. Reembolso integral/parcial e disputa, com revogação comprovada.
6. Expiração de checkout, falha de rede na criação e conciliação.
7. Credenciais live, preços mínimos/tarifas, políticas de venda, e-mails e alertas operacionais.

Não considerar os adapters homologados até concluir esses cenários com contas do proprietário.
