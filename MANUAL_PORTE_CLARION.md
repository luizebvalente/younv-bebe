# Manual de Porte — younv-clarion → younv-crm-fire

Porte da versão **`younv-clarion@feature/melhorias-crm-v2`** para dentro do
**`younv-crm-fire`**, preservando as otimizações de performance que já estão
em produção no fire.

Branch resultante: **`feat/port-clarion-melhorias-crm-v2`** (já criada e enviada).

---

## 1. Diagnóstico (por que não dá pra fazer `git merge`)

Os dois repositórios derivam do mesmo código-base (Younv Clinical CRM), mas têm
**históricos git NÃO relacionados** — cada um foi criado por uploads separados.
`git merge-base origin/main clarion/feature/...` retorna vazio. Logo:

- ❌ `git merge` / `git rebase` direto entre os repos não funciona.
- ✅ O porte é feito por **comparação de árvore de arquivos + merge 3-way manual**,
  usando o `younv-crm-fire@CRMv3` como **base comum** (é o estado de onde tanto o
  clarion quanto o fire/perf partiram, em termos de conteúdo).

### As duas linhas evoluíram em paralelo

| Lado | O que tem de exclusivo |
|------|------------------------|
| **clarion** `feature/melhorias-crm-v2` | Módulo **Estoque** completo, **Gestão de Carteira**, **Pós-Consulta**, **Histórico de Consumo/Visitas**, **Relatório de Recorrentes**, `src/constants/crm.js`, APIs de cleanup |
| **fire** `perf/leads-optimistic-updates` (PRODUÇÃO) | **Optimistic updates** no Leads, **redução de round-trips** no Firestore (`firestore.js`, `firebaseDataService.update/create`), logger condicional DEV-only |

> ⚠️ O clarion **NÃO contém** as otimizações de performance do fire. Portar a
> árvore do clarion "por cima" reintroduziria a lentidão da página de Leads.
> Por isso o porte preserva o lado do fire nos arquivos de performance.

---

## 2. Base escolhida

- **Base da branch nova:** `perf/leads-optimistic-updates` (produção atual, confirmada).
- **Base do merge 3-way:** `origin/CRMv3` (ancestral de conteúdo comum).

---

## 3. O que foi portado

### 3.1 Adições puras (vieram inteiras do clarion, sem conflito)
- `src/components/pages/estoque/**` — módulo Estoque (Dashboard + 16 tabs:
  Produtos, Lotes, Kits, Fornecedores, Categorias, Movimentações, Transferência,
  Alertas, Alertas por local, Mapa, Baixa manual, Entrada rápida, Estoque mínimo
  por local, Visualizar lotes, Relatório de pedido de compra, Estoques)
- `src/hooks/estoque/**` — `useEstoqueProdutos`, `useEstoqueAlertas`, `usePopularDadosIniciais`
- `src/services/estoque/**` — `estoqueDataService`, `estoqueMinimoPorLocal`, `seedData`
- `src/components/pages/GestaoCarteira.jsx`
- `src/components/pages/PosConsulta.jsx`
- `src/components/pages/HistoricoConsumoPaciente.jsx`, `HistoricoVisitas.jsx`
  (usados dentro de GestaoCarteira e Leads, não são rotas top-level)
- `src/components/pages/RelatorioRecorrentes.jsx`
- `src/constants/crm.js`
- `api/cleanup-duplicates.js`, `api/api-cleanup-contato-leads.js`
- Docs: `GUIA_INSTALACAO_ESTOQUE.md`, `MODULO_ESTOQUE_README.md`, `RESUMO_MODULO_ESTOQUE.md`

### 3.2 Arquivos compartilhados — auto-merge 3-way limpo (sem conflito)
`api/digisac-webhook.js`, `src/App.jsx`, `src/components/layout/Sidebar.jsx`,
`src/components/pages/Dashboard.jsx`, `src/components/pages/FunilKanban.jsx`,
`src/components/pages/Relatorios.jsx`, `src/services/firebase/config.js`,
`src/services/firebase/firestore.js`, `src/index.css`.

