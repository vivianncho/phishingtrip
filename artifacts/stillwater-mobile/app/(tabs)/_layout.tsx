import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';

// IMPORTANT: iOS 26 uses NativeTabs for native tabs with liquid glass support.
// NativeTabs intentionally does NOT use custom design tokens — liquid glass
// is a system-level appearance provided by iOS and cannot be overridden.
// Custom brand colors are applied only on the ClassicTabLayout path (older iOS / Android / web).
function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'checkmark.shield', selected: 'checkmark.shield.fill' }}
        />
        <NativeTabs.Trigger.Label>Check</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="directory">
        <NativeTabs.Trigger.Icon sf={{ default: 'book.closed', selected: 'book.closed.fill' }} />
        <NativeTabs.Trigger.Label>Directory</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="trips">
        <NativeTabs.Trigger.Icon sf={{ default: 'suitcase', selected: 'suitcase.fill' }} />
        <NativeTabs.Trigger.Label>My Trips</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const isDark = true;
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarLabelStyle: { fontFamily: 'DMSans_500Medium', fontSize: 11 },
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Check',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name="checkmark.shield" tintColor={color} size={24} />
            ) : (
              <Feather
                name="shield"
                size={22}
                color={focused ? colors.primary : colors.mutedForeground}
              />
            ),
        }}
      />
      <Tabs.Screen name="directory" options={{ title: 'Directory', tabBarIcon: ({ color }) => <Feather name="book-open" size={22} color={typeof color === 'string' ? color : colors.mutedForeground} /> }} />
      <Tabs.Screen name="trips" options={{ title: 'My Trips', tabBarIcon: ({ color }) => <Feather name="briefcase" size={22} color={typeof color === 'string' ? color : colors.mutedForeground} /> }} />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
