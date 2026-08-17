import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import type { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase não configurado. Defina EXPO_PUBLIC_SUPABASE_URL e ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo .env e reinicie o servidor ' +
      'com `npx expo start -c`.',
  );
}

const webStorage = {
  getItem: async (key: string) => typeof window === 'undefined' ? null : window.localStorage.getItem(key),
  setItem: async (key: string, value: string) => { if (typeof window !== 'undefined') window.localStorage.setItem(key, value); },
  removeItem: async (key: string) => { if (typeof window !== 'undefined') window.localStorage.removeItem(key); },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? webStorage : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // RN não tem URL de callback com fragmento; detecção de sessão via URL não se aplica.
    detectSessionInUrl: false,
  },
});
