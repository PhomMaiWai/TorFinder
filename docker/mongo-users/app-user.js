// Creates, or brings up to date, the account the backend connects with
// (ASVS 13.2.2, 12.3.5): a certificate-authenticated user with readWrite on
// the app's own database and collMod there (the
// retention TTL periods are changed in place), nothing on any other database
// and no cluster rights. Root stays for this script and for restores only.
//
// Run by the `db-users` service in docker-compose.yml on every `up`, as root,
// so a database volume created before this account existed gets it too.
// Idempotent: a second run only resets the roles to these.

const dbName = process.env.MONGO_APP_DB || "torr";
// ASVS 12.3.5: the backend logs in with its TLS client certificate
// (MONGODB-X509), not a password. The user is the certificate's subject, as
// docker/certs/generate.sh writes it, in RFC 2253 order.
const x509User = process.env.MONGO_APP_X509_SUBJECT || "CN=torr_app,OU=backend,O=TorFinder";
const legacyPasswordUser = process.env.MONGO_APP_USERNAME || "torr_app";
const roleName = "torrSchemaChanges";

const appDb = db.getSiblingDB(dbName);
const external = db.getSiblingDB("$external");

if (!appDb.getRole(roleName)) {
  appDb.createRole({
    role: roleName,
    privileges: [{ resource: { db: dbName, collection: "" }, actions: ["collMod"] }],
    roles: [],
  });
}

const roles = [{ role: "readWrite", db: dbName }, { role: roleName, db: dbName }];

if (external.getUser(x509User)) {
  external.updateUser(x509User, { roles });
  print(`updated ${x509User}`);
} else {
  external.createUser({ user: x509User, roles });
  print(`created ${x509User}`);
}

// The password account the backend used before certificates: a password that
// still works would be a way around them.
if (appDb.getUser(legacyPasswordUser)) {
  appDb.dropUser(legacyPasswordUser);
  print(`removed the password account ${legacyPasswordUser}`);
}
