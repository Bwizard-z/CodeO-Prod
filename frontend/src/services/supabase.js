import { supabase } from '../lib/supabase';

export const authService = {
  async signUp(email, password) {
    return await supabase.auth.signUp({ email, password });
  },
  async signInWithPassword(email, password) {
    return await supabase.auth.signInWithPassword({ email, password });
  },
  async signInWithOAuth(provider = 'google') {
    return await supabase.auth.signInWithOAuth({ provider });
  },
  async signOut() {
    return await supabase.auth.signOut();
  },
  async getSession() {
    return await supabase.auth.getSession();
  },
  async getUser() {
    return await supabase.auth.getUser();
  },
};

export const roomService = {
  async getRooms() {
    const { data, error } = await supabase.from('rooms').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  async createRoom({ name, language }) {
    const { data, error } = await supabase.from('rooms').insert([{ name, language }]).select().single();
    if (error) throw error;
    return data;
  },
};

export default { authService, roomService };
