# Lanchonete

Projeto desenvolvido para a disciplina de Sistemas Web, utilizando Node.js, Express, HTML, CSS e JavaScript.

O sistema permite visualizar o cardápio, realizar pedidos e consultar os pedidos em aberto.

## Servidores

O projeto possui três servidores:

- **Servidor 1 (porta 3000):** mostra as páginas do cardápio e dos pedidos.
- **Servidor 2 (porta 3001):** recebe os pedidos, calcula os valores e controla os pedidos.
- **Servidor 3 (porta 3002):** controla a quantidade dos produtos em estoque.

Os servidores se comunicam usando requisições HTTP.

## Como executar

Primeiro, instale as dependências na pasta principal do projeto:

```powershell
npm --prefix servidor1 ci
npm --prefix servidor2 ci
npm --prefix servidor3 ci
```

Depois, abra três terminais na pasta principal do projeto. Se os servidores já estiverem rodando, pare-os com Ctrl+C antes de executar os comandos.

No primeiro terminal, inicie o Servidor 1:

```powershell
npm --prefix servidor1 start
```

No segundo terminal, configure a chave e inicie o Servidor 2:

```powershell
$env:CHAVE_ESTOQUE = "lanchoneteSistemasWeb2026"
npm --prefix servidor2 start
```

No terceiro terminal, configure a mesma chave e inicie o Servidor 3:

```powershell
$env:CHAVE_ESTOQUE = "lanchoneteSistemasWeb2026"
npm --prefix servidor3 start
```

A chave usada para executar este trabalho é `lanchoneteSistemasWeb2026`. A variável vale para o terminal em que foi definida. Ao abrir novos terminais, execute novamente os comandos acima.

Os Servidores 2 e 3 não iniciam se a variável estiver ausente ou vazia. O Servidor 1 não precisa da chave.

O Servidor 2 envia a chave ao Servidor 3 no cabeçalho `X-Chave-Estoque`. Ela não é enviada para as páginas nem para o navegador. O Servidor 3 recusa requisições sem a chave correta com HTTP `403` e a mensagem `Acesso negado.`, inclusive ao abrir `http://localhost:3002/estoque` no navegador.

Essa autorização permite acesso a quem conhece a chave. Ela não identifica se a requisição veio de um navegador ou de outro programa.

Acesse no navegador:

http://localhost:3000

## Funcionalidades

- Visualizar os produtos, preços e quantidades disponíveis.
- Escolher os produtos e realizar pedidos.
- Calcular automaticamente o valor total.
- Atualizar o estoque após cada pedido.
- Visualizar e fechar pedidos atendidos.

## Rotas principais

| Servidor | Rota | Função |
|---|---|---|
| 2 | GET /produtos | Listar produtos |
| 2 | POST /pedidos | Criar pedido |
| 2 | GET /pedidos | Listar pedidos |
| 2 | POST /pedidos/:id/fechar | Fechar pedido |
| 3 | GET /estoque | Consultar estoque |
| 3 | POST /baixa | Diminuir estoque |
| 3 | POST /reposicao | Repor estoque |

## Armazenamento

O projeto não utiliza banco de dados. Os pedidos e as quantidades em estoque ficam armazenados em arrays na memória dos servidores.

Ao reiniciar os servidores, os dados voltam aos valores iniciais.

## Testes

Para executar os testes, deixe as portas 3000, 3001 e 3002 livres e use:

```powershell
node --test
```

Os testes geram sua própria chave temporária e a configuram nos servidores que iniciam. Você não precisa informar a chave para executar os testes. Eles verificam o bloqueio de acesso sem autorização, o funcionamento dos pedidos e do estoque e a independência dos três servidores.
