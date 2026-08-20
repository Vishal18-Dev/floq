import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import Constants from 'expo-constants';
import { api } from '../../services/api';
import { networkService } from '../../services/network';
import { syncEngine } from '../../services/sync';

interface SupportDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingSyncCount: number;
}

export function SupportDiagnosticsModal({
  isOpen,
  onClose,
  pendingSyncCount,
}: SupportDiagnosticsModalProps) {
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const platformOS = `${Platform.OS} (${Platform.Version})`;
  const merchantId = api.getMerchantId();
  const storeId = api.getStoreId();
  const isOnline = networkService.getIsConnected();
  const timestamp = new Date().toISOString();

  const diagnosticsText = `
FLOQ MERCHANT SUPPORT DIAGNOSTICS REPORT
-----------------------------------------
Timestamp: ${timestamp}
App Version: v${appVersion}
OS Platform: ${platformOS}
Merchant ID: ${merchantId}
Store ID: ${storeId}
Network State: ${isOnline ? 'ONLINE' : 'OFFLINE'}
Pending Sync Items: ${pendingSyncCount}
Backend API Base: ${api.getBaseUrl()}
-----------------------------------------
  `.trim();

  const handleCopyDiagnostics = () => {
    Alert.alert('Diagnostics Captured', 'Diagnostics report ready. Please share this information with FLOQ Merchant Support.');
  };

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>🛠️ Merchant Support Diagnostics</Text>

          <View style={styles.reportBox}>
            <Text style={styles.reportText}>{diagnosticsText}</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopyDiagnostics}>
              <Text style={styles.copyBtnText}>📋 Copy Diagnostics Report</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 16,
    textAlign: 'center',
  },
  reportBox: {
    backgroundColor: '#0F172A',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  reportText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    color: '#38BDF8',
    lineHeight: 18,
  },
  actions: {
    gap: 12,
  },
  copyBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  copyBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  closeBtn: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
  },
});
