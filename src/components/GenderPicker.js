import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';

/**
 * GenderPicker
 * Shows once after first login.
 * User enters their preferred name and picks a gender for SOS messages.
 * Props:
 *   - visible: boolean
 *   - defaultName: string (pre-filled from Google profile)
 *   - onSave: ({ name, gender }) => void
 */
export default function GenderPicker({ visible, defaultName = '', onSave }) {
  const [name, setName] = useState(defaultName);
  const [gender, setGender] = useState(null);

  const options = [
    { key: 'male',   label: '👨  Male',   pronoun: 'him' },
    { key: 'female', label: '👩  Female',  pronoun: 'her' },
    { key: 'other',  label: '🧑  Other',   pronoun: 'them' },
  ];

  function handleSave() {
    if (!name.trim()) return;
    if (!gender) return;
    onSave({ name: name.trim(), gender });
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.card}>
            {/* Header */}
            <Text style={styles.emoji}>🆘</Text>
            <Text style={styles.title}>Emergency Profile</Text>
            <Text style={styles.subtitle}>
              This info personalizes your SOS alerts.
            </Text>

            {/* Name Input */}
            <Text style={styles.label}>Your Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Anirban"
              placeholderTextColor="#94A3B8"
              autoCorrect={false}
            />

            {/* Gender Options */}
            <Text style={styles.label}>Your Gender</Text>
            <View style={styles.optionRow}>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.optionBtn, gender === opt.key && styles.optionBtnSelected]}
                  onPress={() => setGender(opt.key)}
                >
                  <Text style={[styles.optionText, gender === opt.key && styles.optionTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Preview */}
            {name.trim() && gender && (
              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>SOS message preview:</Text>
                <Text style={styles.previewText}>
                  🚨 {name.trim()} needs help! Please call{' '}
                  {options.find(o => o.key === gender)?.pronoun}.
                </Text>
              </View>
            )}

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveBtn, (!name.trim() || !gender) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!name.trim() || !gender}
            >
              <Text style={styles.saveBtnText}>Save & Continue →</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  emoji: { fontSize: 40, textAlign: 'center', marginBottom: 8 },
  title: {
    fontSize: 22, fontWeight: '800', color: '#0F172A',
    textAlign: 'center', marginBottom: 6,
  },
  subtitle: {
    fontSize: 13, color: '#64748B', textAlign: 'center',
    lineHeight: 20, marginBottom: 24,
  },
  label: {
    fontSize: 13, fontWeight: '700', color: '#475569',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  optionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  optionBtnSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  optionText: {
    fontSize: 13, fontWeight: '600', color: '#64748B',
  },
  optionTextSelected: {
    color: '#2563EB',
  },
  previewBox: {
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  previewLabel: {
    fontSize: 11, color: '#92400E', fontWeight: '700',
    textTransform: 'uppercase', marginBottom: 6,
  },
  previewText: {
    fontSize: 14, color: '#7C2D12', fontWeight: '600', lineHeight: 20,
  },
  saveBtn: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  saveBtnText: {
    color: '#fff', fontWeight: '800', fontSize: 16,
  },
});
