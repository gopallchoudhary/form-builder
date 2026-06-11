const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, 'packages/database/.env') });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();
  console.log("Connected to DB");
  
  try {
    const query = `insert into "form_fields" ("id", "label", "label_key", "placeholder", "description", "index", "is_required", "type", "form_id", "created_at", "updated_at") values (default, $1, $2, $3, $4, $5, $6, $7, $8, default, $9) returning "id"`;
    const params = [
        "Mobile No.",
        "mobile-no",
        "Enter your mobile no.",
        "+91 9999999999",
        "1.00",
        true,
        "NUMBER",
        "855b128a-da4d-440d-a663-ce1340ccbc39",
        new Date("2026-06-11T07:37:28.179Z")
    ];
    
    const res = await client.query(query, params);
    console.log("Success:", res.rows);
  } catch (err) {
    console.error("Postgres Error:");
    console.error(err.message);
  } finally {
    await client.end();
  }
}

run();
