// Toda consulta do navegador passa somente pela API de negócio (Servidor 2).
const API_NEGOCIO = `http://${window.location.hostname}:3001`;
const moeda = valor => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

async function consultarAPI(rota, opcoes = {}) {
    let resposta;
    try {
        resposta = await fetch(`${API_NEGOCIO}${rota}`, {
            ...opcoes,
            headers: opcoes.body ? { "Content-Type": "application/json" } : {},
            signal: AbortSignal.timeout(8000)
        });
    } catch {
        throw new Error("A API de pedidos está indisponível. Verifique o servidor e tente novamente.");
    }
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro || "Não foi possível concluir a operação.");
    return dados;
}

function mostrarAviso(elemento, texto, erro = false) {
    elemento.textContent = texto;
    elemento.classList.toggle("erro", erro);
}
