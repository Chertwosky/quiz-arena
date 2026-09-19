export const TEAM_COLORS = ["#e23d4a", "#2f7dff", "#1fbf73", "#f0a202", "#9b5de5"];

export const DEFAULT_MODIFIERS = [
  {
    id: "plain",
    name: "Обычный вопрос",
    description: "Стандартные правила. Стоимость вопроса без изменений.",
    multiplier: 1,
    kind: "plain",
  },
  {
    id: "no_captain",
    name: "Без капитана ×1.5",
    description: "Капитан молчит. Отвечает кто-то из остальных игроков команды.",
    multiplier: 1.5,
    kind: "no_captain",
  },
  {
    id: "captain_only",
    name: "Только капитан ×1.5",
    description: "Отвечает исключительно капитан команды.",
    multiplier: 1.5,
    kind: "captain_only",
  },
  {
    id: "double",
    name: "Двойная ставка ×2",
    description: "Верный ответ даёт удвоенные очки. Ошибка снимает удвоенную стоимость.",
    multiplier: 2,
    kind: "double",
  },
  {
    id: "all_in",
    name: "Ва-банк",
    description: "Команда ставит весь текущий счёт. Верно — удваивает счёт, ошибка — обнуляет.",
    multiplier: 1,
    kind: "all_in",
  },
  {
    id: "cat_bag",
    name: "Кот в мешке ×1.5",
    description: "Вопрос подменяется случайным несыгранным из другой темы.",
    multiplier: 1.5,
    kind: "cat_bag",
  },
  {
    id: "auction",
    name: "Аукцион",
    description: "Команды торгуются. Победитель играет на свою ставку вместо номинала.",
    multiplier: 1,
    kind: "auction",
  },
  {
    id: "pass",
    name: "Пас сопернику ×1.5",
    description: "Вопрос передаётся другой команде. Она играет на полуторную стоимость.",
    multiplier: 1.5,
    kind: "pass",
  },
  {
    id: "all_teams",
    name: "Все команды ×1",
    description: "После оглашения вопроса каждая команда отвечает отдельно.",
    multiplier: 1,
    kind: "all_teams",
  },
  {
    id: "no_error",
    name: "Без права на ошибку ×1.5",
    description: "Верный ответ — ×1.5. Ошибка снимает ×2 от номинала.",
    multiplier: 1.5,
    wrongMultiplier: 2,
    kind: "no_error",
  },
];

function q(value, prompt, answer, comment = "") {
  return {
    id: crypto.randomUUID(),
    value,
    prompt,
    answer,
    comment,
    media: { image: null, audio: null, video: null },
    answerMedia: { image: null, audio: null, video: null },
  };
}

function category(name, questions) {
  return { id: crypto.randomUUID(), name, questions };
}

