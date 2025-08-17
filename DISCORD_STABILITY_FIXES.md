# Discord Bot Stability Fixes

## Problem Summary
The Discord bot was randomly disconnecting from servers and stopping to respond to messages due to several critical issues:

1. **No Error Handling**: Events could crash the bot without proper try-catch blocks
2. **No Reconnection Logic**: Bot would stay disconnected after network issues
3. **No Heartbeat/Keepalive**: Connection would timeout due to inactivity
4. **Poor Voice Connection Management**: Voice connections weren't properly tracked
5. **No Health Monitoring**: No way to detect or recover from unhealthy states

## Fixes Implemented

### 1. **Enhanced Error Handling**
- Added try-catch blocks around all Discord event handlers
- Prevents individual event errors from crashing the entire bot
- Logs errors for debugging without stopping the bot

### 2. **Automatic Reconnection System**
- **Reconnection Logic**: Automatically attempts to reconnect when disconnected
- **Exponential Backoff**: Starts with 5-second delays, increases up to 30 seconds
- **Max Attempts**: Limits reconnection attempts to prevent infinite loops
- **State Tracking**: Tracks reconnection attempts and prevents duplicate attempts

### 3. **Heartbeat/Keepalive Mechanism**
- **30-Second Heartbeat**: Sends ping every 30 seconds to keep connection alive
- **Connection Health**: Monitors connection state and logs health status
- **Automatic Cleanup**: Stops heartbeat when disconnecting

### 4. **Improved Voice Connection Management**
- **State Waiting**: Waits for voice connections to be ready before audio playback
- **Better Error Handling**: Voice connection errors don't crash the bot
- **Connection Tracking**: Properly tracks and cleans up voice connections
- **Timeout Handling**: Graceful handling of connection timeouts

### 5. **Connection Health Monitoring**
- **Health Check Endpoint**: `/api/health` now includes Discord bot status
- **Status Endpoint**: Enhanced `/api/discord/status/:userId` with detailed health info
- **Health Methods**: `isHealthy()` and `getConnectionStatus()` methods
- **Emergency Restart**: `/api/discord/restart` endpoint for manual recovery

### 6. **Enhanced Logging**
- **Connection Events**: Logs all connection state changes
- **Reconnection Attempts**: Tracks and logs reconnection progress
- **Voice State Changes**: Detailed logging of voice connection states
- **Error Context**: Better error messages with context

## New Features

### Health Monitoring
```typescript
// Check if bot is healthy
const isHealthy = globalDiscordService.isHealthy();

// Get detailed status
const status = globalDiscordService.getConnectionStatus();
// Returns: { isReady, isReconnecting, reconnectAttempts, voiceConnections, guilds }
```

### Emergency Recovery
```bash
# Restart unhealthy Discord bot
POST /api/discord/restart
```

### Enhanced Health Check
```bash
# Get system health including Discord status
GET /api/health
# Returns Discord connection status and health metrics
```

## Configuration

### Environment Variables
Ensure these are properly set:
```env
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
```

### Reconnection Settings
```typescript
private maxReconnectAttempts: number = 5;    // Max reconnection attempts
private reconnectDelay: number = 5000;       // Initial delay (5 seconds)
private heartbeatInterval: number = 30000;   // Heartbeat frequency (30 seconds)
```

## Monitoring and Debugging

### Health Check Endpoint
Monitor bot health at: `GET /api/health`

### Discord Status Endpoint
Get detailed Discord status at: `GET /api/discord/status/:userId`

### Log Monitoring
Look for these log messages:
- ✅ `Discord bot ready! Logged in as...`
- ✅ `Discord heartbeat sent - connection healthy`
- ⚠️ `Discord bot disconnected: ...`
- 🔄 `Attempting to reconnect Discord bot (attempt X/5)...`
- ✅ `Discord bot reconnected successfully`

### Common Issues and Solutions

#### Bot Not Responding
1. Check `/api/health` endpoint
2. Look for disconnection logs
3. Use `/api/discord/restart` if unhealthy
4. Check environment variables

#### Voice Connection Issues
1. Verify bot has voice permissions
2. Check voice connection state logs
3. Ensure audio URLs are accessible
4. Monitor voice state change logs

#### Reconnection Loops
1. Check Discord API rate limits
2. Verify bot token is valid
3. Check network connectivity
4. Review reconnection attempt logs

## Testing

### Manual Testing
1. **Connection Test**: Monitor logs during startup
2. **Disconnection Test**: Temporarily disconnect network
3. **Reconnection Test**: Verify automatic reconnection
4. **Voice Test**: Join voice channel and test audio
5. **Health Test**: Check health endpoints

### Automated Testing
```bash
# Test health endpoint
curl http://localhost:5000/api/health

# Test Discord status
curl http://localhost:5000/api/discord/status/your_user_id

# Test emergency restart (if unhealthy)
curl -X POST http://localhost:5000/api/discord/restart
```

## Deployment Notes

### Render/Railway Deployment
- Ensure all environment variables are set
- Monitor logs for connection issues
- Use health endpoints for monitoring
- Consider setting up alerts for disconnections

### Local Development
- Use `npm run dev` for development
- Monitor console logs for connection events
- Test reconnection by temporarily disconnecting network

## Future Improvements

1. **WebSocket Monitoring**: Add WebSocket connection health checks
2. **Metrics Dashboard**: Create a dashboard for bot health metrics
3. **Alert System**: Set up alerts for bot disconnections
4. **Graceful Shutdown**: Improve shutdown handling
5. **Connection Pooling**: Consider connection pooling for high load

## Files Modified

- `server/discord.ts` - Main Discord service with stability fixes
- `server/routes.ts` - Added health monitoring endpoints
- `DISCORD_STABILITY_FIXES.md` - This documentation

## Impact

These fixes should significantly improve Discord bot stability by:
- ✅ Preventing random disconnections
- ✅ Automatically recovering from network issues
- ✅ Maintaining persistent connections
- ✅ Providing better monitoring and debugging
- ✅ Enabling emergency recovery procedures

The bot should now be much more reliable and self-healing when issues occur.
