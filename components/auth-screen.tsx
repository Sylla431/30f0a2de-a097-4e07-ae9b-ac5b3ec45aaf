import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Typography';
import { supabase } from '@/lib/supabase';

interface AuthScreenProps {
  subtitle?: string;
}

type Feedback = {
  type: 'error' | 'success' | 'info';
  message: string;
};

export function AuthScreen({
  subtitle = 'Connectez-vous pour accéder à la vigilance inondations',
}: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const clearFeedback = useCallback(() => setFeedback(null), []);

  const handleAuth = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      setFeedback({
        type: 'error',
        message: 'Veuillez remplir tous les champs.',
      });
      return;
    }

    try {
      setLoading(true);
      setFeedback(null);

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          if (error.message.toLowerCase().includes('email not confirmed')) {
            setFeedback({
              type: 'info',
              message:
                'Votre adresse email n\'est pas encore confirmée. Consultez votre boîte mail et cliquez sur le lien de validation, puis reconnectez-vous.',
            });
            return;
          }
          throw error;
        }
      } else {
        const emailRedirectTo =
          Platform.OS === 'web' && typeof window !== 'undefined'
            ? `${window.location.origin}/login`
            : undefined;

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: emailRedirectTo ? { emailRedirectTo } : undefined,
        });
        if (error) throw error;

        if (data.user?.identities?.length === 0) {
          setFeedback({
            type: 'info',
            message:
              'Un compte existe déjà avec cette adresse email. Connectez-vous ou utilisez « Mot de passe oublié ».',
          });
          setIsLogin(true);
          setPassword('');
          return;
        }

        if (!data.session) {
          setFeedback({
            type: 'info',
            message: `Un email de confirmation a été envoyé à ${email.trim()}. Ouvrez-le et cliquez sur le lien pour activer votre compte, puis connectez-vous.`,
          });
          setIsLogin(true);
          setPassword('');
          return;
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur d'authentification";
      setFeedback({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  }, [email, password, isLogin]);

  const toggleMode = useCallback(() => {
    setIsLogin((prev) => !prev);
    setFeedback(null);
    setPassword('');
  }, []);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.icon}>
            <Ionicons name="water" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Inondalert</Text>
          <Text style={styles.subtitle}>
            {isLogin ? subtitle : 'Créez votre compte citoyen'}
          </Text>
        </View>

        {feedback ? (
          <View
            style={[
              styles.feedback,
              feedback.type === 'error' && styles.feedbackError,
              feedback.type === 'success' && styles.feedbackSuccess,
              feedback.type === 'info' && styles.feedbackInfo,
            ]}
            accessibilityRole="alert"
          >
            <Ionicons
              name={
                feedback.type === 'error'
                  ? 'alert-circle'
                  : feedback.type === 'success'
                    ? 'checkmark-circle'
                    : 'information-circle'
              }
              size={20}
              color={
                feedback.type === 'error'
                  ? Colors.critical
                  : feedback.type === 'success'
                    ? Colors.success
                    : Colors.primary
              }
            />
            <Text
              style={[
                styles.feedbackText,
                feedback.type === 'error' && styles.feedbackTextError,
                feedback.type === 'success' && styles.feedbackTextSuccess,
                feedback.type === 'info' && styles.feedbackTextInfo,
              ]}
            >
              {feedback.message}
            </Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="votre@email.com"
            placeholderTextColor={Colors.textTertiary}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (feedback) clearFeedback();
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
          />

          <Text style={styles.label}>Mot de passe</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Votre mot de passe"
              placeholderTextColor={Colors.textTertiary}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (feedback) clearFeedback();
              }}
              secureTextEntry={!showPassword}
              autoComplete="password"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              style={styles.passwordToggle}
              onPress={() => setShowPassword((prev) => !prev)}
              accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              accessibilityRole="button"
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={Colors.textSecondary}
              />
            </Pressable>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.6 }]}
            onPress={handleAuth}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.buttonText}>
                {isLogin ? 'Se connecter' : 'Créer un compte'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toggle}
            onPress={toggleMode}
            activeOpacity={0.7}
          >
            <Text style={styles.toggleText}>
              {isLogin
                ? 'Pas de compte ? Inscrivez-vous'
                : 'Déjà un compte ? Connectez-vous'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    padding: 24,
    minHeight: '100%',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 28,
    gap: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    boxShadow: '0 12px 40px rgba(15, 25, 51, 0.08)',
    ...Platform.select({ android: { elevation: 4 } as object, default: {} }),
  },
  header: {
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${Colors.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    color: Colors.text,
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
    gap: 12,
  },
  label: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.text,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        caretColor: Colors.primary,
      } as object,
      default: {},
    }),
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    paddingRight: 8,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.text,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        caretColor: Colors.primary,
      } as object,
      default: {},
    }),
  },
  passwordToggle: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  feedbackError: {
    backgroundColor: `${Colors.critical}10`,
    borderColor: `${Colors.critical}40`,
  },
  feedbackSuccess: {
    backgroundColor: `${Colors.success}10`,
    borderColor: `${Colors.success}40`,
  },
  feedbackInfo: {
    backgroundColor: `${Colors.primary}10`,
    borderColor: `${Colors.primary}40`,
  },
  feedbackText: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  feedbackTextError: {
    color: Colors.critical,
  },
  feedbackTextSuccess: {
    color: Colors.success,
  },
  feedbackTextInfo: {
    color: Colors.primaryDark,
  },
  button: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 52,
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    color: Colors.white,
  },
  toggle: {
    alignItems: 'center',
    padding: 12,
  },
  toggleText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.primary,
  },
});
