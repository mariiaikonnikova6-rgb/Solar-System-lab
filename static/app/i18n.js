export const LANGS = ["ua", "en"];

export const I18N = {
  ua: {
    observer: "Спостерігач",
    time: "Час",
    timeSpeed: "Швидкість",
    timeOffset: "Зсув (днів)",
    asteroidScale: "\u041c\u0430\u0441\u0448\u0442\u0430\u0431 \u0430\u0441\u0442\u0435\u0440\u043e\u0457\u0434\u0456\u0432",
    asteroidScaleValue: "\u041c\u0430\u0441\u0448\u0442\u0430\u0431",
    scaleMode: "\u0420\u0435\u0436\u0438\u043c \u043c\u0430\u0441\u0448\u0442\u0430\u0431\u0443",
    scaleVisual: "\u0412\u0456\u0437\u0443\u0430\u043b\u0456\u0437\u0430\u0446\u0456\u0439\u043d\u0438\u0439",
    scaleReal: "\u0420\u0435\u0430\u043b\u044c\u043d\u0438\u0439",
    scaleComfort: "\u0417\u0440\u0443\u0447\u043d\u0438\u0439 \u043c\u0430\u0441\u0448\u0442\u0430\u0431",
    layers: "Шари",
    sampleNote: "Вибірка: 5 000 астероїдів",
    planetOrbits: "Орбіти планет",
    planets: "Планети",
    mainbelt: "Головний пояс",
    neo: "NEO",
    trojans: "Троянці",
    comets: "Комети",
    play: "Пуск",
    pause: "Пауза",
    scrubHint: "Скрол днів навколо епохи",
    share: "Поділитись лінком",
    shareCopied: "Скопійовано",
    shareFailed: "Не вдалось",
    appName: "Solar System Lab",
    landingSlogan: "\u0422\u0432\u0456\u0439 \u0412\u0441\u0435\u0441\u0432\u0456\u0442 \u0443 \u0432\u0456\u043a\u043d\u0456 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430",
    landingEnter: "\u041f\u0435\u0440\u0435\u0439\u0442\u0438 \u0434\u043e \u0441\u0446\u0435\u043d\u0438",
    sidebarToggle: {
      hide: "Сховати бічну панель",
      show: "Показати бічну панель",
    },
    categories: {
      any: "Будь-яка",
      neo: "Навколоземні (NEO)",
      mainbelt: "Головний пояс",
      trojan: "Троянці",
      comet: "Комети",
      other: "Інше",
    },
    modes: {
      explore: "Огляд",
      random: "Випадковий",
      compare: "Порівняння",
      search: "Пошук астероїдів",
      kepler: "Лаб Кеплера",
    },
    observers: {
      sun: "Сонце (геліоцентр.)",
      earth: "Земля (геоцентр.)",
      follow: "Слідкувати за вибраним",
      free: "Вільний політ",
      fromPlanet: "Від планети…",
    },
    modePanels: {
      explore: "Планетарій: шари + вибірка",
      exploreHint: "Клікніть по точці астероїда, щоб вибрати.",
      randomTitle: "Випадковий об'єкт",
      compareTitle: "Порівняння категорій",
      searchTitle: "Пошук астероїдів та фокус",
      keplerTitle: "Лабораторія Кеплера",
    },
    random: {
      any: "Випадковий (будь-який)",
      neo: "Випадковий NEO",
      mainbelt: "Випадковий головний пояс",
      trojan: "Випадковий троянець",
      comet: "Випадкова комета",
      refine: "Уточнити ефемеридами",
    },
    compare: {
      run: "Згенерувати",
      normalize: "Нормалізувати масштаб",
      clamp: "Обмежити до 10 AU",
    },
    search: {
      placeholder: "Назва або ID…",
      go: "Перейти",
      follow: "Слідкувати",
      pin: "Закріпити інфо",
      add: "Додати у compare",
      empty: "Нічого не знайдено",
    },
    kepler: {
      body: "Тіло",
      k1: "Кеплер-1",
      k2: "Кеплер-2",
      k3: "Кеплер-3",
      exaggeration: "Експресія (i,e)",
    },
    hud: {
      category: "Клас",
      epoch: "Епоха",
      period: "Період (д)",
      a: "a (AU)",
      e: "e",
      i: "i (°)",
      q: "q (AU)",
      Q: "Q (AU)",
      H: "H",
    },
  },
  en: {
    observer: "Observer",
    time: "Time",
    timeSpeed: "Speed",
    timeOffset: "Offset (days)",
    asteroidScale: "Asteroid scale",
    asteroidScaleValue: "Scale",
    scaleMode: "Scale mode",
    scaleVisual: "Visualization",
    scaleReal: "Real scale",
    scaleComfort: "Comfort view",
    layers: "Layers",
    sampleNote: "Sample: 5,000 asteroids",
    planetOrbits: "Planet orbits",
    planets: "Planets",
    mainbelt: "Main-belt",
    neo: "NEO",
    trojans: "Trojans",
    comets: "Comets",
    play: "Play",
    pause: "Pause",
    scrubHint: "Scrub days around epoch",
    share: "Share link",
    shareCopied: "Copied",
    shareFailed: "Failed",
    appName: "Solar System Lab",
    landingSlogan: "Your universe in the browser window",
    landingEnter: "Enter the scene",
    sidebarToggle: {
      hide: "Hide sidebar",
      show: "Show sidebar",
    },
    categories: {
      any: "Any",
      neo: "NEO",
      mainbelt: "Main-belt",
      trojan: "Trojans",
      comet: "Comets",
      other: "Other",
    },
    modes: {
      explore: "Explore",
      random: "Random",
      compare: "Compare",
      search: "Asteroid Search",
      kepler: "Kepler Lab",
    },
    observers: {
      sun: "Sun (Heliocentric)",
      earth: "Earth (Geocentric)",
      follow: "Follow selected",
      free: "Free fly",
      fromPlanet: "From planet…",
    },
    modePanels: {
      explore: "Planetarium: layers + sample",
      exploreHint: "Click an asteroid point to select.",
      randomTitle: "Random object",
      compareTitle: "Category compare",
      searchTitle: "Asteroid search & focus",
      keplerTitle: "Kepler Lab",
    },
    random: {
      any: "Random (Any)",
      neo: "Random NEO",
      mainbelt: "Random Main-belt",
      trojan: "Random Trojan",
      comet: "Random Comet",
      refine: "Refine with ephemeris",
    },
    compare: {
      run: "Generate",
      normalize: "Normalize scale",
      clamp: "Clamp to 10 AU",
    },
    search: {
      placeholder: "Name or ID…",
      go: "Go to object",
      follow: "Follow",
      pin: "Pin info",
      add: "Add to compare",
      empty: "No results",
    },
    kepler: {
      body: "Body",
      k1: "Kepler-1",
      k2: "Kepler-2",
      k3: "Kepler-3",
      exaggeration: "Visual exaggeration (i,e)",
    },
    hud: {
      category: "Class",
      epoch: "Epoch",
      period: "Period (d)",
      a: "a (AU)",
      e: "e",
      i: "i (°)",
      q: "q (AU)",
      Q: "Q (AU)",
      H: "H",
    },
  },
};

export function getLangFromUrl() {
  const raw = new URLSearchParams(location.search).get("lang");
  if (raw && LANGS.includes(raw)) return raw;
  return "ua";
}

export function t(lang, keyPath) {
  const parts = keyPath.split(".");
  let cur = I18N[lang];
  for (const p of parts) {
    cur = cur?.[p];
  }
  return cur ?? keyPath;
}

export function categoryLabel(lang, categoryCode) {
  const labels = I18N[lang]?.categories;
  return labels?.[categoryCode] ?? categoryCode;
}
