/**
 * Polyfill for ExpoCrypto
 * Ensures that expo-crypto functions (used by expo-auth-session and Clerk SSO for PKCE)
 * work seamlessly even if the native module hasn't been recompiled yet in the active Android APK.
 */

function rightRotate(v, a) {
  return (v >>> a) | (v << (32 - a));
}

function sha256Bytes(ascii) {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = 'length';
  let i, j;

  const words = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  
  let hash = [];
  const k = [];
  let primeCounter = 0;

  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  
  ascii += '\x80';
  while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;
  
  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);
    
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp1 = hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) + ch + k[i] + (w[i] = (i < 16) ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0);
      const temp2 = (rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj;
      
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  const bytes = [];
  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      bytes.push((hash[i] >> (8 * j)) & 255);
    }
  }
  return new Uint8Array(bytes);
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    result += chars[b0 >> 2];
    result += chars[((b0 & 3) << 4) | (b1 >> 4)];
    result += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    result += i + 2 < bytes.length ? chars[b2 & 63] : '=';
  }
  return result;
}

if (!globalThis.expo) {
  globalThis.expo = { modules: {} };
}
if (!globalThis.expo.modules) {
  globalThis.expo.modules = {};
}

if (!globalThis.expo.modules.ExpoCrypto) {
  globalThis.expo.modules.ExpoCrypto = {
    getRandomValues(typedArray) {
      if (globalThis.crypto?.getRandomValues) {
        return globalThis.crypto.getRandomValues(typedArray);
      }
      for (let i = 0; i < typedArray.length; i++) {
        typedArray[i] = Math.floor(Math.random() * 256);
      }
      return typedArray;
    },
    randomUUID() {
      if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
    async digestStringAsync(algorithm, data, options = { encoding: 'HEX' }) {
      const bytes = sha256Bytes(data);
      const enc = (options?.encoding || 'HEX').toUpperCase();
      if (enc === 'BASE64') {
        return bytesToBase64(bytes);
      }
      return bytesToHex(bytes);
    },
    digest(algorithm, output, data) {
      const bytes = sha256Bytes(typeof data === 'string' ? data : String.fromCharCode(...data));
      output.set(bytes.subarray(0, output.length));
    }
  };
}

export default globalThis.expo.modules.ExpoCrypto;
