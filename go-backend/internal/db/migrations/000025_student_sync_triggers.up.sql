-- Trigger to cascade class renames to students and tabungan_kelas
CREATE TRIGGER IF NOT EXISTS sync_class_rename
AFTER UPDATE OF name ON student_classes
WHEN OLD.name != NEW.name
BEGIN
    -- Rename equivalent class in savings module
    UPDATE tabungan_kelas
    SET nama = NEW.name,
        updated_at = (strftime('%s', 'now') * 1000)
    WHERE nama = OLD.name;
    
    -- Update denormalized class_name in students
    UPDATE students
    SET class_name = NEW.name,
        updated_at = (strftime('%s', 'now') * 1000)
    WHERE class_id = NEW.id;
END;

-- Trigger to cascade student profile updates to library_members
CREATE TRIGGER IF NOT EXISTS sync_student_profile_to_library
AFTER UPDATE OF full_name, class_name, is_active, status ON students
BEGIN
    UPDATE library_members
    SET name = NEW.full_name,
        class_name = NEW.class_name,
        is_active = CASE WHEN (NEW.is_active = 1 OR NEW.status IN ('active', 'aktif')) THEN 1 ELSE 0 END,
        updated_at = (strftime('%s', 'now') * 1000)
    WHERE student_id = NEW.id;
END;

-- Trigger to cascade student profile updates to tabungan_siswa
CREATE TRIGGER IF NOT EXISTS sync_student_profile_to_savings
AFTER UPDATE OF full_name, nisn, is_active, status ON students
BEGIN
    UPDATE tabungan_siswa
    SET nama = NEW.full_name,
        nisn = NEW.nisn,
        is_active = CASE WHEN (NEW.is_active = 1 OR NEW.status IN ('active', 'aktif')) THEN 1 ELSE 0 END,
        updated_at = (strftime('%s', 'now') * 1000)
    WHERE student_id = NEW.id;
END;

-- Trigger to cascade student class promotion to tabungan_siswa
CREATE TRIGGER IF NOT EXISTS sync_student_class_to_savings
AFTER UPDATE OF class_id ON students
WHEN OLD.class_id IS NOT NEW.class_id
BEGIN
    UPDATE tabungan_siswa
    SET kelas_id = (SELECT id FROM tabungan_kelas WHERE nama = NEW.class_name LIMIT 1),
        updated_at = (strftime('%s', 'now') * 1000)
    WHERE student_id = NEW.id
      AND EXISTS (SELECT 1 FROM tabungan_kelas WHERE nama = NEW.class_name);
END;
