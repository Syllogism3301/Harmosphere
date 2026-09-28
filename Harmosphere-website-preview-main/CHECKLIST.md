# Harmosphere — checklist de entrega

Atualizado em 28/09/2026. Segunda entrega local: tema preto/dourado + blog/editor + materiais gratuitos + recuperação e verificação de conta. Fundação, quiz anônimo e paywall preservados.

Legenda: `[x]` implementado e verificado localmente; `[ ]` pendente. Quando há código parcial, a observação explica o que falta. Integrações sandbox e produção têm critérios separados.

zero vulnerabilidades conhecidas; não representa certificação de segurança nem homologação dos gateways.

Teste local em http://localhost:3000 com `npm run dev:local`. Instruções completas em [README.md](README.md).

## Arquitetura e operação
- [x] Monorepo Next.js + NestJS + TypeScript
- [x] Controllers, Services e Repositories separados
- [x] Schema PostgreSQL, migrations versionadas e integridade referencial — executados em PGlite
- [ ] Homologação no PostgreSQL gerenciado de produção
- [x] Configuração validada, segredos fora do código e documentação de execução
- [x] Modo local persistente sem Docker, recusando pagamentos e produção
- [ ] CI executada no GitHub — workflow pronto; mesmos comandos passaram localmente
- [ ] Deploy, domínio, TLS, backups e restauração testada
- [ ] Observabilidade, alertas e teste de carga

## Landing page e i18n
- [x] Landing Harmosphere responsiva e orientada ao quiz
- [x] Tema das referências: preto/carvão, dourado, títulos serifados, pauta e notas musicais
- [x] Tema aplicado ao quiz, formulários, resultados, blog, materiais e conta
- [x] Menu móvel, foco por teclado e redução de movimento respeitada
- [x] Inglês padrão, português e espanhol
- [x] Perguntas e resultados traduzidos
- [x] Links YouTube @Harmosphere_ofc, Instagram @harmosphere_ e TikTok @harmosphere_official
- [ ] Revisão editorial, acessibilidade manual e SEO de produção

## Quiz e identidade
- [x] Quiz sem login com 30 perguntas iniciais
- [x] Progresso persistido e retomada no navegador
- [x] Rascunho local após falha de rede, inclusive recarga; avanço bloqueado até salvar
- [x] Revisões concorrentes e conclusão imutável
- [x] Cadastro/login apenas antes dos resultados
- [x] Vinculação atômica da tentativa anônima à conta
- [x] Resultado parcial gratuito após login
- [x] Resultado completo somente com compra confirmada da tentativa — política testada localmente
- [x] Histórico de resultados da conta — implementado; leitura protegida por sessão e conta
- [ ] Conteúdo e metodologia musical revisados (não é avaliação psicológica)
- [x] Recuperação de senha com token único, expiração e revogação de sessões — caixa local
- [x] Verificação de e-mail, reenvio limitado e página de conta — caixa local
- [x] Outbox transacional cifrada e entrega em arquivos, sem endpoint público de mensagens
- [ ] Provedor externo de e-mail e homologação de entrega
- [ ] MFA e papéis administrativos para produção

## Pagamentos
- [ ] Stripe homologado — adapter e criação de checkout implementados; faltam credenciais e teste sandbox
- [ ] Mercado Pago homologado — adapter Checkout Pro implementado; validar Pix e metadata na conta
- [x] Verificação de assinatura Stripe rejeita evento adulterado
- [x] Verificação HMAC Mercado Pago testada com validade temporal e recurso assinado
- [ ] Consultas autoritativas aos provedores homologadas — código pronto, sandbox pendente
- [x] Idempotência local, conferência de valor/moeda/comprador e revogação
- [x] Falha ambígua de checkout bloqueia nova criação automática; troca de gateway exige reconciliação
- [ ] Testes sandbox com contas reais de ambos os provedores
- [ ] Reconciliação agendada, reembolsos/disputas operacionais e alertas
- [ ] Preços, tarifas, moedas e credenciais de produção definidos

## Segurança
- [x] JWT curto e refresh rotativo em cookies HttpOnly
- [x] Hash scrypt para senhas; revogação de sessão por replay de refresh
- [x] Proteção de origem/CSRF, headers e validação estrita
- [x] Consultas parametrizadas e autorização por recurso
- [x] Rate limiting no banco e limitação de payload
- [ ] Configurar ingress/proxies confiáveis e limites por conta+IP para produção
- [x] Testes de isolamento, fraude de webhook e concorrência
- [ ] Auditoria, retenção de dados, termos/privacidade e revisão de segurança

## Blog, infoprodutos e cursos
- [x] Blog local com artigos publicados, filtros e páginas de leitura renderizadas no servidor
- [x] Editor local autorizado por conta verificada/configurada; rascunho, publicação e retirada do ar
- [x] Revisões de edição concorrente e validação obrigatória das três traduções
- [x] Texto editorial sem HTML executável; teste de XSS no navegador
- [x] Catálogo de materiais gratuitos e guia de prática imprimível/salvável pelo navegador
- [ ] Administração de produção com auditoria e revisão editorial do conteúdo definitivo
- [ ] Catálogo e vendas de PDFs
- [ ] S3 privado, URLs assinadas e marca d'água por compra
- [ ] Cursos, aulas, área de membros e progresso
- [x] Token de uso único para verificação da conta — implementação local
- [ ] Ativação de matrícula e e-mail após compra de curso
- [ ] HLS protegido, sessões de reprodução e limitação de concorrência
- [ ] Revogação de acesso e avaliação de DRM/marca d'água

## Dependências do proprietário
- Links das três redes recebidos e incluídos. Tema ajustado às referências fornecidas em 28/09; identidade visual final ainda pode ser refinada.
- Conteúdo musical revisado e infoprodutos/aulas.
- Contas sandbox Stripe e Mercado Pago; segredos devem ficar no ambiente, nunca no chat ou git.
- Domínio, provedor de e-mail e hospedagem antes da publicação.

## Próxima etapa recomendada
1. Revisar o tema e o conteúdo inicial; configurar seu e-mail como editor local.
2. Continuar catálogo de produtos privados e biblioteca de cursos com assets locais de teste.
3. Implementar entrega assinada/marca d'água e sessões de streaming, sem habilitar cobranças reais.
4. Quando autorizado a integrar serviços externos: homologar gateways, e-mail, armazenamento e reconciliação.
