const listaPedidos = document.getElementById("pedidos");
const botaoAtualizar = document.getElementById("atualizar-pedidos");
const aviso = document.getElementById("aviso-pedidos");
const mensagemResultado = document.getElementById("mensagem-resultado");

function criarLinhaPedido(pedido) {
    const linhaPedido = document.createElement("tr");
    const numeroPedido = document.createElement("td");
    numeroPedido.textContent = pedido.NumeroPedido;
    const nomeCliente = document.createElement("td");
    nomeCliente.textContent = pedido.NomeCliente;
    const itensPedido = document.createElement("td");
    const listaItens = document.createElement("ul");
    for (const item of pedido.Itens) {
        const itemLista = document.createElement("li");
        itemLista.textContent = `${item.Qtd} \u00d7 ${item.NomeProduto} \u00b7 ${formatarMoeda(item.Preco)} por unidade`;
        listaItens.append(itemLista);
    }
    itensPedido.append(listaItens);
    const totalPedido = document.createElement("td");
    totalPedido.textContent = formatarMoeda(pedido.Total);
    const acoesPedido = document.createElement("td");
    const botaoFechar = document.createElement("button");
    botaoFechar.type = "button";
    botaoFechar.textContent = "Fechar pedido";
    botaoFechar.addEventListener("click", () => fecharPedido(pedido.NumeroPedido, botaoFechar));
    acoesPedido.append(botaoFechar);
    linhaPedido.append(numeroPedido, nomeCliente, itensPedido, totalPedido, acoesPedido);
    return linhaPedido;
}

async function fecharPedido(numeroPedido, botaoFechar) {
    botaoFechar.disabled = true;
    try {
        await consultarAPI(`/pedidos/${numeroPedido}/fechar`, { method: "POST" });
        mostrarAviso(mensagemResultado, `Pedido #${numeroPedido} fechado com sucesso.`);
        await carregarPedidos();
    } catch (erro) {
        mostrarAviso(mensagemResultado, erro.message, true);
        botaoFechar.disabled = false;
    }
}

async function carregarPedidos() {
    botaoAtualizar.disabled = true;
    mostrarAviso(aviso, "Carregando os pedidos…");
    try {
        const pedidos = await consultarAPI("/pedidos");
        listaPedidos.replaceChildren();
        for (const pedido of pedidos) {
            const linhaPedido = criarLinhaPedido(pedido);
            listaPedidos.append(linhaPedido);
        }
        mostrarAviso(aviso, pedidos.length ? "" : "Nenhum pedido em aberto. Faça um pedido no cardápio para começar.");
    } catch (erro) {
        listaPedidos.replaceChildren();
        mostrarAviso(aviso, `${erro.message} Use “Atualizar pedidos” para tentar novamente.`, true);
    } finally {
        botaoAtualizar.disabled = false;
    }
}

botaoAtualizar.addEventListener("click", carregarPedidos);
carregarPedidos();
