/// <reference path="../pb_data/types.d.ts" />

migrate((db) => {
    const dao = new Dao(db);

    // 1. Create inventory_rooms
    const rooms = new Collection({
        name: "inventory_rooms",
        type: "base",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        schema: [
            { name: "name", type: "text", required: true },
            { name: "code", type: "text", required: true, unique: true },
            { name: "description", type: "text" },
            { name: "pic", type: "relation", options: { collectionId: "_pb_users_auth_", cascadeDelete: false, maxSelect: 1 } },
        ],
    });
    dao.saveCollection(rooms);

    // 2. Create inventory_assets
    const assets = new Collection({
        name: "inventory_assets",
        type: "base",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        schema: [
            { name: "name", type: "text", required: true },
            { name: "code", type: "text", required: true, unique: true },
            { name: "category", type: "text", required: true },
            { name: "purchase_date", type: "date" },
            { name: "price", type: "number" },
            { name: "quantity", type: "number", required: true },
            { name: "room", type: "relation", required: true, options: { collectionId: rooms.id, cascadeDelete: false, maxSelect: 1 } },
            { name: "image", type: "file", options: { mimeTypes: ["image/png", "image/jpeg", "image/webp"], thumbs: ["100x100", "500x500"] } },
            { name: "notes", type: "text" },
            // Condition breakdown
            { name: "condition_good", type: "number" },
            { name: "condition_light_damaged", type: "number" },
            { name: "condition_heavy_damaged", type: "number" },
            { name: "condition_lost", type: "number" },
        ],
    });
    dao.saveCollection(assets);

    // 3. Create inventory_opname
    const opname = new Collection({
        name: "inventory_opname",
        type: "base",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        schema: [
            { name: "date", type: "date", required: true },
            { name: "room", type: "relation", required: true, options: { collectionId: rooms.id, cascadeDelete: false, maxSelect: 1 } },
            { name: "auditor", type: "relation", required: true, options: { collectionId: "_pb_users_auth_", cascadeDelete: false, maxSelect: 1 } },
            { name: "items", type: "json" }, // Stores array of OpnameItem
            { name: "status", type: "select", options: { values: ["PENDING", "APPLIED", "REJECTED"] } },
            { name: "note", type: "text" },
        ],
    });
    dao.saveCollection(opname);

    // 4. Create inventory_audit
    const audit = new Collection({
        name: "inventory_audit",
        type: "base",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "", // Audit logs are immutable
        deleteRule: "", // Audit logs are immutable
        schema: [
            { name: "user", type: "relation", required: true, options: { collectionId: "_pb_users_auth_", cascadeDelete: false, maxSelect: 1 } },
            { name: "action", type: "text", required: true },
            { name: "entity", type: "text", required: true },
            { name: "entity_id", type: "text", required: true },
            { name: "changes", type: "json" },
            { name: "note", type: "text" },
        ],
    });
    dao.saveCollection(audit);

}, (db) => {
    const dao = new Dao(db);
    try {
        const audit = dao.findCollectionByNameOrId("inventory_audit");
        dao.deleteCollection(audit);
    } catch (_) { }
    try {
        const opname = dao.findCollectionByNameOrId("inventory_opname");
        dao.deleteCollection(opname);
    } catch (_) { }
    try {
        const assets = dao.findCollectionByNameOrId("inventory_assets");
        dao.deleteCollection(assets);
    } catch (_) { }
    try {
        const rooms = dao.findCollectionByNameOrId("inventory_rooms");
        dao.deleteCollection(rooms);
    } catch (_) { }
});
