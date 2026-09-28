# Funções locais — 28/09/2026

## Visual

O tema usa fundo preto/carvão, bordas e destaques dourados, títulos serifados e uma pauta musical em SVG. O quiz mantém contraste nas respostas, seleção dourada e indicador de progresso. Animações decorativas respeitam `prefers-reduced-motion`. O menu móvel funciona por teclado, e as três redes usam os perfis informados pelo proprietário.

Não foram baixadas fontes, imagens ou mídias externas. O material inicial é original e está traduzido em inglês, português e espanhol. Os 30 itens do quiz foram preservados; as referências visuais não alteraram o número de perguntas para 20/50/90.

## Artigos e materiais

- `/en/journal`: lista de artigos publicados com filtro por categoria.
- `/en/resources`: coleção de materiais gratuitos, com um guia de prática de dez minutos.
- Páginas de leitura são renderizadas no servidor, com título e descrição próprios.
- Texto simples apenas. HTML é exibido como texto, sem execução de scripts ou embeds.
- O material gratuito tem impressão/salvar como PDF pelo navegador. Esse recurso não implementa vendas, links assinados ou marca d'água de produtos pagos.
- O seed é aplicado apenas pelo launcher local e não sobrescreve conteúdo existente.

## Verificação de e-mail e recuperação de senha

1. Execute `npm run dev:local`.
2. Cadastre uma conta e abra `/en/account`.
3. Solicite o link de verificação.
4. Abra o arquivo JSON mais recente para esse e-mail em `.tools/mailbox` e visite o campo `link`.
5. Confirme a ação no site. Abrir o link sozinho não consome o token.

Para recuperar senha, use `/en/forgot-password`. A mensagem usa a mesma caixa local. Os links expiram em 15 minutos e só podem ser usados uma vez; uma nova solicitação invalida o anterior. Reenvios são limitados a uma vez por minuto por finalidade/conta. A alteração de senha encerra todas as sessões anteriores; é preciso entrar novamente.

Nenhum e-mail é enviado à internet. A caixa local não tem endpoint HTTP público. Os tokens ficam como hashes no banco; o payload da outbox fica cifrado com AES-256-GCM e chave derivada do segredo da aplicação. O worker local escreve a mensagem em arquivo antes de marcá-la como entregue, permitindo retry sem perder a mensagem. Os arquivos locais contêm links de uso único e estão ignorados pelo git. Trocar o segredo da aplicação antes da entrega invalida a decifragem da outbox antiga; rotação de chaves com versionamento fica para a operação de produção.

## Habilitar seu editor local

No `.env`, defina o e-mail exato da sua conta local:

```dotenv
LOCAL_EDITOR_EMAIL=seu-email@example.com
```

Reinicie a API. Cadastre/entre nessa conta e confirme o e-mail pela caixa local. O link **Content studio / Estúdio de conteúdo** aparecerá em sua conta. A URL é `/en/studio`.

O editor permite criar rascunhos, editar as três traduções, escolher artigo/material e categoria, publicar e retirar do ar. As três traduções são exigidas antes de salvar. Uma publicação deve voltar para rascunho para editar o texto. Revisões evitam que uma aba sobrescreva silenciosamente alterações de outra.

O backend verifica sessão, e-mail configurado e confirmação do e-mail em cada operação. O papel não é recebido do navegador. Ferramentas locais são recusadas com `NODE_ENV=production`; a administração de produção ainda precisará de papéis, MFA e auditoria.

## Testar

```powershell
npm test
npm run build
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:e2e
```

O teste de edição usa um e-mail de teste configurado **no processo da API e no processo do Playwright**. Para executar os seis cenários, inicie a API com `LOCAL_EDITOR_EMAIL=studio-local@harmosphere.test` e passe o mesmo valor no terminal dos testes. Essa configuração é temporária, exclusiva do teste local. Sem ela, o cenário do editor é explicitamente ignorado. Os outros cenários não precisam de um editor.

O teste completo deixa os próprios rascunhos e contas locais; não modifica publicações do proprietário. Capturas ficam em `test-results/`, ignoradas pelo git.

## Ainda pendente

SMTP/provedor de e-mail, recuperação administrativa com MFA, vendas de PDFs, watermark, links assinados, LMS/HLS, reconciliação de gateways, termos e política de retenção. Nenhuma dessas integrações foi ativada ou simulada como uma compra real nesta etapa.
