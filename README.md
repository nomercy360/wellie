# Wellie

## Project Overview

### 1. Онбординг-квиз

1. Спрашиваем текущий вес, рост, пол, и процент жира.
2. Спрашиваем что человек хочет (похудеть, набрать массу, поддерживать вес). Если похудеть или набрать вес то как
   быстро (быстро, оптимально, медленно).
3. Спрашиваем текущий уровень активности в неделю даем несколько каунтеров потыкать
   а) ходьба (километры)
   б) бег (километры)
   в) единоборства (часы)
   г) плаванье (километры)
   д) велосипед (километры)
   е) зал или калистетиника (часы)

### 2. Процесс

1. Из этих показателей рассчитываем кол-во калорий, белков, жиров, и углеводов на день и приблизительно даем отрезок (
   например 60 дней на то, чтобы похудеть)
2. По фотографии или штрих-коду продукта распознаем микро и макро-нутриенты и даем пользователю вести журнал каллорий.
3. Так же даем добавлять текущий вес каждый день. Раз в неделю напоминаем об этом.
4. Исходя из того какой вес добавляет пользователь, раз в неделю изменяем кол-во каллорий на день. Так как у всех разный
   метаболизм, важно следить за весом.
5. Когда 60 дней проходит — переводим из режима похудения на режим поддержания веса и даем возможность поставить новую
   цель.

## Architecture

- **cmd/api/main.go**: Entry point that initializes the server, connects to the database, and sets up routes
- **internal/db**: Database layer for user management and other data operations
- **internal/handlers**: Request handlers for the HTTP API and Telegram bot
- **internal/middleware**: Echo middleware configuration for logging, auth, and more
- **internal/contract**: Data structures and interfaces for the requests and responses with validation function, DTO
  interfaces between storage and handlers

## Key Components

- **Echo Framework**: HTTP server and routing
- **SQLite**: Database backend
- **Telegram Bot API**: Integration with Telegram
- **JWT**: Authentication for API endpoints
- **SolidJS**: Frontend framework for the telegram miniapp

## Important Notes

- Comments are added only when the code's purpose isn't obvious - not meta-comments that merely rephrase the function
  name that's already clear from the code.