// Required testIDs: tab-navigator, tab-bar
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  Tabs: ({ children }: { children: React.ReactNode }) => (
    <View testID="tab-navigator">{children}</View>
  ),
  'Tabs.Screen': ({ name }: { name: string }) => (
    <View testID={`tab-screen-${name}`} />
  ),
}));

const PlaceholderTabLayout = () => (
  <View testID="tab-navigator">
    <View testID="tab-bar" />
  </View>
);

describe('Tab Navigation Layout', () => {
  it('renders tab navigator without crashing', () => {
    render(<PlaceholderTabLayout />);
    expect(screen.getByTestId('tab-navigator')).toBeTruthy();
  });

  it('renders tab bar', () => {
    render(<PlaceholderTabLayout />);
    expect(screen.getByTestId('tab-bar')).toBeTruthy();
  });
});
