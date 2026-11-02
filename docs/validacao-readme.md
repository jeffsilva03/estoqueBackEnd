# Validação da documentação — Estoque API

Revisão em 02/11/2026, Windows, Node 22.22.0 e MariaDB 10.4.32 em instância temporária de diretório e porta próprios.

| Verificação | Resultado |
| :-- | :-- |
| `npm ci --ignore-scripts --no-audit --no-fund` após limpeza | Passou; lockfile consistente |
| `npm run check` | Sintaxe de `server.js` passou |
| Importação do schema | 10 tabelas, 2 procedures, 2 triggers e 2 views; tabelas com zero registros |
| HTTP 200 | `/`, `/api/test`, produtos, categorias, fornecedores, clientes, vendas e dashboard |
| Respostas vazias | Listas `[]`; indicadores zerados no dashboard |
| Estoque baixo | 404: rota encoberta pela consulta genérica por ID |
| Cadastro de produto fictício | 500: `db is not defined` |
| `npm test -- --runInBand` | Código 1: não há testes versionados |
| `npm audit --json` final | 20 alertas: 2 críticos, 10 altos, 1 moderado, 7 baixos |
| README e assets | Estrutura comparada ao StoreAPI, links e SVGs conferidos e prévia visual revisada |

Os serviços temporários foram encerrados depois das verificações. Não houve conexão a credenciais históricas, banco remoto, banco pessoal ou deploy Railway. Vendas, ajuste de estoque com dados e fluxos completos de relatórios não foram certificados. As falhas são preexistentes e foram documentadas; esta mudança não tenta substituir a implementação das rotas.
