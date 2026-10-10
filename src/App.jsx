import logo from "./assets/logo.png";
import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";
import "./profile-page.css";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday"];
const mealTypes = ["Breakfast", "Lunch", "Dinner"];

const recipes = [
  {
    id: 1,
    name: "Porridge with banana",
    type: "Breakfast",
    time: 5,
    ingredients: ["Oats", "Milk", "Bananas"],
  },
  {
    id: 2,
    name: "Egg on toast",
    type: "Breakfast",
    time: 10,
    ingredients: ["Eggs", "Bread"],
  },
  {
    id: 3,
    name: "Spaghetti",
    type: "Dinner",
    time: 20,
    ingredients: ["Pasta", "Garlic", "Mince"],
  },
  {
    id: 4,
    name: "Tuna sandwich",
    type: "Lunch",
    time: 10,
    ingredients: ["Tinned tuna", "Bread", "Mayonnaise"],
  },
  {
    id: 5,
    name: "Tomato pasta",
    type: "Dinner",
    time: 20,
    ingredients: ["Pasta", "Tinned tomatoes", "Onion", "Garlic"],
  },
  {
    id: 6,
    name: "Chicken rice bowl",
    type: "Dinner",
    time: 25,
    ingredients: ["Chicken", "Rice", "Peppers"],
  },
  {
    id: 7,
    name: "Vegetable stir-fry",
    type: "Dinner",
    time: 20,
    ingredients: ["Rice", "Peppers", "Carrots", "Soy sauce"],
  },
];

const initialPlan = {
  Monday: {
    Breakfast: recipes[0],
    Lunch: recipes[2],
    Dinner: recipes[4],
  },
  Tuesday: {
    Breakfast: recipes[1],
    Lunch: recipes[3],
    Dinner: recipes[5],
  },
  Wednesday: {
    Breakfast: null,
    Lunch: null,
    Dinner: recipes[6],
  },
  Thursday: {
    Breakfast: null,
    Lunch: null,
    Dinner: null,
  },
};

// Emoji shown on a favourite card when the recipe has no photo yet
const mealEmoji = { Breakfast: "🥣", Lunch: "🥪", Dinner: "🍝" };

// Options shown on the onboarding / preferences page
const preferenceOptions = {
  equipment: ["Microwave", "Hob", "Oven", "Air fryer", "Toaster", "Kettle"],
  cuisines: ["Italian", "Asian", "Mexican", "Indian", "Mediterranean", "Irish"],
  dietary: [
    "Vegetarian",
    "Vegan",
    "Pescatarian",
    "Gluten-free",
    "Dairy-free",
    "Halal",
  ],
};

const defaultPreferences = {
  equipment: [],
  cuisines: [],
  skill: "Beginner",
  dietary: [],
  budget: "€30–€40",
  cookingTime: "20–30 minutes",
  dislikes: "",
};

