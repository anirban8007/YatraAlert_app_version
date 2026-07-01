import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { verifySosCode } from '../utils/api';
import { setJSON } from '../utils/storage';
import ShakeAnimation from './ShakeAnimation';

export default function SosModal({ visible, onClose, onComplete }) {
  const [step, setStep] = useState('count');
  const [contactCount, setContactCount] = useState(1);
  const [contactIndex, setContactIndex] = useState(0);
  const [contacts, setContacts] = useState([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('I need help! Please call me immediately.');

  async function handleVerify() {
    if (!name) { setError('Please enter a name'); return; }
    if (!/^\d{5}$/.test(code)) { setError('Enter a 5-digit code'); return; }

    setError('Verifying...');
    const data = await verifySosCode(code);
    if (data.chat_id) {
      const newContacts = [...contacts, { name, chat_id: String(data.chat_id) }];
      setContacts(newContacts);
      setName(''); setCode(''); setError('');

      // Check if this is the last contact
      if (contactIndex + 1 >= contactCount) {
        // Move to message step
        setStep('message');
      } else {
        // Move to next contact
        setContactIndex(contactIndex + 1);
      }
    } else {
      setError(data.error || 'Invalid code');
    }
  }

  async function handleSave() {
    await setJSON('sosContacts', contacts);
    await setJSON('sosContactCount', contactCount);
    await setJSON('sosCustomMessage', message);
    await setJSON('sosSetupDone', true);
    onComplete();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.box}>

          {step === 'count' && (
            <>
              <Text style={styles.title}>🆘 Link Telegram Contacts</Text>
              <Text>How many contacts do you want to alert?</Text>
              <View style={styles.pillContainer}>
                {[1, 2, 3].map((n) => (
                  <TouchableOpacity key={n} onPress={() => setContactCount(n)}
                    style={[styles.pill, contactCount === n && styles.pillActive]}>
                    <Text style={[styles.pillText, contactCount === n && styles.pillTextActive]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.btn} onPress={() => setStep('contact')}>
                <Text style={styles.btnText}>Begin Setup →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'contact' && (
            <>
              <Text style={styles.title}>Contact {contactIndex + 1} of {contactCount}</Text>
              <Text style={styles.instructions}>
                1. Open Telegram{('\n')}
                2. Search @YatraAlertbot{('\n')}
                3. Press Start{('\n')}
                4. Send ANY 5-digit code to the bot (e.g. 12345){('\n')}
                5. Enter the exact same 5-digit code below
              </Text>
              <TextInput style={styles.input} placeholder="Contact Name"
                value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder="5-digit code you sent"
                value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 5))}
                keyboardType="number-pad" maxLength={5} />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <TouchableOpacity style={styles.btn} onPress={handleVerify}>
                <Text style={styles.btnText}>
                  {contactIndex + 1 === contactCount ? 'Verify & Finish ✓' : 'Verify & Next →'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'message' && (
            <>
              <Text style={styles.title}>Custom Message</Text>
              {contacts.map((c, i) => (
                <Text key={i} style={styles.chip}>👤 {c.name} ✅</Text>
              ))}
              <TextInput style={[styles.input, { height: 80 }]} multiline
                value={message} onChangeText={setMessage} />
              <View style={styles.shakeGuide}>
                <ShakeAnimation />
                <Text>💡 Tip: Shake LEFT→RIGHT→LEFT→RIGHT to trigger SOS offline</Text>
              </View>
              <TouchableOpacity style={[styles.btn, styles.btnSuccess]} onPress={handleSave}>
                <Text style={styles.btnText}>Save Contacts ✓</Text>
              </TouchableOpacity>
            </>
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  box: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  pillContainer: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 15 },
  pill: { padding: 15, width: 50, height: 50, borderRadius: 25, borderWidth: 1, borderColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: '#2563EB' },
  pillText: { fontSize: 16, fontWeight: '600', color: '#2563EB' },
  pillTextActive: { color: '#fff' },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 10, marginVertical: 8 },
  btn: { backgroundColor: '#2563EB', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  btnSuccess: { backgroundColor: '#10B981' },
  btnText: { color: '#fff', fontWeight: '700' },
  error: { color: '#EF4444', marginTop: 4, fontWeight: '600' },
  chip: { backgroundColor: '#D1FAE5', borderRadius: 999, padding: 8, marginVertical: 4, textAlign: 'center' },
  instructions: { backgroundColor: '#EFF6FF', padding: 10, borderRadius: 8, marginVertical: 8, borderLeftWidth: 3, borderLeftColor: '#2563EB', lineHeight: 22 },
  shakeGuide: { backgroundColor: '#FEF3C7', padding: 10, borderRadius: 8, marginVertical: 8, borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  cancelBtn: { marginTop: 15, alignItems: 'center', padding: 10 },
  cancelBtnText: { color: '#888', fontWeight: '600' },
});
