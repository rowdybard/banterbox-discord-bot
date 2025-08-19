# Firebase Firestore Indexes Required

## Collection: `users`
- **Index 1**: `email` (Ascending)
  - Used in: `getUserByEmail` query

## Collection: `userSettings`
- **Index 1**: `userId` (Ascending)
  - Used in: `getUserSettings` query

## Collection: `banterItems`
- **Index 1**: `userId` (Ascending), `eventType` (Ascending)
  - Used in: `getBantersByUser` with eventType filter
- **Index 2**: `userId` (Ascending), `guildId` (Ascending)
  - Used in: `getBantersByUser` with guildId filter

## Collection: `linkCodes`
- **Index 1**: `code` (Ascending), `consumedAt` (Ascending)
  - Used in: `getLinkCode` query

## Collection: `guildLinks`
- **Index 1**: `active` (Ascending)
  - Used in: `getAllActiveGuildLinks` query

## Collection: `userApiKeys`
- **Index 1**: `userId` (Ascending), `isActive` (Ascending)
  - Used in: `getUserApiKeys` query
- **Index 2**: `userId` (Ascending), `provider` (Ascending)
  - Used in: `deleteUserApiKey` query

## Collection: `usageTracking`
- **Index 1**: `userId` (Ascending), `date` (Ascending)
  - Used in: `getUsageTracking` query

## Collection: `marketplaceVoices`
- **Index 1**: `isActive` (Ascending), `moderationStatus` (Ascending)
  - Used in: `getMarketplaceVoices` query
- **Index 2**: `isActive` (Ascending), `moderationStatus` (Ascending), `category` (Ascending)
  - Used in: `getMarketplaceVoices` with category filter

## Collection: `marketplacePersonalities`
- **Index 1**: `isActive` (Ascending), `moderationStatus` (Ascending)
  - Used in: `getMarketplacePersonalities` query
- **Index 2**: `isActive` (Ascending), `moderationStatus` (Ascending), `category` (Ascending)
  - Used in: `getMarketplacePersonalities` with category filter

## Collection: `userDownloads`
- **Index 1**: `userId` (Ascending), `itemType` (Ascending), `itemId` (Ascending)
  - Used in: `hasUserDownloaded` query

## Collection: `contentReports`
- **Index 1**: `moderationStatus` (Ascending)
  - Used in: `getContentReports` query
- **Index 2**: `status` (Ascending)
  - Used in: `getContentReports` with status filter

## Collection: `guildLinks`
- **Index 1**: `workspaceId` (Ascending)
  - Used in: `getAllGuildLinks` query

## Collection: `contextMemory`
- **Index 1**: `userId` (Ascending)
  - Used in: `getRecentContext` query
- **Index 2**: `userId` (Ascending), `eventType` (Ascending)
  - Used in: `getContextByType` query
- **Index 3**: `expiresAt` (Ascending)
  - Used in: `cleanupExpiredContext` query

## How to Create These Indexes

### Option 1: Firebase Console (Recommended)
1. Go to Firebase Console > Firestore Database > Indexes
2. Click "Add Index"
3. For each index above:
   - Select the collection name
   - Add the fields in the order specified
   - Set the query scope to "Collection"
   - Click "Create"

### Option 2: Firebase CLI
Create a `firestore.indexes.json` file:

```json
{
  "indexes": [
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "email",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "userSettings",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "banterItems",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "eventType",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "banterItems",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "guildId",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "linkCodes",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "code",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "consumedAt",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "guildLinks",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "active",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "userApiKeys",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "isActive",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "userApiKeys",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "provider",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "usageTracking",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "date",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "marketplaceVoices",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "isActive",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "moderationStatus",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "marketplaceVoices",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "isActive",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "moderationStatus",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "category",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "marketplacePersonalities",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "isActive",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "moderationStatus",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "marketplacePersonalities",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "isActive",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "moderationStatus",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "category",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "userDownloads",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "itemType",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "itemId",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "contentReports",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "moderationStatus",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "contentReports",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "guildLinks",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "workspaceId",
          "order": "ASCENDING"
        }
      ]
    }
  ]
}
```

Then run:
```bash
firebase deploy --only firestore:indexes
```

## Important Notes

1. **Index Creation Time**: Indexes can take several minutes to build, especially for large collections
2. **Cost**: Each index has a small storage cost
3. **Testing**: You can test queries in the Firebase Console to see which indexes are missing
4. **Error Messages**: Firestore will show specific error messages when indexes are missing, including the exact index configuration needed

## Quick Test

To see which indexes are missing, run your application and check the Firebase Console > Firestore Database > Indexes tab. Any missing indexes will appear in the "Missing indexes" section with the exact configuration needed.
