import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BackButton from "@/components/BackButton";
import SiblingAppsLinks from "@/components/SiblingAppsLinks";
import StatusCircle from "@/components/StatusCircle";
import {
  MAX_CONTENT_WIDTH,
  PRIVACY_URL,
  SERVER_URL,
  SUPPORT_URL,
  TERMS_URL,
  useTheme,
} from "@/constants/colors";
import {
  openLinkedApp,
  requestNotificationPermission,
} from "@/lib/notifications";
import { useApp } from "@/providers/app";

const POLL_INTERVAL_MS = 60000;
const EVENTS_POLL_MS = 10000;

type NotifState = "checking" | "granted" | "denied" | "undetermined";

type EventItem = {
  title: string;
  body: string;
  time: string;
};

function formatTime(utcString: string): string {
  const date = new Date(utcString + "Z");
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ConnectedScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { checkStatus, disconnect, userId } = useApp();

  const mounted = useRef<boolean>(true);
  const [notifState, setNotifState] = useState<NotifState>("checking");
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    mounted.current = true;
    const interval = setInterval(() => {
      void checkStatus();
    }, POLL_INTERVAL_MS);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [checkStatus]);

  // Check notification permission on mount.
  useEffect(() => {
    void Notifications.getPermissionsAsync().then((settings) => {
      if (!mounted.current) return;
      if (settings.status === "granted") {
        setNotifState("granted");
      } else if (settings.status === "denied") {
        setNotifState("denied");
      } else {
        setNotifState("undetermined");
      }
    });
  }, []);

  // Fetch events every 10 seconds.
  const fetchEvents = useCallback(async (): Promise<void> => {
    if (!userId) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/events/${userId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; events: EventItem[] };
      if (data.ok && Array.isArray(data.events)) {
        setEvents(data.events);
      }
    } catch (err) {
      console.log("[events] fetch failed", err);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void fetchEvents();
    const interval = setInterval(() => {
      void fetchEvents();
    }, EVENTS_POLL_MS);
    return () => clearInterval(interval);
  }, [userId, fetchEvents]);

  const handleEnableNotifications = async (): Promise<void> => {
    const result = await requestNotificationPermission();
    if (!mounted.current) return;
    setNotifState(result === "granted" ? "granted" : "denied");
  };

  const confirmDisconnect = (): void => {
    Alert.alert(
      "Отключить?",
      "Вы перестанете получать push-уведомления с веб-приложений.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Отключить",
          style: "destructive",
          onPress: () => {
            void disconnect();
          },
        },
      ],
      { cancelable: true }
    );
  };

  const renderEventCards = (): React.ReactNode => {
    if (events.length === 0) {
      return (
        <View style={styles.eventsEmpty}>
          <Text style={[styles.eventsEmptyText, { color: c.textFaint }]}>
            Событий пока нет. Они появятся при получении данных.
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.eventsList}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {events.map((event, index) => (
          <View
            key={`${event.time}-${index}`}
            style={[
              styles.eventCard,
              { backgroundColor: c.eventCard },
              index < events.length - 1 && styles.eventCardGap,
            ]}
          >
            <View style={styles.eventCardContent}>
              <Text
                style={[styles.eventTitle, { color: c.text }]}
                numberOfLines={1}
              >
                {event.title}
              </Text>
              <Text
                style={[styles.eventBody, { color: c.textSecondary }]}
                numberOfLines={2}
              >
                {event.body}
              </Text>
            </View>
            <Text style={[styles.eventTime, { color: c.textFaint }]}>
              {formatTime(event.time)}
            </Text>
          </View>
        ))}
      </ScrollView>
    );
  };

  return (
    <View style={[styles.outermost, { backgroundColor: c.background }]}>
      <ScrollView
        style={styles.constrained}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        <BackButton onPress={() => void disconnect()} />

        {/* Notification permission banner */}
        {notifState === "undetermined" && (
          <View style={[styles.notifBanner, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.notifText, { color: c.textSecondary }]}>
              Включите уведомления, чтобы не пропускать сообщения
            </Text>
            <Pressable
              onPress={() => {
                void handleEnableNotifications();
              }}
              style={({ pressed }) => [
                styles.notifButton,
                { backgroundColor: c.blue, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.notifButtonText, { color: c.onAccent }]}>
                Включить
              </Text>
            </Pressable>
          </View>
        )}

        {notifState === "denied" && (
          <View style={[styles.notifBanner, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.notifSubText, { color: c.textFaint }]}>
              Уведомления отключены. Включить можно в Настройках устройства.
            </Text>
            <Pressable
              onPress={() => {
                void Linking.openSettings();
              }}
              style={({ pressed }) => [
                styles.notifSettingsButton,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={[styles.notifSettingsText, { color: c.blue }]}>
                Открыть настройки
              </Text>
            </Pressable>
          </View>
        )}

        <View style={styles.body}>
          <StatusCircle status="active" />

          <Text style={[styles.statusText, { color: c.green }]}>
            Подключено
          </Text>

          <Text style={[styles.subText, { color: c.textSecondary }]}>
            Уведомления с веб-приложений приходят автоматически
          </Text>

          {/* ── Events feed ── */}
          <View style={styles.eventsSection}>
            <View style={styles.eventsHeader}>
              <Text style={[styles.eventsHeaderTitle, { color: c.text }]}>
                Последние события
              </Text>
              <Text style={[styles.eventsHeaderCount, { color: c.textSecondary }]}>
                {events.length}
              </Text>
            </View>

            {renderEventCards()}
          </View>

          {/* ── Buttons ── */}
          <View style={styles.buttonArea}>
            <Pressable
              onPress={() => {
                void openLinkedApp(undefined, userId);
              }}
              style={({ pressed }) => [
                styles.openButton,
                { backgroundColor: c.blue, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.openButtonText, { color: c.onAccent }]}>
                Открыть приложение
              </Text>
            </Pressable>

            <View style={{ height: 20 }} />

            {/* Legal links */}
            <View style={styles.legalLinks}>
              <Text
                style={styles.legalLink}
                onPress={() => {
                  void Linking.openURL(PRIVACY_URL);
                }}
              >
                Privacy Policy
              </Text>
              <Text style={styles.legalSep}>|</Text>
              <Text
                style={styles.legalLink}
                onPress={() => {
                  void Linking.openURL(TERMS_URL);
                }}
              >
                Terms of Service
              </Text>
              <Text style={styles.legalSep}>|</Text>
              <Text
                style={styles.legalLink}
                onPress={() => {
                  void Linking.openURL(SUPPORT_URL);
                }}
              >
                Support
              </Text>
            </View>

            <View style={{ height: 20 }} />

            <Pressable
              onPress={confirmDisconnect}
              style={styles.disconnectButton}
            >
              <Text style={[styles.disconnectText, { color: c.textSecondary }]}>
                Отключить
              </Text>
            </Pressable>
          </View>
        </View>

        <SiblingAppsLinks />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outermost: {
    flex: 1,
    alignItems: "center",
  },
  constrained: {
    width: "100%",
    maxWidth: MAX_CONTENT_WIDTH,
    flex: 1,
  },
  // Notification banner
  notifBanner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginTop: 8,
  },
  notifText: {
    fontSize: 17,
    lineHeight: 24,
  },
  notifButton: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  notifButtonText: {
    fontSize: 18,
    fontWeight: "700",
  },
  notifSubText: {
    fontSize: 15,
    lineHeight: 22,
  },
  notifSettingsButton: {
    alignSelf: "flex-start",
  },
  notifSettingsText: {
    fontSize: 16,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  body: {
    alignItems: "center",
    paddingTop: 24,
  },
  statusText: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 18,
  },
  subText: {
    fontSize: 15,
    textAlign: "center",
    marginTop: 6,
  },
  // Events feed
  eventsSection: {
    width: "100%",
    marginTop: 22,
  },
  eventsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 12,
  },
  eventsHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  eventsHeaderCount: {
    fontSize: 14,
  },
  eventsList: {
    maxHeight: 300,
  },
  eventsEmpty: {
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  eventsEmptyText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  eventCard: {
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  eventCardGap: {
    marginBottom: 1,
  },
  eventCardContent: {
    flex: 1,
    marginRight: 12,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  eventBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  eventTime: {
    fontSize: 13,
    marginTop: 2,
  },
  // Buttons
  buttonArea: {
    marginTop: 22,
    alignItems: "center",
    width: "100%",
  },
  openButton: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  openButtonText: {
    fontSize: 18,
    fontWeight: "700",
  },
  legalLinks: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  legalLink: {
    fontSize: 14,
    color: "#888",
    textDecorationLine: "underline",
  },
  legalSep: {
    fontSize: 14,
    color: "#888",
  },
  disconnectButton: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  disconnectText: {
    fontSize: 16,
  },
});
