-- Migration to add plan switching limit columns to users table
-- Run this on your database to enable plan switching limits

DO $$ BEGIN
    -- Add last_plan_change_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'last_plan_change_at'
    ) THEN
        ALTER TABLE users ADD COLUMN last_plan_change_at TIMESTAMP;
    END IF;
END $$;

DO $$ BEGIN
    -- Add plan_change_count column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'plan_change_count'
    ) THEN
        ALTER TABLE users ADD COLUMN plan_change_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Verify the columns were added
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('last_plan_change_at', 'plan_change_count')
ORDER BY column_name;
