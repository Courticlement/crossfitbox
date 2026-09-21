import { randomBytes, scryptSync } from "node:crypto";
import { Client } from "pg";

const KEY_LENGTH = 64;
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

const [, , url, email, newPassword] = process.argv;
const passwordHash = hashPassword(newPassword);

const client = new Client({ connectionString: url });
await client.connect();
const res = await client.query(
  'UPDATE "Admin" SET "passwordHash" = $1 WHERE email = $2 RETURNING email, role;',
  [passwordHash, email]
);
console.log("Updated:", JSON.stringify(res.rows));
await client.end();
