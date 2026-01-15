/// <reference path="../pb_data/types.d.ts" />

migrate((db) => {
    const dao = new Dao(db);

    // 1. Create library_items
    const items = new Collection({
        name: "library_items",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        schema: [
            { name: "title", type: "text", required: true },
            { name: "author", type: "text" },
            { name: "isbn", type: "text" },
            { name: "publisher", type: "text" },
            { name: "year", type: "number" },
            { name: "category", type: "select", options: { values: ["FICTION", "NON_FICTION", "REFERENCE", "TEXTBOOK", "MAGAZINE", "OTHER"] } },
            { name: "location", type: "text" },
            { name: "qr_code", type: "text", required: true, unique: true },
            { name: "status", type: "select", options: { values: ["AVAILABLE", "BORROWED"] } },
            { name: "description", type: "text" },
            { name: "cover", type: "file", options: { mimeTypes: ["image/png", "image/jpeg", "image/webp"], thumbs: ["100x150"] } },
        ],
    });
    dao.saveCollection(items);

    // 2. Create library_members
    const members = new Collection({
        name: "library_members",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        schema: [
            { name: "user", type: "relation", options: { collectionId: "_pb_users_auth_", cascadeDelete: false, maxSelect: 1 } },
            { name: "name", type: "text", required: true },
            { name: "class_name", type: "text" },
            { name: "student_id", type: "text" },
            { name: "qr_code", type: "text", required: true, unique: true },
            { name: "max_borrow_limit", type: "number", options: { min: 1, max: 10 } },
            { name: "is_active", type: "bool" },
            { name: "photo", type: "file", options: { mimeTypes: ["image/png", "image/jpeg", "image/webp"], thumbs: ["100x100"] } },
        ],
    });
    dao.saveCollection(members);

    // 3. Create library_loans
    const loans = new Collection({
        name: "library_loans",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        schema: [
            { name: "member", type: "relation", required: true, options: { collectionId: members.id, cascadeDelete: false, maxSelect: 1 } },
            { name: "item", type: "relation", required: true, options: { collectionId: items.id, cascadeDelete: false, maxSelect: 1 } },
            { name: "borrow_date", type: "date", required: true },
            { name: "due_date", type: "date", required: true },
            { name: "return_date", type: "date" },
            { name: "is_returned", type: "bool" },
            { name: "fine_amount", type: "number" },
            { name: "fine_paid", type: "bool" },
            { name: "notes", type: "text" },
        ],
    });
    dao.saveCollection(loans);

    // 4. Create library_visits
    const visits = new Collection({
        name: "library_visits",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "",  // Layout public for kiosk
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        schema: [
            { name: "member", type: "relation", required: true, options: { collectionId: members.id, cascadeDelete: false, maxSelect: 1 } },
            { name: "date", type: "date", required: true },
            { name: "timestamp", type: "date", required: true },
        ],
    });
    dao.saveCollection(visits);

}, (db) => {
    const dao = new Dao(db);
    try {
        const visits = dao.findCollectionByNameOrId("library_visits");
        dao.deleteCollection(visits);
    } catch (_) { }
    try {
        const loans = dao.findCollectionByNameOrId("library_loans");
        dao.deleteCollection(loans);
    } catch (_) { }
    try {
        const members = dao.findCollectionByNameOrId("library_members");
        dao.deleteCollection(members);
    } catch (_) { }
    try {
        const items = dao.findCollectionByNameOrId("library_items");
        dao.deleteCollection(items);
    } catch (_) { }
});
