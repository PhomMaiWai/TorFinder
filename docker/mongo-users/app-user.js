// Creates, or brings up to date, the account the backend connects with
// (ASVS 13.2.2): readWrite on the app's own database and collMod there (the
// retention TTL periods are changed in place), nothing on any other database
// and no cluster rights. Root stays for this script and for restores only.
//
// Run by the `db-users` service in docker-compose.yml on every `up`, as root,
// so a database volume created before this account existed gets it too.
// Idempotent: a second run only resets the password and roles to these.

const dbName = process.env.MONGO_APP_DB || "torr";
const user = process.env.MONGO_APP_USERNAME || "torr_app";
const pwd = process.env.MONGO_APP_PASSWORD || "torr_app";
const roleName = "torrSchemaChanges";

const appDb = db.getSiblingDB(dbName);

if (!appDb.getRole(roleName)) {
  appDb.createRole({
    role: roleName,
    privileges: [{ resource: { db: dbName, collection: "" }, actions: ["collMod"] }],
    roles: [],
  });
}

const roles = [{ role: "readWrite", db: dbName }, { role: roleName, db: dbName }];

if (appDb.getUser(user)) {
  appDb.updateUser(user, { pwd, roles });
  print(`updated ${user} on ${dbName}`);
} else {
  appDb.createUser({ user, pwd, roles });
  print(`created ${user} on ${dbName}`);
}
