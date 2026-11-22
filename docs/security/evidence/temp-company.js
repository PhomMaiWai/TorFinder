// A throwaway approved company for the `crosscompany` shot in
// capture-screenshots.js, created and removed inside the backend container
// with the backend's own database login:
//   docker compose exec -T -e ACTION=create backend node - < docs/security/evidence/temp-company.js
//   docker compose exec -T -e ACTION=remove backend node - < docs/security/evidence/temp-company.js
// `create` prints {"email","password"} for the script to sign in with; the
// password is random and the account is deleted again by `remove`.
const { randomBytes } = require("node:crypto");
const { MongoClient } = require("/app/node_modules/mongodb");
const { passwordFields } = require("/app/dist/common/password.js");

const EMAIL = "evidence-other-company@example.com";

(async () => {
  const client = await new MongoClient(process.env.MONGODB_URI).connect();
  const users = client.db().collection("users");
  try {
    if (process.env.ACTION === "create") {
      await users.deleteOne({ email: EMAIL });
      const password = `Ev-${randomBytes(12).toString("base64url")}`;
      await users.insertOne({
        email: EMAIL,
        name: "Evidence Other Co",
        role: "org",
        status: "approved",
        emailVerified: true,
        ...(await passwordFields(password)),
        company: { companyName: "Evidence Other Co", taxId: "0105563009999", contactName: "Evidence", phone: "0800000000", address: "1 Test Road", specialty: "software", size: "1-10 คน" },
        createdAt: new Date(),
      });
      console.log(JSON.stringify({ email: EMAIL, password }));
    } else if (process.env.ACTION === "remove") {
      const user = await users.findOne({ email: EMAIL }, { projection: { _id: 1 } });
      if (user) await client.db().collection("sessions").deleteMany({ userId: user._id });
      const { deletedCount } = await users.deleteOne({ email: EMAIL });
      console.log(`removed ${deletedCount} temporary company`);
    }
  } finally {
    await client.close();
  }
})();
