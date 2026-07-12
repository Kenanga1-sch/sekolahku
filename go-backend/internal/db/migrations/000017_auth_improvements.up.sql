-- Add must_change_password flag to users
ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0;

-- Set existing users to 0 (no forced change)
UPDATE users SET must_change_password = 0;

-- Add standalone columns to employee_details so it can exist without a user record
ALTER TABLE employee_details ADD COLUMN name TEXT;
ALTER TABLE employee_details ADD COLUMN email TEXT;
ALTER TABLE employee_details ADD COLUMN role TEXT DEFAULT 'guru';

-- Migrate existing data: copy from users to employee_details
UPDATE employee_details SET 
    name = (SELECT name FROM users WHERE users.id = employee_details.user_id),
    email = (SELECT email FROM users WHERE users.id = employee_details.user_id),
    role = (SELECT role FROM users WHERE users.id = employee_details.user_id);
