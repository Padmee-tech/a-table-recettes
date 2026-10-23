(() => {
  const recipes = window.RECIPES;
  const completeRecipes = recipes.filter(recipe => recipe.status === "complete");
  const moodLabels = {
    frais: "Quelque chose de frais",
    reconfortant: "Un plat qui réconforte",
    rapide: "Quelque chose de rapide",
    leger: "Un repas léger",
    genereux: "Un plat généreux"
  };

  const load = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  };

  const state = {
    mood: load("atable-mood", "frais"),
    selected: new Set(load("atable-selected", [])),
    checked: new Set(load("atable-checked", [])),
    suggestions: []
  };

  const suggestionList = document.querySelector("#suggestion-list");
  const collectionList = document.querySelector("#collection-list");
  const selectedMeals = document.querySelector("#selected-meals");
  const shoppingContent = document.querySelector("#shopping-content");
  const dialog = document.querySelector("#recipe-dialog");
  const dialogContent = document.querySelector("#dialog-content");
  const toast = document.querySelector("#toast");
  let toastTimer;

  const save = () => {
    localStorage.setItem("atable-mood", JSON.stringify(state.mood));
    localStorage.setItem("atable-selected", JSON.stringify([...state.selected]));
    localStorage.setItem("atable-checked", JSON.stringify([...state.checked]));
  };

  const escapeHtml = value => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  const showToast = message => {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  };

  const recipeById = id => recipes.find(recipe => recipe.id === id);

  const shuffle = items => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const random = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[random]] = [copy[random], copy[index]];
    }
    return copy;
  };

  const pickSuggestions = () => {
    const matching = shuffle(completeRecipes.filter(recipe => recipe.moods.includes(state.mood)));
    const others = shuffle(completeRecipes.filter(recipe => !matching.includes(recipe)));
    state.suggestions = [...matching, ...others].slice(0, 3);
    renderSuggestions();
  };

  const cardTemplate = recipe => {
    const selected = state.selected.has(recipe.id);
    return `
      <article class="recipe-card" data-open="${recipe.id}" role="button" tabindex="0" aria-label="Voir ${escapeHtml(recipe.name)}">
        <div class="recipe-art ${recipe.color}">
          ${recipe.status === "base" ? '<span class="status-pill">À improviser</span>' : ""}
        </div>
        <div class="card-copy">
          <h3>${escapeHtml(recipe.name)}</h3>
          <p>${escapeHtml(recipe.description)}</p>
          <div class="card-meta"><span>${escapeHtml(recipe.time)}</span><span>${escapeHtml(recipe.servings)}</span>${recipe.oven ? "<span>Four</span>" : ""}</div>
        </div>
        <button class="card-action ${selected ? "selected" : ""}" data-toggle="${recipe.id}" aria-label="${selected ? "Retirer" : "Ajouter"} ${escapeHtml(recipe.name)}">${selected ? "✓" : "+"}</button>
      </article>`;
  };

  const renderSuggestions = () => {
    suggestionList.innerHTML = state.suggestions.map(cardTemplate).join("");
  };

  const renderCollection = (filter = document.querySelector(".collection-tab.active")?.dataset.filter || "all") => {
    const visible = filter === "all" ? recipes : recipes.filter(recipe => filter === "oven" ? recipe.oven : recipe.status === filter);
    collectionList.hidden = filter === "ideas";
    collectionList.innerHTML = visible.map(cardTemplate).join("");
    document.querySelector("#idea-sections").hidden = !["all", "ideas"].includes(filter);
  };

  const renderIdeas = () => {
    const rows = items => items.map((idea, index) => `
      <div class="idea-item"><span class="idea-number">${String(index + 1).padStart(2, "0")}</span><span>${escapeHtml(idea)}</span></div>
    `).join("");
    document.querySelector("#meal-ideas").innerHTML = rows(window.IDEAS);
    document.querySelector("#indian-ideas").innerHTML = rows(window.INDIAN_IDEAS);
  };

  const selectedRecipes = () => [...state.selected].map(recipeById).filter(Boolean);

  const renderSelected = () => {
    const selected = selectedRecipes();
    if (!selected.length) {
      selectedMeals.innerHTML = `
        <div class="empty-state">
          <h2>Ta table est encore libre.</h2>
          <p>Choisis une envie et ajoute les recettes qui te tentent. Elles apparaîtront ici avant de devenir ta liste de courses.</p>
          <button class="primary-button" data-view="suggestions">Trouver des idées</button>
        </div>`;
      return;
    }

    selectedMeals.innerHTML = `
      <div class="selected-list">
        ${selected.map(recipe => `
          <article class="selected-row">
            <div class="recipe-art selected-art ${recipe.color}" data-open="${recipe.id}" role="button" tabindex="0" aria-label="Voir ${escapeHtml(recipe.name)}"></div>
            <div class="selected-copy">
              <h3>${escapeHtml(recipe.name)}</h3>
              <span>${escapeHtml(recipe.time)} · ${escapeHtml(recipe.servings)}</span>
            </div>
            <div class="meal-actions">
              <button class="remove-meal" data-toggle="${recipe.id}" aria-label="Retirer ${escapeHtml(recipe.name)}">×</button>
            </div>
          </article>`).join("")}
      </div>
      <div class="meals-footer">
        <p><strong>${selected.length} ${selected.length > 1 ? "repas choisis" : "repas choisi"}</strong><br>Les ingrédients sont prêts à être regroupés.</p>
        <button class="primary-button" data-view="shopping">Préparer les courses</button>
      </div>`;
  };

  const shoppingData = () => {
    const ingredients = new Map();
    selectedRecipes().forEach(recipe => {
      recipe.ingredients.forEach(([amount, name, category]) => {
        const key = name.toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
        if (!ingredients.has(key)) ingredients.set(key, { key, name, category, details: [] });
        ingredients.get(key).details.push(`${amount ? `${amount} · ` : ""}${recipe.name}`);
      });
    });
    return [...ingredients.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  };

  const renderShopping = () => {
    const ingredients = shoppingData();
    if (!ingredients.length) {
      shoppingContent.innerHTML = `
        <div class="empty-state">
          <h2>Il manque les repas.</h2>
          <p>Ajoute d’abord les recettes que tu veux cuisiner. Leurs ingrédients seront automatiquement réunis ici.</p>
          <button class="primary-button" data-view="suggestions">Choisir mes repas</button>
        </div>`;
      return;
    }

    const validKeys = new Set(ingredients.map(item => item.key));
    state.checked = new Set([...state.checked].filter(key => validKeys.has(key)));
    const categories = ["Fruits et légumes", "Produits frais", "Épicerie", "Placard"];
    const checkedCount = ingredients.filter(item => state.checked.has(item.key)).length;
    const progress = Math.round((checkedCount / ingredients.length) * 100);

    shoppingContent.innerHTML = `
      <div class="shopping-groups">
        <div class="shopping-progress">
          <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
          <span>${checkedCount}/${ingredients.length} cochés</span>
        </div>
        ${categories.map(category => {
          const items = ingredients.filter(item => item.category === category);
          if (!items.length) return "";
          return `<section class="shopping-group">
            <h2>${category}</h2>
            ${items.map(item => {
              const checked = state.checked.has(item.key);
              return `<label class="shopping-item ${checked ? "checked" : ""}">
                <input type="checkbox" data-ingredient="${item.key}" ${checked ? "checked" : ""}>
                <span><strong>${escapeHtml(item.name)}</strong><small>${item.details.map(escapeHtml).join("<br>")}</small></span>
              </label>`;
            }).join("")}
          </section>`;
        }).join("")}
      </div>`;
    save();
  };

  const updateCounts = () => {
    document.querySelectorAll("[data-meal-count]").forEach(element => {
      element.textContent = state.selected.size;
      element.hidden = state.selected.size === 0;
    });
  };

  const renderAll = () => {
    renderSuggestions();
    renderCollection();
    renderSelected();
    renderShopping();
    updateCounts();
  };

  const toggleRecipe = id => {
    const recipe = recipeById(id);
    if (!recipe) return;
    if (state.selected.has(id)) {
      state.selected.delete(id);
      showToast(`${recipe.name} retiré`);
    } else {
      state.selected.add(id);
      showToast(`${recipe.name} ajouté à tes repas`);
    }
    save();
    renderAll();
    if (dialog.open) renderDialog(recipe);
  };

  const renderDialog = recipe => {
    const selected = state.selected.has(recipe.id);
    dialogContent.innerHTML = `
      <div class="recipe-art dialog-art ${recipe.color}"></div>
      <div class="dialog-body">
        <p class="eyebrow">${recipe.status === "complete" ? "Recette complète" : "Base à improviser"}</p>
        <h2 id="dialog-title">${escapeHtml(recipe.name)}</h2>
        <p class="dialog-description">${escapeHtml(recipe.description)}</p>
        <div class="dialog-meta"><span>${escapeHtml(recipe.time)}</span><span>${escapeHtml(recipe.servings)}</span>${recipe.oven ? "<span>Four nécessaire</span>" : ""}${recipe.moods.map(mood => `<span>${escapeHtml(mood === "reconfortant" ? "réconfortant" : mood === "leger" ? "léger" : mood)}</span>`).join("")}</div>
        <button class="primary-button dialog-add" data-toggle="${recipe.id}">${selected ? "Retirer de mes repas" : "Ajouter à mes repas"}</button>
        <div class="recipe-columns">
          <section>
            <h3>Ingrédients</h3>
            <ul class="ingredient-list">${recipe.ingredients.map(([amount, name]) => `<li>${amount ? `<strong>${escapeHtml(amount)}</strong> ` : ""}${escapeHtml(name)}</li>`).join("")}</ul>
          </section>
          <section>
            <h3>Préparation</h3>
            ${recipe.steps.length ? `<ol class="step-list">${recipe.steps.map(step => `<li>${escapeHtml(step)}</li>`).join("")}</ol>` : '<p class="dialog-description">La préparation reste à compléter dans ta collection.</p>'}
          </section>
        </div>
        ${recipe.note ? `<div class="recipe-note">${escapeHtml(recipe.note)}</div>` : ""}
        ${recipe.source ? `<a class="source-link" href="${recipe.source}" target="_blank" rel="noreferrer">Voir la source vidéo</a>` : ""}
      </div>`;
  };

  const openRecipe = id => {
    const recipe = recipeById(id);
    if (!recipe) return;
    renderDialog(recipe);
    dialog.showModal();
    document.body.style.overflow = "hidden";
  };

  const closeDialog = () => {
    dialog.close();
    document.body.style.overflow = "";
  };

  const showView = view => {
    document.querySelectorAll(".view").forEach(section => section.classList.toggle("active", section.id === `${view}-view`));
    document.querySelectorAll("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === view));
    if (view === "meals") renderSelected();
    if (view === "shopping") renderShopping();
    history.replaceState(null, "", `#${view}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  document.addEventListener("click", event => {
    const toggle = event.target.closest("[data-toggle]");
    if (toggle) {
      event.stopPropagation();
      toggleRecipe(toggle.dataset.toggle);
      return;
    }

    const viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      showView(viewButton.dataset.view);
      return;
    }

    const card = event.target.closest("[data-open]");
    if (card) openRecipe(card.dataset.open);
  });

  document.addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-open]")) {
      event.preventDefault();
      openRecipe(event.target.dataset.open);
    }
  });

  document.querySelectorAll(".mood").forEach(button => {
    button.classList.toggle("active", button.dataset.mood === state.mood);
    button.addEventListener("click", () => {
      state.mood = button.dataset.mood;
      document.querySelectorAll(".mood").forEach(item => item.classList.toggle("active", item === button));
      document.querySelector("#mood-title").textContent = moodLabels[state.mood];
      save();
      pickSuggestions();
    });
  });

  document.querySelector("#shuffle-button").addEventListener("click", pickSuggestions);

  document.querySelectorAll(".collection-tab").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".collection-tab").forEach(tab => tab.classList.toggle("active", tab === button));
      renderCollection(button.dataset.filter);
    });
  });

  shoppingContent.addEventListener("change", event => {
    if (!event.target.matches("[data-ingredient]")) return;
    if (event.target.checked) state.checked.add(event.target.dataset.ingredient);
    else state.checked.delete(event.target.dataset.ingredient);
    save();
    renderShopping();
  });

  document.querySelector("#clear-checks").addEventListener("click", () => {
    state.checked.clear();
    save();
    renderShopping();
  });

  document.querySelector("#dialog-close").addEventListener("click", closeDialog);
  dialog.addEventListener("click", event => { if (event.target === dialog) closeDialog(); });
  dialog.addEventListener("close", () => { document.body.style.overflow = ""; });

  document.querySelector("#mood-title").textContent = moodLabels[state.mood];
  renderIdeas();
  pickSuggestions();
  renderAll();

  const initialView = location.hash.slice(1);
  if (["suggestions", "recipes", "meals", "shopping"].includes(initialView)) showView(initialView);

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js");
  }
})();
