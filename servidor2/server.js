const express = require("express");
const cors = require("cors");

const app = express();
const PORTA = 3001;
const URL_ESTOQUE = "http://localhost:3002";
const CHAVE_ESTOQUE = process.env.CHAVE_ESTOQUE;

if (!CHAVE_ESTOQUE || CHAVE_ESTOQUE.trim() === "") {
    throw new Error("Configure a variável de ambiente CHAVE_ESTOQUE antes de iniciar o servidor.");
}

app.use(cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    methods: ["GET", "POST"]
}));
app.use(express.json({ limit: "20kb" }));

const produtos = [
    { CodigoProduto: 1, NomeProduto: "X-Burguer", Preco: 20.00 },
    { CodigoProduto: 2, NomeProduto: "X-Salada", Preco: 22.00 },
    { CodigoProduto: 3, NomeProduto: "Batata Frita", Preco: 12.00 },
    { CodigoProduto: 4, NomeProduto: "Refrigerante", Preco: 6.00 }
];

const pedidos = [];
let proximoNumeroPedido = 1;

app.get("/produtos", async (req, res) => {
    try {
        const resposta = await fetch(`${URL_ESTOQUE}/estoque`, {
            headers: { "X-Chave-Estoque": CHAVE_ESTOQUE },
            signal: AbortSignal.timeout(5000)
        });

        if (!resposta.ok) {
            throw new Error("Erro ao consultar o servidor de estoque.");
        }

        const dadosEstoque = await resposta.json();
        if (!Array.isArray(dadosEstoque)) {
            throw new Error("Resposta inválida do servidor de estoque.");
        }

        const catalogoProdutos = produtos.map(produto => {
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

        res.json(catalogoProdutos);

    } catch (erro) {
        res.status(503).json({
            erro: "Não foi possível consultar o estoque.",
            detalhe: erro.message
        });
    }
});

app.post("/pedidos", async (req, res) => {
    try {
        if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
            return res.status(400).json({ erro: "Informe o cliente e os itens do pedido." });
        }

        if (Object.keys(req.body).some(campo => !["NomeCliente", "Itens"].includes(campo))) {
            return res.status(400).json({ erro: "Envie somente NomeCliente e Itens. O total é calculado pela API." });
        }
        const nomeCliente = req.body.NomeCliente;
        const itens = req.body.Itens;

        if (
            typeof nomeCliente !== "string" ||
            nomeCliente.trim() === "" || nomeCliente.trim().length > 100
        ) {
            return res.status(400).json({
                erro: "Nome do cliente é obrigatório."
            });
        }

        if (!Array.isArray(itens) || itens.length === 0) {
            return res.status(400).json({
                erro: "O pedido deve possuir pelo menos um produto."
            });
        }

        let totalCentavos = 0;
        const itensPedido = [];
        const quantidadesPorProduto = new Map();

        for (const item of itens) {
            if (!item || typeof item !== "object" || Array.isArray(item)) {
                return res.status(400).json({
                    erro: "Código do produto ou quantidade inválida."
                });
            }

            if (
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
                produtoCadastrado => produtoCadastrado.CodigoProduto === item.CodigoProduto
            );

            if (!produto) {
                return res.status(400).json({
                    erro: `Produto ${item.CodigoProduto} não encontrado.`
                });
            }

            const quantidade = (quantidadesPorProduto.get(item.CodigoProduto) || 0) + item.Qtd;
            if (!Number.isSafeInteger(quantidade)) {
                return res.status(400).json({ erro: "Quantidade excede o limite numérico." });
            }
            quantidadesPorProduto.set(item.CodigoProduto, quantidade);
        }

        for (const [codigoProduto, quantidade] of quantidadesPorProduto) {
            const produto = produtos.find(produtoCadastrado => produtoCadastrado.CodigoProduto === codigoProduto);
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

        const respostaEstoque = await fetch(
            `${URL_ESTOQUE}/baixa`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Chave-Estoque": CHAVE_ESTOQUE
                },
                body: JSON.stringify({
                    Itens: itensPedido.map(item => ({ CodigoProduto: item.CodigoProduto, Qtd: item.Qtd }))
                }),
                signal: AbortSignal.timeout(5000)
            }
        );

        const resultadoEstoque = await respostaEstoque.json();

        if (!respostaEstoque.ok) {
            return res.status(respostaEstoque.status).json({
                erro: resultadoEstoque.erro || "Erro ao realizar baixa no estoque."
            });
        }

        const novoPedido = {
            NumeroPedido: proximoNumeroPedido,
            NomeCliente: nomeCliente.trim(),
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

app.get("/pedidos", (req, res) => {
    res.json(pedidos);
});

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
