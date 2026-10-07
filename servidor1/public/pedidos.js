const listaPedidos = document.getElementById("pedidos");
const atualizar = document.getElementById("atualizar");
const aviso = document.getElementById("aviso");
const resultado = document.getElementById("resultado");

async function carregarPedidos() {
    atualizar.disabled = true;
    mostrarAviso(aviso, "Carregando os pedidos…");
    try {
        const pedidos = await consultarAPI("/pedidos");
        listaPedidos.replaceChildren();
        for (const pedido of pedidos) {
            const card = document.createElement("article"); card.className = "pedido";
            const numero = document.createElement("span"); numero.className = "codigo"; numero.textContent = `PEDIDO #${pedido.NumeroPedido}`;
            const nome = document.createElement("h2"); nome.textContent = pedido.NomeCliente;
            const itens = document.createElement("ul");
            for (const item of pedido.Itens) {
                const li = document.createElement("li"); li.textContent = `${item.Qtd} × ${item.NomeProduto} · ${moeda(item.Preco)} por unidade`; itens.append(li);
            }
            const total = document.createElement("p"); total.className = "preco"; total.textContent = `Total: ${moeda(pedido.Total)}`;
            const fechar = document.createElement("button"); fechar.type = "button"; fechar.textContent = "Fechar pedido";
            fechar.addEventListener("click", async () => {
                fechar.disabled = true;
                try {
                    await consultarAPI(`/pedidos/${pedido.NumeroPedido}/fechar`, { method: "POST" });
                    mostrarAviso(resultado, `Pedido #${pedido.NumeroPedido} fechado com sucesso.`);
                    await carregarPedidos();
                } catch (erro) { mostrarAviso(resultado, erro.message, true); fechar.disabled = false; }
            });
            card.append(numero, nome, itens, total, fechar); listaPedidos.append(card);
        }
        mostrarAviso(aviso, pedidos.length ? "" : "Nenhum pedido em aberto. Faça um pedido no cardápio para começar.");
    } catch (erro) {
        listaPedidos.replaceChildren();
        mostrarAviso(aviso, `${erro.message} Use “Atualizar pedidos” para tentar novamente.`, true);
    } finally { atualizar.disabled = false; }
}

atualizar.addEventListener("click", carregarPedidos);
carregarPedidos();
