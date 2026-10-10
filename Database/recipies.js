import { supabase } from './supabase.js';

export async function getRecipieById(id) {
  const { data, error } = await supabase
    .from('Recipies')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createRecipie({ name, meal, dietaryRestrictions, cookingUtensils, difficulty, ingredients }) {
  const { data, error } = await supabase
    .from('Recipes')
    .insert({ name, meal, dietaryRestrictions, cookingUtensils, difficulty, ingredients })
    .select()
    .single();

  if (error) throw error;
  return data;
}