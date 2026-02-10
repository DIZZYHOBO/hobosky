/* ──────────────────────────────────────────────────────────
   HoboSky v0.2.0 — Main App Component
   ────────────────────────────────────────────────────────── */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Redirect, Route, useLocation } from 'react-router-dom';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonBadge,
  IonSpinner,
  setupIonicReact,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import {
  homeOutline,
  home,
  searchOutline,
  search,
  notificationsOutline,
  notifications,
  personOutline,
  person,
} from 'ionicons/icons';

/* Ionic core CSS */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* HoboSky theme */
import './theme/variables.css';
import './styles/global.css';

/* Context */
import { AuthProvider, useAuth } from './context/AuthContext';

/* Pages */
import LoginPage from './pages/Login';
import HomePage from './pages/Home';
import SearchPage from './pages/Search';
import NotificationsPage from './pages/Notifications';
import ProfilePage from './pages/Profile';
import PostThreadPage from './pages/PostThread';
import FollowsListPage from './pages/FollowsList';
import MutedBlockedPage from './pages/MutedBlocked';

/* Services */
import { api } from './services/api';

setupIonicReact({
  mode: 'ios',
});

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#0a0e1a',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div
          style={{
            fontFamily: 'Outfit',
            fontWeight: 800,
            fontSize: 32,
            background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          HoboSky
        </div>
        <IonSpinner name="crescent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const [unreadCount, setUnreadCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const fetchUnread = useCallback(async () => {
    try {
      const res = await api.getUnreadCount();
      setUnreadCount(res.count);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    pollRef.current = setInterval(fetchUnread, 30000); // Poll every 30s
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchUnread]);

  return (
    <IonReactRouter>
      <IonTabs>
        <IonRouterOutlet>
          <Route exact path="/home" component={HomePage} />
          <Route exact path="/search" component={SearchPage} />
          <Route exact path="/notifications" component={NotificationsPage} />
          <Route exact path="/profile/:actor" component={ProfilePage} />
          <Route exact path="/profile" component={ProfilePage} />
          <Route exact path="/thread/:uri" component={PostThreadPage} />
          <Route exact path="/follows/:actor" component={FollowsListPage} />
          <Route exact path="/moderation" component={MutedBlockedPage} />
          <Route exact path="/">
            <Redirect to="/home" />
          </Route>
        </IonRouterOutlet>

        <IonTabBar slot="bottom">
          <IonTabButton tab="home" href="/home">
            <IonIcon icon={homeOutline} />
            <IonLabel>Home</IonLabel>
          </IonTabButton>

          <IonTabButton tab="search" href="/search">
            <IonIcon icon={searchOutline} />
            <IonLabel>Search</IonLabel>
          </IonTabButton>

          <IonTabButton tab="notifications" href="/notifications">
            <IonIcon icon={notificationsOutline} />
            <IonLabel>Notifications</IonLabel>
            {unreadCount > 0 && (
              <IonBadge color="danger">
                {unreadCount > 99 ? '99+' : unreadCount}
              </IonBadge>
            )}
          </IonTabButton>

          <IonTabButton tab="profile" href="/profile">
            <IonIcon icon={personOutline} />
            <IonLabel>Profile</IonLabel>
          </IonTabButton>
        </IonTabBar>
      </IonTabs>
    </IonReactRouter>
  );
}

export default function App() {
  return (
    <IonApp>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </IonApp>
  );
}
