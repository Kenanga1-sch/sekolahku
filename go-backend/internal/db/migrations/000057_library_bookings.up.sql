-- Create library_bookings table for public-facing book reservation system
-- Allows students/teachers to reserve books before picking them up from the library

CREATE TABLE IF NOT EXISTS library_bookings (
    id TEXT PRIMARY KEY,
    user_id TEXT NULL,                    -- Reference to users table (NULL for guest bookings)
    member_id TEXT NULL,                  -- Reference to library_members (auto-linked if user_id exists)
    
    asset_id TEXT NOT NULL,               -- Specific physical copy (library_assets.id)
    catalog_id TEXT NOT NULL,             -- For quick lookup (denormalized)
    
    -- Borrower information
    borrower_name TEXT NOT NULL,          -- Full name (e.g., "John Doe")
    borrower_email TEXT,                  -- Contact email (optional)
    borrower_phone TEXT,                  -- Contact phone (optional)
    student_class TEXT,                   -- Class name (if applicable, e.g., "X-A")
    
    -- Booking dates
    borrow_date INTEGER NOT NULL,         -- When they will pick up the book (Unix ms)
    due_date INTEGER NOT NULL,            -- Return deadline (Unix ms)
    expires_at INTEGER,                   -- Auto-cancel timestamp (Unix ms), NULL = no auto-expiry
    
    -- Status tracking
    status TEXT DEFAULT 'pending',        -- pending/confirmed/ready/completed/cancelled/expired
    
    -- Additional info
    notes TEXT,                           -- Request notes from borrower
    
    -- Metadata
    created_at INTEGER,
    updated_at INTEGER,
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (member_id) REFERENCES library_members(id) ON DELETE SET NULL,
    FOREIGN KEY (asset_id) REFERENCES library_assets(id) ON DELETE CASCADE,
    FOREIGN KEY (catalog_id) REFERENCES library_catalog(id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_library_bookings_user_id ON library_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_library_bookings_member_id ON library_bookings(member_id);
CREATE INDEX IF NOT EXISTS idx_library_bookings_asset_id ON library_bookings(asset_id);
CREATE INDEX IF NOT EXISTS idx_library_bookings_status ON library_bookings(status);
CREATE INDEX IF NOT EXISTS idx_library_bookings_borrow_date ON library_bookings(borrow_date);
CREATE INDEX IF NOT EXISTS idx_library_bookings_expires_at ON library_bookings(expires_at) WHERE expires_at IS NOT NULL;

-- Default values for created_at and updated_at (will be set by application)
-- Note: SQLite doesn't support DEFAULT CURRENT_TIMESTAMP for integers, so handle in app code
