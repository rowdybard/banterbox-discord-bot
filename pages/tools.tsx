import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { ExportData } from "@/components/dashboard/export-data";
import { BackupSystem } from "@/components/dashboard/backup-system";
import { LoadingState } from "@/components/ui/loading-state";

export default function Tools() {
  const { user } = useAuth();
  const [location] = useLocation();
  const userId = user?.id || "demo-user";

  if (!user) {
    return (
      <LoadingState isLoading={true}>
        <div>Loading...</div>
      </LoadingState>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-dark/95 backdrop-blur-lg border-b border-gray-800 sticky top-0 z-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Title */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center">
                  <i className="fas fa-tools text-white text-lg"></i>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    Tools
                  </h1>
                  <p className="text-xs text-gray-400">Advanced utilities and data management</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Export Data */}
          <ExportData userId={userId} />
          
          {/* Backup System */}
          <BackupSystem userId={userId} />
        </div>
      </main>
    </div>
  );
}