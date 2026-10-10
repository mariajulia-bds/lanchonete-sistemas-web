const express = require("express");
const path = require("path");

const app = express();
const PORTA = 3000;

app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src http://localhost:3001 http://127.0.0.1:3001; object-src 'none'; base-uri 'self'; form-action 'none'");
    next();
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "cardapio.html"));
});

app.listen(PORTA, () => {
    console.log(`Servidor de páginas rodando na porta ${PORTA}`);
});
