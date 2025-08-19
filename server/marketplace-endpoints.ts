import { Express } from 'express';
import { isAuthenticated } from './localAuth';
import { firebaseMarketplaceService } from './firebaseMarketplace';

export function registerMarketplaceEndpoints(app: Express) {
  // Rating endpoints
  app.post("/api/marketplace/:itemType/:itemId/rate", isAuthenticated, async (req: any, res) => {
    try {
      const { itemType, itemId } = req.params;
      const { rating } = req.body;
      const userId = req.user.id;
      
      if (!['voice', 'personality'].includes(itemType)) {
        return res.status(400).json({ message: "Invalid item type" });
      }
      
      if (rating !== 1 && rating !== -1) {
        return res.status(400).json({ message: "Rating must be 1 (upvote) or -1 (downvote)" });
      }
      
      await firebaseMarketplaceService.rateItem(userId, itemType as 'voice' | 'personality', itemId, rating);
      
      res.json({ 
        success: true, 
        message: rating === 1 ? "Upvoted successfully" : "Downvoted successfully" 
      });
    } catch (error) {
      console.error('Error rating item:', error);
      res.status(500).json({ message: "Failed to rate item" });
    }
  });
  
  // Get user's rating for an item
  app.get("/api/marketplace/:itemType/:itemId/rating", isAuthenticated, async (req: any, res) => {
    try {
      const { itemType, itemId } = req.params;
      const userId = req.user.id;
      
      if (!['voice', 'personality'].includes(itemType)) {
        return res.status(400).json({ message: "Invalid item type" });
      }
      
      const rating = await firebaseMarketplaceService.getUserRating(
        userId, 
        itemType as 'voice' | 'personality', 
        itemId
      );
      
      res.json({ rating });
    } catch (error) {
      console.error('Error getting user rating:', error);
      res.status(500).json({ message: "Failed to get rating" });
    }
  });
  
  // Report content
  app.post("/api/marketplace/:itemType/:itemId/report", isAuthenticated, async (req: any, res) => {
    try {
      const { itemType, itemId } = req.params;
      const { reason, description } = req.body;
      const reporterId = req.user.id;
      
      if (!['voice', 'personality'].includes(itemType)) {
        return res.status(400).json({ message: "Invalid item type" });
      }
      
      const validReasons = ['inappropriate', 'offensive', 'spam', 'copyright', 'other'];
      if (!reason || !validReasons.includes(reason)) {
        return res.status(400).json({ 
          message: "Invalid reason. Must be one of: " + validReasons.join(', ') 
        });
      }
      
      const report = await firebaseMarketplaceService.reportContent({
        reporterId,
        itemType: itemType as 'voice' | 'personality',
        itemId,
        reason,
        description,
        status: 'pending'
      });
      
      res.json({ 
        success: true, 
        message: "Content reported successfully. We'll review it shortly.",
        reportId: report.id
      });
    } catch (error) {
      console.error('Error reporting content:', error);
      res.status(500).json({ message: "Failed to report content" });
    }
  });
  
  // Get user's marketplace items
  app.get("/api/marketplace/my-items", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const items = await firebaseMarketplaceService.getUserMarketplaceItems(userId);
      
      res.json(items);
    } catch (error) {
      console.error('Error getting user marketplace items:', error);
      res.status(500).json({ message: "Failed to get your marketplace items" });
    }
  });
  
  // Admin endpoints
  
  // Get pending moderation items (admin only)
  app.get("/api/admin/marketplace/moderation/pending", isAuthenticated, async (req: any, res) => {
    try {
      // TODO: Add admin role check
      const pendingItems = await firebaseMarketplaceService.getPendingModerationItems();
      
      res.json(pendingItems);
    } catch (error) {
      console.error('Error getting pending moderation items:', error);
      res.status(500).json({ message: "Failed to get pending items" });
    }
  });
  
  // Moderate an item (admin only)
  app.post("/api/admin/marketplace/:itemType/:itemId/moderate", isAuthenticated, async (req: any, res) => {
    try {
      const { itemType, itemId } = req.params;
      const { status, notes } = req.body;
      const moderatorId = req.user.id;
      
      // TODO: Add admin role check
      
      if (!['voice', 'personality'].includes(itemType)) {
        return res.status(400).json({ message: "Invalid item type" });
      }
      
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Status must be 'approved' or 'rejected'" });
      }
      
      await firebaseMarketplaceService.moderateItem(
        itemType as 'voice' | 'personality',
        itemId,
        status as 'approved' | 'rejected',
        moderatorId,
        notes
      );
      
      res.json({ 
        success: true, 
        message: `Item ${status} successfully` 
      });
    } catch (error) {
      console.error('Error moderating item:', error);
      res.status(500).json({ message: "Failed to moderate item" });
    }
  });
  
  // Get content reports (admin only)
  app.get("/api/admin/marketplace/reports", isAuthenticated, async (req: any, res) => {
    try {
      const { status } = req.query;
      
      // TODO: Add admin role check
      
      const reports = await firebaseMarketplaceService.getContentReports(status as string);
      
      res.json(reports);
    } catch (error) {
      console.error('Error getting content reports:', error);
      res.status(500).json({ message: "Failed to get reports" });
    }
  });
  
  // Review a report (admin only)
  app.post("/api/admin/marketplace/reports/:reportId/review", isAuthenticated, async (req: any, res) => {
    try {
      const { reportId } = req.params;
      const { status, notes } = req.body;
      const reviewerId = req.user.id;
      
      // TODO: Add admin role check
      
      if (!['resolved', 'dismissed'].includes(status)) {
        return res.status(400).json({ message: "Status must be 'resolved' or 'dismissed'" });
      }
      
      await firebaseMarketplaceService.reviewReport(
        reportId,
        reviewerId,
        status as 'resolved' | 'dismissed',
        notes
      );
      
      res.json({ 
        success: true, 
        message: `Report ${status} successfully` 
      });
    } catch (error) {
      console.error('Error reviewing report:', error);
      res.status(500).json({ message: "Failed to review report" });
    }
  });
}
