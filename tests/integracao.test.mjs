import test from 'node:test';
import assert from 'node:assert/strict';
import { iniciar, parar, encerrar, requisicao, urls } from './servidores.mjs';

const item = (CodigoProduto, Qtd) => ({ CodigoProduto, Qtd });
const pedido = Itens => ({ NomeCliente: '  Cliente teste  ', Itens });
const estoque = async () => (await requisicao(3, '/estoque')).dados;
const pedidos = async () => (await requisicao(2, '/pedidos')).dados;

test('Lanchonete: rotas, atomicidade e três processos independentes', async t => {
    try {
        const ids = [];
        for (const numero of [1, 2, 3]) ids.push(await iniciar(numero));
        assert.equal(new Set(ids).size, 3);

        await t.test('Servidor 1 entrega páginas e assets, sem API ou acesso direto ao estoque', async () => {
            for (const rota of ['/', '/cardapio.html', '/pedidos.html', '/style.css', '/api.js', '/cardapio.js', '/pedidos.js']) {
                const resposta = await fetch(urls[1] + rota);
                assert.equal(resposta.status, 200);
                assert.ok((await resposta.text()).length > 0);
                const politica = resposta.headers.get('content-security-policy');
                assert.ok(politica.includes('connect-src http://localhost:3001 http://127.0.0.1:3001;'));
                assert.ok(!politica.includes('3002'));
            }
            assert.equal((await fetch(urls[1] + '/produtos')).status, 404);
        });

        await t.test('Catálogo combina nomes e preços do negócio com estoque real', async () => {
            const catalogo = await requisicao(2, '/produtos');
            assert.equal(catalogo.status, 200);
            assert.equal(catalogo.dados.length, 4);
            assert.equal(catalogo.dados[0].NomeProduto, 'X-Burguer');
            assert.equal(catalogo.dados[0].Preco, 20);
            assert.equal(catalogo.dados[0].Estoque, 10);
            assert.equal((await requisicao(3, '/reposicao', { Itens: [item(1, 2)] })).status, 200);
            assert.equal((await requisicao(2, '/produtos')).dados[0].Estoque, 12);
        });

        await t.test('CORS do negócio aceita o front-end e estoque não oferece CORS', async () => {
            const autorizado = await requisicao(2, '/produtos', undefined, { headers: { Origin: urls[1] } });
            assert.equal(autorizado.headers.get('access-control-allow-origin'), urls[1]);
            const externo = await requisicao(2, '/pedidos', undefined, { headers: { Origin: 'http://localhost:9999' } });
            assert.equal(externo.headers.get('access-control-allow-origin'), null);
            assert.equal((await requisicao(3, '/estoque', undefined, { headers: { Origin: urls[1] } })).headers.get('access-control-allow-origin'), null);
        });

        await t.test('Pedido válido calcula total na API, baixa estoque e recebe número sequencial', async () => {
            const antes = await estoque();
            const resposta = await requisicao(2, '/pedidos', pedido([item(1, 2), item(3, 1)]));
            assert.equal(resposta.status, 201);
            assert.equal(resposta.dados.pedido.Total, 52);
            assert.equal(resposta.dados.pedido.NumeroPedido, 1);
            assert.equal(resposta.dados.pedido.NomeCliente, 'Cliente teste');
            const depois = await estoque();
            assert.equal(depois[0].Estoque, antes[0].Estoque - 2);
            assert.equal(depois[2].Estoque, antes[2].Estoque - 1);
            assert.equal((await pedidos()).length, 1);
        });

        await t.test('Negócio rejeita total/preço do cliente e dados inválidos sem alterar estoque', async () => {
            const antes = await estoque();
            const abertos = await pedidos();
            const invalidos = [
                {}, { NomeCliente: '', Itens: [item(1, 1)] }, { NomeCliente: 3, Itens: [item(1, 1)] },
                pedido([]), pedido([null]), pedido([item(999, 1)]), pedido([item(1, 0)]),
                pedido([item(1, -1)]), pedido([item(1, 1.5)]), pedido([item('1', 1)]),
                pedido([item(1, Number.MAX_SAFE_INTEGER + 1)]),
                { ...pedido([item(1, 1)]), Total: .01 },
                { ...pedido([item(1, 1)]), total: .01 },
                pedido([{ ...item(1, 1), Preco: .01 }])
            ];
            for (const corpo of invalidos) assert.equal((await requisicao(2, '/pedidos', corpo)).status, 400);
            assert.deepEqual(await estoque(), antes);
            assert.deepEqual(await pedidos(), abertos);
        });

        await t.test('Falha em um item rejeita todo o pedido e toda a baixa', async () => {
            const antes = await estoque();
            const abertos = await pedidos();
            const lote = [item(1, 1), item(2, 999)];
            assert.equal((await requisicao(3, '/baixa', { Itens: lote })).status, 400);
            assert.deepEqual(await estoque(), antes);
            assert.equal((await requisicao(2, '/pedidos', pedido(lote))).status, 400);
            assert.deepEqual(await estoque(), antes);
            assert.deepEqual(await pedidos(), abertos);
        });

        await t.test('Itens duplicados são somados antes da validação de estoque', async () => {
            const antes = await estoque();
            assert.equal((await requisicao(3, '/baixa', { Itens: [item(2, 5), item(2, 5)] })).status, 400);
            assert.deepEqual(await estoque(), antes);
            assert.equal((await requisicao(2, '/pedidos', pedido([item(2, 5), item(2, 5)]))).status, 400);
            assert.deepEqual(await estoque(), antes);
            const valido = await requisicao(2, '/pedidos', pedido([item(2, 1), item(2, 2)]));
            assert.equal(valido.status, 201);
            assert.equal(valido.dados.pedido.Total, 66);
            assert.equal(valido.dados.pedido.Itens.length, 1);
            assert.equal(valido.dados.pedido.Itens[0].Qtd, 3);
            assert.equal((await estoque())[1].Estoque, antes[1].Estoque - 3);
        });

        await t.test('Baixa e reposição rejeitam formatos inválidos, sem mutação parcial', async () => {
            const antes = await estoque();
            for (const rota of ['/baixa', '/reposicao']) {
                for (const corpo of [{}, { Itens: [] }, { Itens: [null] }, { Itens: [item(1, 1), item(999, 1)] },
                    { Itens: [item(1, 1), item(2, -1)] }, { Itens: [item('1', 1)] },
                    { Itens: [item(1, Number.MAX_SAFE_INTEGER), item(1, 1)] }]) {
                    assert.equal((await requisicao(3, rota, corpo)).status, 400);
                    assert.deepEqual(await estoque(), antes);
                }
            }
            assert.equal((await requisicao(3, '/reposicao', { Itens: [item(1, 1), item(2, Number.MAX_SAFE_INTEGER)] })).status, 400);
            assert.deepEqual(await estoque(), antes);
            assert.equal((await requisicao(3, '/reposicao', { Itens: [item(1, 1), item(1, 2)] })).status, 200);
            assert.equal((await estoque())[0].Estoque, antes[0].Estoque + 3);
        });

        await t.test('Baixas concorrentes não produzem estoque negativo', async () => {
            const disponivel = (await estoque())[3].Estoque;
            const respostas = await Promise.all(Array.from({ length: disponivel + 3 }, () => requisicao(3, '/baixa', { Itens: [item(4, 1)] })));
            assert.equal(respostas.filter(r => r.status === 200).length, disponivel);
            assert.equal(respostas.filter(r => r.status === 400).length, 3);
            assert.equal((await estoque())[3].Estoque, 0);
        });

        await t.test('JSON malformado retorna erro JSON, mantendo as APIs ativas', async () => {
            for (const [numero, rota] of [[2, '/pedidos'], [3, '/baixa']]) {
                const resposta = await requisicao(numero, rota, undefined, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
                assert.equal(resposta.status, 400);
                assert.ok(resposta.dados.erro);
            }
            assert.equal((await requisicao(2, '/pedidos')).status, 200);
            assert.equal((await requisicao(3, '/estoque')).status, 200);
        });

        await t.test('Fechar remove apenas o pedido e não repõe o estoque', async () => {
            const antes = await estoque();
            assert.equal((await requisicao(2, '/pedidos/1/fechar', {})).status, 200);
            assert.equal((await pedidos()).some(p => p.NumeroPedido === 1), false);
            assert.equal((await pedidos()).length, 1);
            assert.deepEqual(await estoque(), antes);
            assert.equal((await requisicao(2, '/pedidos/1/fechar', {})).status, 404);
            for (const id of ['abc', '0', '-1', '1.5', '1e0']) assert.equal((await requisicao(2, `/pedidos/${id}/fechar`, {})).status, 400);
        });

        await t.test('Parar Servidor 1 não derruba negócio nem estoque', async () => {
            await parar(1);
            assert.equal((await requisicao(2, '/pedidos')).status, 200);
            assert.equal((await requisicao(3, '/estoque')).status, 200);
            await iniciar(1);
        });

        await t.test('Parar Servidor 3 preserva páginas e pedidos, sem criar pedido rejeitado', async () => {
            const antes = await pedidos();
            await parar(3);
            assert.equal((await fetch(urls[1])).status, 200);
            assert.deepEqual(await pedidos(), antes);
            assert.equal((await requisicao(2, '/produtos')).status, 503);
            assert.equal((await requisicao(2, '/pedidos', pedido([item(1, 1)]))).status, 503);
            assert.deepEqual(await pedidos(), antes);
            await iniciar(3);
            assert.equal((await requisicao(2, '/produtos')).status, 200);
        });

        await t.test('Parar Servidor 2 preserva páginas e estoque; memória reinicia somente nele', async () => {
            const antes = await estoque();
            await parar(2);
            assert.equal((await fetch(urls[1] + '/pedidos.html')).status, 200);
            assert.deepEqual(await estoque(), antes);
            await iniciar(2);
            assert.deepEqual(await pedidos(), []);
            assert.deepEqual(await estoque(), antes);
        });
    } finally {
        await encerrar();
    }
});
