-- Add response_frequency column to user_settings table
-- This migration adds a response frequency control to the BanterBox dashboard

-- Add the column if it doesn't exist
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS response_frequency INTEGER DEFAULT 50;

-- Update existing records to have the default value
UPDATE user_settings 
SET response_frequency = 50 
WHERE response_frequency IS NULL;

-- Add a comment to document the column
COMMENT ON COLUMN user_settings.response_frequency IS 'Controls how often BanterBox responds to trigger words and direct questions (0-100 scale)';