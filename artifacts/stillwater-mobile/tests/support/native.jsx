// Only native/platform rendering is substituted. Screen, provider, fish,
// generated API helpers, and React Query all execute their production code.
import React, { useEffect } from 'react';

export const events = {
  app: new Set(),
  focus: new Set(),
  routes: [],
  announcements: [],
  reads: [],
  writes: [],
  calls: [],
  storage: new Map(),
};
export function reset() {
  for (const key of ['routes', 'announcements', 'reads', 'writes', 'calls']) events[key].length = 0;
  events.storage.clear();
}
export function appState(state) {
  for (const listener of events.app) listener(state);
}
export function blur() {
  for (const cleanup of events.focus) cleanup();
}
function route(method, destination) {
  events.routes.push(destination === undefined ? { method } : { method, destination });
  blur();
}
export const router = {
  push: destination => route('push', destination),
  navigate: destination => route('navigate', destination),
  back: () => route('back'),
};
export function useFocusEffect(callback) {
  useEffect(() => {
    const cleanup = callback();
    events.focus.add(cleanup);
    return () => { events.focus.delete(cleanup); cleanup?.(); };
  }, [callback]);
}
export const useLocalSearchParams = () => ({ id: 'delta' });
export const AppState = {
  addEventListener: (_, callback) => {
    events.app.add(callback);
    return { remove: () => events.app.delete(callback) };
  },
};
export const storage = {
  async getItem(key) { events.reads.push(key); return events.storage.get(key) ?? null; },
  async setItem(key, value) { events.writes.push([key, value]); events.storage.set(key, value); },
};
export const Platform = { OS: 'ios' };
export const Linking = { openURL: async url => { events.calls.push(url); } };
export const AccessibilityInfo = {
  announceForAccessibility: text => events.announcements.push(text),
  isReduceMotionEnabled: async () => true,
  addEventListener: () => ({ remove() {} }),
};
export const selectionAsync = async () => {};
export const StyleSheet = { create: value => value };
export const Easing = { sin: () => {}, inOut: value => value };
export const Animated = {
  Value: class {
    setValue() {}
    interpolate() { return 0; }
  },
  View: 'AnimatedView',
};
export const View = 'View', Text = 'Text', TextInput = 'TextInput', Pressable = 'Pressable', ScrollView = 'ScrollView', Image = 'Image';
export function Modal({ visible, children }) { return visible ? <View>{children}</View> : null; }
export const Ionicons = 'Ionicons';
export const Svg = 'Svg', Circle = 'Circle', Defs = 'Defs', Ellipse = 'Ellipse', G = 'G',
  LinearGradient = 'LinearGradient', Path = 'Path', Stop = 'Stop', SvgXml = 'SvgXml';
export const s = {};
export const Copy = Text, Page = View, Providers = 'Providers', Source = 'Source', WebLink = 'WebLink';
export function Busy({ text }) { return <Text>{text}</Text>; }
export function ErrorCard({ text }) { return <Text>{text}</Text>; }
export function Button({ title, ...props }) { return <Pressable {...props}><Text>{title}</Text></Pressable>; }
export function Contact({ contact, onSelect }) {
  return <Button title="Use this number" testID={`contact-${contact.id}`} onPress={onSelect} />;
}
export const dateText = value => value;
export const useColors = () => ({});
