/* ──────────────────────────────────────────────────────────
   HoboSky v0.3.0 — Main App Component
   ────────────────────────────────────────────────────────── */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Redirect, Route } from 'react-router-dom';
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
  searchOutline,
  notificationsOutline,
  personOutline,
  chatbubblesOutline,
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
import MessagesPage, { ChatPage, NewMessagePage } from './pages/Messages';
import FeedsPage, { FeedDetailPage } from './pages/Feeds';
import ListsPage, { ListDetailPage } from './pages/Lists';
import BookmarksPage from './pages/Bookmarks';

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
  const [unreadDMs, setUnreadDMs] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const fetchUnread = useCallback(async () => {
    try {
      const [notifRes, convosRes] = await Promise.allSettled([
        api.getUnreadCount(),
        api.listConvos(undefined, 25),
      ]);

      if (notifRes.status === 'fulfilled') {
        setUnreadCount(notifRes.value.count);
      }
      if (convosRes.status === 'fulfilled') {
        const total = convosRes.value.convos.reduce(
          (sum, c) => sum + c.unreadCount,
          0
        );
        setUnreadDMs(total);
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    pollRef.current = setInterval(fetchUnread, 30000);
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
          <Route exact path="/messages" component={MessagesPage} />
          <Route exact path="/messages/new" component={NewMessagePage} />
          <Route exact path="/messages/:convoId" component={ChatPage} />
          <Route exact path="/feeds" component={FeedsPage} />
          <Route exact path="/feeds/:uri" component={FeedDetailPage} />
          <Route exact path="/lists" component={ListsPage} />
          <Route exact path="/lists/:uri" component={ListDetailPage} />
          <Route exact path="/bookmarks" component={BookmarksPage} />
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

          <IonTabButton tab="messages" href="/messages">
            <IonIcon icon={chatbubblesOutline} />
            <IonLabel>Chat</IonLabel>
            {unreadDMs > 0 && (
              <IonBadge color="danger">
                {unreadDMs > 99 ? '99+' : unreadDMs}
              </IonBadge>
            )}
          </IonTabButton>

          <IonTabButton tab="notifications" href="/notifications">
            <IonIcon icon={notificationsOutline} />
            <IonLabel>Notifs</IonLabel>
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
