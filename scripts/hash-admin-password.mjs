import { randomBytes, scryptSync } from "node:crypto"
import securityConfig from "../config/security.json" with { type: "json" }

const password = process.argv[2] || ""
if (!password || password.length < 12) {
  console.error("Provide an admin password of at least 12 characters.")
  process.exit(1)
}
if (password.length > 256) {
  console.error("Admin password is too long.")
  process.exit(1)
}

const salt = randomBytes(securityConfig.scrypt.generatedSaltBytes)
const hash = scryptSync(password, salt, securityConfig.scrypt.generatedHashBytes)
process.stdout.write(`${salt.toString("hex")}:${hash.toString("hex")}\n`)
