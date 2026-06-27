import { memo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Typography';
import { useAppStore } from '@/store/useAppStore';
import type { ChatMessage, ChatSource } from '@/store/types';

const SUGGESTIONS = [
  "Quels sont les signes avant-coureurs d'une inondation ?",
  "Où se réfugier quand il pleut fort dans mon quartier ?",
  "Que faire après une inondation ?",
  "Quelles zones sont les plus à risque ?",
];

interface OrientationMessageListProps {
  loading: boolean;
  onSuggestionPress: (suggestion: string) => void;
}

function SourceChip({ source }: { source: ChatSource }) {
  const categoryColors: Record<string, string> = {
    signe_precurseur: '#1560c0',
    zone_risque: '#C05515',
    pratique: '#15803D',
    savoir: '#6B21A8',
  };
  const chipColor = categoryColors[source.categorie ?? ''] ?? Colors.primary;

  return (
    <TouchableOpacity
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
}

const MessageBubble = memo(function MessageBubble({ item }: { item: ChatMessage }) {
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
          <Text style={[styles.messageText, isUser && styles.messageTextUser]} selectable>
            {item.content}
          </Text>

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

        {!isUser && item.model === 'retrieval-only' && (
          <View style={styles.retrievalBanner}>
            <Ionicons name="information-circle-outline" size={13} color="#92400E" />
            <Text style={styles.retrievalBannerText}>Mode recherche seule — IA non disponible</Text>
          </View>
        )}

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
              {item.sources.map((src) => (
                <SourceChip key={src.id} source={src} />
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
});

function WelcomePanel({ onSuggestionPress }: { onSuggestionPress: (s: string) => void }) {
  return (
    <View style={styles.welcomeContainer}>
      <View style={styles.welcomeAvatarLarge}>
        <Text style={styles.welcomeAvatarLetter}>A</Text>
      </View>
      <Text style={styles.welcomeTitle}>Bonjour, je suis Aminata</Text>
      <Text style={styles.welcomeText}>
        Votre guide bienveillante sur les inondations en Afrique de l{"'"}Ouest. Je combine savoirs
        communautaires locaux et intelligence artificielle pour vous orienter.
      </Text>
      <View style={styles.suggestionsContainer}>
        <Text style={styles.suggestionsLabel}>Essayez une question :</Text>
        {SUGGESTIONS.map((suggestion) => (
          <TouchableOpacity
            key={suggestion}
            style={styles.suggestionChip}
            onPress={() => onSuggestionPress(suggestion)}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={Colors.primary} />
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function TypingIndicator() {
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
}

export const OrientationMessageList = memo(function OrientationMessageList({
  loading,
  onSuggestionPress,
}: OrientationMessageListProps) {
  const messages = useAppStore((s) => s.messages);
  const listRef = useRef<FlatList>(null);
  const showWelcome = messages.length === 0;

  const scrollToEnd = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToEnd();
    }
  }, [messages.length, loading, scrollToEnd]);

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => <MessageBubble item={item} />,
    []
  );

  return (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.messageList}
      showsVerticalScrollIndicator={false}
      onContentSizeChange={scrollToEnd}
      ListFooterComponent={loading ? <TypingIndicator /> : null}
      ListEmptyComponent={showWelcome ? <WelcomePanel onSuggestionPress={onSuggestionPress} /> : null}
    />
  );
});

const styles = StyleSheet.create({
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  messageBubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleAssistant: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    boxShadow: '0 2px 8px rgba(15, 25, 51, 0.06)',
    ...Platform.select({ android: { elevation: 2 } as object, default: {} }),
  },
  messageText: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
  },
  messageTextUser: {
    color: Colors.white,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  generatedByBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeAI: {
    backgroundColor: '#F3E8FF',
  },
  badgeLocal: {
    backgroundColor: Colors.borderLight,
  },
  generatedByText: {
    fontFamily: Fonts.medium,
    fontSize: 10,
  },
  badgeTextAI: {
    color: '#7C3AED',
  },
  badgeTextLocal: {
    color: Colors.textSecondary,
  },
  retrievalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retrievalBannerText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: '#92400E',
    flex: 1,
  },
  sourcesContainer: {
    gap: 6,
  },
  sourcesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sourcesLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sourcesScrollContent: {
    gap: 8,
    paddingRight: 8,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    maxWidth: 200,
  },
  sourceChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sourceChipTitle: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.text,
    flex: 1,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 4,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
  },
  typingText: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 8,
    gap: 12,
  },
  welcomeAvatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  welcomeAvatarLetter: {
    fontFamily: Fonts.bold,
    fontSize: 32,
    color: Colors.white,
  },
  welcomeTitle: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    color: Colors.text,
    textAlign: 'center',
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
    width: '100%',
    gap: 8,
    marginTop: 8,
  },
  suggestionsLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  suggestionText: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: Colors.text,
    flex: 1,
    lineHeight: 18,
  },
});
