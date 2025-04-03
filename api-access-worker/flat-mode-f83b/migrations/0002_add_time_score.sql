-- Migration number: 0002     2024-04-03T12:00:00.000Z
-- Check if scores table exists and create it if not
CREATE TABLE IF NOT EXISTS scores (
    name TEXT DEFAULT 'placeholder',
    score_value INTEGER DEFAULT 0,
    time_score INTEGER DEFAULT 0
);

-- Add time_score column if it doesn't exist
PRAGMA table_info(scores);

-- Actual ALTER TABLE statement to add the column if needed
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- So we'll run this and allow it to fail if column already exists
ALTER TABLE scores ADD COLUMN time_score INTEGER DEFAULT 0;

-- Update any existing records that don't have time_score
UPDATE scores SET time_score = 0 WHERE time_score IS NULL; 