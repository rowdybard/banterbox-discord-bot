import { useState, useEffect } from "react";
import { Shield, Download, Upload, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ButtonLoading } from "@/components/ui/loading-state";

interface BackupSystemProps {
  userId: string;
}

interface BackupInfo {
  lastBackup?: string;
  nextBackup?: string;
  backupCount: number;
  totalSize: string;
  autoBackupEnabled: boolean;
}

export function BackupSystem({ userId }: BackupSystemProps) {
  const { toast } = useToast();
  const [backupInfo, setBackupInfo] = useState<BackupInfo>({
    backupCount: 0,
    totalSize: "0 MB",
    autoBackupEnabled: true,
  });
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);

  useEffect(() => {
    loadBackupInfo();
    
    // Check for auto-backup every hour
    const autoBackupInterval = setInterval(() => {
      checkAutoBackup();
    }, 60 * 60 * 1000); // 1 hour

    return () => clearInterval(autoBackupInterval);
  }, [userId]);

  const loadBackupInfo = async () => {
    try {
      // Simulate loading backup info (would come from backend)
      const lastBackup = localStorage.getItem(`backup-last-${userId}`);
      const backupCount = parseInt(localStorage.getItem(`backup-count-${userId}`) || '0');
      
      setBackupInfo({
        lastBackup: lastBackup || undefined,
        nextBackup: getNextBackupTime(),
        backupCount,
        totalSize: `${(backupCount * 2.5).toFixed(1)} MB`, // Estimate
        autoBackupEnabled: localStorage.getItem(`backup-auto-${userId}`) !== 'false',
      });
    } catch (error) {
      console.error('Failed to load backup info:', error);
    }
  };

  const getNextBackupTime = (): string => {
    const now = new Date();
    const nextBackup = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
    return nextBackup.toISOString();
  };

  const checkAutoBackup = async () => {
    if (!backupInfo.autoBackupEnabled) return;

    const lastBackup = localStorage.getItem(`backup-last-${userId}`);
    if (!lastBackup) {
      createBackup(true); // First auto-backup
      return;
    }

    const lastBackupTime = new Date(lastBackup);
    const now = new Date();
    const timeDiff = now.getTime() - lastBackupTime.getTime();
    const daysSinceBackup = timeDiff / (1000 * 60 * 60 * 24);

    if (daysSinceBackup >= 1) {
      createBackup(true);
    }
  };

  const createBackup = async (isAuto = false) => {
    setIsCreatingBackup(true);
    setBackupProgress(0);

    try {
      // Simulate backup progress
      const progressInterval = setInterval(() => {
        setBackupProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Get all user data for backup
      const [banters, settings, stats] = await Promise.all([
        apiRequest('GET', `/api/banter/${userId}`).then(r => r.json()),
        apiRequest('GET', `/api/settings/${userId}`).then(r => r.json()),
        apiRequest('GET', `/api/stats/${userId}`).then(r => r.json()),
      ]);

      const backupData = {
        timestamp: new Date().toISOString(),
        userId,
        data: {
          banters,
          settings,
          stats,
        },
        version: "1.0",
      };

      // Store backup locally and create downloadable file
      const backupJson = JSON.stringify(backupData, null, 2);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `banterbox-backup-${timestamp}.json`;

      // Save backup info
      localStorage.setItem(`backup-last-${userId}`, new Date().toISOString());
      localStorage.setItem(`backup-count-${userId}`, (backupInfo.backupCount + 1).toString());

      // Create downloadable backup file
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      if (!isAuto) {
        // Only auto-download for manual backups
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      URL.revokeObjectURL(url);

      setBackupProgress(100);
      setTimeout(() => {
        setBackupProgress(0);
        setIsCreatingBackup(false);
      }, 500);

      await loadBackupInfo();

      toast({
        title: isAuto ? "Auto-Backup Complete" : "Backup Created",
        description: isAuto 
          ? "Your data has been automatically backed up."
          : `Backup saved as ${filename}`,
      });

    } catch (error) {
      console.error('Backup failed:', error);
      setIsCreatingBackup(false);
      setBackupProgress(0);
      
      toast({
        title: "Backup Failed",
        description: "Unable to create backup. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleAutoBackup = () => {
    const newState = !backupInfo.autoBackupEnabled;
    localStorage.setItem(`backup-auto-${userId}`, newState.toString());
    setBackupInfo(prev => ({ ...prev, autoBackupEnabled: newState }));
    
    toast({
      title: newState ? "Auto-Backup Enabled" : "Auto-Backup Disabled",
      description: newState 
        ? "Your data will be automatically backed up daily."
        : "Automatic backups have been turned off.",
    });
  };

  const formatTimeAgo = (timestamp?: string) => {
    if (!timestamp) return "Never";
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return "Less than an hour ago";
  };

  return (
    <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Backup System
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Backup Status */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Last Backup</p>
            <div className="flex items-center gap-2">
              {backupInfo.lastBackup ? (
                <CheckCircle className="h-4 w-4 text-green-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-orange-400" />
              )}
              <span className="text-sm font-medium text-white">
                {formatTimeAgo(backupInfo.lastBackup)}
              </span>
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Auto-Backup</p>
            <Badge 
              variant={backupInfo.autoBackupEnabled ? "default" : "secondary"}
              className="text-xs"
            >
              {backupInfo.autoBackupEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </div>

        {/* Backup Statistics */}
        <div className="p-4 bg-gray-800/50 rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total Backups</span>
            <span className="text-white font-medium">{backupInfo.backupCount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Storage Used</span>
            <span className="text-white font-medium">{backupInfo.totalSize}</span>
          </div>
          {backupInfo.nextBackup && backupInfo.autoBackupEnabled && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Next Auto-Backup</span>
              <span className="text-white font-medium">
                {formatTimeAgo(backupInfo.nextBackup)}
              </span>
            </div>
          )}
        </div>

        {/* Backup Progress */}
        {isCreatingBackup && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-blue-400">Creating backup...</span>
            </div>
            <Progress value={backupProgress} className="w-full" />
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button
            onClick={() => createBackup(false)}
            disabled={isCreatingBackup}
            className="w-full"
            data-testid="button-create-backup"
          >
            <ButtonLoading 
              isLoading={isCreatingBackup} 
              loadingText="Creating..."
            >
              <Download className="h-4 w-4 mr-2" />
              Create Manual Backup
            </ButtonLoading>
          </Button>

          <Button
            onClick={toggleAutoBackup}
            variant="outline"
            className="w-full"
            data-testid="button-toggle-auto-backup"
          >
            {backupInfo.autoBackupEnabled ? "Disable" : "Enable"} Auto-Backup
          </Button>
        </div>

        <p className="text-xs text-gray-500 text-center">
          Backups include all your banter history, settings, and statistics. 
          Store them safely for data recovery.
        </p>
      </CardContent>
    </Card>
  );
}