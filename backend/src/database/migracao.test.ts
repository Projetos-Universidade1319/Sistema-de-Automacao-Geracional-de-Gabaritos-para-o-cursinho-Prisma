import { expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

it('migração preserva históricos anteriores, identifica legado e é idempotente', async () => {
  const db = new PGlite();
  try {
    for (const name of ['001_schema.sql', '002_seed.sql'])
      await db.exec(readFileSync(new URL(`./migrations/${name}`, import.meta.url), 'utf8'));
    await db.exec(`INSERT INTO questao (enunciado,id_origem) VALUES ('Legado',1),('Sem resposta',1);
      INSERT INTO alternativa (id_questao,letra,texto,correta) VALUES (1,'B','Resposta',true);
      UPDATE questao SET validado=true;
      INSERT INTO gabarito DEFAULT VALUES;
      INSERT INTO gabarito_questao VALUES (1,1,1),(1,2,2);`);
    const sql = readFileSync(new URL('./migrations/003_snapshot.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    await db.exec("UPDATE alternativa SET letra='C' WHERE id_questao=1");
    await db.exec(sql);
    expect((await db.query('SELECT letra_correta,snapshot_legado FROM gabarito_questao ORDER BY ordem')).rows)
      .toEqual([{ letra_correta: 'B', snapshot_legado: true }, { letra_correta: '?', snapshot_legado: true }]);
  } finally { await db.close(); }
}, 30000);
