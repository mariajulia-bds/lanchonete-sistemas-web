const listaProdutos = document.getElementById("produtos");
const formularioPedido = document.getElementById("formulario-pedido");
const botaoAtualizar = document.getElementById("atualizar-cardapio");
const botaoEnviar = document.getElementById("enviar-pedido");
const avisoCatalogo = document.getElementById("aviso-catalogo");
const mensagemResultado = document.getElementById("mensagem-resultado");

function criarLinhaProduto(produto) {
    const linhaProduto = document.createElement("tr");
    const codigoProduto = document.createElement("td");
    codigoProduto.textContent = produto.CodigoProduto;
    const nomeProduto = document.createElement("td");
    nomeProduto.textContent = produto.NomeProduto;
    const precoProduto = document.createElement("td");
    precoProduto.textContent = formatarMoeda(produto.Preco);
    const estoqueProduto = document.createElement("td");
    estoqueProduto.textContent = produto.Estoque;
    const quantidadeProduto = document.createElement("td");
    const campoQuantidade = document.createElement("input");
    campoQuantidade.id = `quantidade-${produto.CodigoProduto}`;
    campoQuantidade.type = "number";
    campoQuantidade.min = "0";
    campoQuantidade.max = String(produto.Estoque);
    campoQuantidade.step = "1";
    campoQuantidade.value = "0";
    campoQuantidade.dataset.codigo = String(produto.CodigoProduto);
    campoQuantidade.disabled = produto.Estoque === 0;
    campoQuantidade.setAttribute("aria-label", `Quantidade de ${produto.NomeProduto}`);
    quantidadeProduto.append(campoQuantidade);
    linhaProduto.append(codigoProduto, nomeProduto, precoProduto, estoqueProduto, quantidadeProduto);
    return linhaProduto;
}

async function carregarProdutos() {
    botaoAtualizar.disabled = true;
    botaoEnviar.disabled = true;
    mostrarAviso(avisoCatalogo, "Carregando o cardápio…");
    try {
        const produtos = await consultarAPI("/produtos");
        listaProdutos.replaceChildren();
        for (const produto of produtos) {
            const linhaProduto = criarLinhaProduto(produto);
            listaProdutos.append(linhaProduto);
        }
        botaoEnviar.disabled = produtos.every(produto => produto.Estoque === 0);
        mostrarAviso(avisoCatalogo, produtos.length ? "" : "Não há produtos cadastrados.");
    } catch (erro) {
        listaProdutos.replaceChildren();
        mostrarAviso(avisoCatalogo, `${erro.message} Use “Atualizar cardápio” para tentar novamente.`, true);
    } finally {
        botaoAtualizar.disabled = false;
    }
}

async function enviarPedido(evento) {
    evento.preventDefault();
    if (botaoEnviar.disabled) {
        return;
    }

    const itensPedido = [];
    const camposQuantidade = listaProdutos.querySelectorAll("input[data-codigo]");
    for (const campoQuantidade of camposQuantidade) {
        const quantidade = Number(campoQuantidade.value);
        if (quantidade > 0) {
            itensPedido.push({
                CodigoProduto: Number(campoQuantidade.dataset.codigo),
                Qtd: quantidade
            });
        }
    }
    botaoEnviar.disabled = true;
    botaoAtualizar.disabled = true;
    mostrarAviso(mensagemResultado, "Enviando pedido…");
    try {
        const dados = await consultarAPI("/pedidos", {
            method: "POST",
            body: JSON.stringify({ NomeCliente: document.getElementById("nome-cliente").value, Itens: itensPedido })
        });
        mostrarAviso(mensagemResultado, `Pedido #${dados.pedido.NumeroPedido} confirmado para ${dados.pedido.NomeCliente}. Total: ${formatarMoeda(dados.pedido.Total)}. Acompanhe na página Pedidos.`);
        formularioPedido.reset();
        await carregarProdutos();
    } catch (erro) {
        mostrarAviso(mensagemResultado, erro.message, true);
        botaoEnviar.disabled = false;
    } finally {
        botaoAtualizar.disabled = false;
    }
}

formularioPedido.addEventListener("submit", enviarPedido);
botaoAtualizar.addEventListener("click", carregarProdutos);
carregarProdutos();
