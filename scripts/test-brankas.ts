
import { createOrUpdateBrankas } from "@/lib/tabungan";

async function test() {
    try {
        console.log("Testing Create Brankas...");
        const res = await createOrUpdateBrankas({
            nama: "Test Brankas Debug",
            saldo: 100000,
            picId: null // Explicitly null
        });
        console.log("Success (Explicit Null):", res);

        console.log("Testing Create Brankas (Undefined picId)...");
        const res2 = await createOrUpdateBrankas({
            nama: "Test Brankas Debug 2",
            saldo: 50000
            // picId undefined
        });
        console.log("Success (Undefined picId):", res2);

    } catch (e) {
        console.error("Failed:", e);
    }
}

test();
