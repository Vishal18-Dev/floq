import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Rect, Path } from 'react-native-svg';
import { formatINR } from '@floq/utils';
import { Icon } from '../common/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import { HapticFeedback } from '../../services/haptics';

interface UPICheckoutModalProps {
  isOpen: boolean;
  totalAmount: number;
  ticketNumber: string;
  upiId: string;
  upiName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const UPICheckoutModal: React.FC<UPICheckoutModalProps> = ({
  isOpen,
  totalAmount,
  ticketNumber,
  upiId,
  upiName,
  onClose,
  onSuccess,
}) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStatus, setSimStatus] = useState<'WAITING' | 'SUCCESS' | 'FAILED'>('WAITING');

  useEffect(() => {
    if (isOpen) {
      setSimStatus('WAITING');
      setIsSimulating(false);
    }
  }, [isOpen]);

  const handleSimulateSuccess = () => {
    HapticFeedback.light();
    setIsSimulating(true);
    setTimeout(() => {
      HapticFeedback.success();
      setSimStatus('SUCCESS');
      setIsSimulating(false);
      setTimeout(() => {
        onSuccess();
      }, 500);
    }, 600);
  };

  const handleSimulateFailure = () => {
    HapticFeedback.error();
    setIsSimulating(true);
    setTimeout(() => {
      setSimStatus('FAILED');
      setIsSimulating(false);
    }, 500);
  };

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>UPI QR Payment</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Soundbox Verification Pill */}
          <View style={styles.sandboxPill}>
            <Icon name="volume-2" size={12} color="#0284c7" />
            <Text style={styles.sandboxText}>Paytm / PhonePe Soundbox Verification</Text>
          </View>

          {/* QR Code Frame */}
          <View style={styles.qrFrame}>
            <View style={styles.qrCodeBox}>
              <Svg width={140} height={140} viewBox="0 0 100 100">
                <Rect x="5" y="5" width="25" height="25" fill="#0f172a" />
                <Rect x="9" y="9" width="17" height="17" fill="#ffffff" />
                <Rect x="13" y="13" width="9" height="9" fill="#0f172a" />

                <Rect x="70" y="5" width="25" height="25" fill="#0f172a" />
                <Rect x="74" y="9" width="17" height="17" fill="#ffffff" />
                <Rect x="78" y="13" width="9" height="9" fill="#0f172a" />

                <Rect x="5" y="70" width="25" height="25" fill="#0f172a" />
                <Rect x="9" y="74" width="17" height="17" fill="#ffffff" />
                <Rect x="13" y="78" width="9" height="9" fill="#0f172a" />

                <Rect x="35" y="10" width="6" height="6" fill="#0f172a" />
                <Rect x="45" y="15" width="6" height="6" fill="#0f172a" />
                <Rect x="55" y="10" width="6" height="6" fill="#0f172a" />
                <Rect x="35" y="25" width="6" height="6" fill="#0f172a" />
                <Rect x="45" y="30" width="6" height="6" fill="#0f172a" />
                <Rect x="55" y="25" width="6" height="6" fill="#0f172a" />
                <Rect x="10" y="45" width="6" height="6" fill="#0f172a" />
                <Rect x="25" y="45" width="6" height="6" fill="#0f172a" />
                <Rect x="40" y="45" width="20" height="20" fill="#0f172a" />
                <Rect x="70" y="45" width="6" height="6" fill="#0f172a" />
                <Rect x="85" y="45" width="6" height="6" fill="#0f172a" />
                <Rect x="35" y="70" width="6" height="6" fill="#0f172a" />
                <Rect x="50" y="75" width="6" height="6" fill="#0f172a" />
                <Rect x="70" y="70" width="6" height="6" fill="#0f172a" />
                <Rect x="85" y="80" width="6" height="6" fill="#0f172a" />
              </Svg>
            </View>

            <Text style={styles.scanHint}>Scan with any UPI App (GPay, PhonePe, Paytm)</Text>
            <Text style={styles.upiIdText}>{upiId}</Text>
          </View>

          {/* Amount Due Callout */}
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>AMOUNT DUE</Text>
            <Text style={styles.amountText}>{formatINR(totalAmount)}</Text>
          </View>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.successSimBtn}
              onPress={handleSimulateSuccess}
              disabled={isSimulating}
              activeOpacity={0.85}
            >
              {isSimulating ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Icon name="check-circle" size={16} color="#ffffff" />
              )}
              <Text style={styles.successSimText}>Payment Received (Soundbox Confirmed)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.failSimBtn}
              onPress={handleSimulateFailure}
              disabled={isSimulating}
              activeOpacity={0.7}
            >
              <Text style={styles.failSimText}>Payment Failed / Cancelled</Text>
            </TouchableOpacity>
          </View>

          {simStatus === 'FAILED' && (
            <View style={styles.errorBox}>
              <Icon name="alert-triangle" size={14} color="#e11d48" />
              <Text style={styles.errorText}>Payment declined. Switch to Cash.</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: radius.xl,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 360,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '700',
  },
  sandboxPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  sandboxText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0369a1',
  },
  qrFrame: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  qrCodeBox: {
    padding: 8,
    backgroundColor: '#ffffff',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  scanHint: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
  },
  upiIdText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  amountBox: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  amountLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  amountText: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: 1,
  },
  actionsContainer: {
    gap: 6,
  },
  successSimBtn: {
    backgroundColor: '#0284c7',
    height: 46,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    elevation: 3,
  },
  successSimText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  failSimBtn: {
    backgroundColor: '#f1f5f9',
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  failSimText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: radius.md,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  errorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e11d48',
  },
});
