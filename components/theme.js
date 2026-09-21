import { StyleSheet, Platform } from 'react-native';

// Shared visual tokens, so the panels and cards of the app stay consistent
// instead of each one re-inventing its own border / radius / elevation.
export const colors = {
  accent: '#10b981',       // emerald-500 : selection, "on" states
  warning: '#fbbf24',      // amber-400 : non blocking alerts (low storage...)
  hairline: 'rgba(255,255,255,0.08)',
  panel: 'rgba(63,63,70,0.8)', // zinc-700/80
};

// Dimmed backdrop behind a modal. The config pop-ins had none at all, so the
// screen behind stayed at full brightness and the dialog looked unanchored.
export const modalBackdrop = {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: 'rgba(0,0,0,0.7)',
};

// Modal surface, shared by the processing / animation / info pop-ins
export const modalCard = {
  backgroundColor: '#18181b', // zinc-900
  borderRadius: 20,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: 'rgba(255,255,255,0.12)',
  ...Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.45,
      shadowRadius: 20,
    },
    android: { elevation: 12 },
    default: {},
  }),
};

// Floating toolbar over a live camera feed or an image. Dark and translucent
// rather than mid-grey, so the controls stay legible over a bright spectrum
// without competing with it.
export const toolbarSurface = {
  backgroundColor: 'rgba(0,0,0,0.6)',
  borderRadius: 16,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: 'rgba(255,255,255,0.12)',
};

// Small round button for a modal header (close) or an inline control
export const roundButton = {
  width: 30,
  height: 30,
  borderRadius: 15,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255,255,255,0.10)',
};

// Non blocking warning inside a panel : tinted surface rather than a red banner,
// so it reads as a nudge and not as a failure.
export const warningChip = {
  backgroundColor: 'rgba(251,191,36,0.12)',
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: 'rgba(251,191,36,0.35)',
  borderRadius: 10,
};

// The two home screen cards share a width so their edges line up : enough for
// the status row and its connect button, with the 380 wide sun graph centred
// inside the card below.
export const PANEL_WIDTH = 460;

// Raised panel (home screen cards) : soft border + depth over the background image
export const panelStyle = {
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: 'rgba(255,255,255,0.12)',
  ...Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    android: { elevation: 4 },
    default: {},
  }),
};
