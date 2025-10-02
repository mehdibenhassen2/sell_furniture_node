// just to create the hash for the password and then copy to database
const bcrypt = require('bcryptjs');

async function hashPassword() {
  const hashed = await bcrypt.hash("1212", 10);
  console.log(hashed);
}

hashPassword();