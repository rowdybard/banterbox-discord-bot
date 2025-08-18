# 🔧 Database Migration Fix

## ❌ **Problem Identified**

The application was failing with database schema errors:

### **Missing Columns:**
1. **`favorite_personalities`** - Missing from `user_settings` table
2. **`favorite_voices`** - Missing from `user_settings` table  
3. **`original_message`** - Missing from `banter_items` table
4. **`original_message`** - Missing from `context_memory` table

### **Error Messages:**
```
Error updating user settings: error: column "favorite_personalities" does not exist
Could not load user settings, using default personality
Error getting context for banter: error: column "original_message" does not exist
```

## ✅ **Solution Applied**

### **1. Comprehensive Migration Script**
Updated `migrate-db.js` to add all missing columns:

```javascript
// Adds missing columns to all tables
- password_hash (users table)
- favorite_personalities (user_settings table) 
- favorite_voices (user_settings table)
- original_message (banter_items table)
- original_message (context_memory table)
- sessions table and indexes
```

### **2. Schema Verification**
The schema in `shared/schema.ts` already defines these columns correctly:

```typescript
export const userSettings = pgTable("user_settings", {
  // ... other columns
  favoritePersonalities: jsonb("favorite_personalities").default([]),
  favoriteVoices: jsonb("favorite_voices").default([]),
});

export const banterItems = pgTable("banter_items", {
  // ... other columns
  originalMessage: text("original_message"),
});

export const contextMemory = pgTable("context_memory", {
  // ... other columns
  originalMessage: text("original_message"),
});
```

### **3. Safe Migration**
The migration script:
- ✅ **Checks if columns exist** before adding them
- ✅ **Uses proper defaults** (empty arrays for favorites)
- ✅ **Handles errors gracefully** with try/catch
- ✅ **Logs progress** for debugging

## 🚀 **How to Run**

### **Option 1: Run Migration Script**
```bash
npm run db:migrate
```

### **Option 2: Manual Database Commands**
If you prefer to run manually in your database:

```sql
-- Add missing columns to user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS favorite_personalities JSONB DEFAULT '[]'::jsonb;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS favorite_voices JSONB DEFAULT '[]'::jsonb;

-- Add missing columns to banter_items
ALTER TABLE banter_items ADD COLUMN IF NOT EXISTS original_message TEXT;

-- Add missing columns to context_memory  
ALTER TABLE context_memory ADD COLUMN IF NOT EXISTS original_message TEXT;

-- Create sessions table if missing
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR NOT NULL COLLATE "default",
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_sid ON sessions (sid);
CREATE INDEX IF NOT EXISTS idx_session_expire ON sessions (expire);
```

## 🎯 **Expected Results**

After running the migration:

### **Voice Settings:**
- ✅ **Save Successfully**: No more "favorite_personalities does not exist" errors
- ✅ **Load Successfully**: Settings load with proper defaults
- ✅ **Favorites Work**: Can save favorite personalities and voices

### **Banter Context:**
- ✅ **Context Loading**: No more "original_message does not exist" errors
- ✅ **Message History**: Original messages stored properly
- ✅ **AI Responses**: Better context for banter generation

### **Authentication:**
- ✅ **Sessions Work**: Proper session storage and management
- ✅ **Login Persistence**: Users stay logged in across refreshes

## 🔍 **Files Modified**

- **Updated**: `migrate-db.js` - Comprehensive migration script
- **No changes needed**: `shared/schema.ts` - Schema was already correct
- **No changes needed**: Application code - Already expects these columns

## 📞 **If Issues Persist**

1. **Check Migration Logs**: Look for any errors during migration
2. **Verify Database**: Connect to database and check if columns exist
3. **Re-run Migration**: The script is safe to run multiple times
4. **Check Permissions**: Ensure database user has ALTER TABLE permissions

The database schema should now be fully compatible with the application! 🎉
