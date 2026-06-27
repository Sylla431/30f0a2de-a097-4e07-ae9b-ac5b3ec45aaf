import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Typography';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/with-timeout';
import { useAppStore } from '@/store/useAppStore';
import { OrientationMessageList } from '@/components/orientation-message-list';
import type { ChatMessage, ChatSource } from '@/store/types';

const TIMEOUT_MS = 15000;

const FALLBACK_ERROR_MESSAGE =
  "Désolée, je n'ai pas pu traiter votre demande. Le service rencontre un problème temporaire. Veuillez réessayer dans quelques instants.";

const TIMEOUT_ERROR_MESSAGE =
  "Aminata met trop de temps à répondre (délai de 15 secondes dépassé). Vérifiez votre connexion internet et réessayez.";

export default function OrientationScreen() {
  const insets = useSafeAreaInsets();
  const addMessage = useAppStore((s) => s.addMessage);
  const clearMessages = useAppStore((s) => s.clearMessages);
  const profile = useAppStore((s) => s.profile);
  const hasMessages = useAppStore((s) => s.messages.length > 0);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const query = (overrideText ?? input).trim();
      if (!query || loading) return;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: query,
        timestamp: new Date().toISOString(),
      };

      const historyForApi = useAppStore.getState().messages.slice(-4).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      addMessage(userMessage);
      setInput('');
      setLoading(true);

      try {
        const { data, error } = await withTimeout(
          supabase.functions.invoke('agent-orientation', {
            body: {
              message: query,
              history: historyForApi,
              commune: profile?.commune ?? null,
            },
          }),
          TIMEOUT_MS,
          TIMEOUT_ERROR_MESSAGE
        );

        if (error) {
          addMessage({
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: FALLBACK_ERROR_MESSAGE,
            timestamp: new Date().toISOString(),
            generatedBy: 'local',
          });
          return;
        }

        if (data?.error) {
          addMessage({
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: `Service Aminata : ${data.error}`,
            timestamp: new Date().toISOString(),
            generatedBy: 'local',
          });
          return;
        }

        const sources: ChatSource[] = Array.isArray(data.sources) ? data.sources : [];
        const isAi = data.generatedBy === 'ai';

        addMessage({
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.reply ?? FALLBACK_ERROR_MESSAGE,
          sources: sources.length > 0 ? sources : undefined,
          model: data.model ?? undefined,
          generatedBy: isAi ? 'ai' : 'local',
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        const errorMsg =
          e instanceof Error && e.message.includes('15 secondes')
            ? e.message
            : FALLBACK_ERROR_MESSAGE;
        addMessage({
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: errorMsg,
          timestamp: new Date().toISOString(),
          generatedBy: 'local',
        });
      } finally {
        setLoading(false);
      }
    },
    [input, loading, addMessage, profile?.commune]
  );

  const handleSuggestionPress = useCallback(
    (suggestion: string) => {
      handleSend(suggestion);
    },
    [handleSend]
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerAvatarRow}>
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarLetter}>A</Text>
            </View>
            <View style={styles.headerTextBlock}>
              <Text style={styles.headerTitle}>Aminata</Text>
              <Text style={styles.headerSubtitle}>
                Experte inondations · Afrique de l{"'"}Ouest & Sahel
              </Text>
            </View>
          </View>
          {hasMessages && (
            <TouchableOpacity onPress={clearMessages} activeOpacity={0.7} style={styles.clearBtn}>
              <Ionicons name="trash-outline" size={18} color={Colors.white} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <OrientationMessageList loading={loading} onSuggestionPress={handleSuggestionPress} />

      <View style={styles.disclaimerBar}>
        <Ionicons name="warning-outline" size={13} color={Colors.alert} />
        <Text style={styles.disclaimerBarText}>
          En urgence : onglet SOS ou protection civile (18)
        </Text>
      </View>

      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}>
        <TextInput
          style={styles.textInput}
          placeholder="Posez votre question à Aminata..."
          placeholderTextColor={Colors.textTertiary}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          onSubmitEditing={() => handleSend()}
          returnKeyType="send"
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
          onPress={() => handleSend()}
          disabled={!input.trim() || loading}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Ionicons name="send" size={18} color={Colors.white} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  headerAvatarLetter: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.white,
  },
  headerTextBlock: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.white,
  },
  headerSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  disclaimerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: '#FEF8F0',
    borderTopWidth: 1,
    borderTopColor: '#FDE8D0',
  },
  disclaimerBarText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: Colors.alert,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 2px 8px rgba(31, 121, 235, 0.3)',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.textTertiary,
    boxShadow: 'none',
  },
});
