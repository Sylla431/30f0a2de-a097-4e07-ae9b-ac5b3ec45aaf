import { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Typography';

interface AuthRequiredModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export function AuthRequiredModal({ visible, onDismiss }: AuthRequiredModalProps) {
  const router = useRouter();

  const handleGoToLogin = useCallback(() => {
    onDismiss();
    router.push('/(tabs)/profile');
  }, [onDismiss, router]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="lock-closed" size={28} color={Colors.primary} />
            </View>
          </View>

          {/* Content */}
          <Text style={styles.title}>Connexion requise</Text>
          <Text style={styles.message} selectable>
            Vous devez être connecté pour effectuer cette action. Veuillez vous connecter ou créer un compte.
          </Text>

          {/* Buttons */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleGoToLogin}
              activeOpacity={0.7}
            >
              <Ionicons name="log-in-outline" size={18} color={Colors.white} />
              <Text style={styles.loginButtonText}>Se connecter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onDismiss}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 25, 51, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 14,
    boxShadow: '0 16px 48px rgba(15, 25, 51, 0.18)',
    ...Platform.select({ android: { elevation: 12 } as object, default: {} }),
    borderCurve: 'continuous',
  },
  iconContainer: {
    marginBottom: 4,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: `${Colors.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: Colors.text,
    textAlign: 'center',
  },
  message: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 4,
  },
  buttonGroup: {
    width: '100%',
    gap: 10,
    marginTop: 6,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  loginButtonText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.white,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderCurve: 'continuous',
  },
  cancelButtonText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
