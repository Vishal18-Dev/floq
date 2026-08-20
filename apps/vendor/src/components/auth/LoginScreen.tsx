import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../services/api';

export function LoginScreen() {
  const [phone, setPhone] = useState('9876543210');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [isSending, setIsSending] = useState(false);
  const [isMock, setIsMock] = useState(true);

  const { loginWithOTP, isLoading, error, clearError } = useAuthStore();

  const handleRequestOTP = async () => {
    if (phone.trim().length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      setIsSending(true);
      clearError();
      const res = await api.requestOTP(phone);
      setIsMock(res.isMock);
      setStep('OTP');
      if (res.isMock) {
        setOtp('123456');
      }
    } catch (err: any) {
      Alert.alert('OTP Request Failed', err.message || 'Unable to send OTP.');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      Alert.alert('Enter OTP', 'Please enter the verification code.');
      return;
    }

    try {
      clearError();
      await loginWithOTP(phone, otp);
    } catch (err: any) {
      Alert.alert('Verification Failed', err.message || 'Invalid OTP code.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View var-card style={styles.card}>
        <Text style={styles.logoText}>⚡ FLOQ Merchant</Text>
        <Text style={styles.subtitle}>Counter POS & Order Fulfillment</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {step === 'PHONE' ? (
          <View style={styles.formGroup}>
            <Text style={styles.label}>Mobile Number</Text>
            <View style={styles.phoneInputRow}>
              <Text style={styles.countryCode}>+91</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
                placeholder="Enter 10-digit number"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <TouchableOpacity
              style={styles.button}
              onPress={handleRequestOTP}
              disabled={isSending}
            >
              {isSending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Get Verification Code →</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formGroup}>
            <Text style={styles.label}>Verification Code (OTP)</Text>
            <Text style={styles.infoText}>
              Sent to +91 {phone} {isMock ? '(Development Code: 123456)' : ''}
            </Text>
            <TextInput
              style={styles.input}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="Enter 6-digit OTP"
              placeholderTextColor="#94A3B8"
              autoFocus
            />
            <TouchableOpacity
              style={styles.button}
              onPress={handleVerifyOTP}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Verify & Launch POS →</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep('PHONE')}
            >
              <Text style={styles.backButtonText}>← Change Phone Number</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 28,
  },
  formGroup: {
    gap: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CBD5E1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 16,
  },
  countryCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F59E0B',
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 52,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#3B82F6',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  infoText: {
    fontSize: 12,
    color: '#38BDF8',
    marginBottom: 4,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    backgroundColor: '#450A0A',
    padding: 10,
    borderRadius: 8,
    textAlign: 'center',
    marginBottom: 16,
  },
  backButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
});
