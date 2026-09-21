import { useContext, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

import AppContext from './AppContext';
import PressableScale from './PressableScale';
import { hubErrorKey, hubLogin } from '../utils/SpectroSolHub';

const inputClass = "bg-zinc-800 border border-zinc-600 text-white rounded-xl px-3";

/**
 * SpectroSolHub sign-in. The SUNSCAN trades the password for an API token and
 * keeps only the token. An account with two-factor authentication answers
 * totp_required first: the code field then shows up and the same request is
 * sent again with it.
 *
 * @param {function} onLoggedIn called with the account state once connected
 */
export default function HubLoginForm({ onLoggedIn }) {
  const { t } = useTranslation();
  const { apiURL, setHubAccount } = useContext(AppContext);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState(null);

  const submit = async () => {
    if (busy) {
      return;
    }
    if (!username.trim() || !password) {
      setErrorKey('missing_credentials');
      return;
    }
    setBusy(true);
    setErrorKey(null);
    const result = await hubLogin(apiURL, { username: username.trim(), password, totpCode: needsTotp ? totpCode : '' });
    setBusy(false);
    if (result.ok) {
      setPassword('');
      setTotpCode('');
      setNeedsTotp(false);
      setHubAccount(result.account);
      onLoggedIn?.(result.account);
      return;
    }
    console.warn('hub login failed', result.error, result.detail);
    if (result.error === 'totp_required') {
      // Not an error from the user's point of view: just the next step.
      setNeedsTotp(true);
      return;
    }
    setErrorKey(result.error);
  };

  return (
    <View style={{ gap: 8 }}>
      <TextInput
        className={inputClass}
        style={styles.input}
        value={username}
        onChangeText={setUsername}
        placeholder={t('common:hubUsername')}
        placeholderTextColor="#71717a"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="username"
        editable={!busy && !needsTotp}
      />
      <TextInput
        className={inputClass}
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder={t('common:hubPassword')}
        placeholderTextColor="#71717a"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
        editable={!busy && !needsTotp}
        returnKeyType={needsTotp ? 'next' : 'done'}
        onSubmitEditing={needsTotp ? undefined : submit}
      />
      {needsTotp && <View style={{ gap: 4 }}>
        <Text className="text-zinc-400" style={{ fontSize: 11 }}>{t('common:hubTotpHint')}</Text>
        <TextInput
          className={inputClass}
          style={[styles.input, { letterSpacing: 4 }]}
          value={totpCode}
          onChangeText={(v) => setTotpCode(v.replace(/\D/g, '').slice(0, 6))}
          placeholder="123456"
          placeholderTextColor="#71717a"
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoFocus
          editable={!busy}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      </View>}

      {errorKey !== null && (
        <View className="flex flex-row items-center" style={{ gap: 6 }}>
          <Ionicons name="warning-outline" size={14} color="#f59e0b" />
          <Text className="text-amber-500 flex-1" style={{ fontSize: 11 }}>{t(hubErrorKey(errorKey))}</Text>
        </View>
      )}

      <PressableScale
        className={`${busy ? 'bg-emerald-800' : 'bg-emerald-600'} rounded-xl h-10 flex flex-row justify-center items-center`}
        style={{ gap: 8 }}
        disabled={busy || (needsTotp && totpCode.length !== 6)}
        onPress={submit}
      >
        {busy ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="log-in-outline" size={18} color="#fff" />}
        <Text className="text-white font-bold" style={{ fontSize: 13 }}>{t('common:hubLogin')}</Text>
      </PressableScale>

      {needsTotp && !busy && (
        <PressableScale onPress={() => { setNeedsTotp(false); setTotpCode(''); setErrorKey(null); }} className="py-1">
          <Text className="text-zinc-400 text-center" style={{ fontSize: 11 }}>{t('common:hubChangeAccount')}</Text>
        </PressableScale>
      )}

      <Text className="text-zinc-500" style={{ fontSize: 10 }}>{t('common:hubPasswordNotKept')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    paddingVertical: 7,
  },
});
