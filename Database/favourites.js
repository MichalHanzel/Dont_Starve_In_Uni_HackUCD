import { supabase } from './supabase.js';

export async function addFavourite(userId, recipeId) {
  const { error } = await supabase
    .from('Favourites')
    .upsert({ userId: userId, recipeId: recipeId });

  if (error) throw error;
}

export async function removeFavourite(userId, recipeId) {
  const { error } = await supabase
    .from('Favourites')
    .delete()
    .eq('userId', userId)
    .eq('recipeId', recipeId);

  if (error) throw error;
}

export async function getFavouriteRecipes(userId) {
  const { data, error } = await supabase
    .from('Favourites')
    .select('created_at, Recipes(*)')
    .eq('userId', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map((row) => row.Recipes);
}