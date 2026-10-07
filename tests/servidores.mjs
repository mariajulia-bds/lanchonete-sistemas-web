import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const processos = new Map();
export const urls = { 1: 'http://localhost:3000', 2: 'http://localhost:3001', 3: 'http://localhost:3002' };

export async function iniciar(numero) {
    const porta = 2999 + numero;
    // Não encerra nem reutiliza servidores de outra sessão.
    await new Promise((resolve, reject) => {
        const teste = net.createServer();
        teste.once('error', erro => reject(new Error(erro.code === 'EADDRINUSE'
            ? `Porta ${porta} ocupada. Pare sua instância antes dos testes.`
            : `Não foi possível abrir a porta ${porta}: ${erro.code}. ${erro.message}`)));
        teste.listen(porta, () => teste.close(resolve));
    });
    const pasta = path.join(raiz, `servidor${numero}`);
    const processo = spawn(process.execPath, ['server.js'], { cwd: pasta, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    processos.set(numero, processo);
    let saida = '';
    processo.stdout.on('data', dados => { saida += dados.toString(); });
    processo.stderr.on('data', dados => { saida += dados.toString(); });
    for (let tentativa = 0; tentativa < 100; tentativa++) {
        if (processo.exitCode !== null || processo.signalCode !== null) throw new Error(saida || `Servidor ${numero} encerrou.`);
        if (saida.includes(`porta ${porta}`)) return processo.pid;
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`Servidor ${numero} não iniciou. ${saida}`);
}

export async function parar(numero) {
    const processo = processos.get(numero);
    if (!processo) return;
    processos.delete(numero);
    if (processo.exitCode === null && processo.signalCode === null) {
        const terminou = once(processo, 'exit');
        processo.kill();
        await terminou;
    }
}

export async function encerrar() {
    await Promise.all(Array.from(processos.keys(), parar));
}

export async function requisicao(numero, rota, corpo, opcoes = {}) {
    const resposta = await fetch(urls[numero] + rota, {
        method: corpo === undefined ? 'GET' : 'POST',
        headers: corpo === undefined ? {} : { 'Content-Type': 'application/json' },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        signal: AbortSignal.timeout(8000),
        ...opcoes
    });
    return { status: resposta.status, headers: resposta.headers, dados: await resposta.json() };
}
