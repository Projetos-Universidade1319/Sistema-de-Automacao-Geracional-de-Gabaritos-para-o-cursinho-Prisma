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

## Testes

Backend: `npm run typecheck`, `npm run build` e `npm run test:coverage`.
Frontend: `npm run build` e `npm run test:coverage` (execute dentro de cada pasta).
Os testes de integração usam PostgreSQL embarcado em memória (PGlite), sem acessar
o banco configurado em `DATABASE_URL`. Os testes das telas usam jsdom.
Relatórios de cobertura são gerados em `coverage/index.html` em cada pasta.

## Atualização de instalações existentes

Execute `npm run migrate` no backend antes de iniciar a versão atualizada. A migração
`003_snapshot.sql` preserva a resposta de cada gabarito para que edições futuras não
alterem o CSV. Gabaritos anteriores são identificados como históricos antigos:
preservam a resposta disponível no momento da migração, ou `?` quando indisponível.
Respostas originais já sobrescritas não podem ser reconstruídas sem backup.
As migrações são transacionais e podem ser reaplicadas. O build inclui os arquivos
SQL e também permite executar `node dist/database/migrate.js`.

Questões são paginadas por cursor (`antes`, `limite` até 200); o cabeçalho
`X-Proxima-Pagina` informa o próximo cursor. As telas percorrem todas as páginas.
É possível criar temas na tela de revisão, sem configuração manual pela API.

## Fonte de questões
Importação via API pública [enem.dev](https://docs.enem.dev) (`POST /api/importacao/enem {"ano": 2023}`), com fila compartilhada entre importações no mesmo processo (intervalo de 1,1 s), timeout de 15 s e tratamento de `Retry-After`. Implantações com múltiplas instâncias precisam de coordenação distribuída do limite. Questões importadas entram com tema "A classificar" e precisam de revisão antes de serem validadas. O cadastro manual continua disponível.

O resultado da importação informa contagens e `avisos` quando o total da fonte
diverge dos IDs únicos ou há registros repetidos. Falhas da fonte retornam 502
com o progresso parcial; repetir a importação não duplica registros já salvos.
Texto e imagens são preservados nas novas importações. Questões importadas por
versões anteriores não são sobrescritas na reimportação, preservando revisões manuais.

## API principal
- `GET/POST /api/questoes`, `GET/PUT /api/questoes/:id`, `POST /api/questoes/:id/validar`, `GET /api/questoes/duplicadas`
- `GET /api/disciplinas|temas|dificuldades`
- `POST /api/gabaritos/previa`, `POST /api/gabaritos`, `GET /api/gabaritos`, `GET /api/gabaritos/:id/csv`
