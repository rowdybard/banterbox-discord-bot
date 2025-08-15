import { useState } from "react";
import { Download, FileText, Calendar, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ButtonLoading } from "@/components/ui/loading-state";
import type { BanterItem } from "@shared/schema";

interface ExportDataProps {
  userId: string;
}

export function ExportData({ userId }: ExportDataProps) {
  const { toast } = useToast();
  const [exportType, setExportType] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [isExporting, setIsExporting] = useState(false);

  const exportToCsv = async () => {
    setIsExporting(true);
    
    try {
      // Get data based on filters
      const params = new URLSearchParams({
        userId,
        query: "",
        eventType: exportType === "all" ? "all" : exportType,
      });

      const banters = await apiRequest('GET', `/api/banter/search?${params.toString()}`);
      const data = await banters.json() as BanterItem[];

      // Filter by date range if specified
      let filteredData = data;
      if (dateRange !== "all") {
        const now = new Date();
        let cutoffDate = new Date();

        switch (dateRange) {
          case "week":
            cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "month":
            cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case "quarter":
            cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        }

        filteredData = data.filter(banter => 
          new Date(banter.createdAt!) >= cutoffDate
        );
      }

      // Convert to CSV
      const csvContent = convertBantersToCSV(filteredData);
      
      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      
      link.setAttribute("href", url);
      link.setAttribute("download", `banterbox-export-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Complete",
        description: `Successfully exported ${filteredData.length} banter items to CSV.`,
      });

    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: "Unable to export data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const convertBantersToCSV = (banters: BanterItem[]): string => {
    const headers = [
      'ID',
      'Created Date',
      'Event Type',
      'Original Message',
      'Banter Text',
      'Username',
      'Is Played',
      'Audio URL'
    ];

    const rows = banters.map(banter => [
      banter.id,
      new Date(banter.createdAt!).toISOString(),
      banter.eventType,
      banter.originalMessage || '',
      `"${banter.banterText.replace(/"/g, '""')}"`, // Escape quotes in CSV
      (banter.eventData as any)?.username || '',
      banter.isPlayed ? 'Yes' : 'No',
      banter.audioUrl || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    return csvContent;
  };

  return (
    <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Export Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Export Type Filter */}
        <div className="space-y-2">
          <Label>Export Type</Label>
          <Select value={exportType} onValueChange={setExportType}>
            <SelectTrigger data-testid="select-export-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Banters</SelectItem>
              <SelectItem value="chat">Chat Messages Only</SelectItem>
              <SelectItem value="subscription">Subscriptions Only</SelectItem>
              <SelectItem value="donation">Donations Only</SelectItem>
              <SelectItem value="raid">Raids Only</SelectItem>
              <SelectItem value="follow">Follows Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date Range Filter */}
        <div className="space-y-2">
          <Label>Date Range</Label>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger data-testid="select-date-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="quarter">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Export Statistics */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-800/50 rounded-lg">
          <div className="text-center">
            <Calendar className="h-4 w-4 mx-auto mb-1 text-blue-400" />
            <p className="text-xs text-gray-400">Period</p>
            <p className="text-sm font-medium text-white">
              {dateRange === "all" ? "All Time" : 
               dateRange === "week" ? "7 Days" :
               dateRange === "month" ? "30 Days" : "90 Days"}
            </p>
          </div>
          <div className="text-center">
            <Users className="h-4 w-4 mx-auto mb-1 text-green-400" />
            <p className="text-xs text-gray-400">Type</p>
            <p className="text-sm font-medium text-white">
              {exportType === "all" ? "All Events" : exportType.charAt(0).toUpperCase() + exportType.slice(1)}
            </p>
          </div>
          <div className="text-center">
            <FileText className="h-4 w-4 mx-auto mb-1 text-purple-400" />
            <p className="text-xs text-gray-400">Format</p>
            <p className="text-sm font-medium text-white">CSV</p>
          </div>
        </div>

        {/* Export Button */}
        <Button
          onClick={exportToCsv}
          disabled={isExporting}
          className="w-full"
          data-testid="button-export-csv"
        >
          <ButtonLoading 
            isLoading={isExporting} 
            loadingText="Exporting..."
          >
            <Download className="h-4 w-4 mr-2" />
            Export to CSV
          </ButtonLoading>
        </Button>

        <p className="text-xs text-gray-500 text-center">
          Export includes banter text, original messages, timestamps, and event details
        </p>
      </CardContent>
    </Card>
  );
}