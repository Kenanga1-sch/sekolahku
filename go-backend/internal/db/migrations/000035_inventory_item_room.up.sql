-- 000035: inventory_items.room_id
--
-- Resolusi scope PIC untuk barang habis pakai sebelumnya mencocokkan
-- inventory_items.location dengan inventory_rooms.name lewat ItemRoomID().
-- Itu rapuh: begitu nama ruangan diganti, barang tidak lagi terlindungi dan
-- sunyi-sunyi jatuh ke kategori "stok umum" (bebas diubah siapa saja).
--
-- Kolom room_id menjadi sumber kebenaran; location tetap dipakai sebagai
-- teks tampilan / stok umum.

ALTER TABLE inventory_items ADD COLUMN room_id TEXT REFERENCES inventory_rooms(id);

CREATE INDEX IF NOT EXISTS idx_inventory_items_room ON inventory_items(room_id);
