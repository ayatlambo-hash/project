# AI Copilot v3 — Ultimate Edition

> Умный виджет-ассистент для любого сайта с Intent Layer и Action Engine

## Что нового в v3

| Функция | v2 | v3 |
|---|---|---|
| Читает страницу | ✅ | ✅ |
| История в localStorage | ✅ | ✅ |
| **Intent Layer** | ❌ | ✅ |
| **Action Engine** | ❌ | ✅ |
| **Smart Suggestions** | ❌ | ✅ |
| **Typing animation** | ❌ | ✅ |
| **Новый дизайн** | — | ✅ |

---

## Архитектура

```
Пользователь пишет вопрос
    → виджет читает страницу (текст + кнопки + цены)
    → отправляет на backend: {вопрос + контекст + история}
    → backend строит промпт с few-shot примерами
    → Groq (LLaMA 3.3 70B) генерирует JSON ответ
    → backend парсит: reply + intent + action + suggestions
    → виджет показывает ответ с анимацией
    → если есть action — выполняет на странице
    → обновляет индикатор намерения
```

---

## Быстрый старт

### 1. Установите зависимости

```bash
cd backend
pip install -r requirements.txt
```

### 2. Получите ключ Groq

1. Зайдите на https://console.groq.com
2. API Keys → Create Key
3. Скопируйте ключ (начинается с `gsk_...`)

### 3. Создайте .env файл

```bash
# в папке backend/
cp .env.example .env
# откройте .env и вставьте ключ
```

### 4. Запустите backend

```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```

### 5. Запустите демо-сайт (новый терминал)

```bash
cd ..  # в корень проекта
python -m http.server 3000
```

### 6. Откройте в браузере

http://localhost:3000/demo-site/

---

## Intent Layer

Виджет определяет намерение пользователя в реальном времени:

| Статус | Цвет | Значение |
|---|---|---|
| 🔵 Просматривает | Серый | Изучает страницу |
| 🟡 Интересуется | Жёлтый | Рассматривает покупку |
| 🟢 Готов купить | Зелёный мигающий | Высокий шанс конверсии |

---

## Action Engine

Бот может выполнять действия на странице:

- `click` — нажать кнопку (добавить в корзину, перейти)
- `scroll` — прокрутить к разделу
- `fill` — заполнить поле формы

Попробуйте написать: **"Добавь MacBook в корзину"**

---

## Интеграция на любой сайт

```html
<script src="путь/к/copilot.js" data-backend="http://ВАШ_СЕРВЕР:8000"></script>
```

---

## API Endpoints

### POST /chat

Основной чат с полным ответом.

```json
Request:
{
  "message": "Сколько стоит MacBook?",
  "page": {"url": "...", "title": "...", "text": "...", "buttons": [], "prices": []},
  "history": []
}

Response:
{
  "reply": "MacBook Air M2 стоит 489 000 ₸...",
  "intent": "interested",
  "action": null,
  "suggestions": ["Добавить в корзину", "Расскажи про рассрочку"]
}
```

### POST /suggestions

Умные подсказки на основе контента страницы.

### GET /

Health check.

---

## Промпт-инжиниринг

Промпт использует:
- **Context injection** — динамическая вставка контекста страницы
- **Constrained output** — JSON формат ответа
- **Few-shot examples** — 4 примера для стабильного поведения
- **Role + rules** — чёткая роль и правила поведения
- **Structured intent** — классификация намерения пользователя
