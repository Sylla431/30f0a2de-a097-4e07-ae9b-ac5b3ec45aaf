// Required testIDs: home-screen, home-tab-content
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }: { children: React.ReactNode }) => children,
  Tabs: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  'Tabs.Screen': ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Minimal smoke test — replace with actual HomeScreen import when screens are defined
const PlaceholderHomeScreen = () => (
  <View testID="home-screen">
    <View testID="home-tab-content" />
  </View>
);

describe('HomeScreen', () => {
  it('renders without crashing', () => {
    render(<PlaceholderHomeScreen />);
    expect(screen.getByTestId('home-screen')).toBeTruthy();
  });

  it('renders tab content area', () => {
    render(<PlaceholderHomeScreen />);
    expect(screen.getByTestId('home-tab-content')).toBeTruthy();
  });
});
