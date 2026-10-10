import { supabase } from './supabase.js';

export async function getUserById(id) {
  const { data, error } = await supabase
    .from('Users')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createUser(firstName, secondName, email, cookingUtensils, dietaryRestrictions) {
  const { data, error } = await supabase
    .from('Users')
    .insert({ firstName, secondName, email, cookingUtensils, dietaryRestrictions })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function favouriteRecipie(userId, recipie) {
    const {data, error} = await supabase
        .from('')
}