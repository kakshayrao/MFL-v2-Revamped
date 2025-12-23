'use client';

import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';

interface ActivatePresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset: any;
  leagueId: string;
  onActivated?: () => void;
}

export default function ActivatePresetDialog({
  open,
  onOpenChange,
  preset,
  leagueId,
  onActivated,
}: ActivatePresetDialogProps) {
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalPoints, setTotalPoints] = useState('50');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleActivate = async () => {
    if (!startDate || !endDate) {
      toast.error('Please provide start and end dates');
      return;
    }

    if (new Date(startDate) >= new Date(endDate)) {
      toast.error('End date must be after start date');
      return;
    }

    if (!totalPoints || Number(totalPoints) <= 0) {
      toast.error('Please provide valid points');
      return;
    }

    setLoading(true);
    try {
      let docUrl = null;

      // Upload document if provided
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('league_id', leagueId);

        const uploadRes = await fetch('/api/upload/challenge-document', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || 'Document upload failed');
        }

        docUrl = uploadData.data.url;
      }

      const res = await fetch(`/api/leagues/${leagueId}/challenges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: preset.id,
          startDate,
          endDate,
          totalPoints: Number(totalPoints),
          docUrl,
          isCustom: false,
          status: 'active',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to activate preset');
      }

      toast.success('Preset challenge activated!');
      onOpenChange(false);
      setStartDate('');
      setEndDate('');
      setTotalPoints('50');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onActivated?.();
    } catch (err) {
      console.error('Error activating preset:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to activate preset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Activate Preset Challenge</DialogTitle>
          <DialogDescription>
            Activate the "{preset?.name}" challenge for your league
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Challenge: {preset?.name}</p>
            <p className="text-xs text-muted-foreground mb-3">
              Type: {preset?.challenge_type || 'individual'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="total-points">Total Points for this League *</Label>
            <Input
              id="total-points"
              type="number"
              min="1"
              value={totalPoints}
              onChange={(e) => setTotalPoints(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Points to award participants when they complete this challenge
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date *</Label>
            <Input
              id="start-date"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="end-date">End Date *</Label>
            <Input
              id="end-date"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-file">Challenge Rules Document (Optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="doc-file"
                type="file"
                ref={fileInputRef}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="flex-1"
              />
              {selectedFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Upload rules as PDF, Word document, or image (max 10MB)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleActivate} disabled={loading}>
            {loading ? 'Activating...' : 'Activate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
