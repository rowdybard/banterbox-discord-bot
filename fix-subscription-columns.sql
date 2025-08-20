-- Fix missing subscription columns in users table
-- Run this script directly on your production database

-- Add subscription_tier column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'subscription_tier'
    ) THEN
        ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free';
        RAISE NOTICE 'Added subscription_tier column to users table';
    ELSE
        RAISE NOTICE 'subscription_tier column already exists';
    END IF;
END $$;

-- Add subscription_status column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'subscription_status'
    ) THEN
        ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'active';
        RAISE NOTICE 'Added subscription_status column to users table';
    ELSE
        RAISE NOTICE 'subscription_status column already exists';
    END IF;
END $$;

-- Add subscription_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'subscription_id'
    ) THEN
        ALTER TABLE users ADD COLUMN subscription_id VARCHAR(255);
        RAISE NOTICE 'Added subscription_id column to users table';
    ELSE
        RAISE NOTICE 'subscription_id column already exists';
    END IF;
END $$;

-- Add trial_ends_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'trial_ends_at'
    ) THEN
        ALTER TABLE users ADD COLUMN trial_ends_at TIMESTAMP;
        RAISE NOTICE 'Added trial_ends_at column to users table';
    ELSE
        RAISE NOTICE 'trial_ends_at column already exists';
    END IF;
END $$;

-- Add current_period_end column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'current_period_end'
    ) THEN
        ALTER TABLE users ADD COLUMN current_period_end TIMESTAMP;
        RAISE NOTICE 'Added current_period_end column to users table';
    ELSE
        RAISE NOTICE 'current_period_end column already exists';
    END IF;
END $$;

-- Add password_hash column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
        RAISE NOTICE 'Added password_hash column to users table';
    ELSE
        RAISE NOTICE 'password_hash column already exists';
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
AND column_name IN ('subscription_tier', 'subscription_status', 'subscription_id', 'trial_ends_at', 'current_period_end', 'password_hash')
ORDER BY column_name;
