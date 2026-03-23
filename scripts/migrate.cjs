'use strict';
/**
 * Migration runner — exécuté avant `next start` (script "prestart").
 *
 * Lit les fichiers SQL dans supabase/migrations/ par ordre alphabétique,
 * crée une table _schema_migrations si elle n'existe pas,
 * et applique uniquement les migrations non encore exécutées.
 *
 * Nécessite la variable d'environnement SUPABASE_DB_URL (connection string
 * PostgreSQL directe, disponible dans Supabase Dashboard → Settings → Database).
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.warn('[migrate] SUPABASE_DB_URL non défini — migrations ignorées.');
    return;
  }

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // Crée la table de suivi si elle n'existe pas
    await client.query(`
      CREATE TABLE IF NOT EXISTS public._schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT 1 FROM public._schema_migrations WHERE filename = $1',
        [file]
      );
      if (rows.length > 0) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`[migrate] Application de ${file}…`);
      await client.query(sql);
      await client.query(
        'INSERT INTO public._schema_migrations (filename) VALUES ($1)',
        [file]
      );
      console.log(`[migrate] ${file} ✓`);
    }

    console.log('[migrate] Toutes les migrations sont à jour.');
  } finally {
    await client.end();
  }
}

runMigrations().catch(err => {
  console.error('[migrate] Erreur :', err.message);
  // Ne pas bloquer le démarrage si la migration échoue
});
