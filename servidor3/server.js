const express = require("express");

const app = express();
const PORTA = 3002;

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

// Agrega repetições e valida o lote inteiro antes de qualquer alteração.
function validarItens(corpo) {
    if (!corpo || !Array.isArray(corpo.Itens) || corpo.Itens.length === 0) {
        throw new Error("Lista de produtos inválida.");
    }
    const quantidades = new Map();
    for (const item of corpo.Itens) {
        if (!item || typeof item !== "object" || Array.isArray(item) ||
            !Number.isSafeInteger(item.CodigoProduto) || item.CodigoProduto <= 0 ||
            !Number.isSafeInteger(item.Qtd) || item.Qtd <= 0) {
            throw new Error("Código do produto ou quantidade inválida.");
        }
        const produto = estoque.find(p => p.CodigoProduto === item.CodigoProduto);
        if (!produto) throw new Error(`Produto ${item.CodigoProduto} não encontrado.`);
        const quantidade = (quantidades.get(produto) || 0) + item.Qtd;
        if (!Number.isSafeInteger(quantidade)) throw new Error("Quantidade excede o limite numérico.");
        quantidades.set(produto, quantidade);
    }
    return quantidades;
}

app.post("/baixa", (req, res) => {
    try {
        const quantidades = validarItens(req.body);
        for (const [produto, quantidade] of quantidades) {
            if (produto.Estoque < quantidade) {
                return res.status(400).json({ erro: `Estoque insuficiente para ${produto.NomeProduto}.` });
            }
        }
        // Não há await entre a validação e a baixa: o lote é síncrono e atômico.
        for (const [produto, quantidade] of quantidades) produto.Estoque -= quantidade;
        res.json({ mensagem: "Baixa realizada com sucesso." });
    } catch (erro) {
        res.status(400).json({ erro: erro.message });
    }
});

app.post("/reposicao", (req, res) => {
    try {
        const quantidades = validarItens(req.body);
        for (const [produto, quantidade] of quantidades) {
            if (!Number.isSafeInteger(produto.Estoque + quantidade)) {
                return res.status(400).json({ erro: `Estoque de ${produto.NomeProduto} excede o limite numérico.` });
            }
        }
        for (const [produto, quantidade] of quantidades) produto.Estoque += quantidade;
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