Nesses, as **rotas** (App.jsx) e o **menu** (Sidebar.jsx) dos módulos novos foram
incorporados automaticamente: `/estoque`, `/gestao-carteira`, `/pos-consulta`,
`/relatorio-recorrentes`.

### 3.3 Arquivos compartilhados — conflito resolvido a favor do FIRE (performance)
| Arquivo | Conflitos | Decisão |
|---------|-----------|---------|
| `src/components/pages/Leads.jsx` | 4 | Mantidos os **optimistic updates** + filtro com curto-circuito/debounce + side-effect extraído do `useMemo`. Features de UI do clarion no Leads ficaram nos trechos limpos (preservadas). |
| `src/services/firebaseDataService.js` | 8 | Mantida a versão do fire (`update()` sem `getDoc` prévio, `create()` sem releitura, logger condicional). Descartados os logs verbosos e o multi-round-trip do clarion. |

### 3.4 Dependências adicionadas ao `package.json`
`@radix-ui/react-popover`, `@radix-ui/react-separator`, `@radix-ui/react-tabs`,
`cmdk`, `xlsx`. (Todos os wrappers `src/components/ui/*` necessários — tabs,
popover, separator, table, command — já existiam no fire.)

---

## 4. Validação feita
- `npm install` → 659 pacotes, OK.
- `npm run build` (vite) → **2353 módulos transformados, build OK, zero erros.**

---

## 5. Como subir / testar

```bash
# já está na branch
git checkout feat/port-clarion-melhorias-crm-v2
npm install
npm run dev        # testar local
npm run build      # validar produção
```

### Checklist de QA antes do merge para produção
1. **Leads** — criar/editar/excluir/mover no Kanban e confirmar que a lista
   atualiza instantaneamente (optimistic) sem recarregar tudo. Confirmar que a
   lentidão NÃO voltou.
2. **Estoque** — abrir `/estoque`, rodar o "popular dados iniciais" (seed),
   testar produtos/lotes/movimentações/transferências/alertas.
3. **Gestão de Carteira** `/gestao-carteira` — criar carteira, navegar para o lead,
   abrir histórico de consumo/visitas.
4. **Pós-Consulta** `/pos-consulta` e **Recorrentes** `/relatorio-recorrentes`.
5. **digisac-webhook** — confirmar que o webhook de produção continua funcionando
   (esse arquivo teve auto-merge; vale conferir as variáveis/lógica).

### Pontos de atenção (Firebase)
- Os módulos novos (Estoque, Carteira) usam **coleções novas no Firestore**.
  Conferir as **regras de segurança** (`firestore.rules`) e criar **índices**
  compostos se o console do Firebase pedir na primeira consulta.
- Variáveis de ambiente (`.env`) precisam estar configuradas no Vercel para o
  build de produção (config do Firebase).

---

## 6. Como reproduzir o porte (se precisar refazer)

```bash
cd younv-crm-fire
git remote add clarion https://github.com/luizebvalente/younv-clarion.git
git fetch clarion
git fetch origin main:refs/remotes/origin/main CRMv3:refs/remotes/origin/CRMv3

git checkout -b feat/port-clarion-melhorias-crm-v2 perf/leads-optimistic-updates

# adições puras
git checkout clarion/feature/melhorias-crm-v2 -- \
  src/components/pages/estoque src/hooks/estoque src/services/estoque \
  src/components/pages/GestaoCarteira.jsx src/components/pages/PosConsulta.jsx \
  src/components/pages/HistoricoConsumoPaciente.jsx src/components/pages/HistoricoVisitas.jsx \
  src/components/pages/RelatorioRecorrentes.jsx src/constants/crm.js \
  api/cleanup-duplicates.js api/api-cleanup-contato-leads.js

# arquivos compartilhados: merge 3-way (ours=perf, base=CRMv3, theirs=clarion)
#   git merge-file --diff3 <ours> <base> <theirs>
# resolver Leads.jsx e firebaseDataService.js a favor de ORURS (perf).
```
