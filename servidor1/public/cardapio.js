
const listaProdutos = document.getElementById("produtos");
const formulario = document.getElementById("form-pedido");
const atualizar = document.getElementById("atualizar");
const enviar = document.getElementById("enviar");
const avisoCatalogo = document.getElementById("aviso-catalogo");
const resultado = document.getElementById("resultado");

async function carregarProdutos() {
    atualizar.disabled = true;
    enviar.disabled = true;
    mostrarAviso(avisoCatalogo, "Carregando o cardápio…");
    try {
        const produtos = await consultarAPI("/produtos");
        listaProdutos.replaceChildren();
        for (const produto of produtos) {
            const card = document.createElement("article");
            card.className = "produto";
            const codigo = document.createElement("span"); codigo.className = "codigo"; codigo.textContent = `PRODUTO ${produto.CodigoProduto}`;
            const nome = document.createElement("h2"); nome.textContent = produto.NomeProduto;
            const preco = document.createElement("p"); preco.className = "preco"; preco.textContent = moeda(produto.Preco);
            const estoque = document.createElement("p"); estoque.className = "estoque"; estoque.textContent = produto.Estoque > 0 ? `${produto.Estoque} disponíveis` : "Esgotado";
            const label = document.createElement("label"); label.htmlFor = `qtd-${produto.CodigoProduto}`; label.textContent = "Quantidade";
            const input = document.createElement("input");
            input.id = label.htmlFor; input.type = "number"; input.min = "0"; input.max = String(produto.Estoque); input.step = "1"; input.value = "0";
            input.dataset.codigo = String(produto.CodigoProduto); input.disabled = produto.Estoque === 0;
            card.append(codigo, nome, preco, estoque, label, input);
            listaProdutos.append(card);
        }
        enviar.disabled = produtos.every(produto => produto.Estoque === 0);
        mostrarAviso(avisoCatalogo, produtos.length ? "" : "Não há produtos cadastrados.");
    } catch (erro) {
        listaProdutos.replaceChildren();
        mostrarAviso(avisoCatalogo, `${erro.message} Use “Atualizar cardápio” para tentar novamente.`, true);
    } finally {
        atualizar.disabled = false;
    }
}

formulario.addEventListener("submit", async evento => {
    evento.preventDefault();
    if (enviar.disabled) return;
    // Apenas nome, códigos e quantidades; preço e total pertencem ao Servidor 2.
    const Itens = Array.from(listaProdutos.querySelectorAll("input[data-codigo]"))
        .filter(input => Number(input.value) > 0)
        .map(input => ({ CodigoProduto: Number(input.dataset.codigo), Qtd: Number(input.value) }));
    enviar.disabled = true; atualizar.disabled = true;
    mostrarAviso(resultado, "Enviando pedido…");
    try {
        const dados = await consultarAPI("/pedidos", {
            method: "POST",
            body: JSON.stringify({ NomeCliente: document.getElementById("cliente").value, Itens })
        });
        mostrarAviso(resultado, `Pedido #${dados.pedido.NumeroPedido} confirmado para ${dados.pedido.NomeCliente}. Total: ${moeda(dados.pedido.Total)}. Acompanhe na página Pedidos.`);
        formulario.reset();
        await carregarProdutos();
    } catch (erro) {
        mostrarAviso(resultado, erro.message, true);
        enviar.disabled = false;
    } finally {
        atualizar.disabled = false;
    }
});

atualizar.addEventListener("click", carregarProdutos);
carregarProdutos();
