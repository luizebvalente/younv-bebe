# Guia de Instalação e Configuração - Módulo de Estoque

## 🚀 Instalação

O módulo de estoque já está integrado ao sistema. Para começar a usar:

### 1. Atualizar o Branch

```bash
# Se você está no branch CRMv3, faça merge do novo módulo:
git checkout CRMv3
git merge feature/modulo-estoque

# Ou trabalhe diretamente no novo branch:
git checkout feature/modulo-estoque
```

### 2. Instalar Dependências (se necessário)

```bash
npm install
# ou
pnpm install
```

### 3. Executar o Sistema

```bash
npm run dev
# ou
pnpm dev
```

O sistema estará disponível em `http://localhost:5173`

## 📋 Configuração Inicial

### Passo 1: Popular Dados Iniciais

Para facilitar o uso, execute o script de dados iniciais que cria categorias, fornecedores e localizações padrão.

Você pode fazer isso de duas formas:

#### Opção A: Via Console do Navegador (Recomendado)

1. Acesse o sistema e faça login
2. Abra o Console do Navegador (F12)
3. Cole e execute o seguinte código:

```javascript
import estoqueDataService from './src/services/estoque/estoqueDataService.js'
import { popularDadosIniciais } from './src/services/estoque/seedData.js'

popularDadosIniciais(estoqueDataService)
  .then(() => console.log('Dados iniciais criados com sucesso!'))
  .catch(err => console.error('Erro:', err))
```

#### Opção B: Criar Manualmente

Acesse cada aba e crie os dados conforme sua necessidade:

1. **Categorias** - Acesse a aba Produtos e crie as categorias que você usa
2. **Fornecedores** - Cadastre seus fornecedores
3. **Localizações** - Acesse a aba Localizações e crie seus estoques

### Passo 2: Configurar Permissões no Firestore

Certifique-se de que as regras do Firestore permitem acesso às novas collections:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Regras existentes...
    
    // Regras para o módulo de estoque
    match /produtos/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /lotes/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /estoques/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /movimentacoes_estoque/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /kits/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /kits_itens/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /fornecedores/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /categorias_produtos/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /alertas_estoque/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 🎯 Primeiros Passos

### 1. Cadastrar Primeiro Produto

1. Faça login no sistema
2. Clique em **Estoque** no menu lateral
3. Acesse a aba **Produtos**
4. Clique em **Novo Produto**
5. Preencha:
   - Nome comercial: "Vitamina C 1000mg"
   - Nome técnico: "Ácido Ascórbico"
   - Categoria: "Vitaminas"
   - Unidade de medida: "Ampola"
   - Volume por unidade: "10"
   - Estoque mínimo: "10"
   - Valor unitário: "15.00"
6. Clique em **Salvar**

### 2. Registrar Primeiro Lote

1. Acesse a aba **Lotes**
2. Clique em **Novo Lote**
3. Selecione o produto que você acabou de criar
4. Preencha:
   - Número do lote: "LOT123456"
   - Quantidade inicial: "50"
   - Data de validade: (escolha uma data futura)
5. Clique em **Salvar**

### 3. Criar Primeiro Kit

1. Acesse a aba **Kits**
2. Clique em **Novo Kit**
3. Preencha:
   - Nome: "Protocolo Vitamina C"
   - Categoria: "Protocolo de Soroterapia"
   - Descrição: "Protocolo completo de vitamina C"
4. Clique em **Salvar**
5. Clique no ícone de lista (📋) ao lado do kit
6. Adicione produtos ao kit com suas quantidades
7. Feche o diálogo

### 4. Gerar Alertas

1. Acesse a aba **Alertas**
2. Clique em **Gerar Alertas**
3. O sistema verificará automaticamente:
   - Produtos com estoque mínimo
   - Lotes próximos ao vencimento
   - Produtos zerados

## 🔧 Configurações Avançadas

### Ajustar Frequência de Alertas

Os alertas são atualizados automaticamente a cada 5 minutos. Para alterar:

Edite o arquivo `src/hooks/estoque/useEstoqueAlertas.js`:

```javascript
// Linha ~28
const interval = setInterval(loadAlertas, 5 * 60 * 1000) // 5 minutos

// Altere para o intervalo desejado (em milissegundos)
// Exemplo: 10 minutos = 10 * 60 * 1000
```

### Personalizar Categorias

Edite o arquivo `src/services/estoque/seedData.js` para adicionar suas próprias categorias:

```javascript
export const categoriasIniciais = [
  { nome: 'Sua Categoria', descricao: 'Descrição da categoria' },
  // ... outras categorias
]
```

### Adicionar Novos Tipos de Estoque

Edite o arquivo `src/components/pages/estoque/tabs/EstoquesTab.jsx`:

```javascript
const tiposEstoque = [
  'Almoxarifado Central',
  'Seu Novo Tipo de Estoque',
  // ... outros tipos
]
```

## 📱 Uso no Mobile

O módulo é totalmente responsivo e pode ser usado em dispositivos móveis:

- Interface adaptada para telas pequenas
- Tabelas com scroll horizontal
- Botões e formulários otimizados para touch
- Menu colapsável para economizar espaço

## 🔒 Segurança

- Todas as operações requerem autenticação
- Dados armazenados no Firestore com criptografia
- Rastreamento de todas as ações (quem fez, quando)
- Backup automático pelo Firebase

## 🐛 Solução de Problemas Comuns

### Erro: "Cannot read properties of undefined"

**Causa:** Dados iniciais não foram criados ou Firestore não está configurado.

**Solução:**
1. Execute o script de dados iniciais
2. Verifique as regras do Firestore
3. Confirme que o Firebase está configurado corretamente

### Alertas não aparecem

**Causa:** Alertas ainda não foram gerados.

**Solução:**
1. Acesse a aba Alertas
2. Clique em "Gerar Alertas"
3. Cadastre produtos com estoque mínimo
4. Cadastre lotes com datas de validade

### Kit não pode ser baixado

**Causa:** Estoque insuficiente de algum produto do kit.

**Solução:**
1. Verifique os itens do kit (clique no ícone de lista)
2. Confira o estoque de cada produto
3. Registre novos lotes se necessário

### Produtos não aparecem na lista

**Causa:** Nenhum produto foi cadastrado ainda.

**Solução:**
1. Acesse a aba Produtos
2. Clique em "Novo Produto"
3. Cadastre seus produtos

## 📞 Suporte

Para dúvidas ou problemas:

1. Consulte o arquivo `MODULO_ESTOQUE_README.md` para documentação completa
2. Verifique os logs do console do navegador (F12)
3. Entre em contato com a equipe de desenvolvimento

## 🎉 Pronto!

Seu módulo de estoque está configurado e pronto para uso. Comece cadastrando seus produtos e aproveite todas as funcionalidades!

---

**Última atualização:** Novembro 2025  
**Versão do Módulo:** 1.0.0
