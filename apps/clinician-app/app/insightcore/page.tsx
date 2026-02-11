// apps/clinician-app/app/insightcore/page.tsx
'use client';

import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { AlertTriangle, Activity, Brain, ListTodo, Bell, CheckCircle } from 'lucide-react';

import { useAlertsFeed } from './services/hooks/useAlertsFeed';
import { useRiskFeed } from './services/hooks/useRiskFeed';
import { useInsightsFeed } from './services/hooks/useInsightsFeed';

import { startLiveBridge } from './services/live-bridge';

// Live visualization components
import { LivePulse } from '@/components/insightcore/LivePulse';
import { SeverityBar } from '@/components/insightcore/SeverityBar';
import { ConfidenceBar } from '@/components/insightcore/ConfidenceBar';
import { RiskGradient } from '@/components/insightcore/RiskGradient';

export default function InsightCorePage() {
  const alerts = useAlertsFeed();
  const risks = useRiskFeed();
  const insights = useInsightsFeed();

  useEffect(() => {
    startLiveBridge(); // connects engines → EventBus → UI
  }, []);

  const maxRisk = risks.length
    ? Math.max(...risks.map(r => r.score || 0))
    : 0;

  const avgConfidence = insights.length
    ? insights.reduce((a, b) => a + (b.confidence || 0), 0) / insights.length
    : 0;

  const dominantSeverity =
    alerts.some(a => a.severity === 'critical')
      ? 'critical'
      : alerts.some(a => a.severity === 'high')
      ? 'high'
      : alerts.some(a => a.severity === 'moderate')
      ? 'moderate'
      : 'low';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">InsightCore — Clinical Intelligence</h1>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <LivePulse active={true} />
          Live systems connected
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

        {/* Active Risks */}
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-5 h-5" /> Active Risks
              </div>
              <LivePulse active={true} />
            </div>

            <div className="text-sm text-muted-foreground">
              {risks.length} active risk signals
            </div>

            <RiskGradient score={maxRisk} />

            <div className="text-xs text-muted-foreground italic">
              Risk Engine live stream
            </div>
          </CardContent>
        </Card>

        {/* Patient Deterioration */}
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <Activity className="w-5 h-5" /> Patient Deterioration
              </div>
              <LivePulse active={true} />
            </div>

            <div className="text-sm text-muted-foreground">
              {risks.filter(r => r.score > 0.7).length} high-risk patients
            </div>

            <RiskGradient score={0.8} />

            <div className="text-xs text-muted-foreground italic">
              Inference Engine stream
            </div>
          </CardContent>
        </Card>

        {/* AI Insights Feed */}
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <Brain className="w-5 h-5" /> AI Insights Feed
              </div>
              <LivePulse active={true} />
            </div>

            <div className="text-sm text-muted-foreground">
              {insights.length} generated insights
            </div>

            <ConfidenceBar value={avgConfidence} />

            <div className="text-xs text-muted-foreground italic">
              Insight Generator stream
            </div>
          </CardContent>
        </Card>

        {/* Priority Queue */}
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <ListTodo className="w-5 h-5" /> Priority Queue
              </div>
              <LivePulse active={true} />
            </div>

            <div className="text-sm text-muted-foreground">
              {alerts.filter(a => a.severity === 'critical').length} critical cases
            </div>

            <SeverityBar severity={dominantSeverity as any} />

            <div className="text-xs text-muted-foreground italic">
              EventBus routing layer
            </div>
          </CardContent>
        </Card>

        {/* Alerts Summary */}
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <Bell className="w-5 h-5" /> Alerts Summary
              </div>
              <LivePulse active={true} />
            </div>

            <div className="text-sm text-muted-foreground">
              {alerts.length} active alerts
            </div>

            <SeverityBar severity={dominantSeverity as any} />

            <div className="text-xs text-muted-foreground italic">
              Alert Engine stream
            </div>
          </CardContent>
        </Card>

        {/* Recommended Actions */}
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle className="w-5 h-5" /> Recommended Actions
              </div>
              <LivePulse active={true} />
            </div>

            <div className="text-sm text-muted-foreground">
              {insights.filter(i => i.confidence > 0.8).length} high-confidence actions
            </div>

            <ConfidenceBar value={avgConfidence} />

            <div className="text-xs text-muted-foreground italic">
              Decision Intelligence Engine
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
