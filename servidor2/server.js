const express = require("express");
const cors = require("cors");

const app = express();
const PORTA = 3001;
const URL_ESTOQUE = "http://localhost:3002";

app.use(cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST"]
}));
app.use(express.json({ limit: "20kb" }));

// Produtos mantidos pelo Servidor 2.
// O estoque NÃO fica aqui.
const produtos = [
    { CodigoProduto: 1, NomeProduto: "X-Burguer", Preco: 20.00 },
    { CodigoProduto: 2, NomeProduto: "X-Salada", Preco: 22.00 },
    { CodigoProduto: 3, NomeProduto: "Batata Frita", Preco: 12.00 },
    { CodigoProduto: 4, NomeProduto: "Refrigerante", Preco: 6.00 }
];

// Pedidos ficam em memória.
let pedidos = [];
let proximoNumeroPedido = 1;


// ========================================
// GET /produtos
// ========================================

app.get("/produtos", async (req, res) => {
    try {
        const resposta = await fetch(`${URL_ESTOQUE}/estoque`, {
            signal: AbortSignal.timeout(5000)
        });

        if (!resposta.ok) {
            throw new Error("Erro ao consultar o servidor de estoque.");
        }

        const dadosEstoque = await resposta.json();
        if (!Array.isArray(dadosEstoque)) {
            throw new Error("Resposta inválida do servidor de estoque.");
        }

        const catalogo = produtos.map(produto => {
            const estoqueProduto = dadosEstoque.find(
                item => item.CodigoProduto === produto.CodigoProduto
            );

            return {
                CodigoProduto: produto.CodigoProduto,
                NomeProduto: produto.NomeProduto,
                Preco: produto.Preco,
                Estoque: estoqueProduto ? estoqueProduto.Estoque : 0
            };
        });

        res.json(catalogo);

    } catch (erro) {
        res.status(503).json({
            erro: "Não foi possível consultar o estoque.",
            detalhe: erro.message
        });
    }
});


// ========================================
// POST /pedidos
// ========================================

app.post("/pedidos", async (req, res) => {
    try {
        if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
            return res.status(400).json({ erro: "Informe o cliente e os itens do pedido." });
        }
        // O cliente não pode enviar preços ou um total para o pedido.
        if (Object.keys(req.body).some(campo => !["NomeCliente", "Itens"].includes(campo))) {
            return res.status(400).json({ erro: "Envie somente NomeCliente e Itens. O total é calculado pela API." });
        }
        const { NomeCliente, Itens } = req.body;

        // Validação do nome
        if (
            typeof NomeCliente !== "string" ||
            NomeCliente.trim() === "" || NomeCliente.trim().length > 100
        ) {
            return res.status(400).json({
                erro: "Nome do cliente é obrigatório."
            });
        }

        // Validação da lista de itens
        if (!Array.isArray(Itens) || Itens.length === 0) {
            return res.status(400).json({
                erro: "O pedido deve possuir pelo menos um produto."
            });
        }

        let totalCentavos = 0;
        const itensPedido = [];
        const quantidades = new Map();

        // Valida os produtos e calcula o total
        for (const item of Itens) {

            if (
                !item || typeof item !== "object" || Array.isArray(item) ||
                Object.keys(item).some(campo => !["CodigoProduto", "Qtd"].includes(campo)) ||
                !Number.isSafeInteger(item.CodigoProduto) || item.CodigoProduto <= 0 ||
                !Number.isSafeInteger(item.Qtd) ||
                item.Qtd <= 0
            ) {
                return res.status(400).json({
                    erro: "Código do produto ou quantidade inválida."
                });
            }

            const produto = produtos.find(
                p => p.CodigoProduto === item.CodigoProduto
            );

            if (!produto) {
                return res.status(400).json({
                    erro: `Produto ${item.CodigoProduto} não encontrado.`
                });
            }

            const quantidade = (quantidades.get(item.CodigoProduto) || 0) + item.Qtd;
            if (!Number.isSafeInteger(quantidade)) {
                return res.status(400).json({ erro: "Quantidade excede o limite numérico." });
            }
            quantidades.set(item.CodigoProduto, quantidade);
        }

        for (const [codigo, quantidade] of quantidades) {
            const produto = produtos.find(p => p.CodigoProduto === codigo);
            totalCentavos += Math.round(produto.Preco * 100) * quantidade;
            if (!Number.isSafeInteger(totalCentavos)) {
                return res.status(400).json({ erro: "Valor do pedido excede o limite numérico." });
            }
            itensPedido.push({
                CodigoProduto: produto.CodigoProduto,
                NomeProduto: produto.NomeProduto,
                Preco: produto.Preco,
                Qtd: quantidade
            });
        }

        // Solicita a baixa ao Servidor 3
        const respostaEstoque = await fetch(
            `${URL_ESTOQUE}/baixa`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    Itens: itensPedido.map(item => ({ CodigoProduto: item.CodigoProduto, Qtd: item.Qtd }))
                }),
                signal: AbortSignal.timeout(5000)
            }
        );

        const resultadoEstoque = await respostaEstoque.json();

        // Se o Servidor 3 rejeitar a baixa
        if (!respostaEstoque.ok) {
            return res.status(respostaEstoque.status).json({
                erro: resultadoEstoque.erro || "Erro ao realizar baixa no estoque."
            });
        }

        // Cria o pedido somente depois da baixa funcionar
        const novoPedido = {
            NumeroPedido: proximoNumeroPedido,
            NomeCliente: NomeCliente.trim(),
            Total: totalCentavos / 100,
            Itens: itensPedido
        };

        pedidos.push(novoPedido);

        proximoNumeroPedido++;

        res.status(201).json({
            mensagem: "Pedido realizado com sucesso.",
            pedido: novoPedido
        });

    } catch (erro) {
        res.status(503).json({
            erro: "Não foi possível realizar o pedido.",
            detalhe: erro.message
        });
    }
});


// ========================================
// GET /pedidos
// ========================================

app.get("/pedidos", (req, res) => {
    res.json(pedidos);
});


// ========================================
// POST /pedidos/:id/fechar
// ========================================

app.post("/pedidos/:id/fechar", (req, res) => {

    const numeroPedido = Number(req.params.id);

    if (!/^[1-9][0-9]*$/.test(req.params.id) || !Number.isSafeInteger(numeroPedido)) {
        return res.status(400).json({
            erro: "Número do pedido inválido."
        });
    }

    const indicePedido = pedidos.findIndex(
        pedido => pedido.NumeroPedido === numeroPedido
    );

    if (indicePedido === -1) {
        return res.status(404).json({
            erro: "Pedido não encontrado."
        });
    }

    const pedidoFechado = pedidos[indicePedido];

    pedidos.splice(indicePedido, 1);

    res.json({
        mensagem: "Pedido fechado com sucesso.",
        pedido: pedidoFechado
    });
});


// ========================================
// INICIAR SERVIDOR
// ========================================

// Respostas JSON também para JSON malformado ou corpo acima do limite.
app.use((erro, req, res, next) => {
    if (erro.type === "entity.parse.failed" || erro.type === "entity.too.large") {
        return res.status(erro.status).json({ erro: "Corpo JSON inválido ou muito grande." });
    }
    console.error(erro);
    res.status(500).json({ erro: "Erro interno da API de negócio." });
});

app.listen(PORTA, () => {
    console.log(`Servidor de pedidos rodando na porta ${PORTA}`);
});
