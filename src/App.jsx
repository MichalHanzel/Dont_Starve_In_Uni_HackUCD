import logo from "./assets/logo.png";
import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";

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
    ingredients: ["Pasta", "Garlic", "Mince"]
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

function App() {
  const [mealPlan, setMealPlan] = useState(initialPlan);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState("");
  const [checkedItems, setCheckedItems] = useState([]);
  const [viewingRecipe, setViewingRecipe] = useState(null);

  // The latest fetch result, stored together with the id it belongs to.
  const [recipeResult, setRecipeResult] = useState(null);

  // Fetch the full recipe row whenever a recipe is opened.
  // State is only set inside .then(), never synchronously in the effect body.
  // This must stay above the `if (viewingRecipe)` early return below,
  // because hooks can't be called after a conditional return.
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

  // Derived during render, so there's nothing to reset when the recipe changes.
  // A stored result only counts if it belongs to the recipe being viewed.
  const resultIsCurrent =
    viewingRecipe !== null && recipeResult?.id === viewingRecipe.id;
  const recipeLoading = viewingRecipe !== null && !resultIsCurrent;
  const recipeData = resultIsCurrent ? recipeResult.data : null;
  const recipeError = resultIsCurrent ? recipeResult.error : null;

  // Returns the value if it's an array, otherwise an empty list.
  const asList = (value) => (Array.isArray(value) ? value : []);

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
                    {(Array.isArray(recipeData.ingredients)
                      ? recipeData.ingredients
                      : []
                    ).map((ingredient) => (
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

                  {Array.isArray(recipeData.instructions) &&
                  recipeData.instructions.length > 0 ? (
                    <ol className="recipe-instructions">
                      {recipeData.instructions.map((step, index) => (
                        <li key={`${index}-${step}`}>
                          <span>{index + 1}</span>
                          <p>{step}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="subtitle">
                      Instructions coming soon! Your ingredients are
                      ready, so you're halfway to dinner.
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

        <div className="student-label">Account</div>
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