import { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Typography';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/with-timeout';
import { useAppStore } from '@/store/useAppStore';
import type { ChatMessage, ChatSource } from '@/store/types';

const TIMEOUT_MS = 15000;

const FALLBACK_ERROR_MESSAGE =
  "Désolée, je n'ai pas pu traiter votre demande. Le service rencontre un problème temporaire. Veuillez réessayer dans quelques instants.";

const TIMEOUT_ERROR_MESSAGE =
  "Aminata met trop de temps à répondre (délai de 15 secondes dépassé). Vérifiez votre connexion internet et réessayez.";

const SUGGESTIONS = [
  "Quels sont les signes avant-coureurs d'une inondation ?",
  "Où se réfugier quand il pleut fort dans mon quartier ?",
  "Que faire après une inondation ?",
  "Quelles zones sont les plus à risque ?",
];

export default function OrientationScreen() {
  const insets = useSafeAreaInsets();
  const messages = useAppStore((s) => s.messages);
  const addMessage = useAppStore((s) => s.addMessage);
  const clearMessages = useAppStore((s) => s.clearMessages);
  const profile = useAppStore((s) => s.profile);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const showWelcome = useMemo(() => messages.length === 0, [messages.length]);

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

      // Build history BEFORE addMessage to avoid stale Zustand read
      const historyForApi = messages.slice(-4).map((m) => ({
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
    [input, loading, addMessage, profile, messages]
  );

  const handleSuggestionPress = useCallback(
    (suggestion: string) => {
      handleSend(suggestion);
    },
    [handleSend]
  );

  const renderSourceChip = useCallback((source: ChatSource) => {
    const categoryColors: Record<string, string> = {
      signe_precurseur: '#1560c0',
      zone_risque: '#C05515',
      pratique: '#15803D',
      savoir: '#6B21A8',
    };
    const chipColor = categoryColors[source.categorie ?? ''] ?? Colors.primary;

    return (
      <TouchableOpacity
        key={source.id}
        style={styles.sourceChip}
        activeOpacity={0.7}
        onPress={() => {
          const details = [
            source.porteur ? `Source : ${source.porteur}` : null,
            source.categorie ? `Catégorie : ${source.categorie}` : null,
            source.source_type ? `Type : ${source.source_type}` : null,
            source.quartier ? `Quartier : ${source.quartier}` : null,
          ]
            .filter(Boolean)
            .join('\n');
          Alert.alert(source.titre, details || 'Savoir communautaire documenté');
        }}
      >
        <View style={[styles.sourceChipDot, { backgroundColor: chipColor }]} />
        <Text style={styles.sourceChipTitle} numberOfLines={1}>
          {source.titre}
        </Text>
      </TouchableOpacity>
    );
  }, []);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isUser = item.role === 'user';

      return (
        <View style={[styles.messageBubbleContainer, isUser && styles.messageBubbleContainerUser]}>
          {!isUser && (
            <View style={styles.avatarAminata}>
              <Text style={styles.avatarText}>A</Text>
            </View>
          )}
          <View style={styles.messageContentWrapper}>
            <View
              style={[
                styles.messageBubble,
                isUser ? styles.messageBubbleUser : styles.messageBubbleAssistant,
              ]}
            >
              <Text
                style={[styles.messageText, isUser && styles.messageTextUser]}
                selectable
              >
                {item.content}
              </Text>

              {/* Badge row for assistant messages */}
              {!isUser && (
                <View style={styles.badgeRow}>
                  {item.generatedBy && (
                    <View
                      style={[
                        styles.generatedByBadge,
                        item.generatedBy === 'ai' ? styles.badgeAI : styles.badgeLocal,
                      ]}
                    >
                      <Ionicons
                        name={item.generatedBy === 'ai' ? 'sparkles' : 'library-outline'}
                        size={10}
                        color={item.generatedBy === 'ai' ? '#7C3AED' : Colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.generatedByText,
                          item.generatedBy === 'ai' ? styles.badgeTextAI : styles.badgeTextLocal,
                        ]}
                      >
                        {item.generatedBy === 'ai' ? 'Gemini' : 'Local'}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Retrieval-only mode banner */}
            {!isUser && item.model === 'retrieval-only' && (
              <View style={styles.retrievalBanner}>
                <Ionicons name="information-circle-outline" size={13} color="#92400E" />
                <Text style={styles.retrievalBannerText}>
                  Mode recherche seule — IA non disponible
                </Text>
              </View>
            )}

            {/* Sources section */}
            {!isUser && item.sources && item.sources.length > 0 && (
              <View style={styles.sourcesContainer}>
                <View style={styles.sourcesHeader}>
                  <Ionicons name="book-outline" size={12} color={Colors.textSecondary} />
                  <Text style={styles.sourcesLabel}>Sources</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flexGrow: 0 }}
                  contentContainerStyle={styles.sourcesScrollContent}
                >
                  {item.sources.map((src) => renderSourceChip(src))}
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      );
    },
    [renderSourceChip]
  );

  const renderTypingIndicator = useCallback(() => {
    if (!loading) return null;
    return (
      <View style={styles.typingContainer}>
        <View style={styles.avatarAminata}>
          <Text style={styles.avatarText}>A</Text>
        </View>
        <View style={styles.typingBubble}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.typingText}>Aminata réfléchit...</Text>
        </View>
      </View>
    );
  }, [loading]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
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
          {messages.length > 0 && (
            <TouchableOpacity onPress={clearMessages} activeOpacity={0.7} style={styles.clearBtn}>
              <Ionicons name="trash-outline" size={18} color={Colors.white} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={renderTypingIndicator}
        ListEmptyComponent={
          showWelcome ? (
            <View style={styles.welcomeContainer}>
              <View style={styles.welcomeAvatarLarge}>
                <Text style={styles.welcomeAvatarLetter}>A</Text>
              </View>
              <Text style={styles.welcomeTitle}>Bonjour, je suis Aminata</Text>
              <Text style={styles.welcomeText}>
                Votre guide bienveillante sur les inondations en Afrique de l{"'"}Ouest.
                Je combine savoirs communautaires locaux et intelligence artificielle pour
                vous orienter.
              </Text>
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsLabel}>Essayez une question :</Text>
                {SUGGESTIONS.map((suggestion) => (
                  <TouchableOpacity
                    key={suggestion}
                    style={styles.suggestionChip}
                    onPress={() => handleSuggestionPress(suggestion)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={14} color={Colors.primary} />
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null
        }
      />

      {/* Disclaimer bar */}
      <View style={styles.disclaimerBar}>
        <Ionicons name="warning-outline" size={13} color={Colors.alert} />
        <Text style={styles.disclaimerBarText}>
          En urgence : onglet SOS ou protection civile (18)
        </Text>
      </View>

      {/* Input area */}
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
  // Header
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
  // Messages
  messageList: {
    padding: 16,
    gap: 16,
    flexGrow: 1,
  },
  messageBubbleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    maxWidth: '88%',
  },
  messageBubbleContainerUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
    maxWidth: '80%',
  },
  messageContentWrapper: {
    flex: 1,
    gap: 6,
  },
  avatarAminata: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: Colors.white,
  },
  messageBubble: {
    borderRadius: 18,
    padding: 12,
    paddingHorizontal: 14,
  },
  messageBubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleAssistant: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 4,
    boxShadow: '0 2px 8px rgba(15, 25, 51, 0.06)',
    ...Platform.select({ android: { elevation: 2 } as object, default: {} }),
  },
  messageText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 21,
  },
  messageTextUser: {
    color: Colors.white,
  },
  // Badges
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  generatedByBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeAI: {
    backgroundColor: '#EDE9FE',
  },
  badgeLocal: {
    backgroundColor: '#F0F3F9',
  },
  generatedByText: {
    fontFamily: Fonts.semiBold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  badgeTextAI: {
    color: '#7C3AED',
  },
  badgeTextLocal: {
    color: Colors.textSecondary,
  },
  // Retrieval-only banner
  retrievalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    borderCurve: 'continuous',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retrievalBannerText: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: '#92400E',
    lineHeight: 15,
    flex: 1,
  },
  // Sources section
  sourcesContainer: {
    gap: 6,
  },
  sourcesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 2,
  },
  sourcesLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sourcesScrollContent: {
    gap: 8,
    paddingRight: 4,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderCurve: 'continuous',
    maxWidth: 200,
    boxShadow: '0 1px 3px rgba(15, 25, 51, 0.04)',
    ...Platform.select({ android: { elevation: 1 } as object, default: {} }),
  },
  sourceChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sourceChipTitle: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: Colors.text,
    flex: 1,
  },
  // Typing indicator
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    boxShadow: '0 2px 8px rgba(15, 25, 51, 0.06)',
    ...Platform.select({ android: { elevation: 1 } as object, default: {} }),
  },
  typingText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  // Welcome
  welcomeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  welcomeAvatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 6px 20px rgba(31, 121, 235, 0.3)',
  },
  welcomeAvatarLetter: {
    fontFamily: Fonts.bold,
    fontSize: 32,
    color: Colors.white,
  },
  welcomeTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 20,
    color: Colors.text,
    textAlign: 'center',
    marginTop: 4,
  },
  welcomeText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 320,
  },
  suggestionsContainer: {
    marginTop: 20,
    gap: 8,
    width: '100%',
    maxWidth: 340,
  },
  suggestionsLabel: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderCurve: 'continuous',
    boxShadow: '0 1px 4px rgba(15, 25, 51, 0.04)',
  },
  suggestionText: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.text,
    flex: 1,
  },
  // Disclaimer bar
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
  // Input
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