export function createDemoPack() {
  return {
    id: "demo-general",
    createdAt: Date.now(),
    branding: {
      kicker: "Вечер интеллектуальной игры",
      title: "Своя игра",
      subtitle: "Пакет «Общий кругозор» — пять тем, классическая сетка и модификаторы ставки.",
      welcome: "Соберитесь у одного экрана. Ведущий открывает вопросы, команды спорят за право ответа.",
      hostName: "Ведущий",
      buttonLabel: "Войти в игру",
      pin: "",
      logoText: "QA",
      backgroundImage: "",
    },
    theme: {
      background: "#07111f",
      panel: "#10284a",
      gold: "#f0c75e",
      accent: "#4cc9f0",
      text: "#f6f1e3",
    },
    categories: [
      category("Кино и сериалы", [
        q(100, "Как зовут капитана «Чёрной жемчужины» в первой части «Пиратов Карибского моря»?", "Джек Воробей", "Играет Джонни Депп."),
        q(200, "В каком фильме звучит фраза «Я буду обратно» — I'll be back?", "Терминатор", "1984 год, Джеймс Кэмерон."),
        q(300, "Как называется вымышленный континент в «Игре престолов», где находится Вестерос напротив?", "Эссос"),
        q(400, "Кто режиссёр фильма «Паразиты», получившего «Оскар» за лучший фильм?", "Пон Чжун Хо"),
        q(500, "Какой фильм Стэнли Кубрика снят по роману Энтони Бёрджесса?", "Заводной апельсин", "A Clockwork Orange, 1971."),
      ]),
      category("История", [
        q(100, "В каком году произошла Октябрьская революция в России?", "1917"),
        q(200, "Как звали жену Наполеона Бонапарта, императрицу французов?", "Жозефина"),
        q(300, "Какой город был столицей Византийской империи?", "Константинополь", "Ныне Стамбул."),
        q(400, "Кто возглавлял экспедицию, первой достигшую Южного полюса?", "Руаль Амундсен", "1911 год, опередил Скотта."),
        q(500, "Как назывался мирный договор, завершивший Первую мировую войну для Германии?", "Версальский договор", "1919 год."),
      ]),
      category("Наука", [
        q(100, "Химический символ золота?", "Au"),
        q(200, "Как называется ближайшая к Солнцу планета?", "Меркурий"),
        q(300, "Кто сформулировал три закона движения, лежащие в основе классической механики?", "Исаак Ньютон"),
        q(400, "Как называется процесс, в котором растения превращают свет в химическую энергию?", "Фотосинтез"),
        q(500, "Какая частица переносит электрический заряд в атоме и определяет химические свойства?", "Электрон", "Именно электроны внешних оболочек."),
      ]),
      category("Спорт", [
        q(100, "Сколько игроков одной команды одновременно на поле в футболе?", "11"),
        q(200, "В каком виде спорта используют термины «страйк», «бол» и «хоум-ран»?", "Бейсбол"),
        q(300, "Сколько очков даёт «трехочковый» бросок в баскетболе?", "3"),
        q(400, "В каком городе прошли летние Олимпийские игры 1980 года?", "Москва"),
        q(500, "Как называется удар в теннисе, выполняемый над головой после свечи соперника?", "Смэш", "Также принимают «удар над головой»."),
      ]),
      category("Музыка", [
        q(100, "Сколько струн у классической гитары?", "6"),
        q(200, "Кто написал «Лунную сонату»?", "Людвиг ван Бетховен"),
        q(300, "Как называется самый высокий женский оперный голос?", "Сопрано"),
        q(400, "Какая британская группа записала альбом «The Dark Side of the Moon»?", "Pink Floyd"),
        q(500, "Как зовут композитора оперы «Кармен»?", "Жорж Бизе"),
      ]),
    ],
    modifiers: DEFAULT_MODIFIERS.map((m) => ({ ...m, id: m.id })),
  };
}

export function emptyPack() {
  const values = [100, 200, 300, 400, 500];
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    branding: {
      kicker: "Новая игра",
      title: "Без названия",
      subtitle: "Опишите вечер и настроение на экране входа.",
      welcome: "Добавьте темы и вопросы в админке, затем соберите команды.",
      hostName: "Ведущий",
      buttonLabel: "Начать",
      pin: "",
      logoText: "QA",
      backgroundImage: "",
    },
    theme: {
      background: "#07111f",
      panel: "#10284a",
      gold: "#f0c75e",
      accent: "#4cc9f0",
      text: "#f6f1e3",
    },
    categories: Array.from({ length: 5 }, (_, i) =>
      category(`Тема ${i + 1}`, values.map((value) => q(value, "", "", "")))
    ),
    modifiers: DEFAULT_MODIFIERS.map((m) => ({ ...m })),
  };
}

export function clonePack(pack) {
  const copy = structuredClone(pack);
  copy.id = crypto.randomUUID();
  copy.createdAt = Date.now();
  copy.branding = {
    ...copy.branding,
    title: `${copy.branding.title} (копия)`,
  };
  copy.categories.forEach((cat) => {
    cat.id = crypto.randomUUID();
    cat.questions.forEach((question) => {
      question.id = crypto.randomUUID();
    });
  });
  copy.modifiers.forEach((mod) => {
    if (!mod.id) mod.id = crypto.randomUUID();
  });
  return copy;
}
