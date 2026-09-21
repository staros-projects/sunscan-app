import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import AppContext from '../components/AppContext';
import ActionMenu from '../components/ActionMenu';
import AnchoredTip from '../components/AnchoredTip';
import { useOverlay } from '../components/OverlayHost';
import { useHubReachability } from './SpectroSolHub';

/**
 * Action column of a detail screen (scan, stack, animation): the SpectroSolHub
 * cloud button and the "more" button whose menu holds the secondary actions.
 * One round button per action no longer fit the height of a phone in
 * landscape.
 *
 * The SUNSCAN uploads, not the phone: without internet on its side the cloud
 * button is greyed out, and a tap explains why instead of opening a form that
 * could not send anything.
 *
 * @param {object} options
 * @param {Array}  options.items      ActionMenu items, falsy ones skipped
 * @param {object} options.hubUpload  useHubUpload state of the screen, omitted
 *   on a screen without the cloud button (animations, for now)
 * @param {object} options.hubInfo    last successful upload, or null
 * @param {function} options.onHubOpen opens the upload panel
 * @param {object} options.navigation
 * @returns {{moreButtonRef, openMenu, hubButtonRef, onHubPress, hubIcon: {name, color}}}
 */
export default function useDetailActions({ items, hubUpload, hubInfo, onHubOpen, navigation }) {
  const { t } = useTranslation();
  const myContext = useContext(AppContext);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const hubReach = useHubReachability();
  const hubStatus = hubUpload?.status;
  const hubOffline = hubReach.reachable === false && hubStatus !== 'processing';
  // Position of the cloud button while its explanation is shown, else null
  const [hubTipAnchor, setHubTipAnchor] = useState(null);
  const closeHubTip = useCallback(() => setHubTipAnchor(null), []);
  const hubButtonRef = useRef(null);
  useFocusEffect(
    useCallback(() => {
      if (hubUpload && myContext.sunscanIsConnected && myContext.hubSupported) {
        hubReach.check();
      }
      return () => setHubTipAnchor(null);
    }, [hubReach.check, myContext.sunscanIsConnected, myContext.hubSupported, !!hubUpload]));
  useEffect(() => {
    if (!hubOffline) setHubTipAnchor(null);
  }, [hubOffline]);
  const onHubPress = () => {
    if (!hubOffline) {
      onHubOpen();
      return;
    }
    hubButtonRef.current?.measureInWindow((x, y, w, h) => {
      if (typeof x === 'number' && w > 0) setHubTipAnchor({ x, y, width: w, height: h });
    });
  };

  const moreButtonRef = useRef(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const closeMenu = useCallback(() => setMenuAnchor(null), []);
  const openMenu = () => {
    // Where the column sits, should the button fail to measure: the menu
    // still opens, next to the right edge.
    const fallback = { x: width - 66 - insets.right, y: height / 2 - 21, width: 42, height: 42 };
    const button = moreButtonRef.current;
    if (!button?.measureInWindow) {
      setMenuAnchor(fallback);
      return;
    }
    button.measureInWindow((x, y, w, h) => {
      setMenuAnchor(typeof x === 'number' && w > 0 ? { x, y, width: w, height: h } : fallback);
    });
  };

  const visibleItems = items.filter(Boolean);
  // The OverlayHost holds one layer, and each useOverlay clears it on the
  // way out: the menu and the cloud explanation share a single call.
  const overlay = useMemo(() => {
    if (menuAnchor) {
      return <ActionMenu anchor={menuAnchor} items={visibleItems} onClose={closeMenu} />;
    }
    if (hubTipAnchor) {
      return <AnchoredTip
        anchor={hubTipAnchor}
        text={hubReach.reason === 'hotspot' ? t('common:hubTipHotspot') : t('common:hubTipUnreachable')}
        action={hubReach.reason === 'hotspot' ? { label: t('common:wifiConnectHome'), onPress: () => navigation.navigate('Settings') } : null}
        onClose={closeHubTip} />;
    }
    return null;
    // The items are rebuilt on every render; the menu only needs the list as
    // it was when it opened.
  }, [menuAnchor, closeMenu, hubTipAnchor, closeHubTip, hubReach.reason]);
  useOverlay(overlay);
  // The menu is frozen at opening: it must not outlive the connection most of
  // its actions need.
  useEffect(() => {
    setMenuAnchor(null);
  }, [myContext.sunscanIsConnected]);

  let hubIcon;
  if (hubOffline) hubIcon = { name: 'cloud-offline-outline', color: '#52525b' };
  else if (hubStatus === 'processing') hubIcon = { name: 'cloud-upload', color: '#10b981' };
  else if (hubStatus === 'failed') hubIcon = { name: 'cloud-offline-outline', color: '#f59e0b' };
  else if (hubInfo) hubIcon = { name: 'cloud-done-outline', color: '#10b981' };
  else hubIcon = { name: 'cloud-upload-outline', color: '#fff' };

  return { moreButtonRef, openMenu, hubButtonRef, onHubPress, hubIcon };
}
