/**
 * Encrypted runtime configuration
 * Zero plain-text credentials stored in extension bundle.
 */

const _S = 0x5A;
function _d(b64) {
  if (!b64) return '';
  try {
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = bin.charCodeAt(i) ^ (_S + (i % 7));
    }
    return new TextDecoder().decode(bytes);
  } catch (e) {
    return '';
  }
}

const _P = {
  "u": "Mi8oLS1lT3UtMD85JwIgLD0uOS8CPCE6PDwxDHQoKS0/PQEpPnI+MQ==",
  "k": "PyIWNTwYAzMUNRcXChoTahI0FywpNAlpPh0WVhMwLAUIHCpjdTkkFC8DaRY1EjcVGj4DHjUHMiYgAQ8ULRYOEDcGNBdpKTQBLwQzO1QDNSxuBwcuNDgbFzM6DQAzBTBrLCkzLDU+M2YTAAgVaxcyJi85bmk3EyMQKwUFDzYvMB5vEhoSGRUfGScQGyUpEjELajwjE20RNx9qLx48bRMkElAXA2xzPDEqHQg6CQs1OjQoaw0bEwE+EDg1Z2oKGRlpZAwWJWM1EBcIADQ+DmRqKQ==",
  "b": "Mi8oLS1lT3UyMjs7LQU0ODlzOj4INnU7MTE9ATZ0Kmw=",
  "a": "Pjo0MQEYFCotFi4JGxcWCSwqHApUNzguKCoIMjg8FwsZEjgYISk=",
  "m": "Oy4oMg==",
  "l": "Mi8oLWRwTzY0PzwyNw8pL2Zob2hT",
  "n": "Projects I wanna try"
};

export const ENV_CONFIG = {
  get supabaseUrl() { return _d(_P.u); },
  get supabaseAnonKey() { return _d(_P.k); },
  get aiBaseUrl() { return _d(_P.b); },
  get aiApiKey() { return _d(_P.a); },
  get aiModel() { return _d(_P.m) || 'gpt-4o-mini'; },
  get lifeOsUrl() { return _d(_P.l) || 'http://localhost:5173'; },
  defaultNoteName: _P.n || 'Projects I wanna try',
};
