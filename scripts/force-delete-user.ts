
import Database from "better-sqlite3";

const dbPath = "./data/sekolahku.db";
const db = new Database(dbPath);

function main() {
  const targetEmail = "demo@sekolah.sch.id";
  console.log(`Searching for user: ${targetEmail}`);

  // 1. Find User
  const user = db.prepare("SELECT id, name FROM users WHERE email = ?").get(targetEmail) as { id: string; name: string } | undefined;

  if (!user) {
    console.log("User not found!");
    return;
  }

  console.log(`Found user ID: ${user.id} (${user.name})`);
  console.log("Starting cascading deletion (RAW SQL)...");

  const userId = user.id;

  const transaction = db.transaction(() => {
    // 1. MISC
    console.log("- Cleaning announcements...");
    db.prepare("UPDATE announcements SET author_id = NULL WHERE author_id = ?").run(userId);
    
    console.log("- Deleting audit logs...");
    db.prepare("DELETE FROM audit_logs WHERE user_id = ?").run(userId);

    // 2. TABUNGAN
    console.log("- Cleaning Tabungan Kelas...");
    db.prepare("UPDATE tabungan_kelas SET wali_kelas = NULL WHERE wali_kelas = ?").run(userId);
    
    console.log("- Deleting Tabungan Transactions (User as Teller/Verifier/Customer)...");
    // Delete transactions where user is the customer (userId) OR the verifier/teller
    // Note: tabungan_transaksi has user_id (customer/teller?) and verified_by
    // Based on schema: userId (ref users), verifiedBy (ref users).
    db.prepare("DELETE FROM tabungan_transaksi WHERE user_id = ? OR verified_by = ?").run(userId, userId);

    // 3. SPMB
    console.log("- Cleaning SPMB Registrants...");
    db.prepare("UPDATE spmb_registrants SET verified_by = NULL WHERE verified_by = ?").run(userId);

    // 4. INVENTORY
    console.log("- Cleaning Inventory Audit...");
    db.prepare("UPDATE inventory_audit SET user_id = NULL WHERE user_id = ?").run(userId);

    // 5. LIBRARY
    console.log("- Cleaning Library Members...");
    db.prepare("UPDATE library_members SET user_id = NULL WHERE user_id = ?").run(userId);
    
    // 6. ALUMNI
    console.log("- Cleaning Alumni Documents...");
    db.prepare("UPDATE alumni_documents SET uploaded_by = NULL WHERE uploaded_by = ?").run(userId);
    db.prepare("UPDATE alumni_documents SET verified_by = NULL WHERE verified_by = ?").run(userId);
    db.prepare("UPDATE document_pickups SET handed_over_by = NULL WHERE handed_over_by = ?").run(userId);

    // 7. AUTH & USER
    console.log("- Deleting Sessions/Accounts/Profiles...");
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM accounts WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM profiles WHERE user_id = ?").run(userId);

    console.log("- Deleting User Record...");
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  });

  transaction();

  console.log("✅ Successfully deleted user and cleaned up references.");
}

try {
  main();
} catch (err) {
  console.error("❌ Error deleting user:");
  console.error(err);
  process.exit(1);
}
