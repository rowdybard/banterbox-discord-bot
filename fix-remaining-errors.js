import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the routes.ts file
const routesPath = path.join(__dirname, 'server', 'routes.ts');
let routesContent = fs.readFileSync(routesPath, 'utf8');

// Fix all req.user.id issues
routesContent = routesContent.replace(/const userId = req\.user\.id;/g, 'const userId = (req.user as any)?.id;');

// Fix all req.user?.id issues
routesContent = routesContent.replace(/const userId = req\.user\?\.id;/g, 'const userId = (req.user as any)?.id;');

// Fix array type issues
routesContent = routesContent.replace(/const currentFavorites = userSettings\?\.favoriteVoices \|\| \[\]/g, 'const currentFavorites = Array.isArray(userSettings?.favoriteVoices) ? userSettings.favoriteVoices : []');
routesContent = routesContent.replace(/const currentFavorites = userSettings\?\.favoritePersonalities \|\| \[\]/g, 'const currentFavorites = Array.isArray(userSettings?.favoritePersonalities) ? userSettings.favoritePersonalities : []');

// Write back the fixed content
fs.writeFileSync(routesPath, routesContent);

console.log('Fixed routes.ts issues');

// Read the storage.ts file
const storagePath = path.join(__dirname, 'server', 'storage.ts');
let storageContent = fs.readFileSync(storagePath, 'utf8');

// Fix UserSettings type issues
storageContent = storageContent.replace(/responseFrequency: settingsData\.responseFrequency \|\| 50,/g, 'responseFrequency: settingsData.responseFrequency || 50,');

// Fix DailyStats type issues
storageContent = storageContent.replace(/bantersPlayed: statsData\.bantersPlayed \|\| 0,/g, 'bantersPlayed: statsData.bantersPlayed || 0,');
storageContent = storageContent.replace(/peakHour: statsData\.peakHour \|\| 0,/g, 'peakHour: statsData.peakHour || 0,');

// Fix GuildLink type issues
storageContent = storageContent.replace(/active: guildLinkData\.active \|\| true,/g, 'active: guildLinkData.active || true,');

// Fix GuildSettings type issues
storageContent = storageContent.replace(/voiceProvider: guildSettingsData\.voiceProvider \|\| 'openai',/g, 'voiceProvider: guildSettingsData.voiceProvider || \'openai\',');
storageContent = storageContent.replace(/enabledEvents: guildSettingsData\.enabledEvents \|\| \['chat'\],/g, 'enabledEvents: guildSettingsData.enabledEvents || [\'chat\'],');
storageContent = storageContent.replace(/personality: guildSettingsData\.personality \|\| 'context',/g, 'personality: guildSettingsData.personality || \'context\',');

// Fix ContextMemory type issues
storageContent = storageContent.replace(/userId: contextData\.userId \|\| null,/g, 'userId: contextData.userId || null,');
storageContent = storageContent.replace(/originalMessage: contextData\.originalMessage \|\| null,/g, 'originalMessage: contextData.originalMessage || null,');
storageContent = storageContent.replace(/guildId: contextData\.guildId \|\| null,/g, 'guildId: contextData.guildId || null,');
storageContent = storageContent.replace(/banterResponse: contextData\.banterResponse \|\| null,/g, 'banterResponse: contextData.banterResponse || null,');
storageContent = storageContent.replace(/importance: contextData\.importance \|\| 1,/g, 'importance: contextData.importance || 1,');
storageContent = storageContent.replace(/participants: contextData\.participants \|\| \[\]/g, 'participants: contextData.participants || []');

// Write back the fixed content
fs.writeFileSync(storagePath, storageContent);

console.log('Fixed storage.ts issues');