function App() {
  // ---------- Planner state ----------
  const [mealPlan, setMealPlan] = useState(initialPlan);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState("");
  const [checkedItems, setCheckedItems] = useState([]);
  const [viewingRecipe, setViewingRecipe] = useState(null);

  // ---------- Navigation ----------
  // New users start on the onboarding page; once they've saved their
  // preferences they go straight to the planner on later visits.
  const [currentPage, setCurrentPage] = useState(() =>
    localStorage.getItem("onboardingCompleted") === "true"
      ? "planner"
      : "onboarding"
  );

  // ---------- Preferences (saved in the browser) ----------
  const [preferences, setPreferences] = useState(() => {
    try {
      return {
        ...defaultPreferences,
        ...JSON.parse(localStorage.getItem("studentPreferences") || "{}"),
      };
    } catch {
      return defaultPreferences;
    }
  });

  // ---------- Student profile (saved in the browser) ----------
  const [studentName, setStudentName] = useState(
    () => localStorage.getItem("studentName") || ""
  );

  // Inline name editor on the profile page
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  // The signed-in Supabase user (an anonymous user is created automatically)
  const [userId, setUserId] = useState(null);

  // This user's favourite recipes, as full recipe rows from the database
  const [favourites, setFavourites] = useState([]);
  const [favouritesReady, setFavouritesReady] = useState(false);

  // Bump this number to re-fetch the favourites from the database
  const [favouritesVersion, setFavouritesVersion] = useState(0);

  // The latest Supabase fetch result, stored together with the id it
  // belongs to.
  const [recipeResult, setRecipeResult] = useState(null);

  // Save the name in the browser
  useEffect(() => {
    localStorage.setItem("studentName", studentName);
  }, [studentName]);

  // Sign in anonymously (or reuse the saved session) so each browser gets
  // its own user id to attach favourites to.
  useEffect(() => {
    let cancelled = false;

    async function signIn() {
      const { data: sessionData } = await supabase.auth.getSession();
      let user = sessionData.session?.user ?? null;

      if (!user) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.error("Anonymous sign-in failed:", error.message);
          return;
        }
        user = data.user;
      }

      if (!cancelled) setUserId(user.id);
    }

    signIn();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load this user's favourites, with the full recipe attached to each one.
  useEffect(() => {
    if (!userId) return undefined;

    let cancelled = false;

    supabase
      .from("favourites")
      .select("created_at, Recipes(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Couldn't load favourites:", error.message);
        } else {
          setFavourites(data.map((row) => row.Recipes).filter(Boolean));
        }
        setFavouritesReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, favouritesVersion]);

  // Fetch the full recipe row whenever a recipe is opened.
  // State is only set inside .then(), never synchronously in the effect body.
  // All hooks must stay above the early returns below, because hooks can't
  // be called after a conditional return.
  useEffect(() => {
    if (!viewingRecipe) return undefined;

    let cancelled = false;
    const id = viewingRecipe.id;

    supabase
      .from("Recipes")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        // Ignore the result if the user has already clicked something else
        if (cancelled) return;
        if (error) console.error(error);
        setRecipeResult({ id, data, error: error?.message ?? null });
      });

    return () => {
      cancelled = true;
    };
  }, [viewingRecipe]);

  // Derived during render, so there's nothing to reset when the recipe
  // changes. A stored result only counts if it belongs to the recipe being
  // viewed.
  const resultIsCurrent =
    viewingRecipe !== null && recipeResult?.id === viewingRecipe.id;
  const recipeLoading = viewingRecipe !== null && !resultIsCurrent;
  const recipeData = resultIsCurrent ? recipeResult.data : null;
  const recipeError = resultIsCurrent ? recipeResult.error : null;

  // Returns the value if it's an array, otherwise an empty list.
  const asList = (value) => (Array.isArray(value) ? value : []);

  // Just the ids, for the quick "is this a favourite?" checks on the hearts.
  const favoriteRecipeIds = favourites.map((recipe) => recipe.id);

  // Build the shopping list from all selected meals.
  const shoppingItems = [
    ...new Set(
      Object.values(mealPlan).flatMap((day) =>
        Object.values(day)
          .filter(Boolean)
          .flatMap((meal) => meal.ingredients)
      )
    ),
  ].sort();

  // ---------- Handlers ----------
  function togglePreference(group, value) {
    setPreferences((current) => {
      const values = current[group];

      return {
        ...current,
        [group]: values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value],
      };
    });
  }

  function updatePreference(field, value) {
    setPreferences((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function finishOnboarding() {
    localStorage.setItem("studentPreferences", JSON.stringify(preferences));
    localStorage.setItem("onboardingCompleted", "true");
    setCurrentPage("planner");
  }

  function editPreferences() {
    setCurrentPage("onboarding");
  }

  async function toggleFavorite(recipe) {
    if (!userId) return;

    const isFavourite = favoriteRecipeIds.includes(recipe.id);

    // Update the screen straight away, then confirm with the database.
    setFavourites((current) =>
      isFavourite
        ? current.filter((item) => item.id !== recipe.id)
        : [
            {
              id: recipe.id,
              name: recipe.name,
              mealType: recipe.type ?? recipe.mealType,
              time_mins: recipe.time ?? recipe.time_mins,
              image_url: recipe.image_url ?? null,
            },
            ...current,
          ]
    );

    const { error } = isFavourite
      ? await supabase
          .from("favourites")
          .delete()
          .eq("user_id", userId)
          .eq("recipe_id", recipe.id)
      : await supabase
          .from("favourites")
          .upsert(
            { user_id: userId, recipe_id: recipe.id },
            { onConflict: "user_id,recipe_id", ignoreDuplicates: true }
          );

    if (error) console.error("Couldn't update favourite:", error.message);

    // Re-sync with the database. This also undoes the change if it failed.
    setFavouritesVersion((version) => version + 1);
  }

  function openMealPicker(day, type) {
    setSelectedSlot({ day, type });
    setSelectedRecipe("");
  }

  function saveMeal() {
    if (!selectedSlot || !selectedRecipe) return;

    const recipe = recipes.find(
      (item) => item.id === Number(selectedRecipe)
    );

    if (!recipe) return;

    setMealPlan((current) => ({
      ...current,
      [selectedSlot.day]: {
        ...current[selectedSlot.day],
        [selectedSlot.type]: recipe,
      },
    }));

    setSelectedSlot(null);
  }

  function removeMeal(day, type) {
    setMealPlan((current) => ({
      ...current,
      [day]: {
        ...current[day],
        [type]: null,
      },
    }));
  }

  function toggleShoppingItem(item) {
    setCheckedItems((current) =>
      current.includes(item)
        ? current.filter((name) => name !== item)
        : [...current, item]
    );
  }

  // ---------- Onboarding / preferences page ----------
  if (currentPage === "onboarding") {
    return (
      <div className="app">
        <header className="topbar">
          <a
            className="brand"
            href="#"
            onClick={(event) => {
              event.preventDefault();
              setCurrentPage("planner");
            }}
          >
            <span>Don't Starve in Uni!</span>
            <img
              className="brand-logo"
              src={logo}
              alt="Don't Starve in Uni logo"
            />
          </a>
        </header>

        <main className="page preferences-page">
          <section className="preferences-hero">
            <p className="eyebrow">LET'S GET TO KNOW YOUR KITCHEN</p>
            <h1>Your student survival guide 🍳</h1>
            <p className="subtitle">
              Tell us what works for you, and make meal planning a little
              easier on your time, budget, and taste buds.
            </p>
          </section>

          <section className="preferences-panel">
            <h2>1. What equipment do you have?</h2>
            <p className="subtitle">
              Select everything available in your kitchen.
            </p>

            <div className="preference-options">
              {preferenceOptions.equipment.map((item) => (
                <label key={item} className="preference-option">
                  <input
                    type="checkbox"
                    checked={preferences.equipment.includes(item)}
                    onChange={() => togglePreference("equipment", item)}
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>

            <h2>2. What cuisines do you enjoy?</h2>
            <div className="preference-options">
              {preferenceOptions.cuisines.map((item) => (
                <label key={item} className="preference-option">
                  <input
                    type="checkbox"
                    checked={preferences.cuisines.includes(item)}
                    onChange={() => togglePreference("cuisines", item)}
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>

            <h2>3. How confident are you in the kitchen?</h2>
            <select
              value={preferences.skill}
              onChange={(event) =>
                updatePreference("skill", event.target.value)
              }
            >
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>

            <h2>4. Any dietary preferences?</h2>
            <div className="preference-options">
              {preferenceOptions.dietary.map((item) => (
                <label key={item} className="preference-option">
                  <input
                    type="checkbox"
                    checked={preferences.dietary.includes(item)}
                    onChange={() => togglePreference("dietary", item)}
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>

            <h2>5. What's your weekly food budget?</h2>
            <select
              value={preferences.budget}
              onChange={(event) =>
                updatePreference("budget", event.target.value)
              }
            >
              <option>Under €20</option>
              <option>€20–€30</option>
              <option>€30–€40</option>
              <option>€40–€50</option>
              <option>€50+</option>
            </select>

            <h2>6. How much time do you have to cook?</h2>
            <select
              value={preferences.cookingTime}
              onChange={(event) =>
                updatePreference("cookingTime", event.target.value)
              }
            >
              <option>Under 15 minutes</option>
              <option>15–20 minutes</option>
              <option>20–30 minutes</option>
              <option>30+ minutes</option>
            </select>

            <h2>7. Anything you dislike or need to avoid?</h2>
            <p className="subtitle">
              List ingredients, allergies, or other food requirements.
            </p>
            <textarea
              value={preferences.dislikes}
              onChange={(event) =>
                updatePreference("dislikes", event.target.value)
              }
              placeholder="e.g. mushrooms, onions, peanuts..."
              rows={4}
            />

            <button
              className="primary-button preferences-save"
              onClick={finishOnboarding}
            >
              Save preferences & start planning →
            </button>
          </section>
        </main>
      </div>
    );
  }

  // ---------- Profile page ----------
  if (currentPage === "profile") {
    const favoriteRecipes = favourites;

    return (
      <div className="app">
        <header className="topbar">
          <a
            className="brand"
            href="#"
            onClick={(event) => {
              event.preventDefault();
              setCurrentPage("planner");
            }}
          >
            <span>Don't Starve in Uni!</span>
            <img
              className="brand-logo"
              src={logo}
              alt="Don't Starve in Uni logo"
            />
          </a>

          <nav>
            <button
              className="profile-nav-button"
              onClick={() => setCurrentPage("planner")}
            >
              Meal planner
            </button>
            <button className="profile-nav-button nav-active">
              My profile
            </button>
          </nav>

          <span className="student-label">
            👤 {studentName.trim() || "Student"}
          </span>
        </header>

        <main className="page pf-page">
          <button
            className="back-button"
            onClick={() => setCurrentPage("planner")}
          >
            ← Back to meal planner
          </button>

          <section className="pf-hero">
            <div className="pf-avatar" aria-hidden="true">
              {studentName.trim()
                ? studentName.trim().charAt(0).toUpperCase()
                : "👩‍🍳"}
            </div>

            <div className="pf-hero-body">
              {isEditingName ? (
                <form
                  className="pf-name-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setStudentName(nameDraft.trim());
                    setIsEditingName(false);
                  }}
                >
                  <label className="pf-name-label" htmlFor="student-name">
                    What should we call you?
                  </label>
                  <div className="pf-name-row">
                    <input
                      id="student-name"
                      className="pf-name-input"
                      value={nameDraft}
                      onChange={(event) => setNameDraft(event.target.value)}
                      maxLength={30}
                      autoFocus
                    />
                    <button type="submit" className="primary-button">
                      Save
                    </button>
                    <button
                      type="button"
                      className="pf-ghost-button"
                      onClick={() => setIsEditingName(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <h1>
                    {studentName.trim()
                      ? `Hey, ${studentName.trim()}!`
                      : "Your student profile"}
                  </h1>
                  <p className="pf-tagline">
                    Your kitchen, your favourites, your questionable student
                    food decisions.
                  </p>
                  <div className="pf-hero-actions">
                    <button
                      className="pf-ghost-button"
                      onClick={() => {
                        setNameDraft(studentName);
                        setIsEditingName(true);
                      }}
                    >
                      ✏️ Edit name
                    </button>
                    <button
                      className="pf-ghost-button"
                      onClick={editPreferences}
                    >
                      ⚙️ Edit preferences
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="pf-stat">
              <strong>{favouritesReady ? favoriteRecipes.length : "–"}</strong>
              <span>
                {favoriteRecipes.length === 1 ? "favourite" : "favourites"}
              </span>
            </div>
          </section>

          <section className="pf-section">
            <div className="pf-section-header">
              <h2>Favourite recipes</h2>
              <p>Saved for your next hunger emergency.</p>
            </div>

            {!favouritesReady ? (
              <div className="pf-grid" aria-busy="true">
                {[0, 1, 2].map((slot) => (
                  <div className="pf-skeleton" key={slot} />
                ))}
              </div>
            ) : favoriteRecipes.length === 0 ? (
              <div className="pf-empty">
                <span>🍝</span>
                <h3>No favourites yet</h3>
                <p>
                  Tap the ☆ on any recipe in your planner and it will show up
                  here.
                </p>
                <button
                  className="primary-button"
                  onClick={() => setCurrentPage("planner")}
                >
                  Find some recipes →
                </button>
              </div>
            ) : (
              <div className="pf-grid">
                {favoriteRecipes.map((recipe) => (
                  <article className="pf-card" key={recipe.id}>
                    <button
                      className="pf-card-link"
                      onClick={() => {
                        setCurrentPage("planner");
                        setViewingRecipe(recipe);
                      }}
                    >
                      <div className="pf-card-media">
                        {recipe.image_url ? (
                          <img
                            className="pf-card-photo"
                            src={recipe.image_url}
                            alt={recipe.name}
                          />
                        ) : (
                          <div
                            className={`pf-card-placeholder pf-card-placeholder--${String(
                              recipe.mealType ?? ""
                            ).toLowerCase()}`}
                          >
                            {mealEmoji[recipe.mealType] ?? "🍽️"}
                          </div>
                        )}
                        {recipe.mealType && (
                          <span className="pf-card-type">
                            {recipe.mealType}
                          </span>
                        )}
                      </div>

                      <div className="pf-card-body">
                        <h3>{recipe.name}</h3>
                        {recipe.time_mins ? (
                          <p className="pf-card-meta">
                            ⏱️ {recipe.time_mins} min
                          </p>
                        ) : null}
                      </div>
                    </button>

                    <button
                      className="pf-star"
                      onClick={() => toggleFavorite(recipe)}
                      aria-label={`Remove ${recipe.name} from favourites`}
                      title="Remove from favourites"
                    >
                      ★
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }

  // ---------- Recipe detail page ----------
  if (viewingRecipe) {
    return (
      <div className="app">
        <header className="topbar">
          <a
            className="brand"
            href="#"
            onClick={(event) => {
              event.preventDefault();
              setViewingRecipe(null);
            }}
          >
            <span>Don't Starve in Uni!</span>
            <img
              className="brand-logo"
              src={logo}
              alt="Don't Starve in Uni logo"
            />
          </a>
        </header>

        <main className="page recipe-page">
          <button
            className="back-button"
            onClick={() => setViewingRecipe(null)}
          >
            ← Back to meal planner
          </button>

          {recipeLoading && <p className="subtitle">Loading recipe...</p>}

          {recipeError && (
            <p className="subtitle">
              Couldn't load this recipe: {recipeError}
            </p>
          )}

          {recipeData && (
            <>
              <section className="recipe-hero">
                <p className="eyebrow">TONIGHT'S MASTERPIECE</p>
                <h1>{recipeData.name}</h1>

                <button
                  className={`favorite-button recipe-favorite ${
                    favoriteRecipeIds.includes(viewingRecipe.id)
                      ? "is-favorite"
                      : ""
                  }`}
                  onClick={() => toggleFavorite(viewingRecipe)}
                >
                  {favoriteRecipeIds.includes(viewingRecipe.id)
                    ? "★ Remove from favourites"
                    : "☆ Add to favourites"}
                </button>

                <div className="recipe-meta">
                  {recipeData.time_mins && (
                    <span>⏱️ {recipeData.time_mins} minutes</span>
                  )}
                  <span>👨‍🍳 {recipeData.difficulty ?? "Easy"}</span>
                  <span>💸 Student budget friendly</span>
                </div>

                {asList(recipeData.dietaryRestrictions).length > 0 && (
                  <div className="recipe-tags">
                    <span className="recipe-tags-label">Suitable for:</span>
                    {asList(recipeData.dietaryRestrictions).map((tag) => (
                      <span className="recipe-tag" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {asList(recipeData.cookingUtensils).length > 0 && (
                  <div className="recipe-tags">
                    <span className="recipe-tags-label">You'll need:</span>
                    {asList(recipeData.cookingUtensils).map((item) => (
                      <span className="recipe-tag" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                )}

                {recipeData.image_url && (
                  <img
                    className="recipe-image"
                    src={recipeData.image_url}
                    alt={recipeData.name}
                  />
                )}
              </section>

              <div className="recipe-layout">
                <section className="recipe-panel">
                  <p className="eyebrow">THE SHOPPING BIT</p>
                  <h2>Ingredients</h2>

                  <div className="recipe-ingredients">
                    {asList(recipeData.ingredients).map((ingredient) => (
                      <label key={ingredient}>
                        <input type="checkbox" />
                        <span>{ingredient}</span>
                      </label>
                    ))}
                  </div>
                </section>

                <section className="recipe-panel">
                  <p className="eyebrow">LET'S GET COOKING</p>
                  <h2>Instructions</h2>

                  {asList(recipeData.instructions).length > 0 ? (
                    <ol className="recipe-instructions">
                      {asList(recipeData.instructions).map((step, index) => (
                        <li key={`${index}-${step}`}>
                          <span>{index + 1}</span>
                          <p>{step}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="subtitle">
                      Instructions coming soon! Your ingredients are ready,
                      so you're halfway to dinner.
                    </p>
                  )}
                </section>
              </div>
            </>
          )}
        </main>
      </div>
    );
  }

  // ---------- Meal planner page ----------
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#">
          <span>Don't Starve in Uni!</span>
          <img
            className="brand-logo"
            src={logo}
            alt="Don't Starve in Uni logo"
          />
        </a>

        <nav>
          <a href="#planner" className="nav-active">
            Meal planner
          </a>
          <a href="#shopping">Shopping list</a>
        </nav>

        <button
          className="student-label"
          onClick={() => setCurrentPage("profile")}
        >
          👤 {studentName.trim() || "My Profile"}
        </button>
      </header>

      <main className="page">
        <section className="welcome">
          <div>
            <h1>Meal Planner</h1>
            <p className="subtitle">
              Survive the weekly food shop, dodge another sad instant noodle
              dinner, and pretend you've got your life together...
            </p>
          </div>
        </section>

        <div className="planner-layout">
          <section className="planner-panel" id="planner">
            <div className="section-heading">
              <div>
                <p className="eyebrow">THE GAME PLAN</p>
                <h2>Your meals</h2>
              </div>
            </div>

            <div className="timetable">
              {/* Header row: days across the top */}
              <div className="timetable-corner">MEALS</div>

              {days.map((day) => (
                <div className="timetable-day" key={day}>
                  {day}
                </div>
              ))}

              {/* Each meal type gets its own row */}
              {mealTypes.map((type) => (
                <React.Fragment key={type}>
                  <div className="timetable-label">
                    {type === "Breakfast"
                      ? "🥣"
                      : type === "Lunch"
                        ? "🥪"
                        : "🍝"}
                    <span>{type}</span>
                  </div>

                  {days.map((day) => {
                    const meal = mealPlan[day][type];

                    return (
                      <div className="timetable-cell" key={day}>
                        {meal ? (
                          <div className="meal-card">
                            <button
                              className={`favorite-button ${
                                favoriteRecipeIds.includes(meal.id)
                                  ? "is-favorite"
                                  : ""
                              }`}
                              onClick={() => toggleFavorite(meal)}
                              aria-label={
                                favoriteRecipeIds.includes(meal.id)
                                  ? "Remove from favourites"
                                  : "Add to favourites"
                              }
                              title={
                                favoriteRecipeIds.includes(meal.id)
                                  ? "Remove from favourites"
                                  : "Add to favourites"
                              }
                            >
                              {favoriteRecipeIds.includes(meal.id)
                                ? "★"
                                : "☆"}
                            </button>

                            <button
                              className="recipe-link"
                              onClick={() => setViewingRecipe(meal)}
                            >
                              <strong>{meal.name}</strong>
                              <small>◷ {meal.time} mins</small>
                              <span className="view-recipe">
                                View recipe →
                              </span>
                            </button>

                            <button
                              className="text-button"
                              onClick={() => removeMeal(day, type)}
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <button
                            className="add-meal"
                            onClick={() => openMealPicker(day, type)}
                          >
                            <span>+</span>
                            Add meal
                          </button>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            <p className="planner-hint">
              💡 Tip: choose meals that share ingredients to save money and
              reduce food waste.
            </p>
          </section>

          <aside className="shopping-panel" id="shopping">
            <div className="shopping-heading">
              <div className="basket-icon">🛒</div>
              <div>
                <p className="eyebrow">READY, SET, SHOP</p>
                <h2>Shopping list</h2>
              </div>
            </div>

            <p className="shopping-description">
              Ingredients from your planned meals, all in one place.
            </p>

            <div className="shopping-progress">
              <div className="progress-label">
                <span>
                  {
                    checkedItems.filter((item) =>
                      shoppingItems.includes(item)
                    ).length
                  }{" "}
                  of {shoppingItems.length} collected
                </span>
                <span>
                  {shoppingItems.length
                    ? Math.round(
                        (checkedItems.filter((item) =>
                          shoppingItems.includes(item)
                        ).length /
                          shoppingItems.length) *
                          100
                      )
                    : 0}
                  %
                </span>
              </div>

              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${
                      shoppingItems.length
                        ? (checkedItems.filter((item) =>
                            shoppingItems.includes(item)
                          ).length /
                            shoppingItems.length) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {shoppingItems.length === 0 ? (
              <div className="empty-list">
                <span>🥕</span>
                <p>Your list is waiting!</p>
                <small>Add meals to see their ingredients here.</small>
              </div>
            ) : (
              <div className="shopping-items">
                {shoppingItems.map((item) => (
                  <label className="shopping-item" key={item}>
                    <input
                      type="checkbox"
                      checked={checkedItems.includes(item)}
                      onChange={() => toggleShoppingItem(item)}
                    />
                    <span
                      className={
                        checkedItems.includes(item) ? "item-checked" : ""
                      }
                    >
                      {item}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div className="shopping-footer">
              <span>Made for your next food shop 💚</span>
              <button
                className="clear-button"
                onClick={() => setCheckedItems([])}
              >
                Reset ticks
              </button>
            </div>
          </aside>
        </div>

        <footer className="page-footer">
          <span>Don't Starve in Uni!</span>
          <span>Survive college, one meal at a time</span>
        </footer>
      </main>

      {selectedSlot && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedSlot(null)}
        >
          <section
            className="meal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setSelectedSlot(null)}
              aria-label="Close"
            >
              ×
            </button>

            <p className="eyebrow">LET'S FILL THAT SLOT</p>
            <h2 id="modal-title">
              What's for {selectedSlot.type.toLowerCase()}?
            </h2>
            <p className="subtitle">
              {selectedSlot.day} · Pick a recipe to add to your plan.
            </p>

            <label className="select-label" htmlFor="recipe-select">
              Choose a recipe
            </label>
            <select
              id="recipe-select"
              value={selectedRecipe}
              onChange={(event) => setSelectedRecipe(event.target.value)}
            >
              <option value="">Select a recipe...</option>
              {recipes
                .filter((recipe) => recipe.type === selectedSlot.type)
                .map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.name} · {recipe.time} mins
                  </option>
                ))}
            </select>

            <button
              className="primary-button"
              disabled={!selectedRecipe}
              onClick={saveMeal}
            >
              Add to my week →
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;