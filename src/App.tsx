/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Shell } from './components/Shell';
import { apiRequest } from './lib/api';
import { AuthProvider, useAuth } from './lib/auth-context';
import { AssistantPage } from './pages/AssistantPage';
import { CampaignStudioPage } from './pages/CampaignStudioPage';
import { CompetitorIntelligencePage } from './pages/CompetitorIntelligencePage';
import { CustomerIntelligencePage } from './pages/CustomerIntelligencePage';
import { DashboardPage } from './pages/DashboardPage';
import { KnowledgeHubPage } from './pages/KnowledgeHubPage';
import { MarketIntelligencePage } from './pages/MarketIntelligencePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { RegionalOpportunityPage } from './pages/RegionalOpportunityPage';
import { ReportGeneratorPage } from './pages/ReportGeneratorPage';
import { SettingsPage } from './pages/SettingsPage';
import { UserManagementPage } from './pages/UserManagementPage';
import type { NavModuleId } from './types';

function PaperPulseAppContent() {
  const { profile } = useAuth();
  const [activeModule, setActiveModule] = useState<NavModuleId>('dashboard');
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (!profile) return;
    apiRequest<{ notifications: Array<{ isRead: boolean }> }>('/api/notifications')
      .then((res) => setUnreadNotifications(res.notifications.filter((n) => !n.isRead).length))
      .catch(() => {});
  }, [profile]);

  return (
    <Shell
      activeModule={activeModule}
      onNavigate={setActiveModule}
      unreadNotifications={unreadNotifications}
    >
      {activeModule === 'dashboard' && <DashboardPage onNavigate={setActiveModule} />}
      {activeModule === 'market' && <MarketIntelligencePage onNavigate={setActiveModule} />}
      {activeModule === 'customers' && <CustomerIntelligencePage />}
      {activeModule === 'competitors' && <CompetitorIntelligencePage />}
      {activeModule === 'regional' && <RegionalOpportunityPage />}
      {activeModule === 'campaigns' && <CampaignStudioPage />}
      {activeModule === 'reports' && <ReportGeneratorPage />}
      {activeModule === 'knowledge' && <KnowledgeHubPage />}
      {activeModule === 'assistant' && <AssistantPage onNavigate={setActiveModule} />}
      {activeModule === 'notifications' && (
        <NotificationsPage onUnreadChange={setUnreadNotifications} />
      )}
      {activeModule === 'users' && <UserManagementPage />}
      {activeModule === 'settings' && <SettingsPage />}
    </Shell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PaperPulseAppContent />
    </AuthProvider>
  );
}
