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

export async function createRecipie({ name, mealType, difficulty, dietaryTags, utensils, ingredients, instructions, timeMins, imageUrl }) {
  const { data, error } = await supabase
    .from('Recipes')
    .insert({
      name, mealType, difficulty, dietaryTags, utensils, ingredients,
      instructions, time_mins: timeMins, image_url: imageUrl,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}