import express from 'express';
import { verifyDiscordRequest } from './verify.js';
import { handleCommand, InteractionResponseType } from './slash.js';

const router = express.Router();

/**
 * Discord Interactions endpoint
 * Handles slash commands and other Discord interactions
 */
router.post('/interactions', 
  express.json({ 
    verify: (req: any, res, buf) => {
      // Store raw body for signature verification
      req.rawBody = buf;
    }
  }), 
  async (req, res) => {
    const publicKey = process.env.DISCORD_PUBLIC_KEY;
    
    if (!publicKey) {
      console.error('DISCORD_PUBLIC_KEY environment variable not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Verify Discord signature
    const isValid = verifyDiscordRequest(req, publicKey);
    if (!isValid) {
      console.error('Invalid Discord signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { type, data } = req.body;

    try {
      console.log('Discord interaction received:', { type, data: data?.name });
      
      // Handle PING (Discord verification)
      if (type === 1) {
        console.log('Discord PING received, responding with PONG');
        return res.json({ type: InteractionResponseType.PONG });
      }

      // Handle APPLICATION_COMMAND (slash commands)
      if (type === 2) {
        console.log('Discord slash command received:', data?.name);
        const response = await handleCommand(req.body);
        console.log('Discord command response:', response);
        return res.json(response);
      }

      // Handle other interaction types if needed
      console.log('Unhandled interaction type:', type);
      return res.status(400).json({ error: 'Unhandled interaction type' });

    } catch (error) {
      console.error('Discord interaction error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
