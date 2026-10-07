# Lanchonete

Trabalho acadêmico com três servidores Node.js/Express independentes. Dados mantidos apenas em memória; interface em HTML, CSS e JavaScript puro.

## Estrutura e fluxo

| Servidor | Porta | Responsabilidade |
| --- | --- | --- |
| `servidor1` | 3000 | Entrega somente páginas e arquivos estáticos |
| `servidor2` | 3001 | Produtos, preços, cálculo do total e pedidos |
| `servidor3` | 3002 | Estoque, baixas e reposições |

O navegador recebe as páginas do Servidor 1. O JavaScript dessas páginas faz `fetch` **somente para o Servidor 2**, que consulta o Servidor 3. O Servidor 1 não é um proxy nem contém regras de negócio. A política de segurança das páginas permite conexões de dados apenas à porta 3001.

```text
Navegador ← HTML/CSS/JS ← Servidor 1 (3000)
Navegador → fetch → Servidor 2 (3001) → fetch → Servidor 3 (3002)
```

## Executar

Requer Node.js 22 ou superior e npm. `fetch` e `AbortSignal.timeout` são recursos nativos do Node.js; não requerem dependências adicionais.

Instale as dependências de cada servidor na pasta raiz:

```powershell
npm --prefix servidor1 ci
npm --prefix servidor2 ci
npm --prefix servidor3 ci
```

Abra **três terminais separados**, cada um na pasta raiz do projeto:

```powershell
# Terminal 1: páginas
npm --prefix servidor1 start
```

```powershell
# Terminal 2: negócio
npm --prefix servidor2 start
```

```powershell
# Terminal 3: estoque
npm --prefix servidor3 start
```

Acesse [o cardápio](http://localhost:3000) ou [os pedidos](http://localhost:3000/pedidos.html). Para parar um servidor, use Ctrl+C somente no terminal correspondente. Os demais processos continuam funcionando. Os preços e o catálogo ficam no Servidor 2; as quantidades iniciais ficam no Servidor 3.

## Contratos HTTP

### Servidor 2 — negócio

| Método e rota | Comportamento |
| --- | --- |
| `GET /produtos` | Combina produtos e preços locais com o estoque consultado no Servidor 3 |
| `POST /pedidos` | Valida, calcula o total, solicita a baixa e cria o pedido apenas após aprovação |
| `GET /pedidos` | Lista os pedidos em aberto |
| `POST /pedidos/:id/fechar` | Remove o pedido atendido da lista; não repõe estoque |

Exemplo do corpo de `POST /pedidos`:

```json
{
  "NomeCliente": "Maria",
  "Itens": [
    { "CodigoProduto": 1, "Qtd": 2 },
    { "CodigoProduto": 3, "Qtd": 1 }
  ]
}
```

O navegador não envia preço nem total. Esses campos são rejeitados se enviados. O total é calculado no Servidor 2, utilizando centavos inteiros. No exemplo, o resultado é R$ 52,00. A resposta de sucesso é HTTP 201 e contém `mensagem` e `pedido` com número, cliente, itens e total.

### Servidor 3 — estoque

| Método e rota | Comportamento |
| --- | --- |
| `GET /estoque` | Lista as quantidades disponíveis |
| `POST /baixa` | Desconta um lote inteiro, somente se todos os itens forem válidos e suficientes |
| `POST /reposicao` | Acrescenta um lote de quantidades válidas |

Corpo de baixa e reposição:

```json
{
  "Itens": [
    { "CodigoProduto": 1, "Qtd": 3 }
  ]
}
```

Essas rotas são utilizadas entre servidores ou por ferramentas de teste, **nunca diretamente pelo JavaScript das páginas**. Por exemplo, a reposição pode ser demonstrada no PowerShell:

```powershell
Invoke-RestMethod -Uri http://localhost:3002/reposicao -Method Post -ContentType 'application/json' -Body '{"Itens":[{"CodigoProduto":1,"Qtd":3}]}'
```

Depois use “Atualizar cardápio” para ver o novo estoque por meio do Servidor 2.

## Atomicidade e validações

Os códigos e as quantidades devem ser inteiros seguros; quantidades precisam ser positivas. Itens repetidos são somados por produto antes da validação. Se um deles falhar, nenhum estoque é alterado. A validação e a mutação acontecem de forma síncrona no processo do Servidor 3, sem `await` entre as etapas, evitando que duas requisições intercalem esse trecho.

A reposição também valida o lote inteiro antes de modificar quantidades. Entradas inválidas e estoque insuficiente retornam HTTP 400. Pedido não encontrado retorna 404. Se o estoque estiver fora do ar ou não responder em até cinco segundos, o Servidor 2 retorna 503 nas operações que dependem dele; a listagem e o fechamento dos pedidos continuam disponíveis.

## Testes

Com as portas 3000, 3001 e 3002 livres:

```powershell
node --test tests/integracao.test.mjs
```

O teste inicia três processos próprios e os encerra ao terminar. Verifica rotas, catálogo combinado, total calculado no servidor, dados inválidos, duplicatas, ausência de alterações parciais, concorrência, fechamento e independência dos processos. Ele não encerra processos já existentes: se uma porta estiver ocupada, solicita que a instância seja parada antes do teste.

## Limites do trabalho

Não há banco de dados. Reiniciar o Servidor 2 apaga seus pedidos e reinicia a numeração. Reiniciar o Servidor 3 restaura seu estoque inicial. Não há uma transação distribuída durável entre os dois processos: uma interrupção após a baixa e antes da gravação do pedido pode consumir estoque sem registrar o pedido. Não há repetição automática de `POST /pedidos` em falhas de rede.

As dependências Express e, apenas no Servidor 2, CORS estão declaradas nos `package.json` de cada servidor, acompanhados dos respectivos arquivos de lock. O front-end não usa frameworks ou bibliotecas.
