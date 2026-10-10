const express = require("express");

const app = express();
const PORTA = 3002;
const CHAVE_ESTOQUE = process.env.CHAVE_ESTOQUE;

if (!CHAVE_ESTOQUE || CHAVE_ESTOQUE.trim() === "") {
    throw new Error("Configure a variável de ambiente CHAVE_ESTOQUE antes de iniciar o servidor.");
}

app.use((req, res, next) => {
    if (req.get("X-Chave-Estoque") !== CHAVE_ESTOQUE) {
        return res.status(403).json({ erro: "Acesso negado." });
    }
    next();
});

app.use(express.json({ limit: "20kb" }));

const estoque = [
    { CodigoProduto: 1, NomeProduto: "X-Burguer", Estoque: 10 },
    { CodigoProduto: 2, NomeProduto: "X-Salada", Estoque: 8 },
    { CodigoProduto: 3, NomeProduto: "Batata Frita", Estoque: 15 },
    { CodigoProduto: 4, NomeProduto: "Refrigerante", Estoque: 20 }
];

app.get("/estoque", (req, res) => {
    res.json(estoque);
});

function validarItensEstoque(corpo) {
    if (!corpo || !Array.isArray(corpo.Itens) || corpo.Itens.length === 0) {
        throw new Error("Lista de produtos inválida.");
    }
    const quantidadesPorProduto = new Map();
    for (const item of corpo.Itens) {
        if (!item || typeof item !== "object" || Array.isArray(item) ||
            !Number.isSafeInteger(item.CodigoProduto) || item.CodigoProduto <= 0 ||
            !Number.isSafeInteger(item.Qtd) || item.Qtd <= 0) {
            throw new Error("Código do produto ou quantidade inválida.");
        }
        const produto = estoque.find(produtoCadastrado => produtoCadastrado.CodigoProduto === item.CodigoProduto);
        if (!produto) {
            throw new Error(`Produto ${item.CodigoProduto} não encontrado.`);
        }
        const quantidade = (quantidadesPorProduto.get(produto) || 0) + item.Qtd;
        if (!Number.isSafeInteger(quantidade)) {
            throw new Error("Quantidade excede o limite numérico.");
        }
        quantidadesPorProduto.set(produto, quantidade);
    }
    return quantidadesPorProduto;
}

app.post("/baixa", (req, res) => {
    try {
        const quantidadesPorProduto = validarItensEstoque(req.body);
        for (const [produto, quantidade] of quantidadesPorProduto) {
            if (produto.Estoque < quantidade) {
                return res.status(400).json({ erro: `Estoque insuficiente para ${produto.NomeProduto}.` });
            }
        }

        for (const [produto, quantidade] of quantidadesPorProduto) {
            produto.Estoque -= quantidade;
        }
        res.json({ mensagem: "Baixa realizada com sucesso." });
    } catch (erro) {
        res.status(400).json({ erro: erro.message });
    }
});

app.post("/reposicao", (req, res) => {
    try {
        const quantidadesPorProduto = validarItensEstoque(req.body);
        for (const [produto, quantidade] of quantidadesPorProduto) {
            if (!Number.isSafeInteger(produto.Estoque + quantidade)) {
                return res.status(400).json({ erro: `Estoque de ${produto.NomeProduto} excede o limite numérico.` });
            }
        }
        for (const [produto, quantidade] of quantidadesPorProduto) {
            produto.Estoque += quantidade;
        }
        res.json({ mensagem: "Reposição realizada com sucesso." });
    } catch (erro) {
        res.status(400).json({ erro: erro.message });
    }
});

app.use((erro, req, res, next) => {
    if (erro.type === "entity.parse.failed" || erro.type === "entity.too.large") {
        return res.status(erro.status).json({ erro: "Corpo JSON inválido ou muito grande." });
    }
    console.error(erro);
    res.status(500).json({ erro: "Erro interno da API de estoque." });
});

app.listen(PORTA, () => {
    console.log(`Servidor de estoque rodando na porta ${PORTA}`);
});
