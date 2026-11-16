# PrismaGen
Propõe-se o desenvolvimento de um Sistema de Automação Geracional de Gabaritos, capaz de extrair e estruturar automaticamente questões provenientes de plataformas educacionais já utilizadas como referência pelo projeto, como o Estude Grátis.

## Como executar

Requisitos: Node 20+ e PostgreSQL 14+.

```bash
# Backend (porta 3333)
cd backend
cp .env.example .env      # ajuste DATABASE_URL
npm install
npm run migrate           # cria o schema "questoes" e dados iniciais
npm run dev

# Frontend (porta 5173, com proxy /api -> 3333)
cd frontend
npm install
npm run dev
```

Testes do backend: `cd backend && npm test`.

## Fonte de questões
Importação via API pública [enem.dev](https://docs.enem.dev) (`POST /api/importacao/enem {"ano": 2023}`), limitada a 1 requisição/s. Questões importadas entram com tema "A classificar" e precisam de revisão antes de serem validadas. O cadastro manual continua disponível.

## API principal
- `GET/POST /api/questoes`, `GET/PUT /api/questoes/:id`, `POST /api/questoes/:id/validar`, `GET /api/questoes/duplicadas`
- `GET /api/disciplinas|temas|dificuldades`
- `POST /api/gabaritos/previa`, `POST /api/gabaritos`, `GET /api/gabaritos`, `GET /api/gabaritos/:id/csv`
