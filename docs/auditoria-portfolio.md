# Auditoria de portfólio — Estoque API

Revisão em 02/11/2026. Base: `c1b35446277e33e1cf41b0ee418ac574339b8aa5`.

Foram inventariados os arquivos atuais e o histórico alcançável pelas referências disponíveis no clone: 8503 objetos Git e 15 versões de arquivos de texto próprios. A busca incluiu padrões de tokens, chaves privadas, URLs de conexão, configurações de segredo, e-mails e hashes de senha. Valores sensíveis não foram reproduzidos neste documento.

A revisão não abrange segredos da hospedagem, bancos pessoais, logs externos, caches, releases ou forks, nem equivale a um pentest. Não houve alteração de visibilidade ou reescrita do histórico. As ilustrações do README representam fluxos e não usam contas ou bancos pessoais.

## Exposição no histórico público

- `.env` estava versionado, apesar de já constar no `.gitignore`. O arquivo atual tinha configurações locais e placeholders; versões anteriores contêm host remoto, senha de banco preenchida e segredo JWT sem aparência de exemplo.
- Considere essas credenciais expostas. Se ainda estiverem em uso, troque a senha do banco e o segredo JWT nos serviços correspondentes. Esta revisão não testou as credenciais nem acessou o banco remoto.
- O dump continha registros de clientes, fornecedores, usuários, produtos, vendas e movimentações, incluindo nomes, e-mails, telefones, endereços e um hash com aparência de demonstração. A origem fictícia de todos os registros não pôde ser certificada.

## Alterações realizadas

- `.env` retirado do Git e preservado apenas como arquivo local ignorado; `.env.example` passa a distribuir somente as variáveis usadas pelo servidor.
- 11.028 arquivos gerados de `node_modules` retirados do versionamento. Essa pasta continua local e deve ser recriada com `npm ci`.
- `inventory_system.sql` preservado como estrutura, sem os 8 blocos de dados do dump. Tabelas, índices, relacionamentos, views, procedures e triggers permanecem. INSERTs internos de procedures/triggers são regras do banco e foram mantidos.
- Contadores `AUTO_INCREMENT` do dump foram normalizados; a importação isolada confirmou zero registros nas 10 tabelas.
- Retiradas seis dependências não importadas pelo código: `helmet`, `express-rate-limit`, `joi`, `multer`, `pdf-creator-node` e `xlsx`. Manifesto e lockfile atualizados; instalar essas bibliotecas nunca habilitava proteção automaticamente.
- Removido script `migrate` que apontava para um arquivo inexistente; adicionado `check` para sintaxe e suporte a `DB_PORT` no pool, permitindo banco local em porta dedicada.
- `teste.html` preservado como cliente manual. Metadata fictícia de autoria/repositório no manifesto foi substituída pela identificação do portfólio.
- README e assets de documentação seguem a estrutura e o estilo do StoreAPI, com status funcional honesto.

## Validação e falhas preexistentes

O banco temporário foi criado em diretório próprio da revisão e porta exclusiva. Os bancos e serviços existentes da máquina não foram usados. Importação do schema e consultas básicas passaram; o cadastro de produto respondeu 500 por `db is not defined`, e a consulta de estoque baixo respondeu 404 pela ordem das rotas. Há rotas POST duplicadas e outras referências ao mesmo `db` inexistente.

O middleware JWT é definido e não aplicado às rotas. Não há suíte de testes: `npm test -- --runInBand` terminou com código 1 por ausência de testes. As correções funcionais e de autorização ficam fora desta limpeza e estão listadas no README.

## Dependências

O audit inicial tinha 31 alertas; depois de retirar pacotes sem uso, `npm audit --json` reportou **20 alertas: 2 críticos, 10 altos, 1 moderado e 7 baixos**. Atualizações das dependências restantes ainda precisam de trabalho próprio e validação. A revisão não certifica explorabilidade de cada alerta nas rotas desta aplicação.

## Próximo passo de privacidade

As remoções neste PR não eliminam `.env` e dados dos commits públicos anteriores. Além de rotacionar os segredos que ainda forem válidos, é necessário tratar o histórico ou preparar uma cópia pública limpa; cópias em forks e caches podem continuar existindo. Não foi executado force-push.
