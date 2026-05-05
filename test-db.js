const mysql = require("mysql2/promise");

async function test() {
  try {
    const conn = await mysql.createConnection({
      host: "148.72.53.124",
      user: "martarik_user",
      password: "80Z890mC[!F5",
      database: "electropoint",
      ssl: false,
      connectTimeout: 30000,
      insecureAuth: true,
    });
    console.log("Connected!");
    await conn.end();
  } catch (err) {
    console.log("Error code:", err.code);
    console.log("Error message:", err.message);
  }
}

test();
