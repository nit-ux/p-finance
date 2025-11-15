// auth.js

import { supabaseClient } from './supabase.js';

export async function logoutUser() {
    await supabaseClient.auth.signOut();
}

export async function getCurrentUserId() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session ? session.user.id : null;
}